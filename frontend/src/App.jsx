import { useEffect, useState } from 'react';

const API = 'http://localhost:3000/api';

function App() {
    const [requests, setRequests] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [log, setLog] = useState([]);
    const [message, setMessage] = useState('');

    async function loadAll() {
        try {
            const res = await fetch(`${API}/requests`);
            setRequests(await res.json());

            const invRes = await fetch(`${API}/inventory`);
            setInventory(await invRes.json());

            const logRes = await fetch(`${API}/allocations/log`);
            setLog(await logRes.json());
        } catch (err) {
            setMessage('Could not reach the server. Is the backend running?');
        }
    }

    async function runAllocation() {
        try {
            const res = await fetch(`${API}/allocations/run`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setMessage(data.error || 'Allocation failed');
                return;
            }
            setMessage(`Allocation finished: ${data.fulfilled} fulfilled, ${data.partial} partial, ${data.unfulfilled} unfulfilled`);
            loadAll();
        } catch (err) {
            setMessage('Could not reach the server. Is the backend running?');
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    // Summary cards: count requests by status
    const count = (s) => requests.filter((r) => r.status === s).length;
    const stats = [
        { label: 'Requests', value: requests.length, cls: '' },
        { label: 'Pending', value: count('Pending'), cls: 'pending' },
        { label: 'Fulfilled', value: count('Fulfilled'), cls: 'fulfilled' },
        { label: 'Partial', value: count('Partial'), cls: 'partial' },
        { label: 'Unfulfilled', value: count('Unfulfilled'), cls: 'unfulfilled' },
    ];

    return (
        <div>
            <header className="header">
                <div>
                    <h1>Relief dispatch</h1>
                    <p className="subtitle">Emergency supply allocation for shelters</p>
                </div>
                <button onClick={runAllocation}>Run allocation</button>
            </header>

            {message && <p className="message">{message}</p>}

            <div className="stats">
                {stats.map((s) => (
                    <div key={s.label} className={`stat ${s.cls}`}>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <section className="card">
                <h2>Requests</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Shelter</th><th>Item</th><th>Qty</th>
                            <th>Urgency</th><th>Status</th><th>Sent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.map((r) => (
                            <tr key={r.request_id}>
                                <td>{r.request_id}</td>
                                <td>{r.shelter_id}</td>
                                <td>{r.item}</td>
                                <td>{r.quantity}</td>
                                <td><span className={`badge ${r.urgency.toLowerCase()}`}>{r.urgency}</span></td>
                                <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                                <td>{r.quantity_allocated}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="card">
                <h2>Inventory</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Warehouse</th><th>Item</th><th>Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.map((row) => (
                            <tr key={row.id}>
                                <td>{row.warehouse_id}</td>
                                <td>{row.item}</td>
                                <td>{row.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="card">
                <h2>Allocation log</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Run</th><th>Request</th><th>Warehouse</th>
                            <th>Sent</th><th>Result</th><th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {log.map((row) => (
                            <tr key={row.id}>
                                <td>{row.run_id}</td>
                                <td>{row.request_id}</td>
                                <td>{row.warehouse_id || '-'}</td>
                                <td>{row.quantity_sent}</td>
                                <td><span className={`badge ${row.result.toLowerCase()}`}>{row.result}</span></td>
                                <td>{row.reason || ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

export default App;
