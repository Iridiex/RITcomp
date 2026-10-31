const { signToken } = require('../../src/auth');

const bearer = (user) => 'Bearer ' + signToken(user);

const AUTH = bearer({ user_id: 0, username: 'test', name: 'Test Coordinator', role: 'coordinator' });
const shelterAuth = (id) => bearer({ user_id: 0, username: 'shelter', name: 'Test Shelter', role: 'shelter', shelter_id: id });
const warehouseAuth = (id) => bearer({ user_id: 0, username: 'warehouse', name: 'Test Warehouse', role: 'warehouse', warehouse_id: id });

module.exports = { AUTH, shelterAuth, warehouseAuth };
