import { useState } from 'react';
import { PackagePlus, PackageMinus } from 'lucide-react';
import { API } from '../session';

const REMOVE_REASONS = ['Expired', 'Damaged in storage', 'Counting correction', 'Transferred to another organisation'];

function StockForm({ warehouse, inventory, onChanged }) {
    const [mode, setMode] = useState('add');
    const [item, setItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState([]);
    const [success, setSuccess] = useState('');

    const inStock = inventory.filter((row) => row.quantity > 0);

    function switchMode(next) {
        setMode(next);
        setItem('');
        setQuantity('');
        setReason('');
        setErrors([]);
        setSuccess('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSuccess('');
        const path = mode === 'add' ? 'inventory' : 'inventory/remove';
        try {
            const res = await fetch(`${API}/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item, quantity, reason }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            if (mode === 'add') {
                const sent = data.replacements && data.replacements.length > 0
                    ? ` Sent straight to waiting shelters: ${data.replacements.join(', ')}.`
                    : '';
                setSuccess(`Added ${quantity} ${data.item}. ${data.quantity} now in stock.${sent}`);
            } else {
                setSuccess(`Removed ${quantity} ${data.item}. ${data.quantity} left.`);
            }
            setItem('');
            setQuantity('');
            setReason('');
            onChanged();
        } catch (err) {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <section className="card">
            <div className="panel-header">
                <h2>{warehouse ? warehouse.name : 'My warehouse'}</h2>
                <div className="tabs">
                    <button className={mode === 'add' ? 'active' : ''} onClick={() => switchMode('add')}>
                        <span className="icon-text"><PackagePlus size={16} /> Add stock</span>
                    </button>
                    <button className={mode === 'remove' ? 'active' : ''} onClick={() => switchMode('remove')}>
                        <span className="icon-text"><PackageMinus size={16} /> Remove stock</span>
                    </button>
                </div>
            </div>

            <form className="form" onSubmit={handleSubmit}>
                <label>
                    Item
                    {mode === 'add' ? (
                        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="water" list="known-items" />
                    ) : (
                        <select value={item} onChange={(e) => setItem(e.target.value)}>
                            <option value="">Choose an item</option>
                            {inStock.map((row) => (
                                <option key={row.id} value={row.item}>{row.item} ({row.quantity} in stock)</option>
                            ))}
                        </select>
                    )}
                </label>
                <label>
                    Quantity
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                </label>
                <label>
                    {mode === 'add' ? 'Source (optional)' : 'Reason'}
                    <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        list={mode === 'remove' ? 'remove-reasons' : undefined}
                        placeholder={mode === 'add' ? 'e.g. Community donation drive' : 'e.g. Expired'}
                    />
                </label>
                <datalist id="known-items">
                    {inventory.map((row) => <option key={row.id} value={row.item} />)}
                </datalist>
                <datalist id="remove-reasons">
                    {REMOVE_REASONS.map((r) => <option key={r} value={r} />)}
                </datalist>
                <div className="actions full">
                    <button type="submit" className={mode === 'remove' ? 'danger' : ''}>
                        {mode === 'add' ? 'Add stock' : 'Remove stock'}
                    </button>
                </div>
                {errors.length > 0 && (
                    <ul className="errors full">
                        {errors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                )}
                {success && <p className="success full">{success}</p>}
            </form>
        </section>
    );
}

export default StockForm;
