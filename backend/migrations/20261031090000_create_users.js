exports.up = function(knex) {
    return knex.schema.createTable('users', (table) => {
        table.increments('user_id');
        table.string('username').notNullable().unique();
        table.string('password_hash').notNullable();
        table.string('name').notNullable();
        table.string('role').notNullable();
        table.string('shelter_id');
        table.string('warehouse_id');
        table.string('driver_id');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('users');
};
