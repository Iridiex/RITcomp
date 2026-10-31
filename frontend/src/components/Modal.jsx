import { useEffect } from 'react';
import { X } from 'lucide-react';

function Modal({ title, subtitle, icon: Icon, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="modal-layer">
            <div className="modal-backdrop" onClick={onClose}></div>
            <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
                <div className="modal-head">
                    {Icon && <span className="modal-icon"><Icon size={20} /></span>}
                    <div className="modal-titles">
                        <h3>{title}</h3>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button className="secondary icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}

export default Modal;
