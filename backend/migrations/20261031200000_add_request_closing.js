exports.up = function (knex) {
    return knex.schema.alterTable('requests', (table) => {
        table.integer('quantity_closed').notNullable().defaultTo(0);
        table.string('close_note').nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('requests', (table) => {
        table.dropColumn('quantity_closed');
        table.dropColumn('close_note');
    });
};
