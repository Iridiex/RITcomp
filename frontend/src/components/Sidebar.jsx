export const PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: '▣' },
    { id: 'requests', label: 'Requests', icon: '☰' },
    { id: 'inventory', label: 'Inventory', icon: '▤' },
    { id: 'sites', label: 'Shelters & warehouses', icon: '⌖' },
    { id: 'allocation', label: 'Allocation', icon: '⇄' },
    { id: 'shipments', label: 'Shipments', icon: '➤' },
    { id: 'driver', label: 'Driver view', icon: '◎' },
    { id: 'reports', label: 'Reports', icon: '⤓' },
];

function Sidebar({ page, onNavigate, badges }) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark">RD</div>
                <div>
                    <div className="brand-name">Relief dispatch</div>
                    <div className="brand-sub">Coordinator</div>
                </div>
            </div>
            <nav>
                {PAGES.map((p) => (
                    <button
                        key={p.id}
                        className={`nav-item ${page === p.id ? 'active' : ''}`}
                        onClick={() => onNavigate(p.id)}
                    >
                        <span className="nav-icon">{p.icon}</span>
                        <span className="nav-label">{p.label}</span>
                        {badges[p.id] > 0 && <span className="nav-badge">{badges[p.id]}</span>}
                    </button>
                ))}
            </nav>
        </aside>
    );
}

export default Sidebar;
