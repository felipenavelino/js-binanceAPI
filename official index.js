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

const symbols = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT'];
const priceHistories = {
    BTCUSDT: [],
    ETHUSDT: [],
    XRPUSDT: [],
    SOLUSDT: []
};

const streamUrl = 'wss://stream.binance.com:9443/ws';
const apiUrl = 'https://api.binance.com/api/v3';

async function fetchHistoricalData(symbol, filter) {
    try {
        const endTime = Date.now();
        let startTime;
        let interval;

        // Definir o período exato e intervalo apropriado
        switch(filter) {
            case '24h':
                startTime = endTime - (24 * 60 * 60 * 1000); // 24 horas atrás
                interval = '5m'; // dados a cada 5 minutos
                break;
            case '7d':
                startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 dias atrás
                interval = '1h'; // dados a cada hora
                break;
            case '30d':
                startTime = endTime - (30 * 24 * 60 * 60 * 1000); // 30 dias atrás
                interval = '4h'; // dados a cada 4 horas
                break;
            case '6m':
                startTime = endTime - (180 * 24 * 60 * 60 * 1000); // 6 meses atrás
                interval = '1d'; // dados diários
                break;
            case '1y':
                startTime = endTime - (365 * 24 * 60 * 60 * 1000); // 1 ano atrás
                interval = '1d'; // dados diários
                break;
            default:
                startTime = endTime - (24 * 60 * 60 * 1000);
                interval = '5m';
        }

        console.log(`Fetching ${symbol} data from ${new Date(startTime)} to ${new Date(endTime)}`);

        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: symbol,
                interval: interval,
                startTime: startTime,
                endTime: endTime,
                limit: 1000
            }
        });

        const data = response.data.map(candle => ({
            timestamp: candle[0],
            price: parseFloat(candle[4]) // Usando preço de fechamento
        }));

        console.log(`Received ${data.length} data points for ${symbol}`);
        return data;

    } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error.message);
        return [];
    }
}

// Inicializar dados históricos
symbols.forEach(symbol => {
    fetchHistoricalData(symbol, '24h');
    
    const ws = new WebSocket(`${streamUrl}/${symbol.toLowerCase()}@ticker`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const timestamp = Date.now();
        const price = parseFloat(data.c);

        priceHistories[symbol].push({ timestamp, price });

        // Manter apenas os dados mais recentes
        const thirtyDaysAgo = timestamp - 30 * 24 * 60 * 60 * 1000;
        priceHistories[symbol] = priceHistories[symbol].filter(entry => 
            entry.timestamp >= thirtyDaysAgo
        );
    };
});

app.get('/api/prices', async (req, res) => {
    try {
        const { filter, symbol } = req.query;
        
        if (!symbols.includes(symbol)) {
            return res.status(404).json({ error: 'Symbol not found' });
        }

        const data = await fetchHistoricalData(symbol, filter);
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'No data available' });
        }

        // Ordenar dados por timestamp
        data.sort((a, b) => a.timestamp - b.timestamp);

        res.json(data);

    } catch (error) {
        console.error('API Error:', error);
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
