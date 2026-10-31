const knex = require('../db');

const ALERT_HOURS = 24;

function sinceCutoff(now = Date.now()) {
    return new Date(now - ALERT_HOURS * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

// Unresolved warnings from the last day, newest first, with the place names readers need
async function activeAlerts() {
    return knex('incidents')
        .leftJoin('shelters', 'incidents.shelter_id', 'shelters.shelter_id')
        .leftJoin('drivers', 'incidents.driver_id', 'drivers.driver_id')
        .whereNull('incidents.resolved_at')
        .where('incidents.warn_others', true)
        .where('incidents.created_at', '>=', sinceCutoff())
        .select('incidents.*', 'shelters.name as shelter_name', 'drivers.name as driver_name')
        .orderBy('incidents.id', 'desc');
}

async function resolveIncident(id) {
    const incident = await knex('incidents').where({ id: Number(id) || 0 }).first();
    if (!incident) return { notFound: true };
    if (incident.resolved_at) return { errors: ['This alert is already cleared'] };
    const resolved_at = new Date().toISOString();
    await knex('incidents').where({ id: incident.id }).update({ resolved_at });
    return { row: { ...incident, resolved_at } };
}

module.exports = { activeAlerts, resolveIncident };
