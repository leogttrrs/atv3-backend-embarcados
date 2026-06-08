const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SERVICES = {
    lockers: 'http://localhost:3001',
    condominos: 'http://localhost:3002',
    entregas: 'http://localhost:3003',
    logs: 'http://localhost:3004'
};

const proxyRequest = async (req, res, serviceUrl) => {
    try {
        const response = await axios({
            method: req.method,
            url: `${serviceUrl}${req.originalUrl}`,
            data: req.body
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "Erro de comunicação com o microservice." });
        }
    }
};

app.use('/lockers', (req, res) => proxyRequest(req, res, SERVICES.lockers));
app.use('/condominos', (req, res) => proxyRequest(req, res, SERVICES.condominos));
app.use('/entregas', (req, res) => proxyRequest(req, res, SERVICES.entregas));
app.use('/logs', (req, res) => {
    if (req.method !== 'GET') {
        return res.status(403).json({ error: "Acesso negado. Logs são gerados automaticamente pelo sistema e não podem ser alterados." });
    }
    proxyRequest(req, res, SERVICES.logs);
});

app.listen(3000, () => console.log('API Gateway rodando na porta 3000'));