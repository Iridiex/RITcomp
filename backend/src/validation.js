const URGENCIES = ['Critical', 'High', 'Moderate'];

// Anything that is not a string (missing, number, object) counts as empty text
function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function isBlank(value) {
    return cleanText(value) === '';
}

function validateNewRequest(body, shelterIds, knownItems) {
    const errors = [];
    if (!shelterIds.includes(body.shelter_id)) { errors.push('Choose a shelter that exists'); }
    if (isBlank(body.item)) {
        errors.push('Enter an item');
    } else if (knownItems && !knownItems.includes(cleanText(body.item).toLowerCase())) {
        errors.push('Choose an item from the list. Warehouses do not stock ' + cleanText(body.item));
    }
    if (!(Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0)) { errors.push('Quantity must be a whole number above 0'); }
    if (!URGENCIES.includes(body.urgency)) { errors.push('Urgency must be Critical, High or Moderate'); }
    if (isBlank(body.reason)) { errors.push('Say why you need this'); }
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
    if (isBlank(body.name)) { errors.push('Enter a name'); }
    if (needsPriority && ![1, 2, 3].includes(Number(body.priority))) { errors.push('Priority must be 1, 2 or 3'); }
    if (!isValidCoordinate(body.latitude, 90) || !isValidCoordinate(body.longitude, 180)) { errors.push('Pick a location on the map'); }
    return errors;
}

function validateStock(body, warehouseIds) {
    const errors = [];
    if (!warehouseIds.includes(body.warehouse_id)) { errors.push('Choose a warehouse that exists'); }
    if (isBlank(body.item)) { errors.push('Enter an item'); }
    if (!(Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0)) { errors.push('Quantity must be a whole number above 0'); }
    return errors;
}

function validateDriver(body) {
    const errors = [];
    if (isBlank(body.name)) { errors.push('Enter a name'); }
    const phone = cleanText(body.phone);
    if (phone && !/^\+?[0-9][0-9 ()-]{5,19}$/.test(phone)) { errors.push('Phone must be a number like 050-123-4567'); }
    return errors;
}

module.exports = { validateNewRequest, validateSite, validateStock, validateDriver, cleanText, isBlank, URGENCIES };
