const URGENCIES = ['Critical', 'High', 'Moderate'];

function validateNewRequest(body, shelterIds) {
    const errors = [];

    if (!shelterIds.includes(body.shelter_id)) {
        errors.push('Choose a shelter that exists');
    }

    if (!body.item || body.item.trim() === '') {
        errors.push('Enter an item');
    }

    if (!(Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0)) {
        errors.push('Quantity must be a whole number above 0');
    }

    if (!URGENCIES.includes(body.urgency)) {
        errors.push('Urgency must be Critical, High or Moderate');
    }

    if (body.urgency === 'Critical' && (!body.reason || body.reason.trim() === '')) {
        errors.push('Critical requests need a reason');
    }

    return errors;
}

module.exports = { validateNewRequest, URGENCIES };