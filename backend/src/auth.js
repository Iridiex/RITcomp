const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('./db');
const { listShipments } = require('./services/shipmentService');
const { listMovements } = require('./services/stockService');
const { changeOwnLogin } = require('./services/userService');

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const ALL = ['coordinator', 'shelter', 'warehouse', 'driver'];

const RULES = [
    { methods: ['GET'], path: /^\/health$/, public: true },
    { methods: ['POST'], path: /^\/auth\/login$/, public: true },
    { methods: ['GET', 'PATCH'], path: /^\/auth\/me$/, roles: ALL },
    { methods: ['GET'], path: /^\/requests$/, roles: ['coordinator', 'shelter'] },
    { methods: ['POST'], path: /^\/requests$/, roles: ['coordinator', 'shelter'] },
    { methods: ['GET'], path: /^\/inventory$/, roles: ['coordinator', 'warehouse'] },
    { methods: ['POST'], path: /^\/inventory(\/remove)?$/, roles: ['warehouse'] },
    { methods: ['GET'], path: /^\/stock\/movements$/, roles: ['coordinator', 'warehouse'] },
    { methods: ['GET'], path: /^\/shortages$/, roles: ['coordinator', 'warehouse'] },
    { methods: ['GET'], path: /^\/items$/, roles: ALL },
    { methods: ['POST'], path: /^\/urgency\/check$/, roles: ['coordinator', 'shelter'] },
    { methods: ['GET'], path: /^\/ai\/status$/, roles: ALL },
    { methods: ['GET'], path: /^\/incidents$/, roles: ['coordinator', 'driver'] },
    { methods: ['POST'], path: /^\/speech$/, roles: ['coordinator', 'driver'] },
    { methods: ['GET'], path: /^\/(shelters|warehouses)$/, roles: ALL },
    { methods: ['GET'], path: /^\/shipments$/, roles: ALL },
    { methods: ['PATCH'], path: /^\/requests\/[^/]+\/close$/, roles: ['coordinator', 'shelter'] },
    { methods: ['PATCH'], path: /^\/shipments\/[^/]+\/(pickup|deliver|fail)$/, roles: ['coordinator', 'driver'] },
    { methods: ['PATCH'], path: /^\/shipments\/[^/]+\/return$/, roles: ['coordinator', 'driver', 'warehouse'] },
];

function publicUser(user) {
    return {
        user_id: user.user_id,
        username: user.username,
        name: user.name,
        role: user.role,
        shelter_id: user.shelter_id || null,
        warehouse_id: user.warehouse_id || null,
        driver_id: user.driver_id || null,
    };
}

function signToken(user) {
    return jwt.sign(publicUser(user), SECRET, { expiresIn: '8h' });
}

function findRule(method, path) {
    return RULES.find((r) => r.methods.includes(method) && r.path.test(path));
}

function authenticate(req, res, next) {
    const rule = findRule(req.method, req.path);
    if (rule && rule.public) return next();

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ error: 'Please log in' });

    try {
        req.user = jwt.verify(token, SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    const allowed = rule ? rule.roles : ['coordinator'];
    if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ error: 'Your role cannot do this' });
    }
    next();
}

const authRouter = express.Router();

authRouter.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ errors: ['Enter your username and password'] });
        }
        const user = await knex('users').where({ username: String(username).trim().toLowerCase() }).first();
        if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
            return res.status(401).json({ errors: ['Wrong username or password'] });
        }
        res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.get('/auth/me', (req, res) => {
    res.json({ user: req.user });
});

// Wrong current password is a 400, not a 401: the frontend treats 401 as "session expired" and logs out
authRouter.patch('/auth/me', async (req, res) => {
    try {
        const result = await changeOwnLogin(req.user.user_id, req.body);
        if (result.notFound) return res.status(404).json({ error: 'Account not found' });
        if (result.errors) return res.status(400).json({ errors: result.errors });
        res.json({ token: signToken(result.user), user: publicUser(result.user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.get('/requests', async (req, res, next) => {
    if (req.user.role !== 'shelter') return next();
    try {
        res.json(await knex('requests').where({ shelter_id: req.user.shelter_id }).orderBy('request_id'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.post('/requests', (req, res, next) => {
    req.body = req.body || {};
    if (req.user.role === 'shelter') {
        req.body.shelter_id = req.user.shelter_id;
        req.body.submitted_by = 'shelter';
    } else {
        req.body.submitted_by = 'coordinator';
    }
    next();
});

authRouter.patch('/requests/:id/close', async (req, res, next) => {
    if (req.user.role !== 'shelter') return next();
    try {
        const request = await knex('requests').where({ request_id: req.params.id }).first();
        if (request && request.shelter_id !== req.user.shelter_id) {
            return res.status(403).json({ error: 'This request belongs to another shelter' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.get('/inventory', async (req, res, next) => {
    if (req.user.role !== 'warehouse') return next();
    try {
        res.json(await knex('inventory').where({ warehouse_id: req.user.warehouse_id }).orderBy('item'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.post(['/inventory', '/inventory/remove'], (req, res, next) => {
    req.body = req.body || {};
    req.body.warehouse_id = req.user.warehouse_id;
    req.body.by_name = req.user.name;
    next();
});

authRouter.get('/stock/movements', async (req, res, next) => {
    if (req.user.role !== 'warehouse') return next();
    try {
        res.json(await listMovements(req.user.warehouse_id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.get('/shipments', async (req, res, next) => {
    const { role } = req.user;
    if (role === 'coordinator') return next();
    try {
        const all = await listShipments();
        const mine = all.filter((s) =>
            (role === 'driver' && s.driver_id === req.user.driver_id) ||
            (role === 'shelter' && s.shelter_id === req.user.shelter_id) ||
            (role === 'warehouse' && s.warehouse_id === req.user.warehouse_id)
        );
        res.json(mine);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.patch('/shipments/:id/:action', async (req, res, next) => {
    const { role } = req.user;
    if (role !== 'driver' && role !== 'warehouse') return next();
    try {
        const shipment = await knex('shipments').where({ shipment_id: req.params.id }).first();
        if (role === 'driver' && shipment && shipment.driver_id !== req.user.driver_id) {
            return res.status(403).json({ error: 'This delivery is assigned to another driver' });
        }
        if (role === 'warehouse' && shipment && shipment.warehouse_id !== req.user.warehouse_id) {
            return res.status(403).json({ error: 'This shipment belongs to another warehouse' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = { authenticate, authRouter, signToken, RULES };
