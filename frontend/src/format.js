export function formatTime(value) {
    if (!value) return null;
    const text = String(value);
    const iso = text.includes('T') ? text : text.replace(' ', 'T') + 'Z';
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
