/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        .createTable('shelters', (table) => {
            table.string('shelter_id').primary();
            table.string('name').notNullable();
            table.integer('priority').notNullable();
            table.decimal('latitude', 10, 8).notNullable();
            table.decimal('longitude', 11, 8).notNullable();
        })
        .createTable('inventory', (table) => {
            table.increments('id');
            table.string('warehouse_id').notNullable();
            table.string('item').notNullable();
            table.integer('quantity').notNullable().defaultTo(0);
            table.unique(['warehouse_id', 'item']);
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('inventory')
        .dropTableIfExists('shelters');
}