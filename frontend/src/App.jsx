import { useEffect, useState } from 'react';
import { ClipboardList, Clock, Truck, CircleCheck, CircleDashed, CircleAlert, Play } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { PAGES } from './pages';
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
import AccountPanel from './components/AccountPanel';
import ShortageList from './components/ShortageList';
import SituationBrief from './components/SituationBrief';
import DamagePatterns from './components/DamagePatterns';
import Assistant from './components/Assistant';
import { useAiEnabled } from './aiStatus';
import { InspectProvider } from './inspect';
import { goTo, useRoute } from './router';
import { API, installAuthFetch, loadSession, setCurrentSession, onSessionExpired } from './session';

installAuthFetch();

const ROLE_PAGES = {
    coordinator: ['dashboard', 'requests', 'inventory', 'sites', 'allocation', 'shipments', 'reports', 'account'],
    shelter: ['my-requests', 'incoming', 'account'],
    warehouse: ['stock', 'outgoing', 'account'],
    driver: ['deliveries', 'account'],
};

const ROLE_DATA = {
    coordinator: ['requests', 'inventory', 'allocations/log', 'shelters', 'warehouses', 'shipments', 'drivers', 'stock/movements', 'users', 'incidents'],
    shelter: ['requests', 'shelters', 'warehouses', 'shipments', 'items'],
    warehouse: ['inventory', 'shelters', 'warehouses', 'shipments', 'stock/movements', 'shortages'],
    driver: ['shelters', 'warehouses', 'shipments', 'incidents'],
};

const DATA_KEYS = { 'allocations/log': 'log', 'stock/movements': 'movements' };

const EMPTY = { requests: [], inventory: [], log: [], shelters: [], warehouses: [], shipments: [], drivers: [], movements: [], users: [], shortages: [], items: [], incidents: [] };

const SUBTITLES = {
    dashboard: 'Overview of requests, stock and locations',
    requests: 'Review shelter requests before they are dispatched',
    inventory: 'Stock held in each warehouse, and every change to it',
    sites: 'Register shelters, warehouses and drivers, and give them logins',
    allocation: 'Run the allocation engine and see what was sent',
    shipments: 'Assign drivers and track every delivery',
    reports: 'Export fulfilled and unfulfilled requests',
    'my-requests': 'Ask for supplies and follow each request until it arrives',
    incoming: 'Deliveries on their way to you, and what happened to each',
    stock: 'Add or remove stock, and see every change',
    outgoing: 'Where your stock went, when, and any incidents',
    deliveries: 'Your deliveries for today',
    account: 'Change the username and password you log in with',
};

// Resolves to null when the session has expired (the auth fetch wrapper handles the logout)
async function fetchRoleData(role) {
    const urls = ROLE_DATA[role];
    const responses = await Promise.all(urls.map((u) => fetch(`${API}/${u}`)));
    if (responses.some((r) => r.status === 401)) return null;
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const next = { ...EMPTY };
    urls.forEach((u, i) => {
        next[DATA_KEYS[u] || u] = Array.isArray(bodies[i]) ? bodies[i] : [];
    });
    return next;
}

const OFFLINE = 'Could not reach the server. Is the backend running?';

function Workspace({ user, onLogout, onSessionChange }) {
    const route = useRoute();
    const allowed = ROLE_PAGES[user.role];
    const page = allowed.includes(route) ? route : allowed[0];
    const [data, setData] = useState(EMPTY);
    // A message belongs to the page it was raised on, so it disappears when you move away.
    // page: null means it shows on every page.
    const [notice, setNotice] = useState({ page: null, text: '' });
    const [statusFilter, setStatusFilter] = useState('All');
    const [chat, setChat] = useState([]);
    const aiEnabled = useAiEnabled();
    const message = notice.page === null || notice.page === page ? notice.text : '';
    const setMessage = (text) => setNotice({ page, text });

    useEffect(() => {
        if (route !== page) goTo(page, { replace: true });
    }, [route, page]);

    function loadAll() {
        return fetchRoleData(user.role)
            .then((next) => { if (next) setData(next); })
            .catch(() => setMessage(OFFLINE));
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
        } catch {
            setMessage(OFFLINE);
        }
    }

    function openRequests(status) {
        setStatusFilter(status);
        goTo('requests');
    }

    useEffect(() => {
        let cancelled = false;
        fetchRoleData(user.role)
            .then((next) => { if (next && !cancelled) setData(next); })
            .catch(() => { if (!cancelled) setNotice({ page: null, text: OFFLINE }); });
        return () => { cancelled = true; };
    }, [user.role]);

    const { requests, inventory, log, shelters, warehouses, shipments, drivers, movements, users, shortages, items, incidents } = data;
    const count = (s) => requests.filter((r) => r.status === s).length;
    const stats = [
        { label: 'Requests', value: requests.length, tone: 'total', icon: ClipboardList, filter: 'All' },
        { label: 'Pending', value: count('Pending'), tone: 'pending', icon: Clock, filter: 'Pending' },
        { label: 'On the way', value: count('Allocated'), tone: 'allocated', icon: Truck, filter: 'Allocated' },
        { label: 'Fulfilled', value: count('Fulfilled'), tone: 'fulfilled', icon: CircleCheck, filter: 'Fulfilled' },
        { label: 'Partial', value: count('Partial'), tone: 'partial', icon: CircleDashed, filter: 'Partial' },
        { label: 'Unfulfilled', value: count('Unfulfilled'), tone: 'unfulfilled', icon: CircleAlert, filter: 'Unfulfilled' },
    ];
    const badges = {
        requests: count('Awaiting review'),
        shipments: shipments.filter((s) => s.status === 'Ready' && !s.driver_id).length,
        incoming: shipments.filter((s) => s.status === 'In transit').length,
        outgoing: shipments.filter((s) => s.status === 'Ready' || s.status === 'Returning').length,
        deliveries: shipments.filter((s) => ['Ready', 'In transit', 'Returning'].includes(s.status)).length,
    };
    const myShelter = shelters.find((s) => s.shelter_id === user.shelter_id);
    const myWarehouse = warehouses.find((w) => w.warehouse_id === user.warehouse_id);
    const title = PAGES.find((p) => p.id === page).label;
    const showRunButton = page === 'dashboard' || page === 'allocation';

    return (
        <InspectProvider key={page} data={{ ...data, role: user.role, onChanged: loadAll }}>
            <div className="layout">
                <Sidebar
                    pages={allowed}
                    page={page}
                    onNavigate={goTo}
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
                        {showRunButton && (
                            <button className="icon-text" onClick={runAllocation}><Play size={16} /> Run allocation</button>
                        )}
                    </header>

                    {message && <p className="message">{message}</p>}

                    {page === 'dashboard' && (
                        <>
                            <div className="stats">
                                {stats.map((s) => (
                                    <div key={s.label} className={`stat clickable tone-${s.tone}`} onClick={() => openRequests(s.filter)}>
                                        <span className="stat-icon"><s.icon size={17} /></span>
                                        <div className="stat-value">{s.value}</div>
                                        <div className="stat-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <SituationBrief version={data} />
                            <div className="dash-grid">
                                <MapView shelters={shelters} warehouses={warehouses} requests={requests} inventory={inventory} />
                                <DashboardSide
                                    requests={requests}
                                    shelters={shelters}
                                    inventory={inventory}
                                    warehouses={warehouses}
                                    shipments={shipments}
                                    incidents={incidents}
                                    onIncidentsChanged={loadAll}
                                    onOpenRequests={openRequests}
                                    onOpenShipments={() => goTo('shipments')}
                                    onRunAllocation={runAllocation}
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

                    {page === 'sites' && (
                        <SitesPanel shelters={shelters} warehouses={warehouses} drivers={drivers} users={users} shipments={shipments} onChanged={loadAll} />
                    )}

                    {page === 'allocation' && <AllocationLog log={log} />}

                    {page === 'shipments' && <ShipmentsPanel shipments={shipments} drivers={drivers} onChanged={loadAll} />}

                    {page === 'reports' && (
                        <>
                            <DamagePatterns version={data} />
                            <ReportsPanel requests={requests} />
                        </>
                    )}

                    {page === 'my-requests' && (
                        <>
                            <NewRequestForm shelter={myShelter} items={items} onCreated={loadAll} />
                            <RequestsTable requests={requests} shelters={shelters} filter={statusFilter} onFilterChange={setStatusFilter} />
                        </>
                    )}

                    {page === 'incoming' && <ShipmentTracker shipments={shipments} direction="incoming" />}

                    {page === 'stock' && (
                        <>
                            <StockForm warehouse={myWarehouse} inventory={inventory} onChanged={loadAll} />
                            <ShortageList shortages={shortages} />
                            <InventoryTable inventory={inventory} warehouses={warehouses} />
                            <StockHistory movements={movements} />
                        </>
                    )}

                    {page === 'outgoing' && <ShipmentTracker shipments={shipments} direction="outgoing" onChanged={loadAll} />}

                    {page === 'deliveries' && (
                        <DriverView drivers={drivers} shipments={shipments} incidents={incidents} onChanged={loadAll} fixedDriverId={user.driver_id} />
                    )}

                    {page === 'account' && <AccountPanel user={user} onSessionChange={onSessionChange} />}
                </main>
            </div>
            {user.role === 'coordinator' && aiEnabled && <Assistant messages={chat} setMessages={setChat} onChanged={loadAll} />}
            <DetailDrawer />
        </InspectProvider>
    );
}

function App() {
    const [session, setSession] = useState(loadSession);
    const [notice, setNotice] = useState('');
    const route = useRoute();

    useEffect(() => {
        if (!session && route) goTo('', { replace: true });
    }, [session, route]);

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
    }

    if (!session) return <LoginPage onLogin={login} notice={notice} />;
    return <Workspace key={session.user.user_id} user={session.user} onLogout={logout} onSessionChange={login} />;
}

export default App;
