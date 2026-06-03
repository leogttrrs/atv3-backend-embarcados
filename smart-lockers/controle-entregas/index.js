const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./entregas.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS entregas (id INTEGER PRIMARY KEY AUTOINCREMENT, condomino_id INTEGER, locker_id INTEGER, compartimento_id INTEGER, tamanho TEXT, status TEXT)");
});

app.post('/entregas/depositar', async (req, res) => {
    const { condomino_id, locker_id, tamanho, compartimento_id } = req.body;

    db.run("INSERT INTO entregas (condomino_id, locker_id, compartimento_id, tamanho, status) VALUES (?, ?, ?, ?, 'DISPONIVEL')", [condomino_id, locker_id, compartimento_id, tamanho], async function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const entregaId = this.lastID;

        try {
            await axios.post('http://localhost:3005/abrir', { locker_id, compartimento_id, acao: 'DEPOSITO' });
            await axios.post('http://localhost:3004/logs', { entrega_id: entregaId, condomino_id: condomino_id, acao: "DEPOSITO", data: new Date().toISOString() });
        } catch (e) {
            console.log("Aviso: Falha ao contatar Controle de Abertura ou Logging");
        }

        res.status(201).json({ message: "Encomenda registrada. Porta aberta para depósito.", entrega_id: this.lastID });
    });
});

app.post('/entregas/retirar/:id', (req, res) => {
    const entregaId = req.params.id;

    db.get("SELECT * FROM entregas WHERE id = ?", [entregaId], async (err, row) => {
        if (!row || row.status === 'RETIRADA') return res.status(404).json({ error: "Encomenda não encontrada ou já retirada." });

        db.run("UPDATE entregas SET status = 'RETIRADA' WHERE id = ?", [entregaId], async (errUpdate) => {
            if (errUpdate) return res.status(500).json({ error: errUpdate.message });

            try {
                await axios.post('http://localhost:3005/abrir', { locker_id: row.locker_id, compartimento_id: row.compartimento_id, acao: 'RETIRADA' });
                await axios.post('http://localhost:3004/logs', { entrega_id: entregaId, condomino_id: row.condomino_id, acao: "RETIRADA", data: new Date().toISOString() });
            } catch (e) {
                console.log("Aviso: Falha ao comunicar com serviços de Abertura ou Logging");
            }

            res.json({ message: "Porta aberta. Encomenda retirada com sucesso!" });
        });
    });
});

app.listen(3003, () => console.log('Controle de Entregas rodando na porta 3003'));