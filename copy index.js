const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require("dotenv").config();

const app = express();
const port = 3000;
const User = require('./models/User');

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

// MongoDB Connection
mongoose.connect('mongodb://localhost/crypto_dashboard', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

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
        const startTime = endTime - (365 * 24 * 60 * 60 * 1000); // 1 ano de dados

        const response = await axios.get(`${apiUrl}/klines`, {
            params: {
                symbol: symbol.toUpperCase(),
                interval: '1h',
                limit: 1000, // Aumentado o limite de dados
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
    const { symbol, filter, startTime } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    try {
        if (!priceHistories[symbol]?.length) {
            await fetchHistoricalPrices(symbol);
        }

        const timestamp = Date.now();
        let filteredData = priceHistories[symbol] || [];
        
        switch(filter) {
            case "1d":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 24 * 60 * 60 * 1000
                );
                break;
            case "1w":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 7 * 24 * 60 * 60 * 1000
                );
                break;
            case "1m":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 30 * 24 * 60 * 60 * 1000
                );
                break;
            case "6m":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 180 * 24 * 60 * 60 * 1000
                );
                break;
            case "1y":
                filteredData = filteredData.filter(entry => 
                    entry.timestamp >= timestamp - 365 * 24 * 60 * 60 * 1000
                );
                break;
            default:
                // Se nenhum filtro corresponder, retorna todos os dados
                break;
        }

        // Garante que os dados estão ordenados por timestamp
        filteredData.sort((a, b) => a.timestamp - b.timestamp);

        // Reduz a quantidade de pontos para melhorar a performance
        const maxPoints = 100;
        if (filteredData.length > maxPoints) {
            const step = Math.floor(filteredData.length / maxPoints);
            filteredData = filteredData.filter((_, index) => index % step === 0);
        }

        console.log(`Returning ${filteredData.length} entries for ${symbol} with filter ${filter}`);
        
        res.json(filteredData);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User already exists'
            });
        }

        // Create new user
        const user = await User.create({
            username,
            email,
            password
        });

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Send token in cookie
        res.cookie('jwt', token, {
            expires: new Date(
                Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
            ),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });

        // Remove password from output
        user.password = undefined;

        res.status(201).json({
            status: 'success',
            token,
            data: { user }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password exist
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide email and password'
            });
        }

        // Check if user exists and password is correct
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({
                status: 'error',
                message: 'Incorrect email or password'
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Send token in cookie
        res.cookie('jwt', token, {
            expires: new Date(
                Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
            ),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });

        // Remove password from output
        user.password = undefined;

        res.status(200).json({
            status: 'success',
            token,
            data: { user }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({ status: 'success' });
});

// Protect route middleware
const protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.cookies.jwt) {
            token = req.cookies.jwt;
        }

        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'You are not logged in'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'User no longer exists'
            });
        }

        // Grant access to protected route
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({
            status: 'error',
            message: 'Invalid token'
        });
    }
};

// Protected routes example
app.get('/api/prices', protect, async (req, res) => {
    // Your existing price fetching logic
    // ... existing code ...
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
