exports.up = function(knex) {
    return knex.schema.createTable('incidents', (table) => {
        table.increments('id').primary();
        table.string('shipment_id').notNullable();
        table.string('shelter_id');
        table.string('warehouse_id');
        table.string('driver_id');
        table.string('category').notNullable();
        table.boolean('warn_others').notNullable().defaultTo(true);
        table.text('summary').notNullable();
        table.text('summary_ar');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('resolved_at');
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('incidents');
};
