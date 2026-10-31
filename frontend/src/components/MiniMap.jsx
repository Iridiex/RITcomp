import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { ExternalLink } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

function Fit({ points }) {
    const map = useMap();
    const key = JSON.stringify(points);
    useEffect(() => {
        if (points.length === 1) map.setView(points[0], 14);
        else if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
    }, [key, map]);
    return null;
}

function toLatLng(p) {
    return [Number(p.lat), Number(p.lng)];
}

function MiniMap({ points, lines = [] }) {
    const valid = points.filter((p) => p && !Number.isNaN(Number(p.lat)) && !Number.isNaN(Number(p.lng)));
    if (valid.length === 0) return null;
    const coords = valid.map(toLatLng);

    return (
        <div className="mini-map-wrap">
            <MapContainer center={coords[0]} zoom={13} className="mini-map" scrollWheelZoom={false} zoomControl={false}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {lines.map((line, i) => (
                    <Polyline key={i} positions={line.map(toLatLng)} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 6' }} />
                ))}
                {valid.map((p, i) => (
                    <CircleMarker key={i} center={coords[i]} radius={8} pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.9 }}>
                        {p.label && <Tooltip direction="top" offset={[0, -8]}>{p.label}</Tooltip>}
                    </CircleMarker>
                ))}
                <Fit points={coords} />
            </MapContainer>
            <a
                className="mini-map-link icon-text"
                href={`https://www.google.com/maps?q=${coords[0][0]},${coords[0][1]}`}
                target="_blank"
                rel="noreferrer"
            >
                Open in Google Maps <ExternalLink size={14} />
            </a>
        </div>
    );
}

export default MiniMap;
