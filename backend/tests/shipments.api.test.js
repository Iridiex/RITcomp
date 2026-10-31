const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Test Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Test Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'water', quantity: 100 });
    await knex('drivers').insert({ driver_id: 'DR-1', name: 'Test Driver', phone: '050-000-0000' });
    await knex('requests').insert({ request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 60, urgency: 'Critical' });
});

afterAll(async () => {
    await knex.destroy();
});

test('running allocation creates a Ready shipment', async () => {
    await request(app).post('/api/allocations/run');
    const res = await request(app).get('/api/shipments');
    expect(res.body.length).toBe(1);
    expect(res.body[0].shipment_id).toBe('SHP-001');
    expect(res.body[0].quantity).toBe(60);
    expect(res.body[0].status).toBe('Ready');
    expect(res.body[0].shelter_name).toBe('Test Hall');
});

test('cannot pick up before a driver is assigned', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/pickup');
    expect(res.status).toBe(400);
});

test('assigning an unknown driver is refused, a real one works', async () => {
    const bad = await request(app).patch('/api/shipments/SHP-001/assign').send({ driver_id: 'DR-9' });
    expect(bad.status).toBe(400);
    const good = await request(app).patch('/api/shipments/SHP-001/assign').send({ driver_id: 'DR-1' });
    expect(good.status).toBe(200);
});

test('cannot deliver before pickup', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/deliver').send({ damaged: 0 });
    expect(res.status).toBe(400);
});

test('pickup moves the shipment to In transit', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/pickup');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In transit');
});

test('damage needs a note and a sensible amount', async () => {
    const noNote = await request(app).patch('/api/shipments/SHP-001/deliver').send({ damaged: 10 });
    expect(noNote.status).toBe(400);
    const tooMany = await request(app).patch('/api/shipments/SHP-001/deliver').send({ damaged: 99, damage_note: 'x' });
    expect(tooMany.status).toBe(400);
});

test('damaged delivery puts the shortfall back in the queue', async () => {
    const res = await request(app).patch('/api/shipments/SHP-001/deliver')
        .send({ damaged: 10, damage_note: 'Bottles crushed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Delivered');
    const saved = await knex('requests').where({ request_id: 'RQ-001' }).first();
    expect(saved.quantity_allocated).toBe(50);
    expect(saved.status).toBe('Partial');
});

test('next allocation sends a replacement for the damaged items', async () => {
    await request(app).post('/api/allocations/run');
    const shipments = await request(app).get('/api/shipments');
    expect(shipments.body.length).toBe(2);
    expect(shipments.body[1].quantity).toBe(10);
    const saved = await knex('requests').where({ request_id: 'RQ-001' }).first();
    expect(saved.status).toBe('Fulfilled');
});

test('a driver only sees their own shipments', async () => {
    const res = await request(app).get('/api/shipments?driver_id=DR-1');
    expect(res.body.length).toBe(1);
    expect(res.body[0].shipment_id).toBe('SHP-001');
});
