const CAPACITY = 200;
const GRACE = 10;

// 205 -> [205] (within grace), 215 -> [200, 15], 415 -> [200, 200, 15]
function splitLoad(quantity) {
    const loads = [];
    let left = quantity;
    while (left > CAPACITY + GRACE) {
        loads.push(CAPACITY);
        left -= CAPACITY;
    }
    if (left > 0) loads.push(left);
    return loads;
}

module.exports = { CAPACITY, GRACE, splitLoad };
