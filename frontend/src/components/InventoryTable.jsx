import { IdLink } from '../inspect';
function InventoryTable({ inventory, warehouses }) {
    const nameOf = (id) => {
        const warehouse = warehouses.find((w) => w.warehouse_id === id);
        return warehouse ? warehouse.name : id;
    };

    return (
        <section className="card">
            <h2>Stock levels</h2>
            <table>
                <thead>
                    <tr>
                        <th>Warehouse</th><th>Item</th><th>Qty</th>
                    </tr>
                </thead>
                <tbody>
                    {inventory.map((row) => (
                        <tr key={row.id}>
                            <td><IdLink type="warehouse" id={row.warehouse_id} label={`${row.warehouse_id}: ${nameOf(row.warehouse_id)}`} /></td>
                            <td>{row.item}</td>
                            <td className={row.quantity === 0 ? 'out-of-stock' : ''}>{row.quantity}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export default InventoryTable;
