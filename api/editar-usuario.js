// api/editar-usuario.js
// Edita e-mail e/ou senha do usuário responsável de uma oficina.
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

  try {
    const { userId, novoEmail, novaSenha } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório.' });
    }
    if (!novoEmail && !novaSenha) {
      return res.status(400).json({ error: 'Informe um novo e-mail e/ou uma nova senha.' });
    }
    if (novaSenha && novaSenha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    // 1. Atualiza no Supabase Auth (e-mail e/ou senha)
    const payloadAuth = {};
    if (novoEmail) { payloadAuth.email = novoEmail; payloadAuth.email_confirm = true; }
    if (novaSenha) payloadAuth.password = novaSenha;

    const respAuth = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payloadAuth),
    });
    const authData = await respAuth.json();
    if (!respAuth.ok) {
      return res.status(500).json({ error: 'Erro ao atualizar usuário: ' + (authData.msg || authData.message || JSON.stringify(authData)) });
    }

    // 2. Se o e-mail mudou, espelha também na tabela "usuarios" (campo email)
    if (novoEmail) {
      const respTabela = await fetch(SUPABASE_URL + '/rest/v1/usuarios?user_id=eq.' + userId, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ email: novoEmail }),
      });
      if (!respTabela.ok) {
        const tabelaErr = await respTabela.json();
        return res.status(500).json({ error: 'Usuário atualizado, mas falhou ao sincronizar e-mail na tabela: ' + (tabelaErr.message || JSON.stringify(tabelaErr)) });
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Erro inesperado: ' + e.message });
  }
};
