import { LayoutDashboard, Inbox, Package, MapPin, Shuffle, Truck, Navigation, FileText, Send, LogOut } from 'lucide-react';

export const PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'requests', label: 'Requests', icon: Inbox },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sites', label: 'Shelters & warehouses', icon: MapPin },
    { id: 'allocation', label: 'Allocation', icon: Shuffle },
    { id: 'shipments', label: 'Shipments', icon: Truck },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'my-requests', label: 'My requests', icon: Inbox },
    { id: 'incoming', label: 'Incoming deliveries', icon: Truck },
    { id: 'stock', label: 'My stock', icon: Package },
    { id: 'outgoing', label: 'Outgoing shipments', icon: Send },
    { id: 'deliveries', label: 'My deliveries', icon: Navigation },
];

const ROLE_LABELS = { coordinator: 'Coordinator', shelter: 'Shelter', warehouse: 'Warehouse', driver: 'Driver' };

function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function Sidebar({ pages, page, onNavigate, badges, user, onLogout }) {
    const items = pages.map((id) => PAGES.find((p) => p.id === id));

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark">RD</div>
                <div>
                    <div className="brand-name">Relief dispatch</div>
                    <div className="brand-sub">{ROLE_LABELS[user.role]}</div>
                </div>
            </div>

            <nav>
                {items.map((p) => {
                    const Icon = p.icon;
                    return (
                        <button
                            key={p.id}
                            className={`nav-item ${page === p.id ? 'active' : ''}`}
                            onClick={() => onNavigate(p.id)}
                        >
                            <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span>
                            <span className="nav-label">{p.label}</span>
                            {badges[p.id] > 0 && <span className="nav-badge">{badges[p.id]}</span>}
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-user">
                <div className="user-avatar">{initials(user.name)}</div>
                <div>
                    <div className="user-name">{user.name}</div>
                    <div className="brand-sub">{user.username}</div>
                </div>
                <button className="icon-button logout" title="Log out" aria-label="Log out" onClick={onLogout}>
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;
