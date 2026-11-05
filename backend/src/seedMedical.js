const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function readCsv(fileName) {
    const filePath = path.join(__dirname, '../data/sample', fileName);
    return parse(fs.readFileSync(filePath, 'utf8'), { columns: true, trim: true });
}

// Adds any hospital or doctor missing from the sample files. Does not wipe tickets
// unless replace is true (used by the full database reset).
async function seedMedical(knex, { replace = false } = {}) {
    if (replace) {
        await knex('medical_requests').del();
        await knex('doctors').del();
        await knex('hospitals').del();
    }

    const hospitals = readCsv('hospitals.csv').map((row) => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
    }));
    const doctors = readCsv('doctors.csv');

    const haveHospitals = new Set((await knex('hospitals').select('hospital_id')).map((r) => r.hospital_id));
    const addHospitals = hospitals.filter((h) => !haveHospitals.has(h.hospital_id));
    if (addHospitals.length > 0) await knex('hospitals').insert(addHospitals);

    const haveDoctors = new Set((await knex('doctors').select('doctor_id')).map((r) => r.doctor_id));
    const addDoctors = doctors.filter((d) => !haveDoctors.has(d.doctor_id));
    if (addDoctors.length > 0) await knex('doctors').insert(addDoctors);

    await knex('doctors').where({ specialty: 'Triage Doctor' }).update({ specialty: 'Emergency Physician' });
}

module.exports = { seedMedical };
