require('dotenv').config();

const express = require('express');
const cors = require('cors');
const api = require('./src/api/api');

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', api);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
});

app.listen(port, () => {
  console.log(`Harmony API disponível em http://localhost:${port}/api/health`);
});
