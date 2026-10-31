const request = require('supertest');
const app = require('../src/app');
const { AUTH, warehouseAuth } = require('./helpers/auth');
const knex = require('../src/db');

const getRequest = (id) => knex('requests').where({ request_id: id }).first();
const getShipments = async () => (await request(app).get('/api/shipments').set('Authorization', AUTH)).body;
const stockOf = async (item) => (await knex('inventory').where({ warehouse_id: 'WH-1', item }).first()).quantity;

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Test Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Test Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert([
        { warehouse_id: 'WH-1', item: 'water', quantity: 100 },
        { warehouse_id: 'WH-1', item: 'blankets', quantity: 50 },
        { warehouse_id: 'WH-1', item: 'tents', quantity: 10 },
    ]);
    await knex('drivers').insert([
        { driver_id: 'DR-1', name: 'Driver One', phone: '050-000-0001' },
        { driver_id: 'DR-2', name: 'Driver Two', phone: '050-000-0002' },
    ]);
    await knex('requests').insert([
        { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 60, urgency: 'Critical' },
        { request_id: 'RQ-002', shelter_id: 'SH-01', item: 'blankets', quantity: 20, urgency: 'High' },
        { request_id: 'RQ-003', shelter_id: 'SH-01', item: 'tents', quantity: 10, urgency: 'Moderate' },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test('run allocation creates shipments and spreads them across drivers', async () => {
    const res = await request(app).post('/api/allocations/run').set('Authorization', AUTH);
    expect(res.body.allocated).toBe(3);
    expect(res.body.shipments).toBe(3);
    expect(res.body.drivers).toBe(2);

    const shipments = await getShipments();
    expect(shipments.map((s) => s.driver_id)).toEqual(['DR-1', 'DR-2', 'DR-1']);
    expect((await getRequest('RQ-001')).status).toBe('Allocated');
});

test('cannot deliver before pickup', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/deliver').set('Authorization', AUTH).send({});
    expect(res.status).toBe(400);
});

test('damage at pickup needs a note', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/pickup').set('Authorization', AUTH).send({ damaged: 5 });
    expect(res.status).toBe(400);
});

test('damage at pickup sends a replacement straight away', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/pickup').set('Authorization', AUTH)
        .send({ damaged: 5, damage_note: 'Bottles split while loading' });
    expect(res.status).toBe(200);
    expect(res.body.replacements).toEqual(['SHP-004']);

    const replacement = (await getShipments()).find((s) => s.shipment_id === 'SHP-004');
    expect(replacement.quantity).toBe(5);
    expect(replacement.driver_id).toBe('DR-2');

    const saved = await getRequest('RQ-001');
    expect(saved.status).toBe('Allocated');
    expect(saved.quantity_allocated).toBe(60);
    expect(await stockOf('water')).toBe(35);
});

test('a request is only Fulfilled once everything has arrived', async () => {
    await request(app).patch('/api/shipments/SHP-001/deliver').set('Authorization', AUTH).send({});
    let saved = await getRequest('RQ-001');
    expect(saved.quantity_delivered).toBe(55);
    expect(saved.status).toBe('Allocated');

    await request(app).patch('/api/shipments/SHP-004/pickup').set('Authorization', AUTH).send({});
    await request(app).patch('/api/shipments/SHP-004/deliver').set('Authorization', AUTH).send({});
    saved = await getRequest('RQ-001');
    expect(saved.quantity_delivered).toBe(60);
    expect(saved.status).toBe('Fulfilled');
});

test('failed delivery returns stock and sends a replacement', async () => {
    await request(app).patch('/api/shipments/SHP-002/pickup').set('Authorization', AUTH).send({});
    const noReason = await request(app).patch('/api/shipments/SHP-002/fail').set('Authorization', AUTH).send({});
    expect(noReason.status).toBe(400);

    const res = await request(app).patch('/api/shipments/SHP-002/fail').set('Authorization', AUTH).send({ reason: 'Road closed by flooding' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Returned');
    expect(res.body.replacements).toEqual(['SHP-005']);

    expect(await stockOf('blankets')).toBe(30);
    expect((await getRequest('RQ-002')).status).toBe('Allocated');
});

test('damage with no stock left waits, then fills itself when stock arrives', async () => {
    await request(app).patch('/api/shipments/SHP-003/pickup').set('Authorization', AUTH).send({});
    const res = await request(app).patch('/api/shipments/SHP-003/deliver').set('Authorization', AUTH).send({ damaged: 4, damage_note: 'Torn' });
    expect(res.body.replacements).toEqual([]);

    let saved = await getRequest('RQ-003');
    expect(saved.status).toBe('Partial');
    expect(saved.replacement_pending).toBeTruthy();
    expect(saved.quantity_delivered).toBe(6);

    const stock = await request(app).post('/api/inventory').set('Authorization', warehouseAuth('WH-1')).send({ warehouse_id: 'WH-1', item: 'tents', quantity: 4 });
    expect(stock.body.replacements).toEqual(['SHP-006']);

    saved = await getRequest('RQ-003');
    expect(saved.status).toBe('Allocated');
    expect(saved.replacement_pending).toBeFalsy();
});

test('stock never goes negative', async () => {
    const rows = await knex('inventory');
    expect(rows.every((r) => r.quantity >= 0)).toBe(true);
});

test('a driver only sees their own shipments', async () => {
    const res = await request(app).get('/api/shipments?driver_id=DR-2').set('Authorization', AUTH);
    expect(res.body.map((s) => s.shipment_id)).toEqual(['SHP-002', 'SHP-004', 'SHP-005']);
});
