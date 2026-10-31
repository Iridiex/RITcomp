// End-to-end operations through the real API, checking after every step that no stock appears or vanishes
// and that each request's numbers match its shipments.
const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { AUTH, shelterAuth, warehouseAuth, driverAuth } = require('./helpers/auth');

const SHELTER = shelterAuth('SH-01');
const SHELTER_2 = shelterAuth('SH-02');
const WAREHOUSE = warehouseAuth('WH-1');

const api = {
    ask: (auth, body) => request(app).post('/api/requests').set('Authorization', auth).send(body),
    review: (id, body) => request(app).patch(`/api/requests/${id}/review`).set('Authorization', AUTH).send(body),
    allocate: () => request(app).post('/api/allocations/run').set('Authorization', AUTH),
    addStock: (item, quantity) => request(app).post('/api/inventory').set('Authorization', WAREHOUSE).send({ item, quantity }),
    removeStock: (item, quantity, reason) => request(app).post('/api/inventory/remove').set('Authorization', WAREHOUSE).send({ item, quantity, reason }),
    shipment: (id, action, driver, body) => request(app).patch(`/api/shipments/${id}/${action}`).set('Authorization', driverAuth(driver)).send(body || {}),
    addDriver: (name) => request(app).post('/api/drivers').set('Authorization', AUTH).send({ name, phone: '050 000 0000' }),
};

const requestRow = (id) => knex('requests').where({ request_id: id }).first();
const shipmentsOf = (id) => knex('shipments').where({ request_id: id }).orderBy('shipment_id');
const stockOf = async (item) => ((await knex('inventory').where({ warehouse_id: 'WH-1', item }).first()) || { quantity: 0 }).quantity;

async function checkBooks() {
    const shipments = await knex('shipments');
    const movements = await knex('stock_movements');
    const inventory = await knex('inventory');
    for (const item of new Set(inventory.map((i) => i.item))) {
        const mine = shipments.filter((s) => s.item === item);
        const putIn = movements.filter((m) => m.item === item && m.reason !== 'Returned from a failed delivery').reduce((n, m) => n + m.change, 0);
        const inStock = inventory.filter((i) => i.item === item).reduce((n, i) => n + i.quantity, 0);
        const outThere = mine.filter((s) => s.status !== 'Returned').reduce((n, s) => n + s.quantity - s.quantity_damaged, 0);
        const lost = mine.reduce((n, s) => n + s.quantity_damaged, 0);
        expect({ item, accounted: inStock + outThere + lost }).toEqual({ item, accounted: putIn });
    }
    for (const r of await knex('requests')) {
        const mine = shipments.filter((s) => s.request_id === r.request_id);
        const onTheWay = mine.filter((s) => !['Returning', 'Returned'].includes(s.status)).reduce((n, s) => n + s.quantity - s.quantity_damaged, 0);
        const delivered = mine.filter((s) => s.status === 'Delivered').reduce((n, s) => n + s.quantity - s.quantity_damaged, 0);
        expect({ id: r.request_id, allocated: r.quantity_allocated, delivered: r.quantity_delivered })
            .toEqual({ id: r.request_id, allocated: onTheWay, delivered });
        expect(r.quantity_allocated).toBeLessThanOrEqual(r.quantity);
        if (r.status === 'Fulfilled') expect(r.quantity_delivered).toBeGreaterThanOrEqual(r.quantity);
    }
}

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert([
        { shelter_id: 'SH-01', name: 'Hall One', priority: 1, latitude: 25.1, longitude: 55.2 },
        { shelter_id: 'SH-02', name: 'Hall Two', priority: 2, latitude: 25.15, longitude: 55.25 },
    ]);
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
});

afterAll(async () => {
    await knex.destroy();
});

test('stock that runs out: the shelter gets what exists now and the rest goes out by itself when stock arrives', async () => {
    expect((await api.addStock('water', 250)).status).toBe(201);
    await api.addDriver('Driver A');
    await api.addDriver('Driver B');

    const asked = await api.ask(SHELTER, { item: 'water', quantity: 300, urgency: 'Critical', reason: 'Main tank contaminated, 300 people' });
    expect(asked.status).toBe(201);
    const id = asked.body.request_id;
    expect((await requestRow(id)).status).toBe('Awaiting review');

    expect((await api.allocate()).body.allocated).toBe(0);
    expect(await stockOf('water')).toBe(250);

    await api.review(id, { action: 'approve' });
    const run = await api.allocate();
    expect(run.body).toMatchObject({ partial: 1, shipments: 2 });
    expect(await stockOf('water')).toBe(0);
    expect((await shipmentsOf(id)).map((s) => s.quantity)).toEqual([200, 50]);
    expect(await requestRow(id)).toMatchObject({ status: 'Partial', quantity_allocated: 250 });
    await checkBooks();

    const shortages = await request(app).get('/api/shortages').set('Authorization', WAREHOUSE);
    expect(shortages.body).toEqual([{ item: 'water', short: 50, requests: 1, critical: 1 }]);

    const restock = await api.addStock('water', 80);
    expect(restock.body.replacements).toHaveLength(1);
    expect(await stockOf('water')).toBe(30);
    expect(await requestRow(id)).toMatchObject({ status: 'Allocated', quantity_allocated: 300 });
    await checkBooks();

    for (const s of await shipmentsOf(id)) {
        expect((await api.shipment(s.shipment_id, 'pickup', s.driver_id)).status).toBe(200);
        expect((await api.shipment(s.shipment_id, 'deliver', s.driver_id)).status).toBe(200);
    }
    expect(await requestRow(id)).toMatchObject({ status: 'Fulfilled', quantity_delivered: 300 });
    await checkBooks();
});

test('stock that never comes: the request waits, stays visible as a shortage, and other items are not held up', async () => {
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'tents', quantity: 0 });
    const tents = (await api.ask(SHELTER, { item: 'tents', quantity: 20, urgency: 'High', reason: 'Roof collapsed on one wing' })).body.request_id;
    await api.addStock('blankets', 40);
    const blankets = (await api.ask(SHELTER_2, { item: 'blankets', quantity: 40, urgency: 'Moderate', reason: 'Nights getting colder' })).body.request_id;
    await api.review(tents, { action: 'approve' });
    await api.review(blankets, { action: 'approve' });

    const run = await api.allocate();
    expect(run.body).toMatchObject({ allocated: 1, unfulfilled: 1 });
    expect(await requestRow(tents)).toMatchObject({ status: 'Unfulfilled', quantity_allocated: 0 });
    expect(await requestRow(blankets)).toMatchObject({ status: 'Allocated' });

    const again = await api.allocate();
    expect(again.body).toMatchObject({ allocated: 0, shipments: 0 });
    expect(await shipmentsOf(tents)).toEqual([]);

    const shortages = (await request(app).get('/api/shortages').set('Authorization', AUTH)).body;
    expect(shortages).toContainEqual({ item: 'tents', short: 20, requests: 1, critical: 0 });
    await checkBooks();
});

test('damage at pickup, on arrival and a failed delivery all leave the books straight and re-send what was lost', async () => {
    await api.addStock('food packs', 100);
    const id = (await api.ask(SHELTER, { item: 'food packs', quantity: 60, urgency: 'High', reason: 'Two days of food left' })).body.request_id;
    await api.review(id, { action: 'approve' });
    await api.allocate();
    let [first] = await shipmentsOf(id);

    const picked = await api.shipment(first.shipment_id, 'pickup', first.driver_id, { damaged: 5, damage_note: 'Boxes crushed' });
    expect(picked.body.replacements).toHaveLength(1);
    expect(await stockOf('food packs')).toBe(35);
    await checkBooks();

    await api.shipment(first.shipment_id, 'deliver', first.driver_id, { damaged: 3, damage_note: 'Wet on arrival' });
    expect(await requestRow(id)).toMatchObject({ quantity_delivered: 52 });
    expect(await stockOf('food packs')).toBe(32);
    await checkBooks();

    const shipments = await shipmentsOf(id);
    const failing = shipments.find((s) => s.quantity === 5);
    await api.shipment(failing.shipment_id, 'pickup', failing.driver_id);
    const fail = await api.shipment(failing.shipment_id, 'fail', failing.driver_id, { reason: 'Road flooded' });
    expect(fail.status).toBe(200);
    expect(fail.body.replacements).toHaveLength(1);
    const replacement = (await knex('shipments').where({ shipment_id: fail.body.replacements[0] }).first());
    expect(replacement.driver_id).not.toBe(failing.driver_id);
    await checkBooks();

    const back = await api.shipment(failing.shipment_id, 'return', failing.driver_id);
    expect(back.body.returned).toBe(5);
    expect(await stockOf('food packs')).toBe(27 + 5);
    await checkBooks();

    for (const s of (await shipmentsOf(id)).filter((row) => row.status === 'Ready')) {
        await api.shipment(s.shipment_id, 'pickup', s.driver_id);
        await api.shipment(s.shipment_id, 'deliver', s.driver_id);
    }
    expect(await requestRow(id)).toMatchObject({ status: 'Fulfilled', quantity_delivered: 60 });
    await checkBooks();
});

test('more trucks than drivers: extra loads wait unassigned and go to the next driver who joins', async () => {
    const drivers = (await knex('drivers')).length;
    await api.addStock('blankets', 200 * (drivers + 1));
    const id = (await api.ask(SHELTER, { item: 'blankets', quantity: 200 * (drivers + 1), urgency: 'Critical', reason: 'Whole camp moved into an unheated hall' })).body.request_id;
    await api.review(id, { action: 'approve' });
    await api.allocate();
    const waiting = (await shipmentsOf(id)).filter((s) => !s.driver_id);
    expect(waiting).toHaveLength(1);
    expect((await api.shipment(waiting[0].shipment_id, 'pickup', 'DR-1')).status).toBe(403);

    const hired = await api.addDriver('Driver C');
    expect(hired.body.assigned).toEqual([{ shipment_id: waiting[0].shipment_id, driver_id: hired.body.driver_id }]);
    await checkBooks();
});

test('a double-tapped button cannot send the same goods back or re-send them twice', async () => {
    await knex('drivers').insert({ driver_id: 'DR-9', name: 'Driver Nine' }).onConflict('driver_id').ignore();
    await api.addStock('hygiene kits', 30);
    const id = (await api.ask(SHELTER, { item: 'hygiene kits', quantity: 10, urgency: 'High', reason: 'Skin infections spreading' })).body.request_id;
    await api.review(id, { action: 'approve' });
    await api.allocate();
    const [s] = await shipmentsOf(id);
    await knex('shipments').where({ shipment_id: s.shipment_id }).update({ driver_id: 'DR-9' });
    await api.shipment(s.shipment_id, 'pickup', 'DR-9');

    const both = await Promise.all([
        api.shipment(s.shipment_id, 'fail', 'DR-9', { reason: 'Gate locked' }),
        api.shipment(s.shipment_id, 'fail', 'DR-9', { reason: 'Gate locked' }),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 400]);
    await checkBooks();

    const drops = await Promise.all([
        api.shipment(s.shipment_id, 'return', 'DR-9'),
        api.shipment(s.shipment_id, 'return', 'DR-9'),
    ]);
    expect(drops.map((r) => r.status).sort()).toEqual([200, 400]);
    await checkBooks();
});

test('stock that will never come: the shelter or coordinator closes what is still owed, and a restock no longer sends it', async () => {
    await api.addStock('generators', 3);
    const id = (await api.ask(SHELTER, { item: 'generators', quantity: 10, urgency: 'High', reason: 'Clinic loses power at night' })).body.request_id;
    await api.review(id, { action: 'approve' });
    await api.allocate();
    expect(await requestRow(id)).toMatchObject({ status: 'Partial', quantity_allocated: 3 });

    const close = (auth, body) => request(app).patch(`/api/requests/${id}/close`).set('Authorization', auth).send(body);
    expect((await close(SHELTER_2, { note: 'x' })).status).toBe(403);
    expect((await close(WAREHOUSE, { note: 'x' })).status).toBe(403);
    expect((await close(SHELTER, {})).body.errors).toEqual(['Say why it is no longer needed']);

    const closed = await close(SHELTER, { note: 'Grid power is back' });
    expect(closed.status).toBe(200);
    expect(await requestRow(id)).toMatchObject({ status: 'Allocated', quantity: 3, quantity_closed: 7, close_note: 'Grid power is back' });
    expect((await close(AUTH, { note: 'again' })).status).toBe(400);

    const restock = await api.addStock('generators', 20);
    expect(restock.body.replacements).toEqual([]);
    expect(await stockOf('generators')).toBe(20);

    const [s] = await shipmentsOf(id);
    await api.shipment(s.shipment_id, 'pickup', s.driver_id);
    await api.shipment(s.shipment_id, 'deliver', s.driver_id);
    expect(await requestRow(id)).toMatchObject({ status: 'Fulfilled', quantity_delivered: 3 });

    const nothingSent = (await api.ask(SHELTER, { item: 'tents', quantity: 5, urgency: 'Moderate', reason: 'Extra families expected' })).body.request_id;
    const cancelled = await request(app).patch(`/api/requests/${nothingSent}/close`).set('Authorization', AUTH).send({ note: 'Families went to Hall Two' });
    expect(cancelled.body).toMatchObject({ status: 'Cancelled', quantity: 0, quantity_closed: 5 });
    await api.addStock('tents', 50);
    expect(await shipmentsOf(nothingSent)).toEqual([]);
    await checkBooks();
});

test('a driver whose phone died: the coordinator records the outcome, and the warehouse confirms the goods came back', async () => {
    await api.addStock('water', 40);
    const id = (await api.ask(SHELTER_2, { item: 'water', quantity: 40, urgency: 'High', reason: 'Tank leaking' })).body.request_id;
    await api.review(id, { action: 'approve' });
    await api.allocate();
    const [s] = await shipmentsOf(id);
    await api.shipment(s.shipment_id, 'pickup', s.driver_id);

    const fail = await request(app).patch(`/api/shipments/${s.shipment_id}/fail`).set('Authorization', AUTH).send({ reason: 'Driver unreachable, truck came back' });
    expect(fail.status).toBe(200);

    expect((await request(app).patch(`/api/shipments/${s.shipment_id}/return`).set('Authorization', warehouseAuth('WH-2'))).status).toBe(403);
    const back = await request(app).patch(`/api/shipments/${s.shipment_id}/return`).set('Authorization', WAREHOUSE);
    expect(back.status).toBe(200);
    expect((await request(app).patch(`/api/shipments/${s.shipment_id}/pickup`).set('Authorization', WAREHOUSE)).status).toBe(403);
    await checkBooks();
});
