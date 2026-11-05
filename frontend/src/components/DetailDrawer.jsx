import { ArrowLeft, Check, X } from 'lucide-react';
import { API } from '../session';
import MiniMap from './MiniMap';
import { useEffect } from 'react';
import { IdLink } from '../inspect';
import { useInspect } from '../inspectContext';
import { formatTime } from '../format';
import LoadAmount from './LoadAmount';
import { nextStep } from '../nextStep';
import { NoteLanguageToggle, NoteText } from './DriverNotes';
import { damageLines, failureText, useNoteLanguage } from '../noteLanguage';
import CloseRequest from './CloseRequest';
import ShipmentOverride from './ShipmentOverride';

const TITLES = {
    request: 'Request', shipment: 'Shipment', shelter: 'Shelter', warehouse: 'Warehouse',
    driver: 'Driver', medical: 'Medical ticket', hospital: 'Hospital', doctor: 'Doctor',
};

function statusClass(status) {
    if (status === 'Dispatched') return 'allocated';
    if (status === 'Completed' || status === 'Available') return 'fulfilled';
    if (String(status).startsWith('Pending')) return 'unfulfilled';
    return String(status || '').toLowerCase().replace(/ /g, '-');
}

function doctorsOf(data) {
    return (data.hospitals || []).flatMap((h) => (h.doctors || []).map((d) => ({ ...d, hospital_name: h.name })));
}

function Field({ label, children }) {
    return (
        <div className="field">
            <span className="field-label">{label}</span>
            <span>{children}</span>
        </div>
    );
}

function Badge({ value }) {
    if (!value) return null;
    return <span className={`badge ${statusClass(value)}`}>{value}</span>;
}

function ShipmentList({ shipments }) {
    if (shipments.length === 0) return <p className="muted small-note">No shipments yet.</p>;
    return (
        <ul className="link-list">
            {shipments.map((s) => (
                <li key={s.shipment_id}>
                    <IdLink type="shipment" id={s.shipment_id} /> · <LoadAmount shipment={s} /> ·{' '}
                    <IdLink type="warehouse" id={s.warehouse_id} chip /> → <IdLink type="shelter" id={s.shelter_id} chip />{' '}
                    <Badge value={s.status} />
                    {s.driver_name && <span className="muted"> · {s.driver_name}</span>}
                </li>
            ))}
        </ul>
    );
}

function RequestDetail({ id, data }) {
    const r = data.requests.find((x) => x.request_id === id);
    if (!r) return <p className="muted">Not found. It may have been deleted.</p>;
    const shelter = data.shelters.find((s) => s.shelter_id === r.shelter_id);
    const shipments = data.shipments.filter((s) => s.request_id === id);
    const log = data.log.filter((l) => l.request_id === id);
    const sources = data.warehouses.filter((w) => shipments.some((s) => s.warehouse_id === w.warehouse_id));
    const pct = r.quantity === 0 ? 0 : Math.round((r.quantity_delivered / r.quantity) * 100);

    return (
        <>
            <div className="detail-head">
                <h3>{r.quantity + (r.quantity_closed || 0)} {r.item}</h3>
                <Badge value={r.status} />
                {Boolean(r.replacement_pending) && <span className="tag warn">Replacement pending</span>}
            </div>
            <Field label="Shelter">
                <IdLink type="shelter" id={r.shelter_id} label={shelter ? `${r.shelter_id} · ${shelter.name}` : r.shelter_id} />
            </Field>
            <Field label="Urgency"><Badge value={r.urgency} /></Field>
            <Field label="What happens next"><span className={`next-step ${nextStep(r).tone}`}>{nextStep(r).text}</span></Field>
            {r.reason && <Field label="Reason">{r.reason}</Field>}
            {r.review_note && <Field label="Review note">{r.review_note}</Field>}
            {r.quantity_closed > 0 && (
                <Field label="Closed">{r.quantity_closed} no longer needed{r.close_note ? `: ${r.close_note}` : ''}</Field>
            )}
            {r.status !== 'Cancelled' && (
                <>
                    <Field label="Reserved">{r.quantity_allocated} of {r.quantity}</Field>
                    <Field label="Delivered">{r.quantity_delivered} of {r.quantity} ({pct}%)</Field>
                    <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }}></div></div>
                </>
            )}
            {['coordinator', 'shelter'].includes(data.role) && <CloseRequest request={r} onChanged={data.onChanged} />}
            {shelter && (
                <MiniMap
                    points={[
                        { lat: shelter.latitude, lng: shelter.longitude, color: '#dc2626', label: shelter.name },
                        ...sources.map((w) => ({ lat: w.latitude, lng: w.longitude, color: '#2563eb', label: w.name })),
                    ]}
                    lines={sources.map((w) => [{ lat: w.latitude, lng: w.longitude }, { lat: shelter.latitude, lng: shelter.longitude }])}
                />
            )}

            <h4>Shipments ({shipments.length})</h4>
            <ShipmentList shipments={shipments} />

            <h4>Allocation history</h4>
            {log.length === 0 ? (
                <p className="muted small-note">Not allocated yet.</p>
            ) : (
                <ul className="link-list">
                    {log.map((l) => (
                        <li key={l.id}>
                            {l.run_id.startsWith('REPLACE') ? 'Replacement' : 'Run'} · {l.quantity_sent} from{' '}
                            {l.warehouse_id ? <IdLink type="warehouse" id={l.warehouse_id} chip /> : 'no warehouse'} <Badge value={l.result} />
                            {l.reason && <span className="muted"> · {l.reason}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

function ShipmentDetail({ id, data }) {
    const lang = useNoteLanguage();
    const s = data.shipments.find((x) => x.shipment_id === id);
    if (!s) return <p className="muted">Not found.</p>;
    const siblings = data.shipments.filter((x) => x.request_id === s.request_id && x.shipment_id !== id);
    const hasNotes = Boolean(s.damage_note || s.failure_reason);

    return (
        <>
            <div className="detail-head">
                <h3><LoadAmount shipment={s} shipments={data.shipments} /></h3>
                <Badge value={s.status} />
                {s.run_id.startsWith('REPLACE') && <span className="tag">Replacement</span>}
            </div>
            <Field label="For request"><IdLink type="request" id={s.request_id} /></Field>
            <Field label="From"><IdLink type="warehouse" id={s.warehouse_id} label={`${s.warehouse_id} · ${s.warehouse_name}`} /></Field>
            <Field label="To"><IdLink type="shelter" id={s.shelter_id} label={`${s.shelter_id} · ${s.shelter_name}`} /></Field>
            <Field label="Driver">
                {s.driver_id ? <IdLink type="driver" id={s.driver_id} label={`${s.driver_id} · ${s.driver_name}`} /> : 'Not assigned'}
            </Field>
            <Field label="Urgency"><Badge value={s.urgency} /></Field>
            <ShipmentOverride shipment={s} role={data.role} onChanged={data.onChanged} />
            <MiniMap
                points={[
                    { lat: s.warehouse_lat, lng: s.warehouse_lng, color: '#2563eb', label: 'Pick up: ' + s.warehouse_name },
                    { lat: s.shelter_lat, lng: s.shelter_lng, color: '#dc2626', label: 'Drop off: ' + s.shelter_name },
                ]}
                lines={[[{ lat: s.warehouse_lat, lng: s.warehouse_lng }, { lat: s.shelter_lat, lng: s.shelter_lng }]]}
            />

            <div className="detail-subhead">
                <h4>Timeline</h4>
                {hasNotes && <NoteLanguageToggle />}
            </div>
            <ul className="timeline">
                <li className="done">Created {formatTime(s.created_at)}</li>
                <li className={s.picked_up_at ? 'done' : ''}>Picked up {formatTime(s.picked_up_at) || '-'}</li>
                {s.failure_reason ? (
                    <>
                        <li className="failed">Couldn't deliver: <NoteText shipment={s} kinds={['failure']}>{failureText(s, lang)}</NoteText></li>
                        <li className={s.returned_at ? 'done' : ''}>
                            Back at {s.warehouse_name} {formatTime(s.returned_at) || '(driver on the way)'}
                        </li>
                    </>
                ) : (
                    <li className={s.delivered_at ? 'done' : ''}>Delivered {formatTime(s.delivered_at) || '-'}</li>
                )}
            </ul>

            {s.quantity_damaged > 0 && (
                <p className="damage-note">
                    {s.quantity_damaged} written off:{' '}
                    <NoteText shipment={s} kinds={['damage']}>{damageLines(s, lang).join('; ')}</NoteText>
                </p>
            )}

            <h4>Other shipments for {s.request_id}</h4>
            <ShipmentList shipments={siblings} />
        </>
    );
}

function ShelterDetail({ id, data }) {
    const shelter = data.shelters.find((x) => x.shelter_id === id);
    if (!shelter) return <p className="muted">Not found. It may have been deleted.</p>;
    const requests = data.requests.filter((r) => r.shelter_id === id);
    const shipments = data.shipments.filter((s) => s.shelter_id === id);

    return (
        <>
            <div className="detail-head">
                <h3>{shelter.name}</h3>
                <span className="tag">Priority {shelter.priority}</span>
            </div>
            <Field label="Location">{Number(shelter.latitude).toFixed(4)}, {Number(shelter.longitude).toFixed(4)}</Field>
            <MiniMap points={[{ lat: shelter.latitude, lng: shelter.longitude, color: '#dc2626', label: shelter.name }]} />
            <Field label="Requests">{requests.length}</Field>

            <h4>Requests</h4>
            {requests.length === 0 ? (
                <p className="muted small-note">No requests yet.</p>
            ) : (
                <ul className="link-list">
                    {requests.map((r) => (
                        <li key={r.request_id}>
                            <IdLink type="request" id={r.request_id} /> · {r.quantity} {r.item} <Badge value={r.status} />
                            <span className="muted"> · {r.quantity_delivered}/{r.quantity} delivered</span>
                        </li>
                    ))}
                </ul>
            )}

            <h4>Shipments heading here ({shipments.length})</h4>
            <ShipmentList shipments={shipments} />

            <h4>Medical tickets ({(data.medical || []).filter((r) => r.shelter_id === id).length})</h4>
            <MedicalList tickets={(data.medical || []).filter((r) => r.shelter_id === id)} empty="No medical tickets yet." />
        </>
    );
}

function WarehouseDetail({ id, data }) {
    const warehouse = data.warehouses.find((x) => x.warehouse_id === id);
    if (!warehouse) return <p className="muted">Not found. It may have been deleted.</p>;
    const stock = data.inventory.filter((row) => row.warehouse_id === id);
    const shipments = data.shipments.filter((s) => s.warehouse_id === id);

    return (
        <>
            <div className="detail-head">
                <h3>{warehouse.name}</h3>
            </div>
            <Field label="Location">{Number(warehouse.latitude).toFixed(4)}, {Number(warehouse.longitude).toFixed(4)}</Field>
            <MiniMap points={[{ lat: warehouse.latitude, lng: warehouse.longitude, color: '#2563eb', label: warehouse.name }]} />

            <h4>Stock</h4>
            {stock.length === 0 ? (
                <p className="muted small-note">No stock.</p>
            ) : (
                <ul className="link-list">
                    {stock.map((row) => (
                        <li key={row.id}>
                            {row.item}: <strong className={row.quantity === 0 ? 'out-of-stock' : ''}>{row.quantity}</strong>
                        </li>
                    ))}
                </ul>
            )}

            <h4>Shipments from here ({shipments.length})</h4>
            <ShipmentList shipments={shipments} />
        </>
    );
}

function DriverTaskList({ shipments, empty }) {
    const lang = useNoteLanguage();
    if (shipments.length === 0) return <p className="muted small-note">{empty}</p>;
    return (
        <ul className="link-list">
            {shipments.map((s) => (
                <li key={s.shipment_id}>
                    <IdLink type="shipment" id={s.shipment_id} /> · <LoadAmount shipment={s} /> ·{' '}
                    <IdLink type="warehouse" id={s.warehouse_id} chip /> → <IdLink type="shelter" id={s.shelter_id} chip />{' '}
                    <Badge value={s.status} />
                    {s.status === 'Delivered' && <span className="muted"> · {formatTime(s.delivered_at)}</span>}
                    {s.status === 'In transit' && <span className="muted"> · picked up {formatTime(s.picked_up_at)}</span>}
                    {s.status === 'Returning' && <span className="muted"> · heading back: <span dir="auto">{failureText(s, lang)}</span></span>}
                    {s.status === 'Returned' && <span className="muted"> · <span dir="auto">{failureText(s, lang)}</span></span>}
                    {s.quantity_damaged > 0 && <span className="muted"> · {s.quantity_damaged} damaged</span>}
                </li>
            ))}
        </ul>
    );
}

function DriverDetail({ id, data }) {
    const driver = data.drivers.find((x) => x.driver_id === id);
    if (!driver) return <p className="muted">Not found. It may have been deleted.</p>;
    const login = (data.users || []).find((u) => u.driver_id === id);
    const mine = data.shipments.filter((s) => s.driver_id === id);
    const of = (status) => mine.filter((s) => s.status === status);
    const inTransit = [...of('Returning'), ...of('In transit')];
    const assigned = of('Ready');
    const delivered = of('Delivered').sort((a, b) => String(b.delivered_at).localeCompare(String(a.delivered_at)));
    const returned = of('Returned');
    const failed = [...of('Returning'), ...returned];
    const unitsDelivered = delivered.reduce((sum, s) => sum + s.quantity - (s.quantity_damaged || 0), 0);
    const finished = delivered.length + failed.length;

    return (
        <>
            <div className="detail-head">
                <h3>{driver.name}</h3>
                <span className="tag">{inTransit.length + assigned.length > 0 ? 'On duty' : 'Free'}</span>
            </div>
            <Field label="Phone">{driver.phone || '-'}</Field>
            <Field label="Login">{login ? login.username : 'No login'}</Field>

            <div className="driver-stats">
                <div><strong>{assigned.length}</strong><span>To pick up</span></div>
                <div><strong>{inTransit.length}</strong><span>On the road</span></div>
                <div><strong>{delivered.length}</strong><span>Delivered</span></div>
                <div><strong>{failed.length}</strong><span>Couldn't deliver</span></div>
            </div>
            <Field label="Units delivered intact">{unitsDelivered}</Field>
            {finished > 0 && (
                <Field label="Success rate">{Math.round((delivered.length / finished) * 100)}% of finished trips</Field>
            )}

            <h4>Current tasks ({inTransit.length + assigned.length})</h4>
            <DriverTaskList shipments={[...inTransit, ...assigned]} empty="Nothing assigned right now." />

            <h4>Completed ({delivered.length})</h4>
            <DriverTaskList shipments={delivered} empty="No deliveries yet." />

            {returned.length > 0 && (
                <>
                    <h4>Couldn't deliver, returned to warehouse ({returned.length})</h4>
                    <DriverTaskList shipments={returned} />
                </>
            )}
        </>
    );
}

function MedicalList({ tickets, empty }) {
    if (tickets.length === 0) return <p className="muted small-note">{empty}</p>;
    return (
        <ul className="link-list">
            {tickets.map((r) => (
                <li key={r.medical_id}>
                    <IdLink type="medical" id={r.medical_id} /> · {r.specialty}{' '}
                    {r.doctor_id && <IdLink type="doctor" id={r.doctor_id} chip />}{' '}
                    {r.hospital_id && <IdLink type="hospital" id={r.hospital_id} label={r.hospital_name} chip />}{' '}
                    <Badge value={r.status} />
                </li>
            ))}
        </ul>
    );
}

function MedicalDetail({ id, data }) {
    const r = (data.medical || []).find((x) => x.medical_id === id);
    if (!r) return <p className="muted">Not found.</p>;
    const shelter = data.shelters.find((s) => s.shelter_id === r.shelter_id);
    const hospital = (data.hospitals || []).find((h) => h.hospital_id === r.hospital_id);
    const km = r.distance == null ? null : (r.distance_km != null ? r.distance_km : Number((r.distance * 111.32).toFixed(2)));

    async function arrived() {
        const res = await fetch(`${API}/medical/${id}/complete`, { method: 'PATCH' });
        if (res.ok && data.onChanged) data.onChanged();
    }

    return (
        <>
            <div className="detail-head">
                <h3>{r.specialty}</h3>
                <Badge value={r.status} />
            </div>
            <Field label="Shelter">
                <IdLink type="shelter" id={r.shelter_id} label={shelter ? `${r.shelter_id} · ${shelter.name}` : r.shelter_id} />
            </Field>
            {r.reason && <Field label="Reason">{r.reason}</Field>}
            {r.ai_specialty && (
                <Field label="Specialty check">
                    {r.ai_specialty === r.specialty
                        ? `Agrees with ${r.ai_specialty}${r.ai_why ? ` · ${r.ai_why}` : ''}`
                        : `Suggested ${r.ai_specialty}${r.ai_why ? ` · ${r.ai_why}` : ''}`}
                </Field>
            )}
            {r.review_note && <Field label="Review note">{r.review_note}</Field>}
            <Field label="Doctor">
                {r.doctor_id ? <IdLink type="doctor" id={r.doctor_id} label={`${r.doctor_id}${r.doctor_name ? ` · ${r.doctor_name}` : ''}`} /> : 'Not assigned'}
            </Field>
            <Field label="Hospital">
                {r.hospital_id
                    ? <IdLink type="hospital" id={r.hospital_id} label={hospital ? `${r.hospital_id} · ${hospital.name}` : r.hospital_name || r.hospital_id} />
                    : 'Waiting for a free doctor'}
            </Field>
            {r.distance != null && (
                <Field label="Travel distance">{Number(r.distance).toFixed(4)}{km != null ? ` (${km} km)` : ''}</Field>
            )}
            {data.role === 'shelter' && r.status === 'Dispatched' && (
                <div className="actions">
                    <button type="button" className="secondary small icon-text" onClick={arrived}>
                        <Check size={14} /> Doctor arrived
                    </button>
                </div>
            )}
            {shelter && hospital && (
                <MiniMap
                    points={[
                        { lat: shelter.latitude, lng: shelter.longitude, color: '#dc2626', label: shelter.name },
                        { lat: hospital.latitude, lng: hospital.longitude, color: '#0f766e', label: hospital.name },
                    ]}
                    lines={[[{ lat: hospital.latitude, lng: hospital.longitude }, { lat: shelter.latitude, lng: shelter.longitude }]]}
                />
            )}
            {shelter && !hospital && (
                <MiniMap points={[{ lat: shelter.latitude, lng: shelter.longitude, color: '#dc2626', label: shelter.name }]} />
            )}
        </>
    );
}

function HospitalDetail({ id, data }) {
    const hospital = (data.hospitals || []).find((x) => x.hospital_id === id);
    if (!hospital) return <p className="muted">Not found.</p>;
    const doctors = hospital.doctors || [];
    const tickets = (data.medical || []).filter((r) => r.hospital_id === id);

    return (
        <>
            <div className="detail-head">
                <h3>{hospital.name}</h3>
                <span className="tag">{doctors.filter((d) => d.status === 'Available').length} free</span>
            </div>
            <Field label="Location">{Number(hospital.latitude).toFixed(4)}, {Number(hospital.longitude).toFixed(4)}</Field>
            <MiniMap points={[{ lat: hospital.latitude, lng: hospital.longitude, color: '#0f766e', label: hospital.name }]} />

            <h4>On-call doctors ({doctors.length})</h4>
            {doctors.length === 0 ? (
                <p className="muted small-note">No doctors listed.</p>
            ) : (
                <ul className="link-list">
                    {doctors.map((d) => (
                        <li key={d.doctor_id}>
                            <IdLink type="doctor" id={d.doctor_id} /> · {d.name} · {d.specialty} <Badge value={d.status} />
                        </li>
                    ))}
                </ul>
            )}

            <h4>Tickets from here ({tickets.length})</h4>
            <MedicalList tickets={tickets} empty="No medical tickets assigned here." />
        </>
    );
}

function DoctorDetail({ id, data }) {
    const doctor = doctorsOf(data).find((d) => d.doctor_id === id);
    if (!doctor) return <p className="muted">Not found.</p>;
    const tickets = (data.medical || []).filter((r) => r.doctor_id === id);
    const hospital = (data.hospitals || []).find((h) => h.hospital_id === doctor.hospital_id);

    return (
        <>
            <div className="detail-head">
                <h3>{doctor.name}</h3>
                <Badge value={doctor.status} />
            </div>
            <Field label="Specialty">{doctor.specialty}</Field>
            <Field label="Hospital">
                <IdLink type="hospital" id={doctor.hospital_id} label={hospital ? `${doctor.hospital_id} · ${hospital.name}` : doctor.hospital_name} />
            </Field>
            {hospital && (
                <MiniMap points={[{ lat: hospital.latitude, lng: hospital.longitude, color: '#0f766e', label: hospital.name }]} />
            )}

            <h4>Tickets ({tickets.length})</h4>
            <MedicalList tickets={tickets} empty="No tickets assigned to this doctor." />
        </>
    );
}

const DETAILS = {
    request: RequestDetail, shipment: ShipmentDetail, shelter: ShelterDetail, warehouse: WarehouseDetail,
    driver: DriverDetail, medical: MedicalDetail, hospital: HospitalDetail, doctor: DoctorDetail,
};

function DetailDrawer() {
    const inspect = useInspect();

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') inspect.close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [inspect]);

    if (!inspect || !inspect.current) return null;
    const { type, id } = inspect.current;
    const Detail = DETAILS[type];

    return (
        <>
            <div className="drawer-backdrop" onClick={inspect.close}></div>
            <aside className="drawer">
                <div className="drawer-top">
                    {inspect.canGoBack ? (
                        <button className="secondary small icon-text" onClick={inspect.back}><ArrowLeft size={16} /> Back</button>
                    ) : (
                        <span></span>
                    )}
                    <span className="drawer-kind">{TITLES[type]} {id}</span>
                    <button className="secondary icon-button" aria-label="Close" onClick={inspect.close}><X size={18} /></button>
                </div>
                <div className="drawer-body">
                    <Detail id={id} data={inspect.data} />
                </div>
            </aside>
        </>
    );
}

export default DetailDrawer;
