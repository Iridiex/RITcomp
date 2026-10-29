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

    return (
        <div>
            <h1>Relief dispatch</h1>

            <button onClick={runAllocation}>Run allocation</button>
            {message && <p>{message}</p>}

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
                            <td>{r.urgency}</td>
                            <td>{r.status}</td>
                            <td>{r.quantity_allocated}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

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
                            <td>{row.result}</td>
                            <td>{row.reason || ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default App;
