const request = require('supertest');
const app = require('../src/app');
const { AUTH, warehouseAuth, shelterAuth } = require('./helpers/auth');
const knex = require('../src/db');
const { splitLoad } = require('../src/capacity');

test.each([
    [50, [50]],
    [200, [200]],
    [205, [205]],
    [210, [210]],
    [211, [200, 11]],
    [215, [200, 15]],
    [410, [200, 210]],
    [415, [200, 200, 15]],
])('a load of %i goes in trucks of %j', (quantity, trucks) => {
    expect(splitLoad(quantity)).toEqual(trucks);
});

describe('dispatching over-capacity loads', () => {
    const shipmentsFor = (requestId) => knex('shipments').where({ request_id: requestId }).orderBy('shipment_id');

    beforeAll(async () => {
        await knex.migrate.latest();
        await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
        await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
        await knex('inventory').insert([
            { warehouse_id: 'WH-1', item: 'water', quantity: 1000 },
            { warehouse_id: 'WH-1', item: 'tents', quantity: 1000 },
        ]);
        await knex('drivers').insert([{ driver_id: 'DR-1', name: 'One' }, { driver_id: 'DR-2', name: 'Two' }]);
        await knex('requests').insert([
            { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 205, urgency: 'Critical' },
            { request_id: 'RQ-002', shelter_id: 'SH-01', item: 'tents', quantity: 260, urgency: 'High' },
        ]);
        await request(app).post('/api/allocations/run').set('Authorization', AUTH);
    });

    afterAll(async () => {
        await knex.destroy();
    });

    test('within the 10-unit grace it stays one truck', async () => {
        const rows = await shipmentsFor('RQ-001');
        expect(rows.map((s) => s.quantity)).toEqual([205]);
    });

    test('beyond the grace it splits into 200 and the rest, on two different drivers', async () => {
        const rows = await shipmentsFor('RQ-002');
        expect(rows.map((s) => s.quantity)).toEqual([200, 60]);
        expect(rows[0].driver_id).not.toBe(rows[1].driver_id);
        expect(rows.every((s) => s.driver_id)).toBe(true);
    });

    test('the coordinator cannot put both parts of a split load on one driver', async () => {
        const [first, second] = await shipmentsFor('RQ-002');
        const res = await request(app).patch(`/api/shipments/${second.shipment_id}/assign`).set('Authorization', AUTH)
            .send({ driver_id: first.driver_id });
        expect(res.status).toBe(400);
        expect(res.body.errors[0]).toMatch(/another part of this load/);
    });

    test('with only one driver, the extra part waits for a second driver instead of doubling up', async () => {
        await knex('drivers').where({ driver_id: 'DR-2' }).del();
        await knex('requests').insert({ request_id: 'RQ-003', shelter_id: 'SH-01', item: 'water', quantity: 230, urgency: 'Critical' });
        await request(app).post('/api/allocations/run').set('Authorization', AUTH);

        const rows = await shipmentsFor('RQ-003');
        expect(rows.map((s) => s.quantity)).toEqual([200, 30]);
        expect(rows.map((s) => s.driver_id)).toEqual(['DR-1', null]);
    });

    test('once the only driver delivers their part, the waiting part is handed to them automatically', async () => {
        const [first, second] = await shipmentsFor('RQ-003');
        await request(app).patch(`/api/shipments/${first.shipment_id}/pickup`).set('Authorization', AUTH).send({});
        await request(app).patch(`/api/shipments/${first.shipment_id}/deliver`).set('Authorization', AUTH).send({});
        const after = await knex('shipments').where({ shipment_id: second.shipment_id }).first();
        expect(after.driver_id).toBe('DR-1');
    });

    test('adding a new driver picks up any shipment still waiting for one', async () => {
        await knex('requests').insert({ request_id: 'RQ-004', shelter_id: 'SH-01', item: 'tents', quantity: 240, urgency: 'Critical' });
        await knex('shipments').whereNot({ request_id: 'RQ-004' }).update({ status: 'Delivered' });
        await request(app).post('/api/allocations/run').set('Authorization', AUTH);
        const waiting = (await shipmentsFor('RQ-004')).find((s) => !s.driver_id);
        expect(waiting).toBeTruthy();

        const res = await request(app).post('/api/drivers').set('Authorization', AUTH).send({ name: 'New Driver' });
        expect(res.status).toBe(201);
        expect(res.body.assigned).toEqual([{ shipment_id: waiting.shipment_id, driver_id: res.body.driver_id }]);
    });

    test('warehouses see which items shelters are short of, critical first; shelters cannot', async () => {
        await knex('requests').insert([
            { request_id: 'RQ-010', shelter_id: 'SH-01', item: 'soap', quantity: 40, quantity_allocated: 10, urgency: 'High', status: 'Partial' },
            { request_id: 'RQ-011', shelter_id: 'SH-01', item: 'milk', quantity: 15, quantity_allocated: 0, urgency: 'Critical', status: 'Unfulfilled' },
            { request_id: 'RQ-012', shelter_id: 'SH-01', item: 'soap', quantity: 5, quantity_allocated: 0, urgency: 'Moderate', status: 'Unfulfilled' },
        ]);
        const res = await request(app).get('/api/shortages').set('Authorization', warehouseAuth('WH-1'));
        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            { item: 'milk', short: 15, requests: 1, critical: 1 },
            { item: 'soap', short: 35, requests: 2, critical: 0 },
        ]);
        const blocked = await request(app).get('/api/shortages').set('Authorization', shelterAuth('SH-01'));
        expect(blocked.status).toBe(403);
    });
});
