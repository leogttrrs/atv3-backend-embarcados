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
    const { condomino_id, locker_id, tamanho_encomenda, compartimento_id } = req.body;

    if (!condomino_id || !locker_id || !tamanho_encomenda) {
        return res.status(400).json({ error: "Os campos 'condomino_id', 'locker_id' e 'tamanho_encomenda' são obrigatórios." });
    }

    const tamanhoFormatado = tamanho_encomenda.toUpperCase();

    if (!['P', 'M', 'G', 'XG'].includes(tamanhoFormatado)) {
        return res.status(400).json({ error: "Tamanho de encomenda inválido. Use apenas P, M ou G." });
    }

    const pesoTamanho = { 'P': 1, 'M': 2, 'G': 3, 'XG': 4 };

    try {

        try {
            await axios.get(`http://localhost:3002/condominos/${condomino_id}`);
        } catch (e) {
            return res.status(400).json({ error: "Condômino não encontrado no sistema. Depósito cancelado." });
        }

        const responseLocker = await axios.get(`http://localhost:3001/lockers/${locker_id}/compartimentos`);
        const compartimentosFisicos = responseLocker.data;

        if (compartimentosFisicos.length === 0) {
            return res.status(400).json({ error: "Este locker não possui compartimentos físicos cadastrados." });
        }

        db.all("SELECT compartimento_id FROM entregas WHERE locker_id = ? AND status = 'DISPONIVEL'", [locker_id], async (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const ocupados = rows.map(r => r.compartimento_id);
            const disponiveis = compartimentosFisicos.filter(c => !ocupados.includes(c.id));
            const inCapacity = disponiveis.filter(c => pesoTamanho[c.tamanho] >= pesoTamanho[tamanhoFormatado]);

            if (inCapacity.length === 0) {
                return res.status(400).json({
                    error: "Nenhum compartimento livre suporta o tamanho desta encomenda.",
                    gavetas_livres_porem_pequenas: disponiveis.map(d => d.tamanho)
                });
            }

            let compartimentoFinal = compartimento_id;

            if (compartimento_id) {
                const alvo = compartimentosFisicos.find(c => c.id === compartimento_id);
                if (!alvo) return res.status(404).json({ error: "Compartimento inexistente." });
                if (ocupados.includes(compartimento_id)) return res.status(400).json({ error: "Este compartimento já está ocupado." });

                if (pesoTamanho[alvo.tamanho] < pesoTamanho[tamanhoFormatado]) {
                    return res.status(400).json({
                        error: `A encomenda (${tamanhoFormatado}) é maior que o compartimento escolhido (${alvo.tamanho}).`,
                        sugestao_id: inCapacity[0].id,
                        mensagem_sugestao: `O compartimento ${inCapacity[0].id} (Tamanho ${inCapacity[0].tamanho}) está livre e comporta o pacote.`
                    });
                }
            } else {
                compartimentoFinal = inCapacity[0].id;
            }

            db.run("INSERT INTO entregas (condomino_id, locker_id, compartimento_id, tamanho, status) VALUES (?, ?, ?, ?, 'DISPONIVEL')", [condomino_id, locker_id, compartimentoFinal, tamanhoFormatado], async function(errInsert) {
                if (errInsert) return res.status(500).json({ error: errInsert.message });
                const entregaId = this.lastID;

                try {
                    await axios.post('http://localhost:3005/abrir', { locker_id, compartimento_id: compartimentoFinal, acao: 'DEPOSITO' });
                    await axios.post('http://localhost:3004/logs', { entrega_id: entregaId, condomino_id, acao: "DEPOSITO", data: new Date().toISOString() });
                    console.log(`[SISTEMA] Notificação enviada ao celular do condômino ID ${condomino_id}: "Sua encomenda chegou!"`);
                } catch (e) {
                    console.log("Aviso: Falha ao contatar Controle de Abertura ou Logging");
                }

                res.status(201).json({
                    message: "Encomenda registrada. Porta aberta.",
                    compartimento_utilizado: compartimentoFinal,
                    entrega_id: entregaId
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: "Erro de comunicação com o serviço de Lockers." });
    }
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

app.get('/entregas/condomino/:condomino_id', (req, res) => {
    const condominoId = req.params.condomino_id;

    db.all("SELECT * FROM entregas WHERE condomino_id = ?", [condominoId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/entregas', (req, res) => {
    db.all("SELECT * FROM entregas", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/entregas/compartimento/:id/ocupado', (req, res) => {
    const compartimentoId = req.params.id;

    db.get(
        "SELECT id FROM entregas WHERE compartimento_id = ? AND status = 'DISPONIVEL'",
        [compartimentoId],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({ ocupado: !!row });
        }
    );
});

app.listen(3003, () => console.log('Controle de Entregas rodando na porta 3003'));