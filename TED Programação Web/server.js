const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

app.get('/api/reservas', (req, res) => {
  db.all('SELECT * FROM reservas ORDER BY data, hora', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/reservas', (req, res) => {
  const { nome, celular, campo, data, hora, duracao } = req.body;

  if (!nome || !celular || !campo || !data || !hora || !duracao) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (!/^\d{2}:\d{2}$/.test(hora)) return res.status(400).json({ error: 'Hora inválida' });
  const dur = Number(duracao);
  if (!(dur >= 1 && dur <= 12)) return res.status(400).json({ error: 'Duração inválida' });

  const inicioMin = timeToMinutes(hora);
  const fimMin = inicioMin + dur * 60;

  const sql = 'SELECT * FROM reservas WHERE data = ? AND campo = ?';
  db.all(sql, [data, campo], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const conflito = rows.some(r => {
      const rIni = timeToMinutes(r.hora);
      const rFim = rIni + Number(r.duracao) * 60;
      return inicioMin < rFim && fimMin > rIni;
    });

    if (conflito) {
      return res.status(400).json({ error: 'Horário indisponível — existe uma reserva que se sobrepõe.' });
    }

    const stmt = db.prepare('INSERT INTO reservas (nome, celular, campo, data, hora, duracao) VALUES (?,?,?,?,?,?)');
    stmt.run(nome, celular, campo, data, hora, dur, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    });
    stmt.finalize();
  });
});

app.delete('/api/reservas/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM reservas WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Reserva não encontrada' });
    res.json({ success: true });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
