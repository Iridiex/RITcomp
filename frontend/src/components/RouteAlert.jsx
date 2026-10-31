import { TriangleAlert } from 'lucide-react';
import { formatTime } from '../format';

const LABELS = { road: 'Road problem', shelter: 'Shelter problem', safety: 'Safety warning', other: 'Warning' };

// A warning another driver reported about getting to this shelter, in English and Arabic
function RouteAlert({ alert, children }) {
    return (
        <div className={`route-alert ${alert.category === 'safety' ? 'safety' : ''}`}>
            <TriangleAlert size={16} className="route-alert-icon" />
            <div className="route-alert-body">
                <strong>{LABELS[alert.category] || LABELS.other}</strong>
                <span>{alert.summary}</span>
                {alert.summary_ar && <span dir="rtl" lang="ar" className="route-alert-ar">{alert.summary_ar}</span>}
                <span className="route-alert-meta">
                    Reported {formatTime(alert.created_at)}{alert.driver_name ? ` by ${alert.driver_name}` : ''} · <span className="nowrap">{alert.shipment_id}</span>
                </span>
            </div>
            {children}
        </div>
    );
}

export default RouteAlert;
