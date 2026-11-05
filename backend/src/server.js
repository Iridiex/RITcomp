const path = require('path');

try {
    process.loadEnvFile(path.join(__dirname, '../.env'));
} catch {
    // no .env file: AI features stay off
}

const app = require('./app');
const knex = require('./db');
const { seedMedical } = require('./seedMedical');

knex.migrate.latest({ directory: path.join(__dirname, '../migrations') }).then(() => seedMedical(knex)).then(() => {
    app.listen(3000, () => {
        console.log('Server running on port 3000');
        console.log(process.env.GEMINI_API_KEY ? 'AI checks: Gemini' : 'AI checks: off (no GEMINI_API_KEY)');
    });
});
