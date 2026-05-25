// controle-entregas/index.js
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./entregas.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS entregas (id INTEGER PRIMARY KEY AUTOINCREMENT, condomino_id INTEGER, locker_id INTEGER, tamanho TEXT, status TEXT)");
});

// Entregador deposita encomenda
app.post('/entregas/depositar', async (req, res) => {
    const { condomino_id, locker_id, tamanho, compartimento_id } = req.body;
    
    db.run("INSERT INTO entregas (condomino_id, locker_id, tamanho, status) VALUES (?, ?, ?, 'DISPONIVEL')", [condomino_id, locker_id, tamanho], async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Simula a abertura da porta para o entregador colocar o pacote
        try {
            await axios.post('http://localhost:3005/abrir', { locker_id, compartimento_id, acao: 'DEPOSITO' });
        } catch (e) {
            console.log("Aviso: Falha ao contatar Controle de Abertura");
        }

        res.status(201).json({ message: "Encomenda registrada. Porta aberta para depósito.", entrega_id: this.lastID });
    });
});

// Condômino retira encomenda
app.post('/entregas/retirar/:id', (req, res) => {
    const entregaId = req.params.id;
    const { compartimento_id } = req.body;

    db.get("SELECT * FROM entregas WHERE id = ?", [entregaId], async (err, row) => {
        if (!row || row.status === 'RETIRADA') return res.status(404).json({ error: "Encomenda não encontrada ou já retirada." });

        db.run("UPDATE entregas SET status = 'RETIRADA' WHERE id = ?", [entregaId], async (errUpdate) => {
            if (errUpdate) return res.status(500).json({ error: errUpdate.message });

            try {
                // 1. Envia requisição para abrir a porta do compartimento
                await axios.post('http://localhost:3005/abrir', { locker_id: row.locker_id, compartimento_id, acao: 'RETIRADA' });
                
                // 2. Envia requisição para o serviço de logging para manter o histórico
                await axios.post('http://localhost:3004/logs', { entrega_id: entregaId, condomino_id: row.condomino_id, acao: "RETIRADA", data: new Date().toISOString() });
            } catch (e) {
                console.log("Aviso: Falha ao comunicar com serviços de Abertura ou Logging");
            }

            res.json({ message: "Porta aberta. Encomenda retirada com sucesso e registrada no log!" });
        });
    });
});

app.listen(3003, () => console.log('Controle de Entregas rodando na porta 3003'));