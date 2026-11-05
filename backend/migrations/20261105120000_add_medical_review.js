exports.up = function (knex) {
    return knex.schema.table('medical_requests', (table) => {
        table.string('reason');
        table.string('review_note');
    });
};

exports.down = function (knex) {
    return knex.schema.table('medical_requests', (table) => {
        table.dropColumn('reason');
        table.dropColumn('review_note');
    });
};
