exports.up = function(knex) {
    return knex.schema.createTable('stock_movements', (table) => {
        table.increments('id');
        table.string('warehouse_id').notNullable();
        table.string('item').notNullable();
        table.integer('change').notNullable();
        table.string('reason');
        table.string('by_name');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('stock_movements');
};
