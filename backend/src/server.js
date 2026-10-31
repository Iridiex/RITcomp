const path = require('path');

try {
    process.loadEnvFile(path.join(__dirname, '../.env'));
} catch {
    // no .env file: AI features stay off
}

const app = require('./app');
const knex = require('./db');

knex.migrate.latest({ directory: path.join(__dirname, '../migrations') }).then(() => {
    app.listen(3000, () => {
        console.log('Server running on port 3000');
        console.log(process.env.GEMINI_API_KEY ? 'Urgency check: Gemini' : 'Urgency check: off (no GEMINI_API_KEY)');
    });
});
