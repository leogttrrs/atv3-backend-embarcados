const express = require('express');
const axios = require('axios')
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./lockers.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS lockers (id INTEGER PRIMARY KEY AUTOINCREMENT, condominio TEXT, endereco TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS compartimentos (id INTEGER PRIMARY KEY AUTOINCREMENT, locker_id INTEGER, tamanho TEXT)");
});

app.post('/lockers', (req, res) => {
    const { condominio, endereco } = req.body;

    if (!condominio || !endereco) {
        return res.status(400).json({
            error: "Formato inválido. Os campos 'condominio' e 'endereco' são obrigatórios e não podem estar vazios."
        });
    }

    db.run("INSERT INTO lockers (condominio, endereco) VALUES (?, ?)", [condominio, endereco], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, condominio, endereco });
    });
});

app.get('/lockers/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM lockers WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            return res.status(404).json({ error: "Locker não encontrado." });
        }
        res.json(row);
    });
});

app.get('/lockers', (req, res) => {
    db.all("SELECT * FROM lockers", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/lockers/:id', (req, res) => {
    const id = req.params.id;
    const { condominio, endereco } = req.body;

    db.run(
        "UPDATE lockers SET condominio = ?, endereco = ? WHERE id = ?",
        [condominio, endereco, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Locker não encontrado" });

            res.json({ message: "Locker atualizado com sucesso!", id, condominio, endereco });
        }
    );
});

app.post('/lockers/:id/compartimentos', (req, res) => {
    const locker_id = req.params.id;

    if (!req.body.tamanho) {
        return res.status(400).json({ error: "O campo 'tamanho' é obrigatório." });
    }

    const tamanho = req.body.tamanho.toUpperCase();

    if (!['P', 'M', 'G', 'XG'].includes(tamanho)) {
        return res.status(400).json({ error: "Tamanho inválido. Escolha apenas P, M, G ou XG." });
    }

    db.get("SELECT id FROM lockers WHERE id = ?", [locker_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            return res.status(404).json({ error: "Locker não encontrado para criação do compartimento" });
        }

        db.run("INSERT INTO compartimentos (locker_id, tamanho) VALUES (?, ?)", [locker_id, tamanho], function(errInsert) {
            if (errInsert) return res.status(500).json({ error: errInsert.message });
            res.status(201).json({ id: this.lastID, locker_id, tamanho });
        });
    });
});

app.get('/lockers/:id/compartimentos', (req, res) => {
    const locker_id = req.params.id;
    db.all("SELECT * FROM compartimentos WHERE locker_id = ?", [locker_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/lockers/compartimentos/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const response = await axios.get(`http://localhost:3003/entregas/compartimento/${id}/ocupado`);

        if (response.data.ocupado) {
            return res.status(400).json({
                error: "Operação negada. Não é possível remover um compartimento que possui uma encomenda pendente de retirada."
            });
        }

        db.run("DELETE FROM compartimentos WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Compartimento não encontrado." });

            res.json({ message: "Compartimento removido com sucesso!" });
        });
    } catch (error) {
        console.error("Erro:", error.message);
        res.status(500).json({ error: "Erro de comunicação com o serviço de entregas." });
    }
});

app.listen(3001, () => console.log('Cadastro de Lockers rodando na porta 3001'));