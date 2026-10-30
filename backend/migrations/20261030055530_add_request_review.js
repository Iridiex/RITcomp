exports.up = function(knex) {
    return knex.schema.alterTable('requests', (table) => {
        table.string('reason');
        table.string('review_note');
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('requests', (table) => {
        table.dropColumn('reason');
        table.dropColumn('review_note');
    });
};