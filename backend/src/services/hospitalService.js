const knex = require('../db');
const { validateSite, cleanText } = require('../validation');
const { nextId } = require('../ids');

function cleanHospital(body) {
    return {
        name: cleanText(body.name),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
    };
}

async function createHospital(body) {
    body = body || {};
    const errors = validateSite(body, { needsPriority: false });
    if (errors.length > 0) return { errors };
    const row = {
        hospital_id: await nextId('H-', 1, [['hospitals', 'hospital_id'], ['doctors', 'hospital_id'], ['medical_requests', 'hospital_id']]),
        ...cleanHospital(body),
    };
    await knex('hospitals').insert(row);
    return { site: row };
}

async function updateHospital(id, body) {
    body = body || {};
    const existing = await knex('hospitals').where({ hospital_id: id }).first();
    if (!existing) return { notFound: true };
    const errors = validateSite(body, { needsPriority: false });
    if (errors.length > 0) return { errors };
    const changes = cleanHospital(body);
    await knex('hospitals').where({ hospital_id: id }).update(changes);
    return { site: { ...existing, ...changes } };
}

async function deleteHospital(id) {
    const existing = await knex('hospitals').where({ hospital_id: id }).first();
    if (!existing) return { notFound: true };
    const doctors = await knex('doctors').where({ hospital_id: id }).count({ n: '*' }).first();
    if (Number(doctors.n) > 0) {
        return { errors: [id + ' still has ' + doctors.n + ' doctor(s). Move or delete them first'] };
    }
    const open = await knex('medical_requests').where({ hospital_id: id }).whereIn('status', ['Dispatched', 'Pending Medical Dispatch - High Urgency']).count({ n: '*' }).first();
    if (Number(open.n) > 0) {
        return { errors: [id + ' has ' + open.n + ' medical ticket(s) still open'] };
    }
    await knex('hospitals').where({ hospital_id: id }).del();
    return { site: existing };
}

module.exports = { createHospital, updateHospital, deleteHospital };
