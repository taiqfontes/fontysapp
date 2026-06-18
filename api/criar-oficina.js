// api/criar-oficina.js
// Cria uma nova oficina + usuário de acesso (responsável pela oficina).
// Usa a Service Role Key do Supabase, que NUNCA deve ir para o front-end.
// A Service Role Key fica configurada na Vercel como variável de ambiente:
//   SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://iirmasivaopsmhxtrfdq.supabase.co';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-master-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return res.status(500).json({ error: 'Service Role Key não configurada no servidor.' });
    }

    const { nomeOficina, emailResponsavel, senhaResponsavel, nomeResponsavel } = req.body || {};

    if (!nomeOficina || !emailResponsavel || !senhaResponsavel) {
      return res.status(400).json({ error: 'Preencha nome da oficina, e-mail e senha.' });
    }
    if (senhaResponsavel.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const admin = createClient(SUPABASE_URL, serviceKey);

    // 1. Cria a oficina
    const { data: oficina, error: errOficina } = await admin
      .from('oficinas')
      .insert({ nome: nomeOficina })
      .select()
      .single();

    if (errOficina) {
      return res.status(500).json({ error: 'Erro ao criar oficina: ' + errOficina.message });
    }

    // 2. Cria o usuário de autenticação
    const { data: userData, error: errUser } = await admin.auth.admin.createUser({
      email: emailResponsavel,
      password: senhaResponsavel,
      email_confirm: true,
    });

    if (errUser) {
      // Reverte a oficina criada para não deixar lixo no banco
      await admin.from('oficinas').delete().eq('id', oficina.id);
      return res.status(500).json({ error: 'Erro ao criar usuário: ' + errUser.message });
    }

    // 3. Vincula o usuário à oficina
    const { error: errVinculo } = await admin.from('usuarios').insert({
      user_id: userData.user.id,
      oficina_id: oficina.id,
      nome: nomeResponsavel || nomeOficina,
      perfil: 'admin',
    });

    if (errVinculo) {
      // Reverte tudo em caso de falha no vínculo
      await admin.auth.admin.deleteUser(userData.user.id);
      await admin.from('oficinas').delete().eq('id', oficina.id);
      return res.status(500).json({ error: 'Erro ao vincular usuário: ' + errVinculo.message });
    }

    return res.status(200).json({
      success: true,
      oficina: { id: oficina.id, nome: oficina.nome },
      usuario: { id: userData.user.id, email: emailResponsavel },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro inesperado: ' + e.message });
  }
};
