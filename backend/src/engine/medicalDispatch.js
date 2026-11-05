const SPECIALTIES = [
    'General Practitioner',
    'Pediatrician',
    'Trauma Specialist',
    'Infectious Disease Specialist',
    'Geriatrician',
    'Obstetrician',
    'Orthopedic Specialist',
    'Emergency Physician',
    'Paramedic',
];
const AVAILABLE = 'Available';
const DISPATCHED = 'Dispatched';
const PENDING = 'Pending Medical Dispatch - High Urgency';
const COMPLETED = 'Completed';
const AWAITING = 'Awaiting review';
const REJECTED = 'Rejected';

// Brief: d = √((x2 − x1)² + (y2 − y1)²) using each site's stored coordinates
function euclidean(a, b) {
    const dx = Number(a.latitude) - Number(b.latitude);
    const dy = Number(a.longitude) - Number(b.longitude);
    return Math.sqrt(dx * dx + dy * dy);
}

// Nearest hospital that currently has an available doctor of this specialty
function pickDoctor({ shelter, specialty, hospitals, doctors }) {
    const matches = doctors
        .filter((d) => d.specialty === specialty && d.status === AVAILABLE)
        .map((doctor) => {
            const hospital = hospitals.find((h) => h.hospital_id === doctor.hospital_id);
            if (!hospital) return null;
            return { doctor, hospital, distance: euclidean(shelter, hospital) };
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance || a.doctor.doctor_id.localeCompare(b.doctor.doctor_id));
    return matches[0] || null;
}

module.exports = { euclidean, pickDoctor, SPECIALTIES, AVAILABLE, DISPATCHED, PENDING, COMPLETED, AWAITING, REJECTED };
