exports.up = function(knex) {
    return knex.schema.createTable('shipment_notes', (table) => {
        table.increments('id').primary();
        table.string('shipment_id').notNullable().references('shipment_id').inTable('shipments').onDelete('CASCADE');
        table.string('kind').notNullable();
        table.string('stage').notNullable();
        table.text('original').notNullable();
        table.string('language');
        table.text('english');
        table.text('arabic');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('shipment_notes');
};
