// cadastro-condominos/index.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./condominos.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS condominos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT, locker_id INTEGER)");
});

app.post('/condominos', (req, res) => {
    const { nome, email, locker_id } = req.body;
    db.run("INSERT INTO condominos (nome, email, locker_id) VALUES (?, ?, ?)", [nome, email, locker_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, nome, email, locker_id });
    });
});

app.get('/condominos', (req, res) => {
    db.all("SELECT * FROM condominos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3002, () => console.log('Cadastro de Condôminos rodando na porta 3002'));