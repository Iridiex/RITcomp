const knex = require('./db');
const express = require('express');
const cors = require('cors');
const { runAllocation } = require('./services/allocationService');
const { createRequest, reviewRequest } = require('./services/requestService');

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

app.get('/api/requests', async(req, res) => {
    try {
        const rows = await knex('requests').orderBy('request_id');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load requests' });
    }
});

app.get('/api/inventory', async(req, res) => {
    try {
        const rows = await knex('inventory').orderBy('warehouse_id');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load inventory' });
    }
});

app.get('/api/allocations/log', async(req, res) => {
    try {
        const rows = await knex('allocation_log').orderBy('id', 'desc');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load log' });
    }
});

app.post('/api/requests', async(req, res) => {
    try {
        const result = await createRequest(req.body);
        if (result.errors) {
            return res.status(400).json({ errors: result.errors });
        }
        res.status(201).json(result.request);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not save request' });
    }
});

app.patch('/api/requests/:id/review', async(req, res) => {
    try {
        const result = await reviewRequest(req.params.id, req.body);
        if (result.notFound) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (result.errors) {
            return res.status(400).json({ errors: result.errors });
        }
        res.json(result.request);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not review request' });
    }
});

module.exports = app;