// cadastro-lockers/index.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./lockers.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS lockers (id INTEGER PRIMARY KEY AUTOINCREMENT, condominio TEXT, endereco TEXT)");
});

app.post('/lockers', (req, res) => {
    const { condominio, endereco } = req.body;
    db.run("INSERT INTO lockers (condominio, endereco) VALUES (?, ?)", [condominio, endereco], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, condominio, endereco });
    });
});

app.get('/lockers', (req, res) => {
    db.all("SELECT * FROM lockers", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3001, () => console.log('Cadastro de Lockers rodando na porta 3001'));