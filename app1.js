
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