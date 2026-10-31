const request = require('supertest');
const app = require('../src/app');
const { AUTH } = require('./helpers/auth');
const knex = require('../src/db');

const driverOf = async (id) => (await knex('shipments').where({ shipment_id: id }).first()).driver_id;
const fail = (id, reason) => request(app).patch(`/api/shipments/${id}/pickup`).set('Authorization', AUTH).send({})
    .then(() => request(app).patch(`/api/shipments/${id}/fail`).set('Authorization', AUTH).send({ reason }));

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'water', quantity: 100 });
    await knex('drivers').insert([{ driver_id: 'DR-1', name: 'One' }, { driver_id: 'DR-2', name: 'Two' }]);
    await knex('requests').insert({ request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 20, urgency: 'Critical' });
    await request(app).post('/api/allocations/run').set('Authorization', AUTH);
});

afterAll(async () => {
    await knex.destroy();
});

test('a replacement goes to a different driver than the one who could not deliver', async () => {
    expect(await driverOf('SHP-001')).toBe('DR-1');
    const res = await fail('SHP-001', 'Road flooded');
    expect(res.body.replacements).toEqual(['SHP-002']);
    expect(await driverOf('SHP-002')).toBe('DR-2');
});

test('when every driver has failed this request, it still gets a driver rather than none', async () => {
    const res = await fail('SHP-002', 'Road flooded');
    expect(res.body.replacements).toEqual(['SHP-003']);
    expect(await driverOf('SHP-003')).toBe('DR-1');
});
