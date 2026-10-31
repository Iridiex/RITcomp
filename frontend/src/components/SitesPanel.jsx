import { IdLink } from '../inspect';
import { useState } from 'react';
import SiteForm from './SiteForm';
import { Trash2 } from 'lucide-react';

const API = 'http://localhost:3000/api';

function SitesPanel({ shelters, warehouses, onChanged }) {
    const [tab, setTab] = useState('shelter');
    const [formSite, setFormSite] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const isShelter = tab === 'shelter';
    const list = isShelter ? shelters : warehouses;
    const idField = isShelter ? 'shelter_id' : 'warehouse_id';
    const path = isShelter ? 'shelters' : 'warehouses';

    const allSites = [
        ...shelters.map((s) => ({ id: s.shelter_id, latitude: s.latitude, longitude: s.longitude })),
        ...warehouses.map((w) => ({ id: w.warehouse_id, latitude: w.latitude, longitude: w.longitude })),
    ];
    const editingId = formSite && formSite !== 'new' ? formSite[idField] : null;
    const otherSites = allSites.filter((s) => s.id !== editingId);

    function clearNotes() {
        setMessage('');
        setError('');
    }

    function switchTab(next) {
        setTab(next);
        setFormSite(null);
        setConfirmId(null);
        clearNotes();
    }

    function handleSaved(text) {
        setFormSite(null);
        setMessage(text);
        onChanged();
    }

    async function deleteSite(site) {
        clearNotes();
        try {
            const res = await fetch(`${API}/${path}/${site[idField]}`, { method: 'DELETE' });
            const data = await res.json();
            setConfirmId(null);
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
                return;
            }
            setMessage(`${site[idField]} ${site.name} deleted`);
            onChanged();
        } catch (err) {
            setError('Could not reach the server');
        }
    }

    return (
        <section className="card">
            <div className="panel-header">
                <h2>{isShelter ? 'Shelters' : 'Warehouses'}</h2>
                <div className="tabs">
                    <button className={isShelter ? 'active' : ''} onClick={() => switchTab('shelter')}>
                        Shelters ({shelters.length})
                    </button>
                    <button className={!isShelter ? 'active' : ''} onClick={() => switchTab('warehouse')}>
                        Warehouses ({warehouses.length})
                    </button>
                </div>
            </div>

            {message && <p className="success">{message}</p>}
            {error && <p className="errors">{error}</p>}

            {formSite ? (
                <SiteForm
                    key={editingId || 'new'}
                    kind={tab}
                    site={formSite === 'new' ? null : formSite}
                    otherSites={otherSites}
                    onSaved={handleSaved}
                    onCancel={() => setFormSite(null)}
                />
            ) : (
                <>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th><th>Name</th>
                                {isShelter && <th>Priority</th>}
                                <th>Location</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((site) => (
                                <tr key={site[idField]}>
                                    <td><IdLink type={tab} id={site[idField]} /></td>
                                    <td>{site.name}</td>
                                    {isShelter && <td>{site.priority}</td>}
                                    <td>{Number(site.latitude).toFixed(4)}, {Number(site.longitude).toFixed(4)}</td>
                                    <td>
                                        {confirmId === site[idField] ? (
                                            <div className="actions">
                                                <button className="danger small" onClick={() => deleteSite(site)}>Confirm delete</button>
                                                <button className="secondary small" onClick={() => setConfirmId(null)}>Cancel</button>
                                            </div>
                                        ) : (
                                            <div className="actions">
                                                <button className="secondary small" onClick={() => { clearNotes(); setFormSite(site); }}>Edit</button>
                                                <button className="danger-outline icon-button" title="Delete" aria-label={`Delete ${site.name}`} onClick={() => { clearNotes(); setConfirmId(site[idField]); }}><Trash2 size={18} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button className="add-site" onClick={() => { clearNotes(); setFormSite('new'); }}>
                        + Register {isShelter ? 'shelter' : 'warehouse'}
                    </button>
                </>
            )}
        </section>
    );
}

export default SitesPanel;
