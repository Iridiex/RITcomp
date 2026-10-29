/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('shelters', (table) => {
        table.string('shelter_id').primary();
        // name: text, required
        // priority: whole number, required
        // latitude: decimal, required
        // longitude: decimal, required
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('shelters');
};