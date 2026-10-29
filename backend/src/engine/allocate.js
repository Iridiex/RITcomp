const URGENCY_RANK = { Critical: 1, High: 2, Moderate: 3 };

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

module.exports = { sortRequests };