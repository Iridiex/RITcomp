exports.up = function(knex) {
    return knex.schema.alterTable('requests', (table) => {
        table.string('ai_urgency');
        table.string('ai_why');
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('requests', (table) => {
        table.dropColumn('ai_urgency');
        table.dropColumn('ai_why');
    });
};
