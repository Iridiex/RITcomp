import { useState } from 'react';
import { Hospital, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { IdLink } from '../inspect';
import HospitalForm from './HospitalForm';
import DoctorForm from './DoctorForm';
import Modal from './Modal';
import { API } from '../session';

const TABS = {
    hospital: {
        label: 'Hospitals', idField: 'hospital_id', path: 'hospitals', add: 'Register hospital',
        icon: Hospital, newTitle: 'Register a new hospital', help: 'Hospitals hold on-call doctors for medical dispatch.',
    },
    doctor: {
        label: 'Doctors', idField: 'doctor_id', path: 'doctors', add: 'Add doctor',
        icon: Stethoscope, newTitle: 'Add an on-call doctor', help: 'Each doctor is linked to one hospital and one specialty.',
    },
};

function badgeClass(status) {
    if (status === 'Dispatched') return 'allocated';
    if (status === 'Available') return 'fulfilled';
    return 'pending';
}

function MedicalStaffPanel({ hospitals = [], shelters = [], warehouses = [], onChanged }) {
    const [tab, setTab] = useState('hospital');
    const [formItem, setFormItem] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const t = TABS[tab];
    const doctors = hospitals.flatMap((h) => (h.doctors || []).map((d) => ({ ...d, hospital_name: h.name })));
    const lists = { hospital: hospitals, doctor: doctors };
    const list = lists[tab];
    const editingId = formItem && formItem !== 'new' ? formItem[t.idField] : null;
    const otherSites = [
        ...shelters.map((s) => ({ id: s.shelter_id, latitude: s.latitude, longitude: s.longitude })),
        ...warehouses.map((w) => ({ id: w.warehouse_id, latitude: w.latitude, longitude: w.longitude })),
        ...hospitals.map((h) => ({ id: h.hospital_id, latitude: h.latitude, longitude: h.longitude })),
    ];

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
            <p className="muted small-note">Add or remove hospitals and the doctors linked to them. A hospital cannot be deleted while it still has doctors.</p>

            {message && <p className="success">{message}</p>}
            {error && <p className="errors">{error}</p>}

            {formItem && (
                <Modal
                    icon={t.icon}
                    title={formItem === 'new' ? t.newTitle : `Edit ${formItem.name}`}
                    subtitle={formItem === 'new' ? t.help : editingId}
                    onClose={() => setFormItem(null)}
                >
                    {tab === 'hospital' ? (
                        <HospitalForm
                            key={editingId || 'new'}
                            hospital={formItem === 'new' ? null : formItem}
                            otherSites={otherSites.filter((s) => s.id !== editingId)}
                            onSaved={handleSaved}
                            onCancel={() => setFormItem(null)}
                        />
                    ) : (
                        <DoctorForm
                            key={editingId || 'new'}
                            doctor={formItem === 'new' ? null : formItem}
                            hospitals={hospitals}
                            onSaved={handleSaved}
                            onCancel={() => setFormItem(null)}
                        />
                    )}
                </Modal>
            )}

            {list.length === 0 ? (
                <p className="muted">{tab === 'hospital' ? 'No hospitals yet.' : 'No doctors yet. Register a hospital first, then add doctors.'}</p>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                {tab === 'hospital' && (
                                    <>
                                        <th>Location</th>
                                        <th>Doctors</th>
                                    </>
                                )}
                                {tab === 'doctor' && (
                                    <>
                                        <th>Specialty</th>
                                        <th>Hospital</th>
                                        <th>Status</th>
                                    </>
                                )}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((item) => {
                                const id = item[t.idField];
                                return (
                                    <tr key={id}>
                                        <td className="nowrap"><IdLink type={tab} id={id} /></td>
                                        <td><IdLink type={tab} id={id} label={item.name} /></td>
                                        {tab === 'hospital' && (
                                            <>
                                                <td className="nowrap">{Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}</td>
                                                <td>{(item.doctors || []).length}</td>
                                            </>
                                        )}
                                        {tab === 'doctor' && (
                                            <>
                                                <td>{item.specialty}</td>
                                                <td><IdLink type="hospital" id={item.hospital_id} label={item.hospital_name || item.hospital_id} /></td>
                                                <td><span className={`badge ${badgeClass(item.status)}`}>{item.status}</span></td>
                                            </>
                                        )}
                                        <td>
                                            {confirmId === id ? (
                                                <div className="actions">
                                                    <button className="danger small" onClick={() => remove(item)}>Confirm delete</button>
                                                    <button className="secondary small" onClick={() => setConfirmId(null)}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div className="actions">
                                                    <button className="secondary small" onClick={() => { clearNotes(); setFormItem(item); }}>Edit</button>
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
            )}

            <button className="add-site icon-text" onClick={() => { clearNotes(); setFormItem('new'); }}>
                <Plus size={16} /> {t.add}
            </button>
        </section>
    );
}

export default MedicalStaffPanel;
