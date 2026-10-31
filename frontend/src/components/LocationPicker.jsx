import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const DUBAI = [25.2, 55.3];
const PHOTON = 'https://photon.komoot.io';
const UAE_BBOX = '51.5,22.6,56.4,26.1';

function describe(props) {
    const main = props.name || props.street || props.district || props.city || 'Unnamed place';
    const parts = [props.street, props.district, props.city, props.state].filter((p) => p && p !== main);
    return { main, detail: [...new Set(parts)].join(', ') };
}

function toPlace(feature) {
    const [lng, lat] = feature.geometry.coordinates;
    return { ...describe(feature.properties), lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}

function fullName(place) {
    return place.detail ? `${place.main}, ${place.detail}` : place.main;
}

async function findPlaces(text, limit) {
    const url = `${PHOTON}/api/?q=${encodeURIComponent(text)}&limit=${limit}&lang=en&bbox=${UAE_BBOX}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.features.map(toPlace);
}

async function nameOfSpot(lat, lng) {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`);
    const data = await res.json();
    if (data.features.length === 0) return '';
    return fullName(toPlace(data.features[0]));
}

function ClickToPick({ onPick }) {
    useMapEvents({
        click(e) {
            onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
        },
    });
    return null;
}

function FlyTo({ target }) {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo(target, 15);
    }, [target, map]);
    return null;
}

function LocationPicker({ latitude, longitude, onPick, otherSites = [] }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState(null);
    const [placeName, setPlaceName] = useState('');
    const [searchError, setSearchError] = useState('');
    const chosenName = useRef(null);
    const hasPin = latitude !== '' && latitude !== null && latitude !== undefined;

    useEffect(() => {
        const text = query.trim();
        if (!open || text.length < 3) {
            setSuggestions([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setSuggestions(await findPlaces(text, 5));
            } catch (err) {
                setSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, open]);

    useEffect(() => {
        if (!hasPin) {
            setPlaceName('');
            setQuery('');
            return;
        }
        if (chosenName.current) {
            setPlaceName(chosenName.current);
            chosenName.current = null;
            return;
        }
        setPlaceName('Finding place name...');
        const timer = setTimeout(async () => {
            try {
                const name = (await nameOfSpot(latitude, longitude)) || 'Unnamed spot';
                setPlaceName(name);
                setQuery(name);
            } catch (err) {
                setPlaceName('');
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [latitude, longitude, hasPin]);

    function choose(place) {
        setQuery(fullName(place));
        setOpen(false);
        setSuggestions([]);
        setSearchError('');
        setTarget([place.lat, place.lng]);
        chosenName.current = fullName(place);
        onPick(place.lat, place.lng);
    }

    async function searchNow() {
        if (suggestions.length > 0) {
            choose(suggestions[0]);
            return;
        }
        const text = query.trim();
        if (text === '') return;
        try {
            const places = await findPlaces(text, 1);
            if (places.length === 0) {
                setSearchError('Place not found, try another name');
                return;
            }
            choose(places[0]);
        } catch (err) {
            setSearchError('Search is unavailable right now');
        }
    }

    function clearPin() {
        onPick('', '');
    }

    return (
        <div>
            <div className="picker-search">
                <div className="search-box">
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            setSearchError('');
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                searchNow();
                            }
                            if (e.key === 'Escape') setOpen(false);
                        }}
                        placeholder="Search a place, e.g. Karama"
                    />
                    {open && suggestions.length > 0 && (
                        <ul className="suggestions">
                            {suggestions.map((place, i) => (
                                <li
                                    key={`${place.lat},${place.lng},${i}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        choose(place);
                                    }}
                                >
                                    <span className="suggestion-main">{place.main}</span>
                                    {place.detail && <span className="suggestion-detail">{place.detail}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button type="button" onClick={searchNow}>Search</button>
            </div>
            {searchError && <div className="row-error">{searchError}</div>}

            <MapContainer center={hasPin ? [latitude, longitude] : DUBAI} zoom={hasPin ? 14 : 11} className="map picker-map">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Search by <a href="https://photon.komoot.io">Photon</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {otherSites.map((s) => (
                    <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={5}
                        pathOptions={{ color: '#9ca3af', fillOpacity: 0.5 }} />
                ))}
                {hasPin && (
                    <CircleMarker
                        center={[latitude, longitude]}
                        radius={10}
                        bubblingMouseEvents={false}
                        eventHandlers={{ click: clearPin }}
                        pathOptions={{ color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.9 }}
                    >
                        {placeName && (
                            <Tooltip permanent direction="top" offset={[0, -10]}>{placeName}</Tooltip>
                        )}
                    </CircleMarker>
                )}
                <ClickToPick onPick={onPick} />
                <FlyTo target={target} />
            </MapContainer>

            <div className="picker-footer">
                <div>
                    {hasPin ? (
                        <>
                            <p className="place-name">📍 {placeName}</p>
                            <p className="muted picker-note">{latitude}, {longitude} · click the pin to remove it</p>
                        </>
                    ) : (
                        <p className="muted picker-note">Search above or click the map to place the pin</p>
                    )}
                </div>
                {hasPin && (
                    <button type="button" className="secondary small" onClick={clearPin}>Clear pin</button>
                )}
            </div>
        </div>
    );
}

export default LocationPicker;
