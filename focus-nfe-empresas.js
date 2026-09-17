// api/focus-nfe-empresas.js
//
// Ponte (proxy) entre o Fontys Auto e a API de Empresas da Focus NFe.
// O token da Focus NFe NUNCA fica no index.html (que roda no navegador do
// usuário) — ele mora só aqui, como variável de ambiente na Vercel, e essa
// function é o único lugar que conhece ele.
//
// Configuração necessária no painel da Vercel (Settings → Environment Variables):
//   FOCUS_NFE_TOKEN = <o token gerado no painel da Focus NFe>
//
// Chamadas aceitas a partir do index.html:
//   GET    /api/focus-nfe-empresas?ambiente=homologacao                 → lista empresas
//   GET    /api/focus-nfe-empresas?ambiente=homologacao&id=123          → consulta uma empresa
//   POST   /api/focus-nfe-empresas?ambiente=homologacao                 → cria empresa (corpo = dados da empresa)
//   POST   /api/focus-nfe-empresas?ambiente=homologacao&dry_run=1       → simula a criação, sem gravar
//   PUT    /api/focus-nfe-empresas?ambiente=homologacao&id=123          → atualiza empresa
//   DELETE /api/focus-nfe-empresas?ambiente=homologacao&id=123          → exclui empresa
//
// "ambiente" é OBRIGATÓRIO e por padrão vai pra homologação — assim nada cai
// em produção sem essa escolha ser explícita vindo do front-end.

const HOSTS = {
  homologacao: 'https://homologacao.focusnfe.com.br/v2',
  producao: 'https://api.focusnfe.com.br/v2',
};

module.exports = async function handler(req, res) {
  const token = process.env.FOCUS_NFE_TOKEN;
  if (!token) {
    res.status(500).json({ erro: 'FOCUS_NFE_TOKEN não configurado nas variáveis de ambiente da Vercel.' });
    return;
  }

  const ambiente = (req.query.ambiente || 'homologacao').toString();
  const host = HOSTS[ambiente];
  if (!host) {
    res.status(400).json({ erro: 'Parâmetro "ambiente" inválido. Use "homologacao" ou "producao".' });
    return;
  }

  const { id, dry_run } = req.query;
  let url = `${host}/empresas`;
  if (id) url += `/${encodeURIComponent(id.toString())}`;
  if (dry_run) url += `?dry_run=${dry_run}`;

  // Autenticação HTTP Basic: usuário = token, senha = vazia (padrão Focus NFe)
  const auth = 'Basic ' + Buffer.from(`${token}:`).toString('base64');

  try {
    const respostaFocus = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: (req.method === 'POST' || req.method === 'PUT') ? JSON.stringify(req.body) : undefined,
    });

    const texto = await respostaFocus.text();
    const dados = texto ? JSON.parse(texto) : {};
    res.status(respostaFocus.status).json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao comunicar com a Focus NFe: ' + erro.message });
  }
}
