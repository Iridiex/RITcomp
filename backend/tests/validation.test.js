const { validateNewRequest } = require('../src/validation');

const shelterIds = ['SH-01', 'SH-02'];

test('a valid request has no errors', () => {
    const errors = validateNewRequest({ shelter_id: 'SH-01', item: 'water', quantity: 50, urgency: 'High', reason: 'Ran out' },
        shelterIds
    );
    expect(errors).toEqual([]);
});

test('negative quantity is rejected', () => {
    const errors = validateNewRequest({ shelter_id: 'SH-01', item: 'water', quantity: -5, urgency: 'High' },
        shelterIds
    );
    expect(errors).toContain('Quantity must be a whole number above 0');
});

test('unknown shelter is rejected', () => {
    const errors = validateNewRequest({ shelter_id: 'SH-99', item: 'water', quantity: 50, urgency: 'High' },
        shelterIds
    );
    expect(errors).toContain('Choose a shelter that exists');
});

test.each(['Critical', 'High', 'Moderate'])('%s without a reason is rejected', (urgency) => {
    const errors = validateNewRequest({ shelter_id: 'SH-01', item: 'water', quantity: 50, urgency },
        shelterIds
    );
    expect(errors).toEqual(['Say why you need this']);
});

test('an item outside the known list is rejected, whatever its capitals', () => {
    const known = ['water', 'tents'];
    expect(validateNewRequest({ shelter_id: 'SH-01', item: ' Water ', quantity: 5, urgency: 'High', reason: 'x' }, shelterIds, known)).toEqual([]);
    expect(validateNewRequest({ shelter_id: 'SH-01', item: 'rice', quantity: 5, urgency: 'High', reason: 'x' }, shelterIds, known))
        .toEqual(['Choose an item from the list. Warehouses do not stock rice']);
});