const bcrypt = require('bcryptjs');
const knex = require('../db');
const { cleanText, isBlank } = require('../validation');

const USERNAME = /^[a-z0-9._-]{3,30}$/;
const MIN_PASSWORD = 8;

function passwordOf(login) {
    return login && typeof login.password === 'string' ? login.password : '';
}

function usernameOf(login) {
    return cleanText(login && login.username).toLowerCase();
}

// With no account yet, filling in either field means "create one".
// With an account, only a new password matters (it resets the old one).
function wantsChange(login, current) {
    if (!login) return false;
    if (current) return passwordOf(login) !== '';
    return !isBlank(login.username) || passwordOf(login) !== '';
}

function loginFor(column, id) {
    return knex('users').where({ [column]: id }).first();
}

async function usernameProblem(username) {
    if (!USERNAME.test(username)) {
        return 'Username must be 3 to 30 characters: letters, numbers, dots, dashes or underscores';
    }
    if (await knex('users').where({ username }).first()) {
        return `Username ${username} is already taken`;
    }
    return null;
}

function passwordProblem(password) {
    return password.length < MIN_PASSWORD ? `Password must be at least ${MIN_PASSWORD} characters` : null;
}

async function checkLogin(login, current) {
    if (!wantsChange(login, current)) return [];
    const problems = [
        current ? null : await usernameProblem(usernameOf(login)),
        passwordProblem(passwordOf(login)),
    ];
    return problems.filter(Boolean);
}

// A user changing their own username and/or password. They must confirm their current password.
async function changeOwnLogin(userId, body) {
    body = body || {};
    const user = await knex('users').where({ user_id: userId }).first();
    if (!user) return { notFound: true };
    if (typeof body.current_password !== 'string' || !(await bcrypt.compare(body.current_password, user.password_hash))) {
        return { errors: ['Your current password is not right'] };
    }

    const username = cleanText(body.username).toLowerCase();
    const password = typeof body.new_password === 'string' ? body.new_password : '';
    const changingUsername = username !== '' && username !== user.username;
    if (!changingUsername && password === '') {
        return { errors: ['Enter a new username or a new password'] };
    }

    const problems = [
        changingUsername ? await usernameProblem(username) : null,
        password ? passwordProblem(password) : null,
    ].filter(Boolean);
    if (problems.length > 0) return { errors: problems };

    const changes = {};
    if (changingUsername) changes.username = username;
    if (password) changes.password_hash = await bcrypt.hash(password, 10);
    await knex('users').where({ user_id: userId }).update(changes);
    return { user: await knex('users').where({ user_id: userId }).first() };
}

// `account` = { name, role, shelter_id | warehouse_id | driver_id }. Returns the username, or null if nothing changed.
async function saveLogin(trx, login, current, account) {
    if (!wantsChange(login, current)) return null;
    const password_hash = await bcrypt.hash(passwordOf(login), 10);
    if (current) {
        await trx('users').where({ user_id: current.user_id }).update({ password_hash });
        return current.username;
    }
    const username = usernameOf(login);
    await trx('users').insert({ username, password_hash, ...account });
    return username;
}

function listUsers() {
    return knex('users')
        .select('user_id', 'username', 'name', 'role', 'shelter_id', 'warehouse_id', 'driver_id', 'created_at')
        .orderBy('user_id');
}

module.exports = { loginFor, checkLogin, saveLogin, changeOwnLogin, listUsers, MIN_PASSWORD };
