
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
      ${MESES_PT.map((m,i)=>`<th style="" + (i>mAtivo?"opacity:.4":"") + "">${m}</th>`).join('')}
      <th class="rel-col-total">Total</th>
    </tr></thead><tbody>`;

  // Entradas
  html+=`<tr class="rel-row-grupo"><td>↑ ENTRADAS</td>${entM.map((v,i)=>`<td style="" + (i>mAtivo?"opacity:.4":"") + "color:#7de8b8">${v>0?fmtN(v):"—"}</td>`).join('')}<td class="rel-col-total" style="color:#7de8b8">${fmtN(totalEnt)}</td></tr>`;
  html+=`<tr class="rel-row-linha"><td style="padding-left:16px">Recebimentos de clientes</td>${entM.map((v,i)=>`<td style="" + (i>mAtivo?"opacity:.4":"") + "">${v>0?fmtN(v):"—"}</td>`).join('')}<td class="rel-col-total">${fmtN(totalEnt)}</td></tr>`;

  // Saídas
  html+=`<tr class="rel-row-grupo" style="background:#162338"><td>↓ SAÍDAS</td>${saiM.map((v,i)=>`<td style="" + (i>mAtivo?"opacity:.4":"") + "color:#f5a5a0">${v>0?"("+fmtN(v)+")":"—"}</td>`).join('')}<td class="rel-col-total" style="color:#f5a5a0">${totalSai>0?"("+fmtN(totalSai)+")":"—"}</td></tr>`;
  html+=`<tr class="rel-row-linha"><td style="padding-left:16px">Pagamentos a fornecedores/despesas</td>${saiM.map((v,i)=>`<td style="" + (i>mAtivo?"opacity:.4":"") + "">${v>0?fmtN(v):"—"}</td>`).join('')}<td class="rel-col-total">${fmtN(totalSai)}</td></tr>`;

  // Saldo período
  html+=`<tr class="rel-row-resultado"><td>SALDO DO PERÍODO</td>${entM.map((v,i)=>{const s=v-saiM[i];return `<td style="" + (i>mAtivo?"opacity:.4":"") + "color:${s>=0?"var(--blue)":"var(--danger)"}">${s!==0?(s<0?"("+fmtN(Math.abs(s))+")":fmtN(s)):"—"}</td>`;}).join('')}<td class="rel-col-total" style="color:${saldoPer>=0?"var(--blue)":"var(--danger)"}">${fmtN(saldoPer)}</td></tr>`;

  // Acumulado
  html+=`<tr class="rel-row-final"><td>SALDO ACUMULADO</td>${entM.map((v,i)=>{acum+=(v-saiM[i]);return `<td style="" + (i>mAtivo?"opacity:.4":"") + "color:#7de8b8">${acum!==0?fmtN(acum):"—"}</td>`;}).join('')}<td class="rel-col-total" style="color:#7de8b8">${fmtN(acum)}</td></tr>`;

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
    const totalStyle=neg&&total>0?'color:var(--danger)':'';
    const totalVal=total!==0?(neg?'('+fmtN(total)+')':fmtN(total)):'—';
    const cells=arr.map((v,i)=>{
      const op=i>mAtivo?'opacity:.4':'';
      const clr=neg&&v>0?';color:var(--danger)':'';
      const val=v!==0?(neg?'('+fmtN(v)+')':fmtN(v)):'—';
      return '<td style="'+op+clr+'">'+val+'</td>';
    }).join('');
    return '<tr class="'+cls+'"><td style="padding-left:'+indent+'px">'+label+'</td>'+cells+'<td class="rel-col-total" style="'+totalStyle+'">'+totalVal+'</td></tr>';
  }

  let html=`<table class="rel-table">
    <thead><tr>
      <th>DRE — Competência ${ano}</th>
      ${MESES_PT.map((m,i)=>`<th style="" + (i>mAtivo?"opacity:.4":"") + "">${m}</th>`).join('')}
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
  html+=`<tr class="rel-row-final"><td>9. LUCRO LÍQUIDO ACUMULADO</td>${lucAcuM.map((v,i)=>`<td style="" + (i>mAtivo?"opacity:.4":"") + "color:#7de8b8">${v!==0?fmtN(v):"—"}</td>`).join('')}<td class="rel-col-total" style="color:#7de8b8">${fmtN(acum)}</td></tr>`;
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
  const icon = tipo==='success' ? 'check' : tipo==='error' ? 'x' : 'info-circle';
  t.innerHTML = '<i class="ti ti-' + icon + '"></i> ' + msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ============================================================
// INIT
// ============================================================
checkSession();

// end
