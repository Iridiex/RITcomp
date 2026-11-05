const { euclidean, pickDoctor } = require('../src/engine/medicalDispatch');

const hospitals = [
    { hospital_id: 'H-1', name: 'Rashid Hospital', latitude: 25.2510, longitude: 55.3170 },
    { hospital_id: 'H-2', name: "Al Jalila Children's Hospital", latitude: 25.2310, longitude: 55.3130 },
    { hospital_id: 'H-4', name: 'Mediclinic Parkview', latitude: 25.0900, longitude: 55.1900 },
];

const doctors = [
    { doctor_id: 'DOC-01', specialty: 'Trauma Specialist', status: 'Available', hospital_id: 'H-1' },
    { doctor_id: 'DOC-04', specialty: 'Pediatrician', status: 'Available', hospital_id: 'H-2' },
    { doctor_id: 'DOC-08', specialty: 'General Practitioner', status: 'Available', hospital_id: 'H-4' },
];

const alBarsha = { shelter_id: 'SH-01', latitude: 25.1124, longitude: 55.2006 };

test('euclidean distance matches the brief formula', () => {
    const d = euclidean(alBarsha, hospitals[2]);
    const expected = Math.sqrt((25.1124 - 25.0900) ** 2 + (55.2006 - 55.1900) ** 2);
    expect(d).toBeCloseTo(expected, 10);
});

test('picks the nearest hospital that has an available matching doctor', () => {
    const pick = pickDoctor({ shelter: alBarsha, specialty: 'General Practitioner', hospitals, doctors });
    expect(pick.hospital.hospital_id).toBe('H-4');
    expect(pick.doctor.doctor_id).toBe('DOC-08');
});

test('skips a closer hospital that has no matching specialty', () => {
    const pick = pickDoctor({ shelter: alBarsha, specialty: 'Pediatrician', hospitals, doctors });
    expect(pick.hospital.hospital_id).toBe('H-2');
    expect(pick.doctor.doctor_id).toBe('DOC-04');
});

test('ignores a matching doctor who is already dispatched', () => {
    const busy = doctors.map((d) => (d.doctor_id === 'DOC-08' ? { ...d, status: 'Dispatched' } : d));
    const pick = pickDoctor({ shelter: alBarsha, specialty: 'General Practitioner', hospitals, doctors: busy });
    expect(pick).toBeNull();
});

test('returns null when no hospital has that specialty free', () => {
    expect(pickDoctor({ shelter: alBarsha, specialty: 'Geriatrician', hospitals, doctors })).toBeNull();
});
