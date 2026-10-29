const express = require('express');
const cors = require('cors');
const { runAllocation } = require('./services/allocationService');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.post('/api/allocations/run', async(req, res) => {
    try {
        const summary = await runAllocation();
        res.json(summary);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Allocation failed' });
    }
});

module.exports = app;