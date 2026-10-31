export const API = 'http://localhost:3000/api';

const KEY = 'relief-session';

export function loadSession() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
}

function saveSession(session) {
    try {
        if (session) localStorage.setItem(KEY, JSON.stringify(session));
        else localStorage.removeItem(KEY);
    } catch (err) {
        return;
    }
}

let current = loadSession();
let expiredHandler = () => {};

export function setCurrentSession(session) {
    current = session;
    saveSession(session);
}

export function onSessionExpired(handler) {
    expiredHandler = handler;
}

export function withToken(url) {
    if (!current) return url;
    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(current.token)}`;
}

let installed = false;

export function installAuthFetch() {
    if (installed) return;
    installed = true;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;
        if (!url.startsWith(API) || !current) return original(input, init);
        const headers = new Headers(init.headers || {});
        headers.set('Authorization', `Bearer ${current.token}`);
        const res = await original(input, { ...init, headers });
        if (res.status === 401 && !url.endsWith('/auth/login')) expiredHandler();
        return res;
    };
}
