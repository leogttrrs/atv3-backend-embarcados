// servico-logging/index.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./logs.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, entrega_id INTEGER, condomino_id INTEGER, acao TEXT, data TEXT)");
});

app.post('/logs', (req, res) => {
    const { entrega_id, condomino_id, acao, data } = req.body;
    db.run("INSERT INTO logs (entrega_id, condomino_id, acao, data) VALUES (?, ?, ?, ?)", [entrega_id, condomino_id, acao, data], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Log salvo com sucesso" });
    });
});

app.get('/logs', (req, res) => {
    db.all("SELECT * FROM logs", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3004, () => console.log('Serviço de Logging rodando na porta 3004'));