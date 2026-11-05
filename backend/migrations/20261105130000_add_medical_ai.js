exports.up = function (knex) {
    return knex.schema.table('medical_requests', (table) => {
        table.string('ai_specialty');
        table.string('ai_why');
    });
};

exports.down = function (knex) {
    return knex.schema.table('medical_requests', (table) => {
        table.dropColumn('ai_specialty');
        table.dropColumn('ai_why');
    });
};
