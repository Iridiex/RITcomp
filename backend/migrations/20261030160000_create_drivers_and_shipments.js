exports.up = function(knex) {
    return knex.schema
        .createTable('drivers', (table) => {
            table.string('driver_id').primary();
            table.string('name').notNullable();
            table.string('phone');
        })
        .createTable('shipments', (table) => {
            table.string('shipment_id').primary();
            table.string('run_id').notNullable();
            table.string('request_id').notNullable().references('request_id').inTable('requests');
            table.string('warehouse_id').notNullable();
            table.string('item').notNullable();
            table.integer('quantity').notNullable();
            table.string('status').notNullable().defaultTo('Ready');
            table.string('driver_id').references('driver_id').inTable('drivers');
            table.integer('quantity_damaged').notNullable().defaultTo(0);
            table.string('damage_note');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('picked_up_at');
            table.timestamp('delivered_at');
        });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('shipments').dropTableIfExists('drivers');
};
