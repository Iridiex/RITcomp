const knex = require('../db');
const { translateNote } = require('../ai/language');
const { aiEnabled } = require('../ai/gemini');

const inEnglish = (note) => note.english || note.original;

// Translates outside the database transaction so a slow reply never holds a lock
async function prepareNotes(entries) {
    const wanted = entries.filter((e) => e.text);
    return Promise.all(wanted.map(async (e) => {
        const translated = await translateNote(e.text);
        return {
            kind: e.kind,
            stage: e.stage,
            original: e.text,
            language: translated ? translated.language : null,
            english: translated ? translated.english : null,
            arabic: translated ? translated.arabic : null,
        };
    }));
}

async function saveNotes(trx, shipmentId, notes) {
    if (notes.length > 0) {
        await trx('shipment_notes').insert(notes.map((n) => ({ ...n, shipment_id: shipmentId })));
    }
}

async function notesFor(shipmentIds) {
    const byShipment = new Map();
    if (shipmentIds.length === 0) return byShipment;
    const rows = await knex('shipment_notes').whereIn('shipment_id', shipmentIds).orderBy('id');
    for (const row of rows) {
        if (!byShipment.has(row.shipment_id)) byShipment.set(row.shipment_id, []);
        byShipment.get(row.shipment_id).push({
            kind: row.kind, stage: row.stage, original: row.original, language: row.language, english: row.english, arabic: row.arabic,
        });
    }
    return byShipment;
}

// The shipment keeps English summaries for reports, exports and the AI brief; swap the untranslated text in place
async function useTranslation(note, english) {
    const shipment = await knex('shipments').where({ shipment_id: note.shipment_id }).first();
    if (!shipment) return;
    const changes = {};
    if (note.kind === 'damage' && shipment.damage_note) {
        changes.damage_note = shipment.damage_note.replace(`${note.stage}: ${note.original}`, `${note.stage}: ${english}`);
    }
    if (note.kind === 'failure' && shipment.failure_reason === note.original) changes.failure_reason = english;
    if (Object.keys(changes).length > 0) await knex('shipments').where({ shipment_id: note.shipment_id }).update(changes);
}

let retrying = null;

// Notes saved while Gemini was unreachable get translated in the background on a later page load
function retryUntranslated() {
    if (retrying || !aiEnabled()) return retrying;
    retrying = (async () => {
        const pending = await knex('shipment_notes').whereNull('english').orderBy('id').limit(20);
        let failuresInARow = 0;
        for (const note of pending) {
            const translated = await translateNote(note.original);
            if (!translated) {
                failuresInARow += 1;
                if (failuresInARow >= 3) break;
                continue;
            }
            failuresInARow = 0;
            await knex('shipment_notes').where({ id: note.id }).update(translated);
            await useTranslation(note, translated.english);
        }
    })()
        .catch((err) => console.warn('Retrying note translations failed:', err.message))
        .finally(() => { retrying = null; });
    return retrying;
}

module.exports = { prepareNotes, saveNotes, notesFor, inEnglish, retryUntranslated };
