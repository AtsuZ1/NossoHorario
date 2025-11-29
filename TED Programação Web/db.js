// db.js
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DB_PATH = path.join(DATA_DIR, 'reservas.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      celular TEXT NOT NULL,
      campo INTEGER NOT NULL,
      data TEXT NOT NULL,      -- YYYY-MM-DD
      hora TEXT NOT NULL,      -- HH:MM
      duracao INTEGER NOT NULL,-- horas (inteiro)
      criado_em DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
});

module.exports = db;
