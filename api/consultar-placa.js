// Vercel Serverless Function — proxy para evitar bloqueio de CORS
// Endpoint real: GET /api/consultar-placa?placa=XXX&token=YYY
export default async function handler(req, res) {
  const { placa, token } = req.query;

  if (!placa || !token) {
    return res.status(400).json({ message: 'Parâmetros "placa" e "token" são obrigatórios.', recebido: { placa, token } });
  }

  const placaLimpa = String(placa).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  try {
    const url = `https://wdapi2.com.br/consulta/${placaLimpa}/${token}`;
    const apiRes = await fetch(url);
    const data = await apiRes.json();

    // Inclui debug temporário para diagnóstico
    return res.status(apiRes.status).json({ ...data, _debug_url: url, _debug_status: apiRes.status });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao consultar a API de placas.', detail: err.message });
  }
}
