exports.up = function(knex) {
    return knex.schema
        .alterTable('requests', (table) => {
            table.integer('quantity_delivered').notNullable().defaultTo(0);
            table.boolean('replacement_pending').notNullable().defaultTo(false);
        })
        .alterTable('shipments', (table) => {
            table.string('failure_reason');
        });
};

exports.down = function(knex) {
    return knex.schema
        .alterTable('shipments', (table) => {
            table.dropColumn('failure_reason');
        })
        .alterTable('requests', (table) => {
            table.dropColumn('replacement_pending');
            table.dropColumn('quantity_delivered');
        });
};
