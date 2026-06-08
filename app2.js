const PAGE_LOADERS = {
  clientes: carregarClientes,
  veiculos: carregarVeiculos,
  os: carregarOS,
  servicos: carregarServicos,
  pecas: carregarPecas,
  dashboard: carregarDashboard,
  rh: carregarRH,
  fornecedores: carregarFornecedores,
  receber: carregarReceber,
  pagar: carregarPagar,
  bancario: carregarBancario,
  fluxo: carregarFluxo,
  dre: carregarDRE,
  precificacao: iniciarPrecificacao,
  config: carregarConfig,
};

const fmtN=(v,d=2)=>(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const MESES_PT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ============================================================
// OS COMPLETA — EDIÇÃO, ORÇAMENTO E PDF
// ============================================================
let osAtual = null;
let orcItens = { 1: [], 2: [] };
let orcStatus = { 1: 'pendente', 2: 'vazio' };
let osServicos = [], osPecas = [];

const STATUS_STEPS = [
  { key:'orc',        label:'Orçamento',    icon:'ti-file-text' },
  { key:'aguardando', label:'Ag. Peça',     icon:'ti-package' },
  { key:'andamento',  label:'Em andamento', icon:'ti-tool' },
  { key:'finalizado', label:'Finalizado',   icon:'ti-check' },
  { key:'entregue',   label:'Entregue',     icon:'ti-car' },
  { key:'quitado',    label:'Quitado',      icon:'ti-currency-dollar' },
];

async function abrirOSEdit(id) {
  const os = osTodos.find(o => o.id === id);
  if (!os) return;
  osAtual = { ...os };

  // Carrega catálogos para os selects
  const [{ data: svcs }, { data: pecs }] = await Promise.all([
    db.from('servicos').select('id,nome,horas_previstas,markup').eq('oficina_id', APP.oficina.id).eq('status', 'Ativo'),
    db.from('pecas').select('id,nome,custo_medio,unidade').eq('oficina_id', APP.oficina.id),
  ]);
  osServicos = svcs || [];
  osPecas = pecs || [];

  // Popula header
  document.getElementById('os-edit-title').textContent = os.numero + ' — ' + (os.tipo === 'orc' ? 'Orçamento' : 'OS');
  document.getElementById('os-edit-sub').textContent = (os.clientes?.nome || '—') + ' · ' + (os.veiculos?.placa || '—') + ' ' + (os.veiculos?.modelo || '');

  // Popula dados
  document.getElementById('ose-cliente').value = os.clientes?.nome || '—';
  document.getElementById('ose-veiculo').value = (os.veiculos?.placa || '') + ' ' + (os.veiculos?.marca || '') + ' ' + (os.veiculos?.modelo || '');
  document.getElementById('ose-km').value = os.km_entrada || '';
  document.getElementById('ose-queixa').value = os.queixa || '';
  document.getElementById('ose-previsao').value = os.data_previsao || '';

  // Select mecânico
  const selMec = document.getElementById('ose-mec');
  selMec.innerHTML = '<option value="">Selecionar...</option>';
  APP.funcionarios.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id; opt.textContent = f.nome;
    if (f.id === os.funcionario_id) opt.selected = true;
    selMec.appendChild(opt);
  });

  // Select forma pagamento
  const selForma = document.getElementById('ose-forma');
  ['PIX','Dinheiro','Cartão débito','Cartão crédito','Boleto'].forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    if (f === os.forma_pagamento) opt.selected = true;
    selForma.appendChild(opt);
  });

  // Barra de status
  renderStatusBar(os.status);

  // Carrega itens dos orçamentos
  await carregarItensOrc(os.id);

  // Abre na aba dados
  switchOSTab('dados', document.querySelector('#modal-os-edit .m-tab'));
  openModal('os-edit');
}

function renderStatusBar(statusAtual) {
  const bar = document.getElementById('os-status-bar');
  const idx = STATUS_STEPS.findIndex(s => s.key === statusAtual);
  bar.innerHTML = STATUS_STEPS.map((s, i) => `
    <div class="os-status-step ${i < idx ? 'concluido' : i === idx ? 'ativo' : ''}"
         onclick="mudarStatusOS('${s.key}')">
      <i class="ti ${s.icon}" style="font-size:13px;display:block;margin-bottom:2px"></i>
      ${s.label}
    </div>`).join('');
}

async function mudarStatusOS(novoStatus) {
  if (!osAtual) return;
  if (!confirm(`Mudar status para "${STATUS_STEPS.find(s=>s.key===novoStatus)?.label}"?`)) return;
  const { error } = await db.from('ordens_servico').update({ status: novoStatus }).eq('id', osAtual.id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  osAtual.status = novoStatus;
  // Atualiza na lista local
  const idx = osTodos.findIndex(o => o.id === osAtual.id);
  if (idx >= 0) osTodos[idx].status = novoStatus;
  renderStatusBar(novoStatus);
  renderOS();
  await carregarDashboard();
  toast('Status atualizado!', 'success');
}

function switchOSTab(tab, el) {
  ['dados','orc1','orc2'].forEach(t => {
    document.getElementById('os-tab-' + t).style.display = 'none';
  });
  document.querySelectorAll('#modal-os-edit .m-tab').forEach(t => {
    t.style.color = 'var(--text-3)';
    t.style.borderBottomColor = 'transparent';
  });
  document.getElementById('os-tab-' + tab).style.display = 'block';
  if (el) { el.style.color = 'var(--navy)'; el.style.borderBottomColor = 'var(--navy)'; }
}

// ITENS DO ORÇAMENTO
async function carregarItensOrc(osId) {
  orcItens = { 1: [], 2: [] };
  orcStatus = { 1: 'pendente', 2: 'vazio' };

  const { data: orcs } = await db.from('orcamentos').select('*,orcamento_itens(*)').eq('os_id', osId);
  (orcs || []).forEach(orc => {
    const n = orc.numero;
    if (n === 1 || n === 2) {
      orcStatus[n] = orc.status;
      orcItens[n] = (orc.orcamento_itens || []).map(item => ({
        id: item.id, orcId: orc.id, tipo: item.tipo,
        descricao: item.descricao, quantidade: item.quantidade,
        custo: item.valor_unitario, preco: item.valor_total / item.quantidade,
        servicoId: item.servico_id, pecaId: item.peca_id,
      }));
    }
  });

  renderItensOrc(1);
  renderItensOrc(2);
}

function renderItensOrc(n) {
  const wrap = document.getElementById('orc' + n + '-itens');
  const statusBadge = document.getElementById('orc' + n + '-status-badge');
  const aprovBtn = document.getElementById('orc' + n + '-aprovar-btn');

  // Status badge
  const st = orcStatus[n];
  const stMap = {
    pendente: { l:'Pendente', bg:'var(--warning-bg)', c:'var(--warning)' },
    aprovado: { l:'Aprovado ✅', bg:'var(--success-bg)', c:'var(--success)' },
    reprovado: { l:'Reprovado ❌', bg:'var(--danger-bg)', c:'var(--danger)' },
    vazio: { l:'Não preenchido', bg:'var(--surface-3)', c:'var(--text-3)' },
  };
  const stStyle = stMap[st] || stMap.pendente;
  statusBadge.textContent = stStyle.l;
  statusBadge.style.background = stStyle.bg;
  statusBadge.style.color = stStyle.c;
  if (aprovBtn) aprovBtn.style.display = st === 'aprovado' ? 'none' : 'inline-flex';

  if (orcItens[n].length === 0) {
    wrap.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-3);font-size:12px">Nenhum item adicionado. Use os botões abaixo.</div>`;
    atualizarTotalOrc(n);
    return;
  }

  wrap.innerHTML = orcItens[n].map((item, i) => {
    const custo = item.custo || 0;
    const preco = item.preco || 0;
    const qtd = item.quantidade || 1;
    const totalPreco = preco * qtd;
    const totalCusto = custo * qtd;
    const lucro = totalPreco - totalCusto;
    const margem = totalPreco > 0 ? (lucro / totalPreco * 100) : 0;
    const lucroCls = lucro >= 0 ? 'lucro-pos' : 'lucro-neg';
    const tipoBadge = item.tipo === 'Serviço' ? '🔧' : item.tipo === 'Peça' ? '📦' : '📝';
    return `<div class="orc-item">
      <div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:2px">${tipoBadge} ${item.tipo}</div>
        <div style="font-size:13px;font-weight:500;color:var(--navy)">${item.descricao}</div>
      </div>
      <input class="form-input" type="number" value="${qtd}" min="0.5" step="0.5"
             style="font-size:12px;padding:5px 8px;text-align:center"
             onchange="updateItemOrc(${n},${i},'quantidade',this.value)">
      <div style="font-size:12px;color:var(--text-3);text-align:center">${fmtMoeda(custo)}</div>
      <input class="form-input" type="number" value="${preco.toFixed(2)}" step="0.01" min="0"
             style="font-size:12px;padding:5px 8px;text-align:center;font-weight:500"
             onchange="updateItemOrc(${n},${i},'preco',this.value)">
      <div>
        <div style="font-size:12px;font-weight:500;color:${lucro>=0?'var(--success)':'var(--danger)'};text-align:center">${fmtMoeda(lucro)}</div>
        <div style="font-size:10px;color:var(--text-3);text-align:center">${margem.toFixed(1)}%</div>
      </div>
      <button class="action-btn" onclick="removeItemOrc(${n},${i})" style="color:var(--danger)"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');

  atualizarTotalOrc(n);
}

function atualizarTotalOrc(n) {
  const total = orcItens[n].reduce((a, item) => a + ((item.preco || 0) * (item.quantidade || 1)), 0);
  const custo = orcItens[n].reduce((a, item) => a + ((item.custo || 0) * (item.quantidade || 1)), 0);
  const lucro = total - custo;
  const margem = total > 0 ? (lucro / total * 100) : 0;
  document.getElementById('orc' + n + '-total').innerHTML = `
    <div>
      <div style="font-size:12px;color:rgba(255,255,255,0.6)">Total do orçamento</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px">Custo: ${fmtMoeda(custo)} · Lucro: ${fmtMoeda(lucro)} (${margem.toFixed(1)}%)</div>
    </div>
    <span style="font-size:20px;font-weight:500;color:#fff">${fmtMoeda(total)}</span>`;
}

function updateItemOrc(n, i, campo, val) {
  orcItens[n][i][campo] = parseFloat(val) || 0;
  atualizarTotalOrc(n);
}

function removeItemOrc(n, i) {
  orcItens[n].splice(i, 1);
  if (orcItens[n].length === 0 && n === 2) orcStatus[2] = 'vazio';
  renderItensOrc(n);
}

function addItemOrc(n, tipo) {
  const tipoLabel = tipo === 'servico' ? 'Serviço' : tipo === 'peca' ? 'Peça' : 'Outro';

  // Abre modal de seleção bonito
  orcSelecionandoN = n;
  orcSelecionandoTipo = tipo;
  abrirModalSeletor(tipo);
}

// MODAL SELETOR DE ITENS
let orcSelecionandoN = 1;
let orcSelecionandoTipo = 'servico';

function abrirModalSeletor(tipo) {
  const modal = document.getElementById('modal-seletor');
  const titulo = document.getElementById('seletor-titulo');
  const busca = document.getElementById('seletor-busca');

  if (tipo === 'outro') {
    const desc = window.prompt('Descrição do item:');
    if (!desc) return;
    const tipoLabel = 'Outro';
    orcItens[orcSelecionandoN].push({ tipo: tipoLabel, descricao: desc, quantidade: 1, custo: 0, preco: 0 });
    if (orcSelecionandoN === 2 && orcStatus[2] === 'vazio') orcStatus[2] = 'pendente';
    renderItensOrc(orcSelecionandoN);
    return;
  }

  titulo.textContent = tipo === 'servico' ? '🔧 Selecionar Serviço' : '📦 Selecionar Peça';
  busca.value = '';
  renderListaSeletor('');
  modal.classList.add('open');
  busca.focus();
}

function renderListaSeletor(filtro) {
  const tipo = orcSelecionandoTipo;
  const lista = tipo === 'servico' ? osServicos : osPecas;
  const wrap = document.getElementById('seletor-lista');
  const f = filtro.toLowerCase();

  const filtrados = lista.filter(item =>
    !f || item.nome?.toLowerCase().includes(f)
  );

  if (filtrados.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-3);font-size:13px">Nenhum item encontrado</div>`;
    return;
  }

  if (tipo === 'servico') {
    const custoHora = 64.77;
    wrap.innerHTML = filtrados.map(s => {
      const custo = (s.horas_previstas || 1) * custoHora;
      const preco = custo * (1 + (s.markup || 60) / 100);
      return `<div onclick="selecionarItemOrc('svc','${s.id}')"
        style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s;"
        onmouseover="this.style.background='var(--blue-bg)'" onmouseout="this.style.background=''">
        <div>
          <div style="font-weight:500;color:var(--navy)">${s.nome}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">${s.categoria} · ${s.horas_previstas}h · Dif: ${s.dificuldade}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px">
          <div style="font-size:11px;color:var(--text-3)">Custo: R$ ${custo.toFixed(2)}</div>
          <div style="font-weight:600;color:var(--success);font-size:13px">R$ ${preco.toFixed(2)}</div>
        </div>
      </div>`;
    }).join('');
  } else {
    wrap.innerHTML = filtrados.map(p => {
      const custo = p.custo_medio || 0;
      const preco = custo > 0 ? custo / (1 - 0.55) : 0;
      const estoqueColor = p.estoque_atual === 0 ? 'var(--danger)' : p.estoque_atual <= p.estoque_minimo ? 'var(--warning)' : 'var(--success)';
      return `<div onclick="selecionarItemOrc('pec','${p.id}')"
        style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s;"
        onmouseover="this.style.background='var(--blue-bg)'" onmouseout="this.style.background=''">
        <div>
          <div style="font-weight:500;color:var(--navy)">${p.nome}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">${p.categoria} · Ref: ${p.referencia || '—'}</div>
          <div style="font-size:11px;margin-top:2px;font-weight:500;color:${estoqueColor}">Estoque: ${p.estoque_atual} ${p.unidade}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px">
          <div style="font-size:11px;color:var(--text-3)">Custo: R$ ${custo.toFixed(2)}</div>
          <div style="font-weight:600;color:var(--success);font-size:13px">R$ ${preco.toFixed(2)}</div>
        </div>
      </div>`;
    }).join('');
  }
}

function selecionarItemOrc(tipo, id) {
  const n = orcSelecionandoN;
  if (tipo === 'svc') {
    const s = osServicos.find(x => x.id === id);
    if (!s) return;
    const custoHora = 64.77;
    const custo = (s.horas_previstas || 1) * custoHora;
    const preco = custo * (1 + (s.markup || 60) / 100);
    orcItens[n].push({ tipo:'Serviço', descricao:s.nome, quantidade:s.horas_previstas||1, custo, preco, servicoId:s.id });
  } else {
    const p = osPecas.find(x => x.id === id);
    if (!p) return;
    const custo = p.custo_medio || 0;
    const preco = custo > 0 ? custo / (1 - 0.55) : 0;
    orcItens[n].push({ tipo:'Peça', descricao:p.nome, quantidade:1, custo, preco, pecaId:p.id });
  }
  if (n === 2 && orcStatus[2] === 'vazio') orcStatus[2] = 'pendente';
  closeModal('seletor');
  renderItensOrc(n);

function aprovarOrc(n) {
  orcStatus[n] = 'aprovado';
  renderItensOrc(n);
  toast('Orçamento ' + n + ' aprovado!', 'success');
}

function reprovarOrc(n) {
  orcStatus[n] = 'reprovado';
  renderItensOrc(n);
  toast('Orçamento ' + n + ' reprovado.', 'error');
}

async function salvarOSEdit() {
  if (!osAtual) return;

  // Salva dados da OS
  const { error } = await db.from('ordens_servico').update({
    funcionario_id: document.getElementById('ose-mec').value || null,
    forma_pagamento: document.getElementById('ose-forma').value,
    km_entrada: parseInt(document.getElementById('ose-km').value) || 0,
    queixa: document.getElementById('ose-queixa').value,
    data_previsao: document.getElementById('ose-previsao').value || null,
  }).eq('id', osAtual.id);

  if (error) { toast('Erro: ' + error.message, 'error'); return; }

  // Salva/atualiza orçamentos
  for (const n of [1, 2]) {
    if (n === 2 && orcStatus[2] === 'vazio') continue;
    if (orcItens[n].length === 0 && n === 2) continue;

    // Verifica se já existe orçamento
    const { data: orcExist } = await db.from('orcamentos').select('id').eq('os_id', osAtual.id).eq('numero', n);
    let orcId;

    if (orcExist && orcExist.length > 0) {
      orcId = orcExist[0].id;
      // Atualiza status
      await db.from('orcamentos').update({
        status: orcStatus[n],
        total: orcItens[n].reduce((a, item) => a + ((item.preco || 0) * (item.quantidade || 1)), 0),
      }).eq('id', orcId);
      // Remove itens antigos
      await db.from('orcamento_itens').delete().eq('orcamento_id', orcId);
    } else {
      // Cria novo orçamento
      const { data: newOrc } = await db.from('orcamentos').insert({
        os_id: osAtual.id, numero: n,
        titulo: n === 1 ? 'Problema relatado' : 'Preventivo',
        status: orcStatus[n],
        total: orcItens[n].reduce((a, item) => a + ((item.preco || 0) * (item.quantidade || 1)), 0),
      }).select();
      orcId = newOrc?.[0]?.id;
    }

    // Insere itens
    if (orcId && orcItens[n].length > 0) {
      const itensInsert = orcItens[n].map(item => ({
        orcamento_id: orcId,
        tipo: item.tipo,
        descricao: item.descricao,
        servico_id: item.servicoId || null,
        peca_id: item.pecaId || null,
        quantidade: item.quantidade,
        valor_unitario: item.custo,
        valor_total: (item.preco || 0) * (item.quantidade || 1),
      }));
      await db.from('orcamento_itens').insert(itensInsert);
    }
  }

  // Atualiza total da OS
  const totalOrc1 = orcItens[1].reduce((a, item) => a + ((item.preco || 0) * (item.quantidade || 1)), 0);
  const totalOrc2 = orcStatus[2] === 'aprovado' ? orcItens[2].reduce((a, item) => a + ((item.preco || 0) * (item.quantidade || 1)), 0) : 0;
  await db.from('ordens_servico').update({ total: totalOrc1 + totalOrc2 }).eq('id', osAtual.id);

  toast('OS salva com sucesso!', 'success');
  await carregarOS();
  await carregarDashboard();
}

// PDF DE ORÇAMENTO
function imprimirOrcamento() {
  if (!osAtual) return;
  const os = osAtual;
  const oficina = APP.oficina;

  const linhasOrc = (n) => {
    if (orcItens[n].length === 0) return '';
    const rows = orcItens[n].map(item => {
      const total = (item.preco || 0) * (item.quantidade || 1);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${item.tipo === 'Serviço' ? '🔧' : item.tipo === 'Peça' ? '📦' : '📝'} ${item.descricao}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${item.quantidade}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmtMoeda(item.preco)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${fmtMoeda(total)}</td>
      </tr>`;
    }).join('');
    const total = orcItens[n].reduce((a, i) => a + ((i.preco || 0) * (i.quantidade || 1)), 0);
    return rows + `<tr style="background:#f5f5f5"><td colspan="3" style="padding:8px;font-weight:600;text-align:right">Subtotal Orçamento ${n}</td><td style="padding:8px;font-weight:700;text-align:right">${fmtMoeda(total)}</td></tr>`;
  };

  const mostrarOrc2 = orcStatus[2] === 'aprovado' && orcItens[2].length > 0;
  const totalGeral = orcItens[1].reduce((a,i)=>a+((i.preco||0)*(i.quantidade||1)),0) +
    (mostrarOrc2 ? orcItens[2].reduce((a,i)=>a+((i.preco||0)*(i.quantidade||1)),0) : 0);

  const html = `
    <html><head><meta charset="UTF-8">
    <style>
      body{font-family:'Segoe UI',sans-serif;font-size:13px;color:#222;margin:0;padding:24px;}
      h1{font-size:22px;margin:0}
      h2{font-size:15px;margin:12px 0 6px;color:#0d2240;border-bottom:2px solid #0d2240;padding-bottom:4px}
      table{width:100%;border-collapse:collapse}
      .header{display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #0d2240}
      .total-box{background:#0d2240;color:#fff;padding:14px 18px;border-radius:8px;display:flex;justify-content:space-between;margin-top:12px}
      .assinatura{margin-top:40px;display:flex;gap:40px}
      .ass-line{flex:1;border-top:1px solid #999;padding-top:8px;font-size:11px;color:#666}
    </style></head>
    <body>
    <div class="header">
      <div>
        <h1>${oficina?.nome || 'Oficina'}</h1>
        <div style="font-size:12px;color:#666;margin-top:4px">${oficina?.cnpj || ''} · ${oficina?.telefone || ''}</div>
        <div style="font-size:12px;color:#666">${oficina?.endereco || ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700;color:#0d2240">${os.numero}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Data: ${new Date().toLocaleDateString('pt-BR')}</div>
        <div style="font-size:12px;color:#666">Validade: 10 dias</div>
      </div>
    </div>
    <table style="margin-bottom:16px">
      <tr><td style="width:50%;padding:4px 0"><strong>Cliente:</strong> ${os.clientes?.nome || '—'}</td>
          <td style="padding:4px 0"><strong>Veículo:</strong> ${(os.veiculos?.placa || '')} ${(os.veiculos?.marca || '')} ${(os.veiculos?.modelo || '')}</td></tr>
      <tr><td style="padding:4px 0"><strong>KM entrada:</strong> ${os.km_entrada || '—'}</td>
          <td style="padding:4px 0"><strong>Problema:</strong> ${os.queixa || '—'}</td></tr>
    </table>
    <h2>Orçamento 1 — Problema relatado</h2>
    <table>
      <thead><tr style="background:#f0f0f0">
        <th style="padding:7px 8px;text-align:left">Descrição</th>
        <th style="padding:7px 8px;text-align:center;width:60px">Qtd.</th>
        <th style="padding:7px 8px;text-align:right;width:110px">Valor unit.</th>
        <th style="padding:7px 8px;text-align:right;width:110px">Total</th>
      </tr></thead>
      <tbody>${linhasOrc(1)}</tbody>
    </table>
    ${mostrarOrc2 ? '<h2>Orçamento 2 — Preventivo</h2><table><thead><tr style="background:#f0f0f0"><th style="padding:7px 8px;text-align:left">Descrição</th><th style="padding:7px 8px;text-align:center;width:60px">Qtd.</th><th style="padding:7px 8px;text-align:right;width:110px">Valor unit.</th><th style="padding:7px 8px;text-align:right;width:110px">Total</th></tr></thead><tbody>' + linhasOrc(2) + '</tbody></table>' : ''}
    <div class="total-box">
      <span style="font-size:14px">TOTAL GERAL</span>
      <span style="font-size:20px;font-weight:700">${fmtMoeda(totalGeral)}</span>
    </div>
    <div class="assinatura">
      <div class="ass-line">Assinatura do cliente</div>
      <div class="ass-line">Responsável técnico</div>
    </div>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

// Atualiza renderOS para abrir modal de edição ao clicar na linha
