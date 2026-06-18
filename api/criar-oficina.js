// api/criar-oficina.js
// Cria uma nova oficina + usuário de acesso (responsável pela oficina).
// Usa a Service Role Key do Supabase via chamadas REST diretas (fetch nativo),
// sem depender de bibliotecas externas — não precisa de package.json.
// A Service Role Key fica configurada na Vercel como variável de ambiente:
//   SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://iirmasivaopsmhxtrfdq.supabase.co';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'Service Role Key não configurada no servidor.' });
  }

  const headers = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
  };

  let oficinaIdCriada = null;
  let userIdCriado = null;

  try {
    const { nomeOficina, emailResponsavel, senhaResponsavel, nomeResponsavel } = req.body || {};

    if (!nomeOficina || !emailResponsavel || !senhaResponsavel) {
      return res.status(400).json({ error: 'Preencha nome da oficina, e-mail e senha.' });
    }
    if (senhaResponsavel.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    // 1. Cria a oficina
    const respOficina = await fetch(SUPABASE_URL + '/rest/v1/oficinas', {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ nome: nomeOficina }),
    });
    const oficinaData = await respOficina.json();
    if (!respOficina.ok) {
      return res.status(500).json({ error: 'Erro ao criar oficina: ' + (oficinaData.message || JSON.stringify(oficinaData)) });
    }
    const oficina = Array.isArray(oficinaData) ? oficinaData[0] : oficinaData;
    oficinaIdCriada = oficina.id;

    // 2. Cria o usuário de autenticação
    const respUser = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: emailResponsavel,
        password: senhaResponsavel,
        email_confirm: true,
      }),
    });
    const userData = await respUser.json();
    if (!respUser.ok) {
      await fetch(SUPABASE_URL + '/rest/v1/oficinas?id=eq.' + oficinaIdCriada, { method: 'DELETE', headers });
      return res.status(500).json({ error: 'Erro ao criar usuário: ' + (userData.msg || userData.message || JSON.stringify(userData)) });
    }
    userIdCriado = userData.id;

    // 3. Vincula o usuário à oficina
    const respVinculo = await fetch(SUPABASE_URL + '/rest/v1/usuarios', {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userIdCriado,
        oficina_id: oficinaIdCriada,
        nome: nomeResponsavel || nomeOficina,
        email: emailResponsavel,
        perfil: 'admin',
      }),
    });
    const vinculoData = await respVinculo.json();
    if (!respVinculo.ok) {
      await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userIdCriado, { method: 'DELETE', headers });
      await fetch(SUPABASE_URL + '/rest/v1/oficinas?id=eq.' + oficinaIdCriada, { method: 'DELETE', headers });
      return res.status(500).json({ error: 'Erro ao vincular usuário: ' + (vinculoData.message || JSON.stringify(vinculoData)) });
    }

    return res.status(200).json({
      success: true,
      oficina: { id: oficinaIdCriada, nome: nomeOficina },
      usuario: { id: userIdCriado, email: emailResponsavel },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro inesperado: ' + e.message });
  }
};
