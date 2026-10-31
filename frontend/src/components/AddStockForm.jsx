import { useState } from 'react';

const API = 'http://localhost:3000/api';

function AddStockForm({ warehouses, onAdded }) {
    const [warehouseId, setWarehouseId] = useState('');
    const [item, setItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [errors, setErrors] = useState([]);
    const [success, setSuccess] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSuccess('');
        try {
            const res = await fetch(`${API}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ warehouse_id: warehouseId, item, quantity }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            setSuccess(`${data.warehouse_id} now has ${data.quantity} ${data.item}`);
            setItem('');
            setQuantity('');
            onAdded();
        } catch (err) {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <section className="card">
            <h2>Add stock</h2>
            <form className="form" onSubmit={handleSubmit}>
                <label>
                    Warehouse
                    <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                        <option value="">Choose a warehouse</option>
                        {warehouses.map((w) => (
                            <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_id}: {w.name}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Item
                    <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="water" />
                </label>
                <label>
                    Quantity
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                </label>
                <div className="actions full">
                    <button type="submit">Add stock</button>
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

export default AddStockForm;
