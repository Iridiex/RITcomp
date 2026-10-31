exports.up = function(knex) {
    return knex.schema.createTable('warehouses', (table) => {
        table.string('warehouse_id').primary();
        table.string('name').notNullable();
        table.decimal('latitude', 10, 8).notNullable();
        table.decimal('longitude', 11, 8).notNullable();
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('warehouses');
};
