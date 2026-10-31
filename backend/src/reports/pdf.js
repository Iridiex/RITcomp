const PDFDocument = require('pdfkit');

const REQUEST_COLUMNS = [
    { key: 'request_id', label: 'ID', width: 50 },
    { key: 'shelter_name', label: 'Shelter', width: 130 },
    { key: 'item', label: 'Item', width: 80 },
    { key: 'urgency', label: 'Urgency', width: 60 },
    { key: 'requested', label: 'Requested', width: 55 },
    { key: 'allocated', label: 'Sent', width: 45 },
    { key: 'shortfall', label: 'Short', width: 45 },
    { key: 'status', label: 'Status', width: 50 },
];

const INVENTORY_COLUMNS = [
    { key: 'warehouse_id', label: 'Warehouse', width: 80 },
    { key: 'item', label: 'Item', width: 150 },
    { key: 'quantity', label: 'Quantity', width: 60 },
];

const DAMAGE_COLUMNS = [
    { key: 'shipment_id', label: 'Shipment', width: 55 },
    { key: 'request_id', label: 'Request', width: 55 },
    { key: 'shelter_name', label: 'Shelter', width: 120 },
    { key: 'item', label: 'Item', width: 75 },
    { key: 'damaged', label: 'Damaged', width: 50 },
    { key: 'note', label: 'What happened', width: 160 },
];

function drawTable(doc, columns, rows) {
    const left = doc.page.margins.left;
    let y = doc.y;

    function drawRow(cells, bold) {
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
            doc.addPage();
            y = doc.page.margins.top;
        }
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        let x = left;
        cells.forEach((cell, i) => {
            const text = cell === null || cell === undefined ? '' : String(cell);
            doc.text(text, x, y, { width: columns[i].width - 6, lineBreak: false, ellipsis: true });
            x += columns[i].width;
        });
        y += 16;
    }

    drawRow(columns.map((c) => c.label), true);
    if (rows.length === 0) {
        drawRow(['None'].concat(columns.slice(1).map(() => '')), false);
    }
    rows.forEach((row) => drawRow(columns.map((c) => row[c.key]), false));

    doc.x = left;
    doc.y = y + 10;
}

function heading(doc, text) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(text);
    doc.moveDown(0.3);
}

function writePdf(report, stream) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(stream);

    const s = report.summary;
    const generated = new Date(report.generated_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });

    doc.font('Helvetica-Bold').fontSize(18).text('Relief dispatch report');
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Generated ' + generated + ' (Dubai time)');
    doc.moveDown();

    heading(doc, 'Summary');
    doc.font('Helvetica').fontSize(10).fillColor('#111827');
    doc.text('Requests: ' + s.total + '   Fulfilled: ' + s.fulfilled + '   Partial: ' + s.partial +
        '   Unfulfilled: ' + s.unfulfilled + '   Pending: ' + s.pending +
        '   Awaiting review: ' + s.awaiting_review + '   Rejected: ' + s.rejected);
    doc.text('Units requested: ' + s.units_requested + '   Units sent: ' + s.units_allocated +
        '   Fill rate: ' + s.fill_rate + '%');
    doc.moveDown();

    heading(doc, 'Fulfilled requests');
    drawTable(doc, REQUEST_COLUMNS, report.fulfilled);

    heading(doc, 'Unfulfilled and partial requests');
    drawTable(doc, REQUEST_COLUMNS, report.unfulfilled);

    heading(doc, 'Still open (pending, awaiting review or on the way)');
    drawTable(doc, REQUEST_COLUMNS, report.open);

    heading(doc, 'Damaged, written off or returned');
    drawTable(doc, DAMAGE_COLUMNS, report.damaged);

    heading(doc, 'Current inventory');
    drawTable(doc, INVENTORY_COLUMNS, report.inventory);

    doc.end();
}

module.exports = { writePdf };
