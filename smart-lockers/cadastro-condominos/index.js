const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./condominos.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS condominos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT, locker_id INTEGER)");
});

app.post('/condominos', async (req, res) => {
    const { nome, email, locker_id } = req.body;

    if (!nome || !email || !locker_id) {
        return res.status(400).json({
            error: "Formato inválido. Os campos 'nome', 'email' e 'locker_id' são obrigatórios."
        });
    }

    try {
        await axios.get(`http://localhost:3001/lockers/${locker_id}`);

        db.run("INSERT INTO condominos (nome, email, locker_id) VALUES (?, ?, ?)", [nome, email, locker_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, nome, email, locker_id });
        });
    } catch (error) {
        return res.status(400).json({ error: "O locker_id informado não existe no sistema." });
    }
});

app.get('/condominos', (req, res) => {
    db.all("SELECT * FROM condominos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/condominos/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM condominos WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            return res.status(404).json({ error: "Condômino não encontrado." });
        }
        res.json(row);
    });
});

app.put('/condominos/:id', (req, res) => {
    const id = req.params.id;
    const { nome, email, locker_id } = req.body;

    db.run(
        "UPDATE condominos SET nome = ?, email = ?, locker_id = ? WHERE id = ?",
        [nome, email, locker_id, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Condômino não encontrado" });

            res.json({ message: "Condômino atualizado com sucesso!", id, nome, email, locker_id });
        }
    );
});

app.delete('/condominos/:id', (req, res) => {
    const id = req.params.id;

    db.run("DELETE FROM condominos WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Condômino não encontrado" });

        res.json({ message: "Condômino removido com sucesso!" });
    });
});

app.listen(3002, () => console.log('Cadastro de Condôminos rodando na porta 3002'));