import { CAPACITY, GRACE, isOverCapacity, partOf } from '../capacity';

function LoadAmount({ shipment, shipments, quantity = shipment.quantity }) {
    const over = isOverCapacity(shipment.quantity);
    const part = shipments ? partOf(shipment, shipments) : null;
    return (
        <>
            <span
                className={over ? 'over-capacity' : ''}
                title={over ? `${shipment.quantity - CAPACITY} over the ${CAPACITY}-unit truck capacity (allowed up to ${GRACE} extra)` : undefined}
            >
                {quantity} {shipment.item}
            </span>
            {part && <span className="tag" title="Too big for one truck, so it was split across drivers">Part {part.index} of {part.total}</span>}
        </>
    );
}

export default LoadAmount;
