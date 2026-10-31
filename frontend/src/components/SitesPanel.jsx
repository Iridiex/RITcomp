import { IdLink } from '../inspect';
import { useState } from 'react';
import SiteForm from './SiteForm';
import DriverForm from './DriverForm';
import Modal from './Modal';
import { Trash2, KeyRound, House, Warehouse, Truck, Plus } from 'lucide-react';
import { API } from '../session';

const TABS = {
    shelter: {
        label: 'Shelters', idField: 'shelter_id', path: 'shelters', add: 'Register shelter', icon: House,
        newTitle: 'Register a new shelter', help: 'Shelters request supplies and receive deliveries.',
    },
    warehouse: {
        label: 'Warehouses', idField: 'warehouse_id', path: 'warehouses', add: 'Register warehouse', icon: Warehouse,
        newTitle: 'Register a new warehouse', help: 'Warehouses hold stock and send out shipments.',
    },
    driver: {
        label: 'Drivers', idField: 'driver_id', path: 'drivers', add: 'Add driver', icon: Truck,
        newTitle: 'Add a new driver', help: 'Drivers pick up shipments and deliver them to shelters.',
    },
};

function taskCounts(shipments, driverId) {
    const mine = shipments.filter((s) => s.driver_id === driverId);
    return {
        active: mine.filter((s) => ['Ready', 'In transit', 'Returning'].includes(s.status)).length,
        delivered: mine.filter((s) => s.status === 'Delivered').length,
        returned: mine.filter((s) => s.status === 'Returning' || s.status === 'Returned').length,
    };
}

function SitesPanel({ shelters, warehouses, drivers, users, shipments, onChanged }) {
    const [tab, setTab] = useState('shelter');
    const [formItem, setFormItem] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const t = TABS[tab];
    const lists = { shelter: shelters, warehouse: warehouses, driver: drivers };
    const list = lists[tab];
    const loginOf = (id) => {
        const user = users.find((u) => u[t.idField] === id);
        return user ? user.username : null;
    };

    const allSites = [
        ...shelters.map((s) => ({ id: s.shelter_id, latitude: s.latitude, longitude: s.longitude })),
        ...warehouses.map((w) => ({ id: w.warehouse_id, latitude: w.latitude, longitude: w.longitude })),
    ];
    const editingId = formItem && formItem !== 'new' ? formItem[t.idField] : null;

    function clearNotes() {
        setMessage('');
        setError('');
    }

    function switchTab(next) {
        setTab(next);
        setFormItem(null);
        setConfirmId(null);
        clearNotes();
    }

    function handleSaved(text) {
        setFormItem(null);
        setMessage(text);
        onChanged();
    }

    async function remove(item) {
        clearNotes();
        try {
            const res = await fetch(`${API}/${t.path}/${item[t.idField]}`, { method: 'DELETE' });
            const data = await res.json();
            setConfirmId(null);
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
                return;
            }
            setMessage(`${item[t.idField]} ${item.name} deleted`);
            onChanged();
        } catch {
            setError('Could not reach the server');
        }
    }

    function renderForm() {
        const item = formItem === 'new' ? null : formItem;
        const currentLogin = item ? loginOf(item[t.idField]) : null;
        if (tab === 'driver') {
            return (
                <DriverForm key={editingId || 'new'} driver={item} currentLogin={currentLogin}
                    onSaved={handleSaved} onCancel={() => setFormItem(null)} />
            );
        }
        return (
            <SiteForm
                key={editingId || 'new'}
                kind={tab}
                site={item}
                currentLogin={currentLogin}
                otherSites={allSites.filter((s) => s.id !== editingId)}
                onSaved={handleSaved}
                onCancel={() => setFormItem(null)}
            />
        );
    }

    return (
        <section className="card">
            <div className="panel-header">
                <h2>{t.label}</h2>
                <div className="tabs">
                    {Object.entries(TABS).map(([id, tabInfo]) => (
                        <button key={id} className={tab === id ? 'active' : ''} onClick={() => switchTab(id)}>
                            {tabInfo.label} ({lists[id].length})
                        </button>
                    ))}
                </div>
            </div>

            {message && <p className="success">{message}</p>}
            {error && <p className="errors">{error}</p>}

            {formItem && (
                <Modal
                    icon={t.icon}
                    title={formItem === 'new' ? t.newTitle : `Edit ${formItem.name}`}
                    subtitle={formItem === 'new' ? t.help : editingId}
                    onClose={() => setFormItem(null)}
                >
                    {renderForm()}
                </Modal>
            )}

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Name</th>
                            {tab === 'shelter' && <th>Priority</th>}
                            {tab === 'driver' ? <><th>Phone</th><th>Tasks</th></> : <th>Location</th>}
                            <th>Login</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((item) => {
                            const id = item[t.idField];
                            const username = loginOf(id);
                            const tasks = tab === 'driver' ? taskCounts(shipments, id) : null;
                            return (
                                <tr key={id}>
                                    <td><IdLink type={tab} id={id} /></td>
                                    <td>{item.name}</td>
                                    {tab === 'shelter' && <td>{item.priority}</td>}
                                    {tab === 'driver'
                                        ? <>
                                            <td>{item.phone || '-'}</td>
                                            <td>
                                                <IdLink type="driver" id={id}
                                                    label={`${tasks.active} active · ${tasks.delivered} delivered${tasks.returned ? ` · ${tasks.returned} failed` : ''}`} />
                                            </td>
                                        </>
                                        : <td>{Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}</td>}
                                    <td>
                                        {username
                                            ? <span className="icon-text"><KeyRound size={14} /> {username}</span>
                                            : <span className="muted">No login</span>}
                                    </td>
                                    <td>
                                        {confirmId === id ? (
                                            <div className="actions">
                                                <button className="danger small" onClick={() => remove(item)}>Confirm delete</button>
                                                <button className="secondary small" onClick={() => setConfirmId(null)}>Cancel</button>
                                            </div>
                                        ) : (
                                            <div className="actions">
                                                <button className="secondary small" onClick={() => { clearNotes(); setFormItem(item); }}>
                                                    {username ? 'Edit' : 'Edit / add login'}
                                                </button>
                                                <button className="danger-outline icon-button" title="Delete" aria-label={`Delete ${item.name}`}
                                                    onClick={() => { clearNotes(); setConfirmId(id); }}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <button className="add-site icon-text" onClick={() => { clearNotes(); setFormItem('new'); }}>
                <Plus size={16} /> {t.add}
            </button>
        </section>
    );
}

export default SitesPanel;
