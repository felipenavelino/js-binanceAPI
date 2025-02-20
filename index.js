const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = 3000;

const symbols = process.env.SYMBOLS?.trim().split(',') || [];
const priceHistories = {
    BTCUSDT: [],
    ETHUSDT: [],
    XRPUSDT: []
};

const streamUrl = process.env.STREAM_URL?.trim();
const apiUrl = process.env.API_URL?.trim();

if (!streamUrl || !apiUrl) {
    console.error("Erro: STREAM_URL ou API_URL não definidos corretamente no .env");
    process.exit(1);
}


async function fetchHistoricalPrices(symbol) {
    try {
        const endTime = Date.now();
        const startTime = endTime - (30 * 24 * 60 * 60 * 1000); 

        const response = await axios.get(`${apiUrl}/klines`, {
            params: {
                symbol: symbol.toUpperCase(),
                interval: '1h',
                limit: 720,
                startTime: startTime,
                endTime: endTime
            }
        });

        if (!response.data || !Array.isArray(response.data)) {
            console.error(`Dados inválidos recebidos para ${symbol}`);
            return;
        }

        priceHistories[symbol] = response.data.map(candle => ({
            timestamp: candle[0],
            price: parseFloat(candle[4])
        }));

        console.log(`Fetched ${priceHistories[symbol].length} historical prices for ${symbol}`);
    } catch (error) {
        console.error(`Erro ao buscar dados históricos para ${symbol}:`, error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

symbols.forEach(symbol => {
    const ws = new WebSocket(`${streamUrl}/${symbol.toLowerCase()}@ticker`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const timestamp = Date.now();
        const price = parseFloat(data.c);

        priceHistories[symbol].push({ timestamp, price });

        const thirtyDaysAgo = timestamp - 30 * 24 * 60 * 60 * 1000;
        priceHistories[symbol] = priceHistories[symbol].filter(entry => 
            entry.timestamp >= thirtyDaysAgo
        );
    };
});

app.get("/api/prices", async (req, res) => {
    const { symbol, filter } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    try {
        if (filter !== '24h' || !priceHistories[symbol]?.length) {
            await fetchHistoricalPrices(symbol);
        }

        const timestamp = Date.now();
        let filteredData = priceHistories[symbol] || [];
        
        switch(filter) {
            case "24h":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 24 * 60 * 60 * 1000
                );
                break;
            case "7d":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 7 * 24 * 60 * 60 * 1000
                );
                break;
            case "30d":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 30 * 24 * 60 * 60 * 1000
                );
                break;
        }

        filteredData.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`Returning ${filteredData.length} entries for ${symbol} with filter ${filter}`);
        
        res.json(filteredData);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.use(express.static("public"));

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});