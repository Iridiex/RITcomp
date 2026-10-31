function toDate(value) {
    const text = String(value);
    return new Date(text.includes('T') ? text : text.replace(' ', 'T') + 'Z');
}

export function hoursSince(value) {
    if (!value) return 0;
    return (Date.now() - toDate(value).getTime()) / 3600000;
}

export function waitedText(value) {
    const hours = hoursSince(value);
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)} days`;
}

export function formatTime(value) {
    if (!value) return null;
    return toDate(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
