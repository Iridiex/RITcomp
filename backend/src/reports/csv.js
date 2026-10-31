// A cell needs quotes if it contains a comma, quote or line break.
// Quotes inside the text are doubled: He said "hi" -> "He said ""hi"""
function csvCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (/[",\n\r]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

// columns = [{ key: 'request_id', label: 'Request ID' }, ...]
function toCsv(rows, columns) {
    const header = columns.map((c) => csvCell(c.label)).join(',');
    const lines = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(','));
    return [header, ...lines].join('\n');
}

module.exports = { csvCell, toCsv };
