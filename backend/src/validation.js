const URGENCIES = ['Critical', 'High', 'Moderate'];

function validateNewRequest(body, shelterIds) {
    const errors = [];
    if (!shelterIds.includes(body.shelter_id)) { errors.push('Choose a shelter that exists'); }
    if (!body.item || body.item.trim() === '') { errors.push('Enter an item'); }
    if (!(Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0)) { errors.push('Quantity must be a whole number above 0'); }
    if (!URGENCIES.includes(body.urgency)) { errors.push('Urgency must be Critical, High or Moderate'); }
    if (body.urgency === 'Critical' && (!body.reason || body.reason.trim() === '')) { errors.push('Critical requests need a reason'); }
    return errors;
}

// A coordinate must be a real number inside its range (latitude 90, longitude 180)
function isValidCoordinate(value, limit) {
    if (value === undefined || value === null || value === '') return false;
    const n = Number(value);
    return !Number.isNaN(n) && n >= -limit && n <= limit;
}

// Used for both shelters and warehouses; only shelters need a priority
function validateSite(body, { needsPriority }) {
    const errors = [];
    if (!body.name || body.name.trim() === '') { errors.push('Enter a name'); }
    if (needsPriority && ![1, 2, 3].includes(Number(body.priority))) { errors.push('Priority must be 1, 2 or 3'); }
    if (!isValidCoordinate(body.latitude, 90) || !isValidCoordinate(body.longitude, 180)) { errors.push('Pick a location on the map'); }
    return errors;
}

function validateStock(body, warehouseIds) {
    const errors = [];
    if (!warehouseIds.includes(body.warehouse_id)) { errors.push('Choose a warehouse that exists'); }
    if (!body.item || body.item.trim() === '') { errors.push('Enter an item'); }
    if (!(Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0)) { errors.push('Quantity must be a whole number above 0'); }
    return errors;
}

module.exports = { validateNewRequest, validateSite, validateStock, URGENCIES };
