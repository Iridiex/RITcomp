exports.up = function(knex) {
    return knex.schema.alterTable('shipments', (table) => {
        table.string('returned_at');
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('shipments', (table) => {
        table.dropColumn('returned_at');
    });
};
