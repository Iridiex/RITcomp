const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { AUTH, shelterAuth } = require('./helpers/auth');

beforeAll(async () => {
    await knex.migrate.latest();
});

afterAll(async () => {
    await knex.destroy();
});

test('coordinator can register a hospital and attach a doctor', async () => {
    const hospital = await request(app).post('/api/hospitals').set('Authorization', AUTH)
        .send({ name: 'Test Clinic', latitude: 25.1, longitude: 55.2 });
    expect(hospital.status).toBe(201);
    expect(hospital.body.hospital_id).toMatch(/^H-/);

    const doctor = await request(app).post('/api/doctors').set('Authorization', AUTH)
        .send({ name: 'Dr Test', specialty: 'Geriatrician', hospital_id: hospital.body.hospital_id });
    expect(doctor.status).toBe(201);
    expect(doctor.body).toMatchObject({
        specialty: 'Geriatrician',
        hospital_id: hospital.body.hospital_id,
        status: 'Available',
    });

    const listed = await request(app).get('/api/hospitals').set('Authorization', AUTH);
    const row = listed.body.find((h) => h.hospital_id === hospital.body.hospital_id);
    expect(row.doctors.map((d) => d.doctor_id)).toContain(doctor.body.doctor_id);
});

test('a hospital with doctors cannot be deleted', async () => {
    const hospital = await knex('hospitals').first();
    const res = await request(app).delete(`/api/hospitals/${hospital.hospital_id}`).set('Authorization', AUTH);
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/doctor/);
});

test('a shelter cannot add a hospital', async () => {
    const res = await request(app).post('/api/hospitals').set('Authorization', shelterAuth('SH-01'))
        .send({ name: 'No', latitude: 25, longitude: 55 });
    expect(res.status).toBe(403);
});
