import { useEffect, useState } from 'react';
import Sidebar, { PAGES } from './components/Sidebar';
import LoginPage from './components/LoginPage';
import MapView from './components/MapView';
import DashboardSide from './components/DashboardSide';
import ReviewQueue from './components/ReviewQueue';
import NewRequestForm from './components/NewRequestForm';
import RequestsTable from './components/RequestsTable';
import StockForm from './components/StockForm';
import StockHistory from './components/StockHistory';
import InventoryTable from './components/InventoryTable';
import SitesPanel from './components/SitesPanel';
import AllocationLog from './components/AllocationLog';
import ShipmentsPanel from './components/ShipmentsPanel';
import ShipmentTracker from './components/ShipmentTracker';
import DriverView from './components/DriverView';
import ReportsPanel from './components/ReportsPanel';
import DetailDrawer from './components/DetailDrawer';
import { InspectProvider } from './inspect';
import { API, installAuthFetch, loadSession, setCurrentSession, onSessionExpired } from './session';

installAuthFetch();

const ROLE_PAGES = {
    coordinator: ['dashboard', 'requests', 'inventory', 'sites', 'allocation', 'shipments', 'reports'],
    shelter: ['my-requests', 'incoming'],
    warehouse: ['stock', 'outgoing'],
    driver: ['deliveries'],
};

const ROLE_DATA = {
    coordinator: ['requests', 'inventory', 'allocations/log', 'shelters', 'warehouses', 'shipments', 'drivers', 'stock/movements'],
    shelter: ['requests', 'shelters', 'warehouses', 'shipments'],
    warehouse: ['inventory', 'shelters', 'warehouses', 'shipments', 'stock/movements'],
    driver: ['shelters', 'warehouses', 'shipments'],
};

const DATA_KEYS = { 'allocations/log': 'log', 'stock/movements': 'movements' };

const EMPTY = { requests: [], inventory: [], log: [], shelters: [], warehouses: [], shipments: [], drivers: [], movements: [] };

const SUBTITLES = {
    dashboard: 'Overview of requests, stock and locations',
    requests: 'Review shelter requests before they are dispatched',
    inventory: 'Stock held in each warehouse, and every change to it',
    sites: 'Register, move or remove shelters and warehouses',
    allocation: 'Run the allocation engine and see what was sent',
    shipments: 'Assign drivers and track every delivery',
    reports: 'Export fulfilled and unfulfilled requests',
    'my-requests': 'Ask for supplies and follow each request until it arrives',
    incoming: 'Deliveries on their way to you, and what happened to each',
    stock: 'Add or remove stock, and see every change',
    outgoing: 'Where your stock went, when, and any incidents',
    deliveries: 'Your deliveries for today',
};

function pageFromHash(role) {
    const hash = window.location.hash.replace('#', '');
    return ROLE_PAGES[role].includes(hash) ? hash : ROLE_PAGES[role][0];
}

function Workspace({ user, onLogout }) {
    const [page, setPage] = useState(() => pageFromHash(user.role));
    const [data, setData] = useState(EMPTY);
    const [message, setMessage] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    async function loadAll() {
        try {
            const urls = ROLE_DATA[user.role];
            const responses = await Promise.all(urls.map((u) => fetch(`${API}/${u}`)));
            if (responses.some((r) => r.status === 401)) return;
            const bodies = await Promise.all(responses.map((r) => r.json()));
            const next = { ...EMPTY };
            urls.forEach((u, i) => {
                next[DATA_KEYS[u] || u] = Array.isArray(bodies[i]) ? bodies[i] : [];
            });
            setData(next);
        } catch (err) {
            setMessage('Could not reach the server. Is the backend running?');
        }
    }

    async function runAllocation() {
        try {
            const res = await fetch(`${API}/allocations/run`, { method: 'POST' });
            const result = await res.json();
            if (!res.ok) {
                setMessage(result.error || 'Allocation failed');
                return;
            }
            setMessage(
                `This run: ${result.allocated} allocated, ${result.partial} partial, ${result.unfulfilled} unfulfilled · ${result.shipments} shipment(s) assigned to ${result.drivers} driver(s)`
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

    const { requests, inventory, log, shelters, warehouses, shipments, drivers, movements } = data;
    const count = (s) => requests.filter((r) => r.status === s).length;
    const stats = [
        { label: 'Requests', value: requests.length, cls: '', filter: 'All' },
        { label: 'Pending', value: count('Pending'), cls: 'pending', filter: 'Pending' },
        { label: 'On the way', value: count('Allocated'), cls: 'allocated', filter: 'Allocated' },
        { label: 'Fulfilled', value: count('Fulfilled'), cls: 'fulfilled', filter: 'Fulfilled' },
        { label: 'Partial', value: count('Partial'), cls: 'partial', filter: 'Partial' },
        { label: 'Unfulfilled', value: count('Unfulfilled'), cls: 'unfulfilled', filter: 'Unfulfilled' },
    ];
    const badges = {
        requests: count('Awaiting review'),
        shipments: shipments.filter((s) => s.status === 'Ready' && !s.driver_id).length,
        incoming: shipments.filter((s) => s.status === 'In transit').length,
        outgoing: shipments.filter((s) => s.status === 'Ready').length,
        deliveries: shipments.filter((s) => s.status === 'Ready' || s.status === 'In transit').length,
    };
    const myShelter = shelters.find((s) => s.shelter_id === user.shelter_id);
    const myWarehouse = warehouses.find((w) => w.warehouse_id === user.warehouse_id);
    const title = PAGES.find((p) => p.id === page).label;
    const showRunButton = page === 'dashboard' || page === 'allocation';

    return (
        <InspectProvider data={data}>
            <div className="layout">
                <Sidebar
                    pages={ROLE_PAGES[user.role]}
                    page={page}
                    onNavigate={navigate}
                    badges={badges}
                    user={user}
                    onLogout={onLogout}
                />

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
                                    <div key={s.label} className={`stat clickable ${s.cls}`} onClick={() => openRequests(s.filter)}>
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
                            <RequestsTable requests={requests} shelters={shelters} filter={statusFilter} onFilterChange={setStatusFilter} />
                        </>
                    )}

                    {page === 'inventory' && (
                        <>
                            <InventoryTable inventory={inventory} warehouses={warehouses} />
                            <StockHistory movements={movements} showWarehouse />
                        </>
                    )}

                    {page === 'sites' && <SitesPanel shelters={shelters} warehouses={warehouses} onChanged={loadAll} />}

                    {page === 'allocation' && <AllocationLog log={log} />}

                    {page === 'shipments' && <ShipmentsPanel shipments={shipments} drivers={drivers} onChanged={loadAll} />}

                    {page === 'reports' && <ReportsPanel requests={requests} />}

                    {page === 'my-requests' && (
                        <>
                            <NewRequestForm shelter={myShelter} onCreated={loadAll} />
                            <RequestsTable requests={requests} shelters={shelters} filter={statusFilter} onFilterChange={setStatusFilter} />
                        </>
                    )}

                    {page === 'incoming' && <ShipmentTracker shipments={shipments} direction="incoming" />}

                    {page === 'stock' && (
                        <>
                            <StockForm warehouse={myWarehouse} inventory={inventory} onChanged={loadAll} />
                            <InventoryTable inventory={inventory} warehouses={warehouses} />
                            <StockHistory movements={movements} />
                        </>
                    )}

                    {page === 'outgoing' && <ShipmentTracker shipments={shipments} direction="outgoing" />}

                    {page === 'deliveries' && (
                        <DriverView drivers={drivers} shipments={shipments} onChanged={loadAll} fixedDriverId={user.driver_id} />
                    )}
                </main>
            </div>
            <DetailDrawer />
        </InspectProvider>
    );
}

function App() {
    const [session, setSession] = useState(loadSession);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        onSessionExpired(() => {
            setCurrentSession(null);
            setSession(null);
            setNotice('Your session expired. Please log in again.');
        });
    }, []);

    function login(next) {
        setCurrentSession(next);
        setNotice('');
        setSession(next);
    }

    function logout() {
        setCurrentSession(null);
        setSession(null);
        window.location.hash = '';
    }

    if (!session) return <LoginPage onLogin={login} notice={notice} />;
    return <Workspace key={session.user.username} user={session.user} onLogout={logout} />;
}

export default App;
