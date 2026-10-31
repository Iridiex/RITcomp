const config = require('../knexfile');
const env = process.env.NODE_ENV === 'test' ? 'test' : 'development';
module.exports = require('knex')(config[env]);
