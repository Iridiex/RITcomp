const { validateNewRequest } = require('../src/validation');

const shelterIds = ['SH-01', 'SH-02'];

test('a valid request has no errors', () => {
    const errors = validateNewRequest({ shelter_id: 'SH-01', item: 'water', quantity: 50, urgency: 'High' },
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

test('Critical without a reason is rejected', () => {
    const errors = validateNewRequest({ shelter_id: 'SH-99', item: 'water', quantity: 50, urgency: 'Critical' },
        shelterIds
    );
    expect(errors).toContain('Critical requests need a reason');
});