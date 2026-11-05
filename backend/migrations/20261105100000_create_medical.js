exports.up = function (knex) {
    return knex.schema
        .createTable('hospitals', (table) => {
            table.string('hospital_id').primary();
            table.string('name').notNullable();
            table.float('latitude').notNullable();
            table.float('longitude').notNullable();
        })
        .createTable('doctors', (table) => {
            table.string('doctor_id').primary();
            table.string('name').notNullable();
            table.string('specialty').notNullable();
            table.string('status').notNullable().defaultTo('Available');
            table.string('hospital_id').notNullable().references('hospital_id').inTable('hospitals');
        })
        .createTable('medical_requests', (table) => {
            table.string('medical_id').primary();
            table.string('shelter_id').notNullable();
            table.string('specialty').notNullable();
            table.string('status').notNullable();
            table.string('doctor_id');
            table.string('hospital_id');
            table.float('distance');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('dispatched_at');
            table.timestamp('completed_at');
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('medical_requests')
        .dropTableIfExists('doctors')
        .dropTableIfExists('hospitals');
};
