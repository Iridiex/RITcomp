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
        })
        .createTable('requests', (table) => {
            table.string('request_id').primary();
            table.string('shelter_id').notNullable()
                .references('shelter_id').inTable('shelters');
            table.string('item').notNullable();
            table.integer('quantity').notNullable();
            table.string('urgency').notNullable();
            table.string('status').notNullable().defaultTo('Pending');
            table.integer('quantity_allocated').notNullable().defaultTo(0);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('requests')
        .dropTableIfExists('inventory')
        .dropTableIfExists('shelters');
};