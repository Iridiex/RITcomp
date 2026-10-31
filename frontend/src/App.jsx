import { useEffect, useState } from 'react';
import Sidebar, { PAGES } from './components/Sidebar';
import MapView from './components/MapView';
import DashboardSide from './components/DashboardSide';
import ReviewQueue from './components/ReviewQueue';
import NewRequestForm from './components/NewRequestForm';
import RequestsTable from './components/RequestsTable';
import AddStockForm from './components/AddStockForm';
import InventoryTable from './components/InventoryTable';
import SitesPanel from './components/SitesPanel';
import AllocationLog from './components/AllocationLog';
import ShipmentsPanel from './components/ShipmentsPanel';
import DriverView from './components/DriverView';
import ReportsPanel from './components/ReportsPanel';

const API = 'http://localhost:3000/api';

const SUBTITLES = {
    dashboard: 'Overview of requests, stock and locations',
    requests: 'Review shelter requests and add new ones',
    inventory: 'Stock held in each warehouse',
    sites: 'Register, move or remove shelters and warehouses',
    allocation: 'Run the allocation engine and see what was sent',
    shipments: 'Assign drivers and track every delivery',
    driver: 'What a driver sees on their phone',
    reports: 'Export fulfilled and unfulfilled requests',
};

function startPage() {
    const hash = window.location.hash.replace('#', '');
    return PAGES.some((p) => p.id === hash) ? hash : 'dashboard';
}

function App() {
    const [page, setPage] = useState(startPage);
    const [requests, setRequests] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [log, setLog] = useState([]);
    const [shelters, setShelters] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [message, setMessage] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    async function loadAll() {
        try {
            const urls = ['requests', 'inventory', 'allocations/log', 'shelters', 'warehouses', 'shipments', 'drivers'];
            const responses = await Promise.all(urls.map((u) => fetch(`${API}/${u}`)));
            const [req, inv, lg, sh, wh, shp, drv] = await Promise.all(responses.map((r) => r.json()));
            setRequests(req);
            setInventory(inv);
            setLog(lg);
            setShelters(sh);
            setWarehouses(wh);
            setShipments(shp);
            setDrivers(drv);
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
            setMessage(
                `This run: ${data.fulfilled} fulfilled, ${data.partial} partial, ${data.unfulfilled} unfulfilled · ${data.shipments} shipment(s) created`
            );
            loadAll();
        } catch (err) {
            setMessage('Could not reach the server. Is the backend running?');
        }
    }

    function navigate(next) {
        setPage(next);
        setMessage('');
        window.location.hash = next;
    }

    function openRequests(status) {
        setStatusFilter(status);
        navigate('requests');
    }

    useEffect(() => {
        loadAll();
    }, []);

    const count = (s) => requests.filter((r) => r.status === s).length;
    const stats = [
        { label: 'Requests', value: requests.length, cls: '' },
        { label: 'Pending', value: count('Pending'), cls: 'pending' },
        { label: 'Fulfilled', value: count('Fulfilled'), cls: 'fulfilled' },
        { label: 'Partial', value: count('Partial'), cls: 'partial' },
        { label: 'Unfulfilled', value: count('Unfulfilled'), cls: 'unfulfilled' },
    ];
    const badges = {
        requests: count('Awaiting review'),
        shipments: shipments.filter((s) => s.status === 'Ready' && !s.driver_id).length,
    };
    const title = PAGES.find((p) => p.id === page).label;
    const showRunButton = page === 'dashboard' || page === 'allocation';

    return (
        <div className="layout">
            <Sidebar page={page} onNavigate={navigate} badges={badges} />

            <main className="content">
                <header className="header">
                    <div>
                        <h1>{title}</h1>
                        <p className="subtitle">{SUBTITLES[page]}</p>
                    </div>
                    {showRunButton && <button onClick={runAllocation}>Run allocation</button>}
                </header>

                {message && <p className="message">{message}</p>}

                {page === 'dashboard' && (
                    <>
                        <div className="stats">
                            {stats.map((s) => (
                                <div
                                    key={s.label}
                                    className={`stat clickable ${s.cls}`}
                                    onClick={() => openRequests(s.label === 'Requests' ? 'All' : s.label)}
                                >
                                    <div className="stat-value">{s.value}</div>
                                    <div className="stat-label">{s.label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="dash-grid">
                            <MapView shelters={shelters} warehouses={warehouses} requests={requests} inventory={inventory} />
                            <DashboardSide
                                requests={requests}
                                shelters={shelters}
                                inventory={inventory}
                                warehouses={warehouses}
                                onOpenRequests={openRequests}
                            />
                        </div>
                    </>
                )}

                {page === 'requests' && (
                    <>
                        <ReviewQueue requests={requests} shelters={shelters} onChanged={loadAll} />
                        <NewRequestForm shelters={shelters} onCreated={loadAll} />
                        <RequestsTable
                            requests={requests}
                            shelters={shelters}
                            filter={statusFilter}
                            onFilterChange={setStatusFilter}
                        />
                    </>
                )}

                {page === 'inventory' && (
                    <>
                        <AddStockForm warehouses={warehouses} onAdded={loadAll} />
                        <InventoryTable inventory={inventory} warehouses={warehouses} />
                    </>
                )}

                {page === 'sites' && (
                    <SitesPanel shelters={shelters} warehouses={warehouses} onChanged={loadAll} />
                )}

                {page === 'allocation' && <AllocationLog log={log} />}

                {page === 'shipments' && (
                    <ShipmentsPanel shipments={shipments} drivers={drivers} onChanged={loadAll} />
                )}

                {page === 'driver' && (
                    <DriverView drivers={drivers} shipments={shipments} onChanged={loadAll} />
                )}

                {page === 'reports' && <ReportsPanel requests={requests} />}
            </main>
        </div>
    );
}

export default App;
