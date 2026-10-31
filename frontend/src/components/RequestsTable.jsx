import { useState } from 'react';

const FILTERS = ['All', 'Awaiting review', 'Pending', 'Fulfilled', 'Partial', 'Unfulfilled', 'Rejected'];

function RequestsTable({ requests, shelters, filter, onFilterChange }) {
    const [search, setSearch] = useState('');

    const nameOf = (id) => {
        const shelter = shelters.find((s) => s.shelter_id === id);
        return shelter ? shelter.name : id;
    };

    const term = search.trim().toLowerCase();
    const matchesSearch = (r) =>
        term === '' ||
        r.request_id.toLowerCase().includes(term) ||
        r.item.toLowerCase().includes(term) ||
        nameOf(r.shelter_id).toLowerCase().includes(term);

    const shown = requests.filter((r) => (filter === 'All' || r.status === filter) && matchesSearch(r));
    const countOf = (f) => (f === 'All' ? requests.length : requests.filter((r) => r.status === f).length);

    return (
        <section className="card">
            <div className="panel-header">
                <h2>All requests</h2>
                <input
                    className="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search ID, shelter or item"
                />
            </div>

            <div className="chips">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        className={`chip ${filter === f ? 'active' : ''}`}
                        onClick={() => onFilterChange(f)}
                    >
                        {f} <span className="chip-count">{countOf(f)}</span>
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <p className="muted">No requests match.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Shelter</th><th>Item</th><th>Qty</th>
                            <th>Urgency</th><th>Status</th><th>Sent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((r) => (
                            <tr key={r.request_id}>
                                <td>{r.request_id}</td>
                                <td>{nameOf(r.shelter_id)}</td>
                                <td>{r.item}</td>
                                <td>{r.quantity}</td>
                                <td><span className={`badge ${r.urgency.toLowerCase()}`}>{r.urgency}</span></td>
                                <td><span className={`badge ${r.status.toLowerCase().replace(' ', '-')}`}>{r.status}</span></td>
                                <td>{r.quantity_allocated}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export default RequestsTable;
