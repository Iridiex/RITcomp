export function nextStep(r) {
    const short = r.quantity - r.quantity_allocated;
    const delivered = r.quantity_delivered || 0;
    const closed = r.quantity_closed > 0 ? `. ${r.quantity_closed} more closed as no longer needed` : '';
    switch (r.status) {
        case 'Awaiting review':
            return { tone: 'info', text: 'The coordinator is reviewing it' };
        case 'Pending':
            return { tone: 'info', text: 'Approved. Goes out in the next allocation run' };
        case 'Allocated':
            return {
                tone: 'ok',
                text: (delivered > 0 ? `${delivered} of ${r.quantity} delivered, the rest is on the way` : `All ${r.quantity} on the way`) + closed,
            };
        case 'Partial':
            return { tone: 'warn', text: `${r.quantity_allocated} sent, ${short} short. The rest is sent automatically as soon as stock arrives` };
        case 'Unfulfilled':
            return { tone: 'warn', text: `No ${r.item} in stock yet. Sent automatically as soon as it arrives` };
        case 'Fulfilled':
            return { tone: 'ok', text: `All ${r.quantity} delivered` + closed };
        case 'Rejected':
            return { tone: 'muted', text: r.review_note ? `Not approved: ${r.review_note}` : 'Not approved' };
        case 'Cancelled':
            return { tone: 'muted', text: r.close_note ? `Cancelled: ${r.close_note}` : 'Cancelled' };
        default:
            return { tone: 'muted', text: '' };
    }
}
