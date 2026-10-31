const { listShipments, assignDriver, pickUp, deliver } = require('./services/shipmentService');
const { buildReport } = require('./services/reportService');
const { toCsv } = require('./reports/csv');
const { writePdf } = require('./reports/pdf');
const { createSite, updateSite, deleteSite } = require('./services/siteService');
const { addStock } = require('./services/stockService');
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

app.get('/api/shelters', async(req, res) => {
    try {
        const rows = await knex('shelters').orderBy('shelter_id');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load shelters' });
    }
});

app.get('/api/warehouses', async (req, res) => {
    try {
        const warehouses = await knex('warehouses').orderBy('warehouse_id');
        res.json(warehouses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function sendResult(res, result, okStatus) {
    if (result.notFound) return res.status(404).json({ error: 'Not found' });
    if (result.errors) return res.status(400).json({ errors: result.errors });
    return res.status(okStatus).json(result.site || result.row);
}

app.post('/api/shelters', async (req, res) => {
    try { sendResult(res, await createSite('shelter', req.body), 201); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shelters/:id', async (req, res) => {
    try { sendResult(res, await updateSite('shelter', req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/warehouses', async (req, res) => {
    try { sendResult(res, await createSite('warehouse', req.body), 201); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/warehouses/:id', async (req, res) => {
    try { sendResult(res, await updateSite('warehouse', req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory', async (req, res) => {
    try { sendResult(res, await addStock(req.body), 201); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

const CSV_COLUMNS = [
    { key: 'request_id', label: 'Request ID' },
    { key: 'shelter_id', label: 'Shelter ID' },
    { key: 'shelter_name', label: 'Shelter' },
    { key: 'item', label: 'Item' },
    { key: 'urgency', label: 'Urgency' },
    { key: 'requested', label: 'Requested' },
    { key: 'allocated', label: 'Allocated' },
    { key: 'shortfall', label: 'Shortfall' },
    { key: 'status', label: 'Status' },
    { key: 'note', label: 'Review note' },
];

function reportName(extension) {
    return 'relief-report-' + new Date().toISOString().slice(0, 10) + '.' + extension;
}

app.get('/api/reports/report.json', async (req, res) => {
    try {
        const report = await buildReport();
        res.attachment(reportName('json'));
        res.send(JSON.stringify(report, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/requests.csv', async (req, res) => {
    try {
        const report = await buildReport();
        const allRows = [...report.fulfilled, ...report.unfulfilled, ...report.open, ...report.rejected];
        allRows.sort((a, b) => a.request_id.localeCompare(b.request_id));
        res.attachment(reportName('csv'));
        res.send(toCsv(allRows, CSV_COLUMNS));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/report.pdf', async (req, res) => {
    try {
        const report = await buildReport();
        res.attachment(reportName('pdf'));
        writePdf(report, res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shelters/:id', async (req, res) => {
    try { sendResult(res, await deleteSite('shelter', req.params.id), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/warehouses/:id', async (req, res) => {
    try { sendResult(res, await deleteSite('warehouse', req.params.id), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/drivers', async (req, res) => {
    try { res.json(await knex('drivers').orderBy('driver_id')); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipments', async (req, res) => {
    try { res.json(await listShipments(req.query.driver_id)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shipments/:id/assign', async (req, res) => {
    try { sendResult(res, await assignDriver(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shipments/:id/pickup', async (req, res) => {
    try { sendResult(res, await pickUp(req.params.id), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shipments/:id/deliver', async (req, res) => {
    try { sendResult(res, await deliver(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;