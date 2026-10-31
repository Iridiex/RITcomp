export const NO_LOGIN = { username: '', password: '' };

// The password is only ever visible right after it is set, so the success message repeats it
export function loginNote(login, username) {
    if (!username || !login.password) return '';
    return ` Login: ${username} / ${login.password}. Share it with them now, it will not be shown again.`;
}
