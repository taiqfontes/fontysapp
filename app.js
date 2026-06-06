
// ============================================================
// SUPABASE — CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = 'https://iirmasivaopsmhxtrfdq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_J262kmG_U0iySvaKJ3ehSw_0lcJKPau';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// ESTADO GLOBAL
// ============================================================
let APP = {
  user: null,
  oficina: null,
  oficinas: [],
  clientes: [],
  veiculos: [],
  funcionarios: [],
};

const CARGO_TIPO = {'Mecânico 1':'Produtivo','Mecânico 2':'Produtivo','Mecânico 3':'Produtivo','Auxiliar de Mecânico':'Operação','Auxiliar Administrativo':'ADM','Chefe de Oficina':'Operação'};
const CORES_AV = ['#2d7dd2','#1a8f5c','#6c3fc5','#b8860b','#c0392b','#0e7c7b'];

const PAGE_CONFIG = {
  dashboard:    { title:'Dashboard', sub:'Visão geral do negócio', actions:'' },
  os:           { title:'Ordens de Serviço', sub:'Gestão completa de OS', actions:`<button class="btn btn-outline btn-sm" onclick="openModal('os')"><i class="ti ti-file-plus"></i> Orçamento</button><button class="btn btn-primary btn-sm" onclick="openModal('os')"><i class="ti ti-plus"></i> Nova OS</button>` },
  clientes:     { title:'Clientes', sub:'Cadastro e CRM', actions:`<button class="btn btn-outline btn-sm"><i class="ti ti-download"></i> Exportar</button><button class="btn btn-primary btn-sm" onclick="openModal('cli')"><i class="ti ti-plus"></i> Novo Cliente</button>` },
  veiculos:     { title:'Veículos', sub:'Cadastro e alertas de revisão', actions:`<button class="btn btn-primary btn-sm" onclick="abrirModalVeiculo()"><i class="ti ti-plus"></i> Novo Veículo</button>` },
  servicos:     { title:'Serviços', sub:'Catálogo de mão de obra', actions:`<button class="btn btn-primary btn-sm" onclick="openModal('svc')"><i class="ti ti-plus"></i> Novo Serviço</button>` },
  pecas:        { title:'Peças', sub:'Estoque e kardex', actions:`<button class="btn btn-primary btn-sm" onclick="openModal('pec')"><i class="ti ti-plus"></i> Nova Peça</button>` },
  rh:           { title:'RH', sub:'Equipe, fichas e provisões CLT', actions:`<button class="btn btn-primary btn-sm" onclick="openModalFuncionario()"><i class="ti ti-plus"></i> Novo Funcionário</button>` },
  fornecedores: { title:'Fornecedores', sub:'Cadastro e histórico de compras', actions:`<button class="btn btn-primary btn-sm" onclick="openModal('forn')"><i class="ti ti-plus"></i> Novo Fornecedor</button>` },
  receber:      { title:'Contas a Receber', sub:'Receitas, previsão e baixas', actions:`<button class="btn btn-outline btn-sm"><i class="ti ti-download"></i> Exportar</button><button class="btn btn-primary btn-sm" onclick="abrirModalRec()"><i class="ti ti-plus"></i> Novo Lançamento</button>` },
  pagar:        { title:'Contas a Pagar', sub:'Compromissos e notas de fornecedores', actions:`<button class="btn btn-outline btn-sm"><i class="ti ti-download"></i> Exportar</button><button class="btn btn-primary btn-sm" onclick="abrirModalPag()"><i class="ti ti-plus"></i> Novo Lançamento</button>` },
  bancario:     { title:'Contas Bancárias', sub:'Saldos, extratos e previsões', actions:`<button class="btn btn-primary btn-sm" onclick="openModal('banc')"><i class="ti ti-plus"></i> Nova Conta</button>` },
  fluxo:        { title:'Fluxo de Caixa', sub:'DFC — Regime de Caixa', actions:`<button class="btn btn-outline btn-sm" onclick="carregarFluxo()"><i class="ti ti-refresh"></i> Atualizar</button>` },
  dre:          { title:'DRE', sub:'Demonstrativo do Resultado — Competência', actions:`<button class="btn btn-outline btn-sm" onclick="carregarDRE()"><i class="ti ti-refresh"></i> Atualizar</button>` },
  precificacao: { title:'Precificação', sub:'Calcule o preço justo com base nos seus custos reais', actions:'' },
  config:       { title:'Configurações', sub:'Parametrização do sistema', actions:'' },
};

// ============================================================
// AUTENTICAÇÃO
// ============================================================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');

  if (!email || !senha) { showError('Preencha e-mail e senha.'); return; }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  err.classList.remove('show');

  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });

  if (error) {
    showError('E-mail ou senha incorretos.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
    return;
  }

  APP.user = data.user;
  await initApp();
}

function showError(msg) {
  const err = document.getElementById('login-error');
  err.textContent = msg;
  err.classList.add('show');
}

async function doLogout() {
  await db.auth.signOut();
  document.getElementById('login-wrap').style.display = 'flex';
  document.getElementById('app').classList.remove('show');
  APP.user = null;
  APP.oficina = null;
}

async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    APP.user = session.user;
    await initApp();
  }
}

// ============================================================
// INICIALIZAÇÃO DO APP
// ============================================================
async function initApp() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('app').classList.add('show');

  // Atualiza UI do usuário
  const email = APP.user.email;
  const ini = email.slice(0,2).toUpperCase();
  document.getElementById('user-av').textContent = ini;
  document.getElementById('user-name').textContent = email;
  document.getElementById('user-role').textContent = 'Administrador';

  // Carrega oficinas
  await carregarOficinas();

  // Carrega dados do dashboard
  await carregarDashboard();

  // Pré-carrega clientes e mecânicos para os selects
  await carregarClientesBase();
  await carregarMecanicosBase();
}

async function carregarOficinas() {
  // Busca a oficina vinculada ao usuário logado
  const { data: vinculo, error: errV } = await db
    .from('usuarios')
    .select('oficina_id, nome, perfil')
    .eq('user_id', APP.user.id)
    .single();

  if (errV || !vinculo) {
    // Fallback: tenta carregar a primeira oficina (admin Fontys)
    const { data, error } = await db.from('oficinas').select('*').order('nome');
    if (error) { console.error(error); return; }
    APP.oficinas = data || [];
    if (APP.oficinas.length > 0) {
      APP.oficina = APP.oficinas[0];
    }
  } else {
    // Carrega a oficina específica do usuário
    const { data, error } = await db
      .from('oficinas')
      .select('*')
      .eq('id', vinculo.oficina_id)
      .single();

    if (error) { console.error(error); return; }
    APP.oficina = data;
    APP.oficinas = [data];

    // Atualiza nome e perfil do usuário na sidebar
    if (vinculo.nome) {
      document.getElementById('user-name').textContent = vinculo.nome;
    }
    if (vinculo.perfil) {
      const perfilLabel = {admin:'Administrador', gerente:'Gerente', operador:'Operador'};
      document.getElementById('user-role').textContent = perfilLabel[vinculo.perfil] || vinculo.perfil;
    }
  }

  if (APP.oficina) {
    document.getElementById('sidebar-oficina-name').childNodes[0].textContent = APP.oficina.nome;
    document.getElementById('topbar-sub').textContent = 'Dashboard — ' + APP.oficina.nome;
  }
}

async function carregarDashboard() {
  if (!APP.oficina) return;
  const oid = APP.oficina.id;

  const [os, cli, vei, pec] = await Promise.all([
    db.from('ordens_servico').select('id',{count:'exact'}).eq('oficina_id',oid).in('status',['andamento','aguardando','orc']),
    db.from('clientes').select('id',{count:'exact'}).eq('oficina_id',oid),
    db.from('veiculos').select('id',{count:'exact'}).eq('oficina_id',oid),
    db.from('pecas').select('id,estoque_atual,estoque_minimo').eq('oficina_id',oid),
  ]);

  document.getElementById('kpi-os-abertas').textContent = os.count || 0;
  document.getElementById('kpi-clientes').textContent = cli.count || 0;
  document.getElementById('kpi-veiculos').textContent = vei.count || 0;
  const pecAbaixo = (pec.data||[]).filter(p=>p.estoque_atual<=p.estoque_minimo).length;
  document.getElementById('kpi-pecas-min').textContent = pecAbaixo;
  document.getElementById('badge-os').textContent = os.count || 0;
}

async function carregarClientesBase() {
  if (!APP.oficina) return;
  const { data } = await db.from('clientes').select('id,nome').eq('oficina_id',APP.oficina.id).order('nome');
  APP.clientes = data || [];
  // Popula selects
  ['vei-cliente','os-cliente'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecionar...</option>';
    APP.clientes.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
  });
}

async function carregarMecanicosBase() {
  if (!APP.oficina) return;
  const { data } = await db.from('funcionarios').select('id,nome').eq('oficina_id',APP.oficina.id).eq('tipo_funcao','Produtivo').eq('status','ativo').order('nome');
  APP.funcionarios = data || [];
  const sel = document.getElementById('os-mec');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data||[]).forEach(f => sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
}

// ============================================================
// CLIENTES
// ============================================================
let cliTodos = [], cliFiltro = '', cliTipoFiltro = '';

async function carregarClientes() {
  if (!APP.oficina) return;
  document.getElementById('cli-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('clientes').select('*').eq('oficina_id',APP.oficina.id).order('nome');
  if (error) { toast('Erro ao carregar clientes','error'); return; }
  cliTodos = data || [];
  renderClientes();
}

function filtrarClientes(v) { cliFiltro = v.toLowerCase(); renderClientes(); }
function filtrarClienteTipo(v) { cliTipoFiltro = v; renderClientes(); }

function renderClientes() {
  const lista = cliTodos.filter(c => {
    const tOk = !cliFiltro || c.nome?.toLowerCase().includes(cliFiltro) || c.documento?.includes(cliFiltro) || c.telefone?.includes(cliFiltro);
    const tipOk = !cliTipoFiltro || c.tipo === cliTipoFiltro;
    return tOk && tipOk;
  });
  document.getElementById('cli-count').textContent = lista.length + ' cliente' + (lista.length !== 1 ? 's' : '');
  if (lista.length === 0) {
    document.getElementById('cli-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-users" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum cliente encontrado</div><div>Cadastre o primeiro cliente.</div></div>`;
    return;
  }
  document.getElementById('cli-table-wrap').innerHTML = `
    <table>
      <thead><tr>
        <th style="width:220px">Cliente</th>
        <th style="width:70px">Tipo</th>
        <th style="width:130px">Documento</th>
        <th style="width:130px">Telefone</th>
        <th style="width:200px">E-mail</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map(c=>`<tr>
        <td><div style="font-weight:500;color:var(--navy)">${c.nome}</div></td>
        <td><span class="badge ${c.tipo==='PF'?'badge-blue':'badge-purple'}">${c.tipo}</span></td>
        <td style="font-family:monospace;font-size:11px;color:var(--text-3)">${c.documento||'—'}</td>
        <td style="font-size:12px;color:var(--text-2)">${c.telefone||'—'}</td>
        <td style="font-size:12px;color:var(--text-3)">${c.email||'—'}</td>
        <td><button class="action-btn" onclick="excluirCliente('${c.id}')"><i class="ti ti-trash"></i></button></td>
      </tr>`).join('')}</tbody>
    </table>`;
}

async function salvarCliente() {
  const nome = document.getElementById('cli-nome').value.trim();
  if (!nome) { toast('Informe o nome.','error'); return; }
  const tipo = document.querySelector('input[name="cli-tipo"]:checked')?.value || 'PF';
  const { error } = await db.from('clientes').insert({
    oficina_id: APP.oficina.id,
    tipo, nome,
    documento: document.getElementById('cli-doc').value,
    telefone: document.getElementById('cli-tel').value,
    email: document.getElementById('cli-email').value,
    endereco: document.getElementById('cli-end').value,
  });
  if (error) { toast('Erro ao salvar: ' + error.message,'error'); return; }
  closeModal('cli');
  toast('Cliente salvo!','success');
  await carregarClientes();
  await carregarClientesBase();
  await carregarDashboard();
}

async function excluirCliente(id) {
  if (!confirm('Excluir este cliente?')) return;
  const { error } = await db.from('clientes').delete().eq('id',id);
  if (error) { toast('Erro ao excluir','error'); return; }
  toast('Cliente excluído','success');
  await carregarClientes();
  await carregarDashboard();
}

// ============================================================
// VEÍCULOS
// ============================================================
let veiTodos = [], veiFiltro = '';

async function carregarVeiculos() {
  if (!APP.oficina) return;
  document.getElementById('vei-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('veiculos').select('*,clientes(nome)').eq('oficina_id',APP.oficina.id).order('placa');
  if (error) { toast('Erro ao carregar veículos','error'); return; }
  veiTodos = data || [];
  renderVeiculos();
}

function filtrarVeiculos(v) { veiFiltro = v.toLowerCase(); renderVeiculos(); }

function renderVeiculos() {
  const lista = veiTodos.filter(v =>
    !veiFiltro || v.placa?.toLowerCase().includes(veiFiltro) || v.modelo?.toLowerCase().includes(veiFiltro) || v.clientes?.nome?.toLowerCase().includes(veiFiltro)
  );
  document.getElementById('vei-count').textContent = lista.length + ' veículo' + (lista.length !== 1 ? 's' : '');
  if (lista.length === 0) {
    document.getElementById('vei-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-car" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum veículo encontrado</div></div>`;
    return;
  }
  document.getElementById('vei-table-wrap').innerHTML = `
    <table>
      <thead><tr>
        <th style="width:100px">Placa</th>
        <th style="width:180px">Veículo</th>
        <th style="width:80px">Ano</th>
        <th style="width:80px">Combust.</th>
        <th style="width:160px">Cliente</th>
        <th style="width:90px">KM atual</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map(v=>{
        const kmProx = v.km_proxima_revisao || (v.km_atual + (v.intervalo_revisao||10000));
        const rest = kmProx - v.km_atual;
        const alerta = rest <= 5000 ? (rest < 0 ? '🔴' : '⚠️') : '';
        return `<tr>
          <td><span style="font-family:monospace;font-weight:700;background:var(--navy);color:#fff;padding:3px 8px;border-radius:5px;font-size:11px">${v.placa||'—'}</span></td>
          <td><div style="font-weight:500;color:var(--navy)">${v.marca||''} ${v.modelo||''}</div><div style="font-size:11px;color:var(--text-3)">${v.versao||''} · ${v.cor||''}</div></td>
          <td style="font-size:12px;color:var(--text-2)">${v.ano_fabricacao||'—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${v.combustivel||'—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${v.clientes?.nome||'—'}</td>
          <td style="font-size:12px">${alerta} ${(v.km_atual||0).toLocaleString('pt-BR')} km</td>
          <td><button class="action-btn" onclick="excluirVeiculo('${v.id}')"><i class="ti ti-trash"></i></button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function abrirModalVeiculo() {
  await carregarClientesBase();
  openModal('vei');
}

async function salvarVeiculo() {
  const placa = document.getElementById('vei-placa').value.trim();
  if (!placa) { toast('Informe a placa.','error'); return; }
  const km = parseInt(document.getElementById('vei-km').value)||0;
  const intervalo = parseInt(document.getElementById('vei-intervalo').value)||10000;
  const { error } = await db.from('veiculos').insert({
    oficina_id: APP.oficina.id,
    cliente_id: document.getElementById('vei-cliente').value || null,
    placa: placa.toUpperCase(),
    marca: document.getElementById('vei-marca').value,
    modelo: document.getElementById('vei-modelo').value,
    versao: document.getElementById('vei-versao').value,
    cor: document.getElementById('vei-cor').value,
    ano_fabricacao: parseInt(document.getElementById('vei-anofab').value)||null,
    combustivel: document.getElementById('vei-comb').value,
    km_atual: km,
    intervalo_revisao: intervalo,
    km_proxima_revisao: km + intervalo,
  });
  if (error) { toast('Erro ao salvar: ' + error.message,'error'); return; }
  closeModal('vei');
  toast('Veículo salvo!','success');
  await carregarVeiculos();
  await carregarDashboard();
}

async function excluirVeiculo(id) {
  if (!confirm('Excluir este veículo?')) return;
  await db.from('veiculos').delete().eq('id',id);
  toast('Veículo excluído','success');
  await carregarVeiculos();
  await carregarDashboard();
}

// ============================================================
// ORDENS DE SERVIÇO
// ============================================================
let osTodos = [], osFiltro = '', osStatusFiltro = '';

async function carregarOS() {
  if (!APP.oficina) return;
  document.getElementById('os-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('ordens_servico')
    .select('*,clientes(nome),veiculos(placa,marca,modelo),funcionarios(nome)')
    .eq('oficina_id',APP.oficina.id)
    .order('created_at',{ascending:false});
  if (error) { toast('Erro ao carregar OS','error'); return; }
  osTodos = data || [];
  renderOS();
}

function filtrarOS(v) { osFiltro = v.toLowerCase(); renderOS(); }
function filtrarOSStatus(v) { osStatusFiltro = v; renderOS(); }

const STATUS_OS = {
  orc:{label:'Orçamento',cls:'badge-purple'},
  aguardando:{label:'Ag. Peça',cls:'badge-warning'},
  andamento:{label:'Em andamento',cls:'badge-blue'},
  finalizado:{label:'Finalizado',cls:'badge-purple'},
  entregue:{label:'Entregue',cls:'badge-success'},
  quitado:{label:'Quitado',cls:'badge-success'},
};

function renderOS() {
  const lista = osTodos.filter(o => {
    const tOk = !osFiltro || o.numero?.toLowerCase().includes(osFiltro) || o.clientes?.nome?.toLowerCase().includes(osFiltro);
    const stOk = !osStatusFiltro || o.status === osStatusFiltro;
    return tOk && stOk;
  });
  document.getElementById('os-count').textContent = lista.length + ' registro' + (lista.length !== 1 ? 's' : '');
  if (lista.length === 0) {
    document.getElementById('os-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-clipboard-list" style="color:var(--blue)"></i><div class="empty-state-title">Nenhuma OS encontrada</div><div>Crie a primeira OS.</div></div>`;
    return;
  }
  document.getElementById('os-table-wrap').innerHTML=`
    <table>
      <thead><tr>
        <th style="width:100px">Nº / Tipo</th>
        <th style="width:170px">Cliente</th>
        <th style="width:140px">Veículo</th>
        <th style="width:120px">Mecânico</th>
        <th style="width:95px">Total</th>
        <th style="width:110px">Status</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map(o=>{
        const st = STATUS_OS[o.status] || {label:o.status,cls:'badge-gray'};
        return `<tr onclick="abrirOSEdit('${o.id}')">
          <td><div style="font-weight:600;color:var(--navy)">${o.numero||'—'}</div><span class="badge ${o.tipo==='orc'?'badge-purple':'badge-blue'}" style="font-size:10px;margin-top:3px">${o.tipo==='orc'?'Orçamento':'OS'}</span></td>
          <td style="font-weight:500;color:var(--navy)">${o.clientes?.nome||'—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${o.veiculos?.placa||'—'} ${o.veiculos?.modelo?'· '+o.veiculos.modelo:''}</td>
          <td style="font-size:12px;color:var(--text-2)">${o.funcionarios?.nome||'—'}</td>
          <td style="font-weight:500;color:var(--success)">R$ ${(o.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td><button class="action-btn" onclick="event.stopPropagation();excluirOS('${o.id}')"><i class="ti ti-trash"></i></button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function carregarVeiculosOS() {
  const cliId = document.getElementById('os-cliente').value;
  const sel = document.getElementById('os-veiculo');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  if (!cliId) return;
  const { data } = await db.from('veiculos').select('id,placa,marca,modelo').eq('cliente_id',cliId).order('placa');
  (data||[]).forEach(v => sel.innerHTML += `<option value="${v.id}">${v.placa} — ${v.marca} ${v.modelo}</option>`);
}

async function salvarOS() {
  const tipo = document.getElementById('os-tipo').value;
  const cliId = document.getElementById('os-cliente').value;
  if (!cliId) { toast('Selecione um cliente.','error'); return; }
  const prefixo = tipo === 'orc' ? 'ORC' : 'OS';
  const numero = prefixo + '-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*900)+100).padStart(3,'0');
  const { error } = await db.from('ordens_servico').insert({
    oficina_id: APP.oficina.id,
    numero, tipo,
    cliente_id: cliId || null,
    veiculo_id: document.getElementById('os-veiculo').value || null,
    funcionario_id: document.getElementById('os-mec').value || null,
    km_entrada: parseInt(document.getElementById('os-km').value)||0,
    queixa: document.getElementById('os-queixa').value,
    status: tipo === 'orc' ? 'orc' : 'aguardando',
    forma_pagamento: document.getElementById('os-forma').value,
    data_abertura: document.getElementById('os-data').value || new Date().toISOString().split('T')[0],
    data_previsao: document.getElementById('os-previsao').value || null,
    total: 0,
  });
  if (error) { toast('Erro: ' + error.message,'error'); return; }
  closeModal('os');
  toast('OS ' + numero + ' criada!','success');
  await carregarOS();
  await carregarDashboard();
}

async function excluirOS(id) {
  if (!confirm('Excluir esta OS?')) return;
  await db.from('ordens_servico').delete().eq('id',id);
  toast('OS excluída','success');
  await carregarOS();
  await carregarDashboard();
}

// ============================================================
// SERVIÇOS
// ============================================================
async function carregarServicos() {
  if (!APP.oficina) return;
  document.getElementById('svc-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('servicos').select('*').eq('oficina_id',APP.oficina.id).order('nome');
  if (error) { toast('Erro','error'); return; }
  const lista = data || [];
  document.getElementById('svc-count').textContent = lista.length + ' serviço' + (lista.length !== 1 ? 's' : '');
  if (lista.length === 0) {
    document.getElementById('svc-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-tool" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum serviço cadastrado</div></div>`;
    return;
  }
  document.getElementById('svc-table-wrap').innerHTML = `
    <table>
      <thead><tr>
        <th style="width:250px">Serviço</th>
        <th style="width:100px">Categoria</th>
        <th style="width:70px">Horas</th>
        <th style="width:80px">Markup</th>
        <th style="width:110px">Dificuldade</th>
        <th style="width:70px">Status</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map(s=>`<tr>
        <td style="font-weight:500;color:var(--navy)">${s.nome}</td>
        <td><span class="badge badge-blue">${s.categoria||'—'}</span></td>
        <td style="font-size:12px;color:var(--text-2)">${s.horas_previstas}h</td>
        <td style="font-size:12px;color:var(--text-2)">${s.markup}%</td>
        <td><span class="badge ${s.dificuldade==='Simples'?'badge-success':s.dificuldade==='Complexo'?'badge-danger':'badge-warning'}">${s.dificuldade==='Simples'?'🟢':s.dificuldade==='Complexo'?'🔴':'🟡'} ${s.dificuldade}</span></td>
        <td style="font-size:11px;color:${s.status==='Ativo'?'var(--success)':'var(--text-3)'}">${s.status}</td>
        <td><button class="action-btn" onclick="excluirServico('${s.id}')"><i class="ti ti-trash"></i></button></td>
      </tr>`).join('')}</tbody>
    </table>`;
}

async function salvarServico() {
  const nome = document.getElementById('svc-nome').value.trim();
  if (!nome) { toast('Informe o nome.','error'); return; }
  const { error } = await db.from('servicos').insert({
    oficina_id: APP.oficina.id, nome,
    categoria: document.getElementById('svc-cat').value,
    dificuldade: document.getElementById('svc-dif').value,
    horas_previstas: parseFloat(document.getElementById('svc-horas').value)||1,
    markup: parseFloat(document.getElementById('svc-markup').value)||60,
    status: 'Ativo',
  });
  if (error) { toast('Erro: ' + error.message,'error'); return; }
  closeModal('svc');
  toast('Serviço salvo!','success');
  await carregarServicos();
}

async function excluirServico(id) {
  if (!confirm('Excluir este serviço?')) return;
  await db.from('servicos').delete().eq('id',id);
  toast('Serviço excluído','success');
  await carregarServicos();
}

// ============================================================
// PEÇAS
// ============================================================
async function carregarPecas() {
  if (!APP.oficina) return;
  document.getElementById('pec-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('pecas').select('*').eq('oficina_id',APP.oficina.id).order('nome');
  if (error) { toast('Erro','error'); return; }
  const lista = data || [];
  document.getElementById('pec-count').textContent = lista.length + ' ite' + (lista.length !== 1 ? 'ns' : 'm');
  if (lista.length === 0) {
    document.getElementById('pec-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-package" style="color:var(--blue)"></i><div class="empty-state-title">Nenhuma peça cadastrada</div></div>`;
    return;
  }
  document.getElementById('pec-table-wrap').innerHTML = `
    <table>
      <thead><tr>
        <th style="width:210px">Peça</th>
        <th style="width:90px">Categoria</th>
        <th style="width:80px">Tipo</th>
        <th style="width:50px">Un.</th>
        <th style="width:80px">Estoque</th>
        <th style="width:70px">Mínimo</th>
        <th style="width:100px">Custo médio</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map(p=>{
        const alerta = p.estoque_atual <= p.estoque_minimo;
        return `<tr>
          <td><div style="font-weight:500;color:var(--navy)">${alerta?'⚠️ ':''} ${p.nome}</div><div style="font-size:10px;color:var(--text-3);font-family:monospace">${p.referencia||''}</div></td>
          <td><span class="badge badge-blue">${p.categoria||'—'}</span></td>
          <td style="font-size:11px;color:var(--text-2)">${p.tipo}</td>
          <td style="font-size:12px;color:var(--text-2)">${p.unidade}</td>
          <td style="font-weight:600;color:${p.estoque_atual===0?'var(--danger)':alerta?'var(--warning)':'var(--success)'}">${p.estoque_atual} ${p.unidade}</td>
          <td style="font-size:12px;color:var(--text-3)">${p.estoque_minimo}</td>
          <td style="font-weight:500">R$ ${(p.custo_medio||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          <td><button class="action-btn" onclick="excluirPeca('${p.id}')"><i class="ti ti-trash"></i></button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function salvarPeca() {
  const nome = document.getElementById('pec-nome').value.trim();
  if (!nome) { toast('Informe o nome.','error'); return; }
  const estoque = parseFloat(document.getElementById('pec-estoque').value)||0;
  const custo = parseFloat(document.getElementById('pec-custo').value)||0;
  const { data, error } = await db.from('pecas').insert({
    oficina_id: APP.oficina.id, nome,
    referencia: document.getElementById('pec-ref').value,
    categoria: document.getElementById('pec-cat').value,
    tipo: document.getElementById('pec-tipo').value,
    unidade: document.getElementById('pec-un').value,
    estoque_atual: estoque,
    estoque_minimo: parseFloat(document.getElementById('pec-minimo').value)||2,
    custo_medio: custo,
  }).select();
  if (error) { toast('Erro: ' + error.message,'error'); return; }
  // Registra kardex inicial se tiver estoque
  if (estoque > 0 && data?.[0]?.id) {
    await db.from('kardex').insert({
      oficina_id: APP.oficina.id,
      peca_id: data[0].id,
      tipo: 'entrada',
      quantidade: estoque,
      custo_unitario: custo,
      custo_medio_apos: custo,
      saldo_apos: estoque,
      observacao: 'Saldo inicial',
    });
  }
  closeModal('pec');
  toast('Peça salva!','success');
  await carregarPecas();
  await carregarDashboard();
}

async function excluirPeca(id) {
  if (!confirm('Excluir esta peça?')) return;
  await db.from('pecas').delete().eq('id',id);
  toast('Peça excluída','success');
  await carregarPecas();
  await carregarDashboard();
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
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

async function carregarFluxo(){
  if(!APP.oficina)return;
  document.getElementById('flx-wrap').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const ano=parseInt(document.getElementById('flx-ano')?.value||2026);
  const de=`${ano}-01-01`, ate=`${ano}-12-31`;

  const [{data:recD},{data:pagD}]=await Promise.all([
    db.from('contas_receber').select('valor,data_pagamento,origem,so_caixa').eq('oficina_id',APP.oficina.id).eq('status','recebido').gte('data_pagamento',de).lte('data_pagamento',ate),
    db.from('contas_pagar').select('valor,data_pagamento,categoria').eq('oficina_id',APP.oficina.id).eq('status','pago').gte('data_pagamento',de).lte('data_pagamento',ate),
  ]);

  // Agrupa por mês
  const entM=Array(12).fill(0), saiM=Array(12).fill(0);
  (recD||[]).forEach(r=>{const m=new Date(r.data_pagamento+'T12:00:00').getMonth();entM[m]+=(r.valor||0);});
  (pagD||[]).forEach(p=>{const m=new Date(p.data_pagamento+'T12:00:00').getMonth();saiM[m]+=(p.valor||0);});

  const totalEnt=entM.reduce((a,v)=>a+v,0);
  const totalSai=saiM.reduce((a,v)=>a+v,0);
  const saldoPer=totalEnt-totalSai;

  document.getElementById('kpi-flx-ent').textContent=fmtMoeda(totalEnt);
  document.getElementById('kpi-flx-sai').textContent=fmtMoeda(totalSai);
  document.getElementById('kpi-flx-saldo').textContent=fmtMoeda(saldoPer);
  document.getElementById('kpi-flx-per').textContent=`Jan–Dez ${ano}`;
  document.getElementById('kpi-flx-acum').textContent=fmtMoeda(saldoPer);

  // Tabela
  let acum=0;
  const mAtivo=new Date().getMonth();
  let html=`<table class="rel-table">
    <thead><tr>
      <th>Categoria</th>
      ${MESES_PT.map((m,i)=>`<th style="${i>mAtivo?'opacity:.4':''}">${m}</th>`).join('')}
      <th class="rel-col-total">Total</th>
    </tr></thead><tbody>`;

  // Entradas
  html+=`<tr class="rel-row-grupo"><td>↑ ENTRADAS</td>${entM.map((v,i)=>`<td style="${i>mAtivo?'opacity:.4':''}color:#7de8b8">${v>0?fmtN(v):'—'}</td>`).join('')}<td class="rel-col-total" style="color:#7de8b8">${fmtN(totalEnt)}</td></tr>`;
  html+=`<tr class="rel-row-linha"><td style="padding-left:16px">Recebimentos de clientes</td>${entM.map((v,i)=>`<td style="${i>mAtivo?'opacity:.4':''}">${v>0?fmtN(v):'—'}</td>`).join('')}<td class="rel-col-total">${fmtN(totalEnt)}</td></tr>`;

  // Saídas
  html+=`<tr class="rel-row-grupo" style="background:#162338"><td>↓ SAÍDAS</td>${saiM.map((v,i)=>`<td style="${i>mAtivo?'opacity:.4':''}color:#f5a5a0">${v>0?'('+fmtN(v)+')':'—'}</td>`).join('')}<td class="rel-col-total" style="color:#f5a5a0">${totalSai>0?'('+fmtN(totalSai)+')':'—'}</td></tr>`;
  html+=`<tr class="rel-row-linha"><td style="padding-left:16px">Pagamentos a fornecedores/despesas</td>${saiM.map((v,i)=>`<td style="${i>mAtivo?'opacity:.4':''}">${v>0?fmtN(v):'—'}</td>`).join('')}<td class="rel-col-total">${fmtN(totalSai)}</td></tr>`;

  // Saldo período
  html+=`<tr class="rel-row-resultado"><td>SALDO DO PERÍODO</td>${entM.map((v,i)=>{const s=v-saiM[i];return `<td style="${i>mAtivo?'opacity:.4':''}color:${s>=0?'var(--blue)':'var(--danger)'}">${s!==0?(s<0?'('+fmtN(Math.abs(s))+')':fmtN(s)):'—'}</td>`;}).join('')}<td class="rel-col-total" style="color:${saldoPer>=0?'var(--blue)':'var(--danger)'}">${fmtN(saldoPer)}</td></tr>`;

  // Acumulado
  html+=`<tr class="rel-row-final"><td>SALDO ACUMULADO</td>${entM.map((v,i)=>{acum+=(v-saiM[i]);return `<td style="${i>mAtivo?'opacity:.4':''}color:#7de8b8">${acum!==0?fmtN(acum):'—'}</td>`;}).join('')}<td class="rel-col-total" style="color:#7de8b8">${fmtN(acum)}</td></tr>`;

  html+='</tbody></table>';
  document.getElementById('flx-wrap').innerHTML=html;
}

// ============================================================
// DRE
// ============================================================
async function carregarDRE(){
  if(!APP.oficina)return;
  document.getElementById('dre-wrap').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const ano=parseInt(document.getElementById('dre-ano')?.value||2026);
  const de=`${ano}-01-01`,ate=`${ano}-12-31`;

  const [{data:recD},{data:pagD}]=await Promise.all([
    db.from('contas_receber').select('valor,valor_taxa_transacao,valor_taxa_antecipacao,data_referencia,categoria,so_caixa').eq('oficina_id',APP.oficina.id).eq('status','recebido').gte('data_referencia',de).lte('data_referencia',ate),
    db.from('contas_pagar').select('valor,data_referencia,categoria,origem').eq('oficina_id',APP.oficina.id).eq('status','pago').gte('data_referencia',de).lte('data_referencia',ate),
  ]);

  // Agrupa por mês — apenas competência (excluindo só_caixa)
  const recBM=Array(12).fill(0),dedM=Array(12).fill(0),cmvM=Array(12).fill(0);
  const despM=Array(12).fill(0),despFinM=Array(12).fill(0);

  (recD||[]).forEach(r=>{
    if(r.so_caixa)return;
    const m=new Date(r.data_referencia+'T12:00:00').getMonth();
    recBM[m]+=(r.valor||0);
    dedM[m]+=(r.valor_taxa_transacao||0);
  });
  (pagD||[]).forEach(p=>{
    const m=new Date(p.data_referencia+'T12:00:00').getMonth();
    const cat=p.categoria||'';
    if(cat.includes('Peças')||cat==='Compra de Peças') cmvM[m]+=(p.valor||0);
    else if(cat.includes('Financeira')) despFinM[m]+=(p.valor||0);
    else despM[m]+=(p.valor||0);
  });

  const recLiqM=recBM.map((v,i)=>v-dedM[i]);
  const lucBrM=recLiqM.map((v,i)=>v-cmvM[i]);
  const resOpM=lucBrM.map((v,i)=>v-despM[i]);
  const lucLiqM=resOpM.map((v,i)=>v-despFinM[i]);
  let acum=0;
  const lucAcuM=lucLiqM.map(v=>{acum+=v;return acum;});
  const mAtivo=new Date().getMonth();

  function dreRow(label,arr,cls,indent=0,neg=false){
    const total=arr.reduce((a,v)=>a+v,0);
    return `<tr class="${cls}"><td style="padding-left:${indent}px">${label}</td>${arr.map((v,i)=>`<td style="${i>mAtivo?'opacity:.4':''}${neg&&v>0?';color:var(--danger)':''}">${v!==0?(neg?'('+fmtN(v)+')':fmtN(v)):'—'}</td>`).join('')}<td class="rel-col-total" style="${neg&&total>0?'color:var(--danger)':''}">${total!==0?(neg?'('+fmtN(total)+')':fmtN(total)):'—'}</td></tr>`;
  }

  let html=`<table class="rel-table">
    <thead><tr>
      <th>DRE — Competência ${ano}</th>
      ${MESES_PT.map((m,i)=>`<th style="${i>mAtivo?'opacity:.4':''}">${m}</th>`).join('')}
      <th class="rel-col-total">Total</th>
    </tr></thead><tbody>`;

  html+=dreRow('1. RECEITA BRUTA',recBM,'rel-row-grupo');
  html+=dreRow('(-) Deduções / Taxas de transação',dedM,'rel-row-linha',16,true);
  html+=dreRow('2. RECEITA LÍQUIDA',recLiqM,'rel-row-resultado');
  html+=dreRow('3. CMV — Custo de Mercadoria Vendida',cmvM,'rel-row-cat',0,true);
  html+=dreRow('4. LUCRO BRUTO (Margem de Contribuição)',lucBrM,'rel-row-total-pos');
  html+=dreRow('5. DESPESAS OPERACIONAIS',despM,'rel-row-cat',0,true);
  html+=dreRow('6. RESULTADO OPERACIONAL',resOpM,'rel-row-resultado');
  html+=dreRow('7. DESPESAS FINANCEIRAS',despFinM,'rel-row-linha',16,true);
  html+=dreRow('8. LUCRO LÍQUIDO',lucLiqM,'rel-row-total-pos');
  html+=`<tr class="rel-row-final"><td>9. LUCRO LÍQUIDO ACUMULADO</td>${lucAcuM.map((v,i)=>`<td style="${i>mAtivo?'opacity:.4':''}color:#7de8b8">${v!==0?fmtN(v):'—'}</td>`).join('')}<td class="rel-col-total" style="color:#7de8b8">${fmtN(acum)}</td></tr>`;
  html+='</tbody></table>';

  if((recD||[]).length===0&&(pagD||[]).length===0){
    html=`<div class="empty-state"><i class="ti ti-report-analytics" style="color:var(--blue)"></i><div class="empty-state-title">Sem lançamentos com data de referência em ${ano}</div><div>Cadastre receitas e despesas nas contas a receber e pagar.</div></div>`;
  }
  document.getElementById('dre-wrap').innerHTML=html;
}

// ============================================================
// PRECIFICAÇÃO
// ============================================================
function iniciarPrecificacao(){
  calcPrecSvc();
  calcPrecPec();
}

function calcPrecSvc(){
  const desp=parseFloat(document.getElementById('prec-desp')?.value)||28000;
  const hd=parseFloat(document.getElementById('prec-hd')?.value)||8;
  const dias=parseFloat(document.getElementById('prec-dias')?.value)||22;
  const mecs=parseFloat(document.getElementById('prec-mecs')?.value)||3;
  const sh=parseFloat(document.getElementById('prec-sh')?.value)||1;
  const mk=parseFloat(document.getElementById('prec-mk')?.value)||60;
  const imp=parseFloat(document.getElementById('prec-imp')?.value)||8;
  const tx=parseFloat(document.getElementById('prec-tx')?.value)||2.99;

  const custoHoraOf=desp/(hd*dias);
  const custoHoraH=custoHoraOf/mecs;
  const custoSvc=sh*custoHoraH;
  const valorBruto=(custoSvc*(1+mk/100))/(1-(imp/100));
  const taxaV=valorBruto*(tx/100);
  const liquido=valorBruto-taxaV;
  const margem=((liquido-custoSvc)/valorBruto)*100;

  const el=document.getElementById('prec-custo-hora');
  if(el) el.textContent=fmtMoeda(custoHoraH);

  const res=document.getElementById('prec-result-svc');
  if(!res)return;
  res.innerHTML=`
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span style="color:rgba(255,255,255,0.55)">Custo hora / mecânico</span><span style="color:#4a9fe8;font-weight:500">${fmtMoeda(custoHoraH)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span style="color:rgba(255,255,255,0.55)">Custo do serviço (${sh}h)</span><span style="color:#fff;font-weight:500">${fmtMoeda(custoSvc)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span style="color:rgba(255,255,255,0.55)">(-) Imposto (${imp}%)</span><span style="color:#f5a5a0">- ${fmtMoeda(valorBruto*(imp/100))}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span style="color:rgba(255,255,255,0.55)">(-) Taxa de transação (${tx}%)</span><span style="color:#f5a5a0">- ${fmtMoeda(taxaV)}</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:6px;border-top:1px solid rgba(255,255,255,0.15)"><span style="font-size:12px;color:rgba(255,255,255,0.6)">💰 Preço ao cliente</span><span style="font-size:20px;font-weight:500;color:#fff">${fmtMoeda(valorBruto)}</span></div>
    <div style="background:rgba(45,125,210,0.2);border-radius:6px;padding:10px 12px;margin-top:8px;display:flex;justify-content:space-between;"><span style="font-size:11px;color:#4a9fe8">Margem líquida real</span><span style="font-size:15px;font-weight:500;color:#7de8b8">${margem.toFixed(1)}%</span></div>`;
}

function calcPrecPec(){
  const custo=parseFloat(document.getElementById('pp-custo')?.value)||100;
  const imp=parseFloat(document.getElementById('pp-imp')?.value)||8;
  const cf=parseFloat(document.getElementById('pp-cf')?.value)||15;
  const lucro=parseFloat(document.getElementById('pp-lucro')?.value)||20;
  const tx=parseFloat(document.getElementById('pp-tx')?.value)||2.99;
  const qtd=parseFloat(document.getElementById('pp-qtd')?.value)||1;
  const div=1-(imp/100)-(cf/100)-(lucro/100)-(tx/100);
  const preco=div>0?custo/div:0;
  const markup=preco>0?(preco/custo):0;
  const marg=preco>0?((preco-custo)/preco)*100:0;

  const res=document.getElementById('prec-result-pec');
  if(!res)return;
  res.innerHTML=`
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span style="color:rgba(255,255,255,0.55)">Markup aplicado</span><span style="color:#4a9fe8;font-weight:500">${markup.toFixed(2)}×</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span style="color:rgba(255,255,255,0.55)">(-) Impostos (${imp}%)</span><span style="color:#f5a5a0">- ${fmtMoeda(preco*(imp/100))}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span style="color:rgba(255,255,255,0.55)">(-) Custos fixos (${cf}%)</span><span style="color:#f5a5a0">- ${fmtMoeda(preco*(cf/100))}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span style="color:rgba(255,255,255,0.55)">(-) Taxa de transação (${tx}%)</span><span style="color:#f5a5a0">- ${fmtMoeda(preco*(tx/100))}</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:6px;border-top:1px solid rgba(255,255,255,0.15)"><span style="font-size:12px;color:rgba(255,255,255,0.6)">💰 Preço sugerido / un.</span><span style="font-size:20px;font-weight:500;color:#fff">${fmtMoeda(preco)}</span></div>
    <div style="background:rgba(45,125,210,0.2);border-radius:6px;padding:10px 12px;margin-top:8px;display:flex;justify-content:space-between;"><span style="font-size:11px;color:#4a9fe8">Margem de contribuição</span><span style="font-size:15px;font-weight:500;color:#7de8b8">${marg.toFixed(1)}%</span></div>
    ${qtd>1?('<div style="text-align:right;margin-top:8px;font-size:13px;color:rgba(255,255,255,0.7)">Receita total ('+qtd+' un.): <strong style="color:#fff">'+fmtMoeda(preco*qtd)+'</strong></div>'):''}`;
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
async function carregarConfig(){
  if(!APP.oficina)return;
  renderDadosOficina();
}

function showCfgPanel(id,el){
  document.querySelectorAll('.cfg-item').forEach(i=>i.classList.remove('active'));
  document.querySelectorAll('.cfg-panel').forEach(p=>p.classList.remove('active-panel'));
  document.getElementById('cfg-panel-'+id).classList.add('active-panel');
  el.classList.add('active');
  if(id==='dados') renderDadosOficina();
}

function renderDadosOficina(){
  const o=APP.oficina||{};
  const el=document.getElementById('cfg-dados-content');
  if(!el)return;
  el.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;">
    <div class="form-group form-full"><label class="form-label">Nome fantasia</label><input class="form-input" id="cfg-nome" type="text" value="${o.nome||''}"></div>
    <div class="form-group"><label class="form-label">Razão social</label><input class="form-input" id="cfg-razao" type="text" value="${o.razao_social||''}"></div>
    <div class="form-group"><label class="form-label">CNPJ</label><input class="form-input" id="cfg-cnpj" type="text" value="${o.cnpj||''}" style="font-family:monospace"></div>
    <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="cfg-tel" type="text" value="${o.telefone||''}"></div>
    <div class="form-group"><label class="form-label">WhatsApp</label><input class="form-input" id="cfg-whats" type="text" value="${o.whatsapp||''}"></div>
    <div class="form-group"><label class="form-label">E-mail</label><input class="form-input" id="cfg-email" type="email" value="${o.email||''}"></div>
    <div class="form-group form-full"><label class="form-label">Endereço</label><input class="form-input" id="cfg-end" type="text" value="${o.endereco||''}"></div>
  </div>`;
}

async function salvarDadosOficina(){
  const {error}=await db.from('oficinas').update({
    nome:document.getElementById('cfg-nome')?.value,
    razao_social:document.getElementById('cfg-razao')?.value,
    cnpj:document.getElementById('cfg-cnpj')?.value,
    telefone:document.getElementById('cfg-tel')?.value,
    whatsapp:document.getElementById('cfg-whats')?.value,
    email:document.getElementById('cfg-email')?.value,
    endereco:document.getElementById('cfg-end')?.value,
  }).eq('id',APP.oficina.id);
  if(error){toast('Erro: '+error.message,'error');return;}
  await carregarOficinas();
  toast('Dados da oficina salvos!','success');
}

function salvarTaxas(){toast('Taxas salvas!','success');}

const TAXAS_CARTAO = {pix:0,dinheiro:0,debito:1.2,credito1:2.99,credito2a6:3.5,credito7a12:4.2};
const hoje = () => new Date().toISOString().split('T')[0];
const fmtMoeda = v => 'R$ ' + (v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

// ============================================================
// CONTAS A RECEBER
// ============================================================
let recTodos=[], recFiltro='', recStatusFiltro='', recOrigemFiltro='';
let recAtual=null;

async function carregarReceber() {
  if (!APP.oficina) return;
  document.getElementById('rec-table-wrap').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data } = await db.from('contas_receber').select('*').eq('oficina_id',APP.oficina.id).order('data_vencimento');
  recTodos = data || [];
  const mesAtual = new Date().toISOString().slice(0,7);
  const abertos = recTodos.filter(r=>r.status==='aberto'||r.status==='atraso');
  const totalAberto = abertos.reduce((a,r)=>a+(r.valor||0),0);
  const hoje2 = hoje();
  const venceHoje = recTodos.filter(r=>r.data_vencimento===hoje2&&r.status==='aberto').reduce((a,r)=>a+(r.valor||0),0);
  const atraso = recTodos.filter(r=>r.status==='atraso').reduce((a,r)=>a+(r.valor||0),0);
  const recebido = recTodos.filter(r=>r.status==='recebido'&&r.data_pagamento?.startsWith(mesAtual)).reduce((a,r)=>a+(r.valor||0),0);
  document.getElementById('kpi-rec-total').textContent = fmtMoeda(totalAberto);
  document.getElementById('kpi-rec-qtd').textContent = abertos.length + ' em aberto';
  document.getElementById('kpi-rec-hoje').textContent = fmtMoeda(venceHoje);
  document.getElementById('kpi-rec-atraso').textContent = fmtMoeda(atraso);
  document.getElementById('kpi-rec-recebido').textContent = fmtMoeda(recebido);
  renderReceber();
}

function filtrarRec(v){recFiltro=v.toLowerCase();renderReceber();}
function filtrarRecStatus(v){recStatusFiltro=v;renderReceber();}
function filtrarRecOrigem(v){recOrigemFiltro=v;renderReceber();}

function renderReceber() {
  const lista=recTodos.filter(r=>{
    const tOk=!recFiltro||r.descricao?.toLowerCase().includes(recFiltro);
    const sOk=!recStatusFiltro||r.status===recStatusFiltro;
    const oOk=!recOrigemFiltro||r.origem===recOrigemFiltro;
    return tOk&&sOk&&oOk;
  });
  document.getElementById('rec-count').textContent=lista.length+' registro'+(lista.length!==1?'s':'');
  if(lista.length===0){
    document.getElementById('rec-table-wrap').innerHTML=`<div class="empty-state"><i class="ti ti-circle-arrow-down" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum lançamento encontrado</div></div>`;
    return;
  }
  const ORIG={os:'OS',avulso:'Avulso',aporte:'Aporte',emprestimo:'Empréstimo',dev:'Devolução'};
  const ST={aberto:{l:'Em aberto',c:'badge-blue'},recebido:{l:'Recebido',c:'badge-success'},atraso:{l:'Em atraso',c:'badge-danger'}};
  document.getElementById('rec-table-wrap').innerHTML=`<table>
    <thead><tr>
      <th style="width:80px">Origem</th>
      <th style="width:220px">Descrição</th>
      <th style="width:90px">Referência</th>
      <th style="width:90px">Vencimento</th>
      <th style="width:110px">Valor</th>
      <th style="width:90px">Status</th>
      <th style="width:90px"></th>
    </tr></thead>
    <tbody>${lista.map(r=>{
      const st=ST[r.status]||{l:r.status,c:'badge-gray'};
      const venc=r.data_vencimento||'—';
      const vencColor=r.status==='atraso'?'color:var(--danger);font-weight:500':r.data_vencimento===hoje()?'color:var(--warning);font-weight:500':'';
      return `<tr>
        <td><span class="badge badge-blue">${ORIG[r.origem]||r.origem}</span></td>
        <td><div style="font-weight:500;color:var(--navy)">${r.descricao||'—'}</div><div style="font-size:10px;color:var(--text-3)">${r.categoria||''}</div></td>
        <td style="font-size:11px;color:var(--text-3)">${r.data_referencia||'—'}</td>
        <td style="font-size:12px;${vencColor}">${venc}</td>
        <td style="font-weight:500;color:var(--navy)">${fmtMoeda(r.valor)}</td>
        <td><span class="badge ${st.c}">${st.l}</span></td>
        <td>${r.status!=='recebido'?`<button class="btn btn-success btn-sm" onclick="abrirBaixaRec('${r.id}')">Baixar</button>`:'<span style="font-size:11px;color:var(--text-3)">✅ Quitado</span>'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function abrirModalRec(){
  document.getElementById('rec-ref').value=hoje();
  document.getElementById('rec-venc').value=hoje();
  onRecOrigem();
  openModal('rec');
}

function onRecOrigem(){
  const o=document.getElementById('rec-origem').value;
  const soCaixa=['aporte','emprestimo'].includes(o);
  document.getElementById('rec-socaixa-wrap').style.display=soCaixa?'block':'none';
  document.getElementById('rec-cat-wrap').style.display=soCaixa?'none':'flex';
}

async function salvarReceber(){
  const desc=document.getElementById('rec-desc').value.trim();
  const valor=parseFloat(document.getElementById('rec-valor').value)||0;
  if(!desc){toast('Informe a descrição.','error');return;}
  if(!valor){toast('Informe o valor.','error');return;}
  const origem=document.getElementById('rec-origem').value;
  const soCaixa=['aporte','emprestimo'].includes(origem);
  const {error}=await db.from('contas_receber').insert({
    oficina_id:APP.oficina.id,
    origem,descricao:desc,
    categoria:soCaixa?origem:document.getElementById('rec-cat').value,
    data_referencia:document.getElementById('rec-ref').value,
    data_vencimento:document.getElementById('rec-venc').value,
    valor,valor_liquido:valor,
    forma_pagamento:document.getElementById('rec-forma').value,
    status:'aberto',so_caixa:soCaixa,
  });
  if(error){toast('Erro: '+error.message,'error');return;}
  closeModal('rec');
  toast('Lançamento salvo!','success');
  await carregarReceber();
}

function abrirBaixaRec(id){
  recAtual=recTodos.find(r=>r.id===id);
  if(!recAtual)return;
  document.getElementById('baixa-rec-sub').textContent=recAtual.descricao+' · '+fmtMoeda(recAtual.valor);
  document.getElementById('baixa-rec-data').value=hoje();
  document.getElementById('baixa-rec-taxa').value='0';
  document.getElementById('baixa-rec-antec').value='0';
  calcBaixaRec();
  openModal('baixa-rec');
}

function calcBaixaRec(){
  if(!recAtual)return;
  const forma=document.getElementById('baixa-rec-forma').value;
  document.getElementById('baixa-rec-taxa').value=(TAXAS_CARTAO[forma]||0).toFixed(2);
  const bruto=recAtual.valor;
  const taxa=(parseFloat(document.getElementById('baixa-rec-taxa').value)||0)/100;
  const antec=(parseFloat(document.getElementById('baixa-rec-antec').value)||0)/100;
  const tV=bruto*taxa, aV=bruto*antec;
  document.getElementById('bb-bruto').textContent=fmtMoeda(bruto);
  document.getElementById('bb-trans').textContent='- '+fmtMoeda(tV);
  document.getElementById('bb-antec').textContent='- '+fmtMoeda(aV);
  document.getElementById('bb-liq').textContent=fmtMoeda(bruto-tV-aV);
}

async function confirmarBaixaRec(){
  if(!recAtual)return;
  const bruto=recAtual.valor;
  const taxa=(parseFloat(document.getElementById('baixa-rec-taxa').value)||0)/100;
  const antec=(parseFloat(document.getElementById('baixa-rec-antec').value)||0)/100;
  const liq=bruto-(bruto*taxa)-(bruto*antec);
  const {error}=await db.from('contas_receber').update({
    status:'recebido',
    data_pagamento:document.getElementById('baixa-rec-data').value,
    valor_taxa_transacao:bruto*taxa,
    valor_taxa_antecipacao:bruto*antec,
    valor_liquido:liq,
  }).eq('id',recAtual.id);
  if(error){toast('Erro: '+error.message,'error');return;}
  closeModal('baixa-rec');
  toast('Recebimento confirmado!','success');
  recAtual=null;
  await carregarReceber();
}

// ============================================================
// CONTAS A PAGAR
// ============================================================
let pagTodos=[], pagFiltro='', pagStatusFiltro='', pagOrigemFiltro='';
let pagAtual=null;

async function carregarPagar(){
  if(!APP.oficina)return;
  document.getElementById('pag-table-wrap').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const {data}=await db.from('contas_pagar').select('*').eq('oficina_id',APP.oficina.id).order('data_vencimento');
  pagTodos=data||[];
  const mesAtual=new Date().toISOString().slice(0,7);
  const abertos=pagTodos.filter(p=>p.status==='aberto'||p.status==='atraso');
  const totalAberto=abertos.reduce((a,p)=>a+(p.valor||0),0);
  const venceHoje=pagTodos.filter(p=>p.data_vencimento===hoje()&&p.status==='aberto').reduce((a,p)=>a+(p.valor||0),0);
  const atraso=pagTodos.filter(p=>p.status==='atraso').reduce((a,p)=>a+(p.valor||0),0);
  const pago=pagTodos.filter(p=>p.status==='pago'&&p.data_pagamento?.startsWith(mesAtual)).reduce((a,p)=>a+(p.valor||0),0);
  document.getElementById('kpi-pag-total').textContent=fmtMoeda(totalAberto);
  document.getElementById('kpi-pag-qtd').textContent=abertos.length+' em aberto';
  document.getElementById('kpi-pag-hoje').textContent=fmtMoeda(venceHoje);
  document.getElementById('kpi-pag-atraso').textContent=fmtMoeda(atraso);
  document.getElementById('kpi-pag-pago').textContent=fmtMoeda(pago);
  renderPagar();
}

function filtrarPag(v){pagFiltro=v.toLowerCase();renderPagar();}
function filtrarPagStatus(v){pagStatusFiltro=v;renderPagar();}
function filtrarPagOrigem(v){pagOrigemFiltro=v;renderPagar();}

function renderPagar(){
  const lista=pagTodos.filter(p=>{
    const tOk=!pagFiltro||p.descricao?.toLowerCase().includes(pagFiltro);
    const sOk=!pagStatusFiltro||p.status===pagStatusFiltro;
    const oOk=!pagOrigemFiltro||p.origem===pagOrigemFiltro;
    return tOk&&sOk&&oOk;
  });
  document.getElementById('pag-count').textContent=lista.length+' registro'+(lista.length!==1?'s':'');
  if(lista.length===0){
    document.getElementById('pag-table-wrap').innerHTML=`<div class="empty-state"><i class="ti ti-circle-arrow-up" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum lançamento encontrado</div></div>`;
    return;
  }
  const ORIG={comp:'Compromisso',nota:'Nota peças'};
  const ST={aberto:{l:'Em aberto',c:'badge-blue'},pago:{l:'Pago',c:'badge-success'},atraso:{l:'Em atraso',c:'badge-danger'}};
  document.getElementById('pag-table-wrap').innerHTML=`<table>
    <thead><tr>
      <th style="width:100px">Origem</th>
      <th style="width:210px">Descrição</th>
      <th style="width:90px">Referência</th>
      <th style="width:90px">Vencimento</th>
      <th style="width:110px">Valor</th>
      <th style="width:90px">Status</th>
      <th style="width:90px"></th>
    </tr></thead>
    <tbody>${lista.map(p=>{
      const st=ST[p.status]||{l:p.status,c:'badge-gray'};
      const vencColor=p.status==='atraso'?'color:var(--danger);font-weight:500':p.data_vencimento===hoje()?'color:var(--warning);font-weight:500':'';
      const recBadge=p.recorrente?'<span class="badge badge-purple" style="font-size:10px;margin-left:4px">🔄</span>':'';
      return `<tr>
        <td><span class="badge badge-warning">${ORIG[p.origem]||p.origem}</span></td>
        <td><div style="font-weight:500;color:var(--navy)">${p.descricao||'—'}${recBadge}</div><div style="font-size:10px;color:var(--text-3)">${p.categoria||''}</div></td>
        <td style="font-size:11px;color:var(--text-3)">${p.data_referencia||'—'}</td>
        <td style="font-size:12px;${vencColor}">${p.data_vencimento||'—'}</td>
        <td style="font-weight:500;color:var(--navy)">${fmtMoeda(p.valor)}</td>
        <td><span class="badge ${st.c}">${st.l}</span></td>
        <td>${p.status!=='pago'?`<button class="btn btn-danger btn-sm" onclick="abrirBaixaPag('${p.id}')">Pagar</button>`:'<span style="font-size:11px;color:var(--text-3)">✅ Pago</span>'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function abrirModalPag(){
  document.getElementById('pag-ref').value=hoje();
  document.getElementById('pag-venc').value=hoje();
  document.getElementById('toggle-recorrente').classList.remove('on');
  document.getElementById('recorrente-wrap').style.display='none';
  openModal('pag');
}

function toggleRecorrente(){
  const on=document.getElementById('toggle-recorrente').classList.contains('on');
  document.getElementById('recorrente-wrap').style.display=on?'block':'none';
}

async function salvarPagar(){
  const desc=document.getElementById('pag-desc').value.trim();
  const valorTotal=parseFloat(document.getElementById('pag-valor').value)||0;
  if(!desc){toast('Informe a descrição.','error');return;}
  if(!valorTotal){toast('Informe o valor.','error');return;}
  const n=parseInt(document.getElementById('pag-parcelas').value)||1;
  const vencBase=new Date(document.getElementById('pag-venc').value+'T12:00:00');
  const recorrente=document.getElementById('toggle-recorrente').classList.contains('on');
  const freq=document.getElementById('pag-freq').value;
  const mesesFreq={mensal:1,bimestral:2,trimestral:3,anual:12};
  const incr=mesesFreq[freq]||1;
  const pv=valorTotal/n;
  const inserts=[];
  for(let i=0;i<n;i++){
    const d=new Date(vencBase);
    d.setMonth(d.getMonth()+i);
    inserts.push({
      oficina_id:APP.oficina.id,
      origem:document.getElementById('pag-origem').value,
      descricao:n>1?`${desc} (${i+1}/${n})`:desc,
      categoria:document.getElementById('pag-cat').value,
      data_referencia:document.getElementById('pag-ref').value,
      data_vencimento:d.toISOString().split('T')[0],
      valor:parseFloat(pv.toFixed(2)),
      forma_pagamento:document.getElementById('pag-forma').value,
      status:'aberto',recorrente,
      frequencia_recorrencia:recorrente?freq:null,
    });
  }
  // Se recorrente, gera os próximos 11 meses além das parcelas
  if(recorrente&&n===1){
    for(let i=1;i<12;i++){
      const d=new Date(vencBase);
      d.setMonth(d.getMonth()+i*incr);
      inserts.push({
        oficina_id:APP.oficina.id,
        origem:document.getElementById('pag-origem').value,
        descricao:`${desc} (${i+1}/12)`,
        categoria:document.getElementById('pag-cat').value,
        data_referencia:d.toISOString().split('T')[0],
        data_vencimento:d.toISOString().split('T')[0],
        valor:valorTotal,
        forma_pagamento:document.getElementById('pag-forma').value,
        status:'aberto',recorrente:true,
        frequencia_recorrencia:freq,
      });
    }
  }
  const {error}=await db.from('contas_pagar').insert(inserts);
  if(error){toast('Erro: '+error.message,'error');return;}
  closeModal('pag');
  toast(`Salvo! ${inserts.length>1?inserts.length+' parcelas geradas.':''}`.trim(),'success');
  await carregarPagar();
}

function abrirBaixaPag(id){
  pagAtual=pagTodos.find(p=>p.id===id);
  if(!pagAtual)return;
  document.getElementById('baixa-pag-sub').textContent=pagAtual.descricao+' · '+fmtMoeda(pagAtual.valor);
  document.getElementById('baixa-pag-data').value=hoje();
  openModal('baixa-pag');
}

async function confirmarBaixaPag(){
  if(!pagAtual)return;
  const {error}=await db.from('contas_pagar').update({
    status:'pago',
    data_pagamento:document.getElementById('baixa-pag-data').value,
  }).eq('id',pagAtual.id);
  if(error){toast('Erro: '+error.message,'error');return;}
  closeModal('baixa-pag');
  toast('Pagamento confirmado!','success');
  pagAtual=null;
  await carregarPagar();
}

// ============================================================
// CONTAS BANCÁRIAS
// ============================================================
async function carregarBancario(){
  if(!APP.oficina)return;
  document.getElementById('banc-cards-wrap').innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const {data}=await db.from('contas_bancarias').select('*').eq('oficina_id',APP.oficina.id).order('apelido');
  const contas=data||[];
  const totalSaldo=contas.reduce((a,c)=>a+(c.saldo_atual||0),0);
  document.getElementById('kpi-banc-saldo').textContent=fmtMoeda(totalSaldo);
  document.getElementById('kpi-banc-contas').textContent=contas.length;
  // Busca totais de receber e pagar
  const hoje2=hoje();
  const em30=new Date();em30.setDate(em30.getDate()+30);const em30s=em30.toISOString().split('T')[0];
  const [{data:recD},{data:pagD}]=await Promise.all([
    db.from('contas_receber').select('valor').eq('oficina_id',APP.oficina.id).eq('status','aberto').lte('data_vencimento',em30s),
    db.from('contas_pagar').select('valor').eq('oficina_id',APP.oficina.id).eq('status','aberto').lte('data_vencimento',em30s),
  ]);
  const totalRec=(recD||[]).reduce((a,r)=>a+(r.valor||0),0);
  const totalPag=(pagD||[]).reduce((a,p)=>a+(p.valor||0),0);
  document.getElementById('kpi-banc-rec').textContent=fmtMoeda(totalRec);
  document.getElementById('kpi-banc-pag').textContent=fmtMoeda(totalPag);
  if(contas.length===0){
    document.getElementById('banc-cards-wrap').innerHTML=`<div class="empty-state"><i class="ti ti-building-bank" style="color:var(--blue)"></i><div class="empty-state-title">Nenhuma conta bancária cadastrada</div></div>`;
    return;
  }
  const CORES=['#f97316','#6c3fc5','#1a8f5c','#2d7dd2','#c0392b','#0e7c7b'];
  document.getElementById('banc-cards-wrap').innerHTML=contas.map((c,i)=>`
    <div style="background:var(--surface);border-radius:var(--radius-xl);border:1px solid var(--border);overflow:hidden;">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="width:36px;height:36px;border-radius:var(--radius-md);background:${c.cor||CORES[i%CORES.length]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${(c.banco||'B')[0]}</div>
          <div><div style="font-size:13px;font-weight:500;color:var(--navy)">${c.apelido||c.banco}</div><div style="font-size:11px;color:var(--text-3)">${c.tipo||'—'}</div></div>
        </div>
        <div style="font-size:11px;color:var(--text-3);font-family:monospace">Ag: ${c.agencia||'—'} · CC: ${c.conta||'—'}</div>
      </div>
      <div style="padding:14px 16px;">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Saldo atual</div>
        <div style="font-size:22px;font-weight:500;color:${(c.saldo_atual||0)<0?'var(--danger)':'var(--navy)'}">${fmtMoeda(c.saldo_atual)}</div>
      </div>
    </div>`).join('');
}

async function salvarConta(){
  const banco=document.getElementById('banc-banco').value;
  const saldo=parseFloat(document.getElementById('banc-saldo').value)||0;
  const CORES=['#f97316','#6c3fc5','#1a8f5c','#2d7dd2','#c0392b'];
  const {data:existing}=await db.from('contas_bancarias').select('id').eq('oficina_id',APP.oficina.id);
  const cor=CORES[(existing?.length||0)%CORES.length];
  const {error}=await db.from('contas_bancarias').insert({
    oficina_id:APP.oficina.id,banco,
    apelido:document.getElementById('banc-apelido').value||banco,
    tipo:document.getElementById('banc-tipo').value,
    agencia:document.getElementById('banc-ag').value,
    conta:document.getElementById('banc-conta').value,
    saldo_inicial:saldo,saldo_atual:saldo,cor,status:'ativo',
  });
  if(error){toast('Erro: '+error.message,'error');return;}
  closeModal('banc');
  toast('Conta bancária salva!','success');
  await carregarBancario();
}

// ============================================================
// RH — FUNCIONÁRIOS
// ============================================================
let funcTodos = [], funcFiltro = '', funcCargoFiltro = '';

function calcProvisoes(salario) {
  const dec = salario / 12;
  const ferias = salario / 12;
  const tercFerias = ferias / 3;
  const fgts = (salario + dec + ferias) * 0.08;
  const total = dec + ferias + tercFerias + fgts;
  return { dec, ferias, tercFerias, fgts, total, custoReal: salario + total };
}

async function carregarRH() {
  if (!APP.oficina) return;
  document.getElementById('func-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('funcionarios').select('*').eq('oficina_id', APP.oficina.id).order('nome');
  if (error) { toast('Erro ao carregar equipe', 'error'); return; }
  funcTodos = data || [];

  // KPIs
  const total = funcTodos.length;
  const prods = funcTodos.filter(f => f.tipo_funcao === 'Produtivo').length;
  const folha = funcTodos.reduce((a, f) => a + (f.salario || 0), 0);
  const custoReal = funcTodos.filter(f => f.tipo_registro === 'CLT').reduce((a, f) => {
    const p = calcProvisoes(f.salario || 0);
    return a + p.custoReal;
  }, 0) + funcTodos.filter(f => f.tipo_registro !== 'CLT').reduce((a, f) => a + (f.salario || 0), 0);

  document.getElementById('kpi-func-total').textContent = total;
  document.getElementById('kpi-func-prod').textContent = prods;
  document.getElementById('kpi-folha').textContent = 'R$ ' + folha.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  document.getElementById('kpi-custo-real').textContent = 'R$ ' + Math.round(custoReal).toLocaleString('pt-BR');

  renderFuncionarios();
}

function filtrarFuncionarios(v) { funcFiltro = v.toLowerCase(); renderFuncionarios(); }
function filtrarFuncCargo(v) { funcCargoFiltro = v; renderFuncionarios(); }

function renderFuncionarios() {
  const lista = funcTodos.filter(f => {
    const tOk = !funcFiltro || f.nome?.toLowerCase().includes(funcFiltro) || f.email?.toLowerCase().includes(funcFiltro);
    const cOk = !funcCargoFiltro || f.cargo === funcCargoFiltro;
    return tOk && cOk;
  });
  document.getElementById('func-count').textContent = lista.length + ' funcionário' + (lista.length !== 1 ? 's' : '');
  if (lista.length === 0) {
    document.getElementById('func-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-users-group" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum funcionário cadastrado</div></div>`;
    return;
  }
  document.getElementById('func-table-wrap').innerHTML = `
    <table>
      <thead><tr>
        <th style="width:200px">Funcionário</th>
        <th style="width:140px">Cargo</th>
        <th style="width:80px">Tipo</th>
        <th style="width:70px">Registro</th>
        <th style="width:110px">Salário base</th>
        <th style="width:110px">Custo real</th>
        <th style="width:70px">Status</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map((f, i) => {
        const p = f.tipo_registro === 'CLT' ? calcProvisoes(f.salario || 0) : { custoReal: f.salario || 0 };
        const tipoBadge = f.tipo_funcao === 'Produtivo' ? 'badge-blue' : f.tipo_funcao === 'ADM' ? 'badge-purple' : 'badge-warning';
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:8px;">
            <div style="width:30px;height:30px;border-radius:50%;background:${CORES_AV[i % CORES_AV.length]};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">${f.nome?.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>
            <div><div style="font-weight:500;color:var(--navy)">${f.nome}</div><div style="font-size:10px;color:var(--text-3)">${f.email || ''}</div></div>
          </div></td>
          <td style="font-size:12px;color:var(--text-2)">${f.cargo || '—'}</td>
          <td><span class="badge ${tipoBadge}">${f.tipo_funcao || '—'}</span></td>
          <td style="font-size:11px;color:var(--text-3)">${f.tipo_registro || 'CLT'}</td>
          <td style="font-weight:500">R$ ${(f.salario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="font-weight:500;color:var(--danger)">R$ ${Math.round(p.custoReal).toLocaleString('pt-BR')}</td>
          <td><span style="font-size:11px;color:var(--success)">● Ativo</span></td>
          <td><button class="action-btn" onclick="excluirFuncionario('${f.id}')"><i class="ti ti-trash"></i></button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

function onFuncCargo() {
  const cargo = document.getElementById('func-cargo')?.value || '';
  const tipoEl = document.getElementById('func-tipo');
  if (tipoEl) tipoEl.value = CARGO_TIPO[cargo] || 'Operação';
}

function openModalFuncionario() {
  document.getElementById('func-modal-title').textContent = 'Novo Funcionário';
  onFuncCargo();
  openModal('func');
}

async function salvarFuncionario() {
  const nome = document.getElementById('func-nome').value.trim();
  if (!nome) { toast('Informe o nome.', 'error'); return; }
  const cargo = document.getElementById('func-cargo').value;
  const { error } = await db.from('funcionarios').insert({
    oficina_id: APP.oficina.id, nome,
    cpf: document.getElementById('func-cpf').value,
    telefone: document.getElementById('func-tel').value,
    email: document.getElementById('func-email').value,
    endereco: document.getElementById('func-end').value,
    cargo,
    tipo_funcao: CARGO_TIPO[cargo] || 'Operação',
    tipo_registro: document.getElementById('func-reg').value,
    data_admissao: document.getElementById('func-admissao').value || null,
    salario: parseFloat(document.getElementById('func-salario').value) || 0,
    pix: document.getElementById('func-pix').value,
    status: 'ativo',
  });
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  closeModal('func');
  toast('Funcionário salvo!', 'success');
  await carregarRH();
  await carregarMecanicosBase();
}

async function excluirFuncionario(id) {
  if (!confirm('Excluir este funcionário?')) return;
  await db.from('funcionarios').delete().eq('id', id);
  toast('Funcionário excluído', 'success');
  await carregarRH();
}

// ============================================================
// FORNECEDORES
// ============================================================
let fornTodos = [], fornFiltro = '', fornCatFiltro = '';

async function carregarFornecedores() {
  if (!APP.oficina) return;
  document.getElementById('forn-table-wrap').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  const { data, error } = await db.from('fornecedores').select('*').eq('oficina_id', APP.oficina.id).order('nome');
  if (error) { toast('Erro ao carregar fornecedores', 'error'); return; }
  fornTodos = data || [];

  // KPIs
  const total = fornTodos.length;
  const cats = [...new Set(fornTodos.flatMap(f => f.categorias || []))].length;
  const pix = fornTodos.filter(f => f.forma_pagamento === 'PIX').length;
  document.getElementById('kpi-forn-total').textContent = total;
  document.getElementById('kpi-forn-cats').textContent = cats || '—';
  document.getElementById('kpi-forn-pend').textContent = '—';
  document.getElementById('kpi-forn-pix').textContent = pix;

  renderFornecedores();
}

function filtrarFornecedores(v) { fornFiltro = v.toLowerCase(); renderFornecedores(); }
function filtrarFornCat(v) { fornCatFiltro = v; renderFornecedores(); }

function renderFornecedores() {
  const lista = fornTodos.filter(f => {
    const tOk = !fornFiltro || f.nome?.toLowerCase().includes(fornFiltro) || f.cnpj?.includes(fornFiltro);
    const cOk = !fornCatFiltro || (f.categorias || []).includes(fornCatFiltro);
    return tOk && cOk;
  });
  document.getElementById('forn-count').textContent = lista.length + ' fornecedor' + (lista.length !== 1 ? 'es' : '');
  if (lista.length === 0) {
    document.getElementById('forn-table-wrap').innerHTML = `<div class="empty-state"><i class="ti ti-truck" style="color:var(--blue)"></i><div class="empty-state-title">Nenhum fornecedor cadastrado</div></div>`;
    return;
  }
  document.getElementById('forn-table-wrap').innerHTML = `
    <table>
      <thead><tr>
        <th style="width:210px">Fornecedor</th>
        <th style="width:120px">Contato</th>
        <th style="width:110px">Categorias</th>
        <th style="width:90px">Prazo pgto</th>
        <th style="width:90px">Forma pref.</th>
        <th style="width:70px">Status</th>
        <th style="width:40px"></th>
      </tr></thead>
      <tbody>${lista.map((f, i) => {
        const catHtml = (f.categorias || []).slice(0, 2).map(c => `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:var(--blue-bg);color:var(--blue);font-weight:500">${c}</span>`).join(' ');
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:9px;">
            <div style="width:30px;height:30px;border-radius:8px;background:${CORES_AV[i % CORES_AV.length]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">${f.nome?.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>
            <div><div style="font-weight:500;color:var(--navy)">${f.nome}</div><div style="font-size:10px;color:var(--text-3);font-family:monospace">${f.cnpj || ''}</div></div>
          </div></td>
          <td style="font-size:12px;color:var(--text-2)">${f.representante || f.telefone || '—'}</td>
          <td>${catHtml || '<span style="color:var(--text-3);font-size:11px">—</span>'}</td>
          <td style="font-size:12px;color:var(--text-2)">${f.prazo_pagamento || '—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${f.forma_pagamento || '—'}</td>
          <td><span class="badge badge-success">Ativo</span></td>
          <td><button class="action-btn" onclick="excluirFornecedor('${f.id}')"><i class="ti ti-trash"></i></button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function salvarFornecedor() {
  const nome = document.getElementById('forn-nome').value.trim();
  if (!nome) { toast('Informe a razão social.', 'error'); return; }
  const catsRaw = document.getElementById('forn-cats').value;
  const cats = catsRaw ? catsRaw.split(',').map(c => c.trim()).filter(Boolean) : [];
  const { error } = await db.from('fornecedores').insert({
    oficina_id: APP.oficina.id, nome,
    cnpj: document.getElementById('forn-cnpj').value,
    telefone: document.getElementById('forn-tel').value,
    email: document.getElementById('forn-email').value,
    representante: document.getElementById('forn-rep').value,
    endereco: document.getElementById('forn-end').value,
    prazo_pagamento: document.getElementById('forn-prazo').value,
    forma_pagamento: document.getElementById('forn-forma').value,
    categorias: cats,
    status: 'ativo',
  });
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  closeModal('forn');
  toast('Fornecedor salvo!', 'success');
  await carregarFornecedores();
}

async function excluirFornecedor(id) {
  if (!confirm('Excluir este fornecedor?')) return;
  await db.from('fornecedores').delete().eq('id', id);
  toast('Fornecedor excluído', 'success');
  await carregarFornecedores();
}

function navigate(pagina, navItem) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pagina);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navItem) navItem.classList.add('active');
  const cfg = PAGE_CONFIG[pagina] || { title: pagina, sub: '', actions: '' };
  document.getElementById('topbar-title').textContent = cfg.title;
  document.getElementById('topbar-sub').textContent = (APP.oficina?.nome || '') + (cfg.sub ? ' — ' + cfg.sub : '');
  document.getElementById('topbar-actions').innerHTML = cfg.actions;
  // Define data padrão se for OS
  if (pagina === 'os') {
    const el = document.getElementById('os-data');
    if (el) el.value = new Date().toISOString().split('T')[0];
  }
  // Carrega dados da página
  if (PAGE_LOADERS[pagina]) PAGE_LOADERS[pagina]();
}

// ============================================================
// MODAIS
// ============================================================
function openModal(id) { document.getElementById('modal-' + id).classList.add('open'); }
function closeModal(id) { document.getElementById('modal-' + id).classList.remove('open'); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// ============================================================
// TOAST
// ============================================================
function toast(msg, tipo = 'default') {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.innerHTML = `<i class="ti ti-${tipo==='success'?'check':tipo==='error'?'x':'info-circle'}"></i> ${msg}`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ============================================================
// INIT
// ============================================================
checkSession();
