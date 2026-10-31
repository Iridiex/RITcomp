const { authenticate, authRouter } = require('./auth');
const { listShipments, assignDriver, pickUp, deliver, failDelivery, returnToWarehouse } = require('./services/shipmentService');
const { buildReport } = require('./services/reportService');
const { toCsv } = require('./reports/csv');
const { writePdf } = require('./reports/pdf');
const { createSite, updateSite, deleteSite } = require('./services/siteService');
const { addStock, removeStock, listMovements } = require('./services/stockService');
const { createDriver, updateDriver, deleteDriver } = require('./services/driverService');
const { listUsers } = require('./services/userService');
const knex = require('./db');
const express = require('express');
const cors = require('cors');
const { runAllocation, listShortages } = require('./services/allocationService');
const { createRequest, reviewRequest, closeRequest, listItems } = require('./services/requestService');
const { checkUrgency } = require('./ai/urgency');
const { getBrief, writeBrief } = require('./ai/brief');
const { transcribe, MAX_AUDIO_BYTES } = require('./ai/language');
const { aiEnabled } = require('./ai/gemini');
const { activeAlerts, resolveIncident } = require('./services/incidentService');
const { getPatterns, findPatterns } = require('./ai/patterns');
const { askAssistant } = require('./ai/assistant');

const app = express();

app.use(cors());
app.use(express.json());
// Express 5 leaves req.body undefined when a request has no JSON body
app.use((req, res, next) => {
    if (!req.body) req.body = {};
    next();
});
app.use('/api', authenticate);
app.use('/api', authRouter);

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

app.patch('/api/requests/:id/close', async (req, res) => {
    try {
        const result = await closeRequest(req.params.id, req.body);
        if (result.notFound) return res.status(404).json({ error: 'Request not found' });
        if (result.errors) return res.status(400).json({ errors: result.errors });
        res.json(result.request);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not close request' });
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

app.post('/api/drivers', async (req, res) => {
    try { sendResult(res, await createDriver(req.body), 201); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/drivers/:id', async (req, res) => {
    try { sendResult(res, await updateDriver(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/drivers/:id', async (req, res) => {
    try { sendResult(res, await deleteDriver(req.params.id), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
    try { res.json(await listUsers()); }
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
    try { sendResult(res, await pickUp(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shipments/:id/deliver', async (req, res) => {
    try { sendResult(res, await deliver(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shipments/:id/fail', async (req, res) => {
    try { sendResult(res, await failDelivery(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/shipments/:id/return', async (req, res) => {
    try { sendResult(res, await returnToWarehouse(req.params.id, req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/remove', async (req, res) => {
    try { sendResult(res, await removeStock(req.body), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stock/movements', async (req, res) => {
    try { res.json(await listMovements()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/items', async (req, res) => {
    try { res.json(await listItems()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/urgency/check', async (req, res) => {
    try {
        const { item, quantity, reason } = req.body;
        if (!String(reason || '').trim()) return res.status(400).json({ errors: ['Write a reason to check'] });
        res.json(await checkUrgency({ item, quantity, reason }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/incidents', async (req, res) => {
    try { res.json(await activeAlerts()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/incidents/:id/resolve', async (req, res) => {
    try { sendResult(res, await resolveIncident(req.params.id), 200); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/patterns', async (req, res) => {
    try { res.json(await getPatterns()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/patterns', async (req, res) => {
    try {
        res.json(await findPatterns());
    } catch (err) {
        console.warn('Pattern search failed:', err.message);
        res.status(502).json({ error: 'Could not look for patterns right now. Try again in a moment.' });
    }
});

app.post('/api/assistant', async (req, res) => {
    try {
        const result = await askAssistant(req.body && req.body.messages);
        if (result.error) return res.status(result.status).json({ error: result.error });
        res.json(result.data);
    } catch (err) {
        console.warn('Assistant failed:', err.message);
        res.status(502).json({ error: "The assistant couldn't answer right now. Try again in a moment." });
    }
});

app.get('/api/ai/status', (req, res) => {
    res.json({ enabled: aiEnabled() });
});

app.post('/api/speech', express.raw({ type: 'audio/*', limit: MAX_AUDIO_BYTES }), async (req, res) => {
    try {
        if (!aiEnabled()) return res.status(503).json({ error: 'Speech is switched off' });
        const result = await transcribe(Buffer.isBuffer(req.body) ? req.body : null, req.get('Content-Type'));
        if (result.errors) return res.status(400).json({ errors: result.errors });
        res.json(result);
    } catch (err) {
        console.warn('Speech failed:', err.message);
        res.status(502).json({ error: 'Could not understand the recording right now. Try again or type it' });
    }
});

app.get('/api/brief', async (req, res) => {
    try { res.json(await getBrief()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/brief', async (req, res) => {
    try {
        res.json(await writeBrief());
    } catch (err) {
        console.warn('Situation brief failed:', err.message);
        res.status(502).json({ error: 'Could not write the brief right now. Try again in a moment.' });
    }
});

app.get('/api/shortages', async (req, res) => {
    try { res.json(await listShortages()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;