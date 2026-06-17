// Vercel Serverless Function — consulta o saldo de créditos disponíveis
// Endpoint real: GET /api/saldo-placa?token=YYY
export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: 'Parâmetro "token" é obrigatório.' });
  }

  try {
    const url = `https://wdapi2.com.br/saldo/${token}`;
    const apiRes = await fetch(url);
    const data = await apiRes.json();
    return res.status(apiRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao consultar o saldo.', detail: err.message });
  }
}
