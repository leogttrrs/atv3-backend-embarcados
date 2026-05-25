// controle-abertura/index.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/abrir', (req, res) => {
    const { locker_id, compartimento_id, acao } = req.body;
    
    console.log(`\n=========================================`);
    console.log(`[HARDWARE SIMULADO] Acionando relé...`);
    console.log(`Locker ID: ${locker_id}`);
    console.log(`Compartimento ID: ${compartimento_id}`);
    console.log(`Ação: ${acao}`);
    console.log(`Status: PORTA ABERTA COM SUCESSO!`);
    console.log(`=========================================\n`);
    
    res.json({ status: "sucesso", mensagem: "Abertura física realizada." });
});

app.listen(3005, () => console.log('Controle de Abertura rodando na porta 3005'));