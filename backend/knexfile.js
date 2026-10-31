module.exports = {
    development: {
        client: 'sqlite3',
        connection: { filename: './data/relief.sqlite3' },
        useNullAsDefault: true,
    },

    test: {
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
        pool: { min: 1, max: 1 },
    },
};