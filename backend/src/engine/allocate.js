const URGENCY_RANK = { Critical: 1, High: 2, Moderate: 3 };
const WAITING = ['Pending', 'Partial', 'Unfulfilled'];

function sortRequests(requests, shelters) {
    return [...requests].sort((a, b) => {
        const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        if (byUrgency !== 0) return byUrgency;

        const shelterA = shelters.find((s) => s.shelter_id === a.shelter_id);
        const shelterB = shelters.find((s) => s.shelter_id === b.shelter_id);
        const byPriority = shelterA.priority - shelterB.priority;
        if (byPriority !== 0) return byPriority;

        const byAge = new Date(a.created_at) - new Date(b.created_at);
        if (byAge !== 0) return byAge;

        return a.request_id.localeCompare(b.request_id);
    });
}

function orderWarehouses(inventory, item) {
    return inventory
        .filter((row) => row.item === item && row.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity);
}

function allocate(requests, shelters, inventory) {
    const stock = inventory.map((row) => ({ ...row }));
    const waiting = requests.filter((r) => WAITING.includes(r.status));
    const queue = sortRequests(waiting, shelters);
    const results = [];

    for (const request of queue) {
        let needed = request.quantity - request.quantity_allocated;
        const takes = [];

        for (const row of orderWarehouses(stock, request.item)) {
            if (needed === 0) break;
            const take = Math.min(needed, row.quantity);
            row.quantity = row.quantity - take;
            needed = needed - take;
            takes.push({ warehouse_id: row.warehouse_id, quantity: take });
        }

        const totalSent = request.quantity - needed;
        let status;
        if (needed === 0) {
            status = 'Allocated';
        } else if (totalSent > 0) {
            status = 'Partial';
        } else {
            status = 'Unfulfilled';
        }

        let reason = null;
        if (status === 'Partial') {
            reason = `Requested ${request.quantity}, only ${totalSent} available`;
        } else if (status === 'Unfulfilled') {
            reason = `No ${request.item} in stock`;
        }

        results.push({ request_id: request.request_id, status, quantity_allocated: totalSent, takes, reason });
    }

    return { results, stock };
}

module.exports = { sortRequests, orderWarehouses, allocate, WAITING };
