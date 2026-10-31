import { useEffect, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { PAGES } from '../pages';
import Logo from './Logo';

const ROLE_LABELS = { coordinator: 'Coordinator', shelter: 'Shelter', warehouse: 'Warehouse', driver: 'Driver' };

function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function Sidebar({ pages, page, onNavigate, badges, user, onLogout }) {
    const [open, setOpen] = useState(false);
    const items = pages.map((id) => PAGES.find((p) => p.id === id));
    const current = items.find((p) => p.id === page);
    const waiting = items.reduce((sum, p) => sum + (badges[p.id] || 0), 0);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    function go(id) {
        setOpen(false);
        onNavigate(id);
    }

    return (
        <>
            <header className="mobile-bar">
                <button className="mobile-menu-button" aria-label="Open menu" onClick={() => setOpen(true)}>
                    <Menu size={22} />
                    {waiting > 0 && <span className="mobile-menu-dot"></span>}
                </button>
                <Logo size={30} className="brand-mark" />
                <span className="mobile-bar-title">{current ? current.label : 'Relief Dispatch'}</span>
            </header>

            {open && <div className="sidebar-scrim" onClick={() => setOpen(false)}></div>}

            <aside className={`sidebar ${open ? 'open' : ''}`}>
                <div className="brand">
                    <Logo className="brand-mark" />
                    <div className="brand-text">
                        <div className="brand-name">Relief Dispatch</div>
                        <div className="brand-sub">{ROLE_LABELS[user.role]}</div>
                    </div>
                    <button className="sidebar-close icon-button" aria-label="Close menu" onClick={() => setOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <nav>
                    {items.map((p) => {
                        const Icon = p.icon;
                        return (
                            <button
                                key={p.id}
                                className={`nav-item ${page === p.id ? 'active' : ''}`}
                                onClick={() => go(p.id)}
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
        </>
    );
}

export default Sidebar;
