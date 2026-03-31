let map;
let userMarker;
let userLat = 0;
let userLng = 0;
let bodyPart = '';
let illnessType = '';
let bodyName = '';
let locationLabel = '';
let currentRadius = 5000;
let markers = [];

document.addEventListener('DOMContentLoaded', () => {
    getURLParams();
    wireControls();
    initPage();
});

function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    bodyPart = params.get('part') || '';
    illnessType = params.get('illness_type') || '';
    bodyName = decodeURIComponent(params.get('name') || '');
    locationLabel = decodeURIComponent(params.get('location_label') || '');
    userLat = parseFloat(params.get('lat') || '0');
    userLng = parseFloat(params.get('lng') || '0');

    const saved = readSavedLocation();
    if (!locationLabel && saved && nearlySameLocation(saved.lat, saved.lng, userLat, userLng)) {
        locationLabel = saved.label || '';
    }
}

function wireControls() {
    document.getElementById('refreshBtn')?.addEventListener('click', searchHospitals);
    document.getElementById('limitFilter')?.addEventListener('change', searchHospitals);
    document.getElementById('updateLocationBtn')?.addEventListener('click', updateLocationFromInput);
    document.getElementById('currentLocationBtn')?.addEventListener('click', useCurrentLocation);
    document.getElementById('locationInput')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            updateLocationFromInput();
        }
    });

    document.querySelectorAll('.radius-btn').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.radius-btn').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            currentRadius = parseInt(button.dataset.radius, 10);
            searchHospitals();
        });
    });
}

async function initPage() {
    const hasSearch = bodyPart || illnessType;
    const hasLocation = isFinite(userLat) && isFinite(userLng) && userLat !== 0 && userLng !== 0;

    if (!hasSearch || !hasLocation) {
        renderMissingState();
        return;
    }

    const label = bodyName || illnessType || bodyPart;
    document.getElementById('pageTitle').innerHTML = `Hospitals for <span>${escapeHtml(label)}</span>`;
    document.getElementById('locationInput').value = locationLabel;

    if (!locationLabel) {
        locationLabel = await getReadableLocation(userLat, userLng);
    }

    updateLocationSummary();
    initMap();
    searchHospitals();
}

function renderMissingState() {
    document.getElementById('pageTitle').innerHTML = 'Missing <span>Information</span>';
    document.getElementById('hospitalsList').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">!</div>
            <h3>Could not detect location or search type</h3>
            <p><a href="/" style="color:var(--accent)">Go back and try again</a></p>
        </div>`;
}

function initMap() {
    map = L.map('map', { zoomControl: true }).setView([userLat, userLng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    userMarker = L.marker([userLat, userLng], {
        icon: L.divIcon({
            className: '',
            html: '<div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        })
    }).addTo(map).bindPopup('<b>Your Location</b>');
}

async function searchHospitals() {
    const limit = parseInt(document.getElementById('limitFilter').value, 10);
    const searchName = bodyName || illnessType || bodyPart || 'selected';

    document.getElementById('hospitalsList').innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <div class="loading-text">Searching ${escapeHtml(searchName)} hospitals...</div>
        </div>`;

    clearHospitalMarkers();

    try {
        const response = await fetch('/api/search-hospitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                body_part: bodyPart,
                illness_type: illnessType,
                lat: userLat,
                lng: userLng,
                radius: currentRadius,
                limit
            })
        });
        const data = await response.json();

        if (data.success && data.groups && data.groups.length > 0) {
            renderGroups(data);
            return;
        }

        document.getElementById('hospitalsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">Hospital</div>
                <h3>No hospitals found</h3>
                <p>Try increasing the distance radius above or updating the location.</p>
            </div>`;
    } catch (error) {
        document.getElementById('hospitalsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">X</div>
                <h3>Search failed</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>`;
    }
}

function renderGroups(data) {
    document.getElementById('resultCount').textContent = data.total;
    document.getElementById('resultInfo').textContent =
        `Grouped by specialty | Within ${currentRadius / 1000} km | ${data.search_label}`;

    const allHospitals = [];
    let markerIndex = 1;

    const html = data.groups.map((group, index) => {
        const cls = getGroupClass(group.id);
        const cards = group.hospitals.map((hospital) => {
            const markerId = markerIndex++;
            allHospitals.push({ ...hospital, markerId, groupId: group.id });

            return `
                <div class="hospital-card ${cls}" onclick="showOnMap(${hospital.lat}, ${hospital.lng})">
                    <div class="card-top">
                        <div>
                            <div class="card-num">#${markerId}</div>
                            <div class="card-name">${escapeHtml(hospital.name)}</div>
                        </div>
                        <span class="card-badge ${cls}">${badgeText(group.id)}</span>
                    </div>
                    <span class="card-type">${escapeHtml(hospital.type || 'Hospital')}</span>
                    <div class="card-address">Location: ${escapeHtml(hospital.address || 'Address unavailable')}</div>
                    <div class="card-footer">
                        <div style="display:flex;flex-direction:column;gap:4px;">
                            <div class="card-distance">${hospital.distance} km away</div>
                            ${renderRating(hospital.display_rating)}
                        </div>
                        <div class="card-actions">
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}" target="_blank" class="btn-nav" onclick="event.stopPropagation()">Navigate</a>
                            <button class="btn-map-pin" onclick="event.stopPropagation();showOnMap(${hospital.lat}, ${hospital.lng})">Map</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="specialty-group" style="animation-delay:${index * 0.08}s">
                <div class="group-header">
                    <div class="group-icon ${cls}">${escapeHtml(group.icon || 'H')}</div>
                    <div class="group-label ${cls}">${escapeHtml(group.label)}</div>
                    <span class="group-count">${group.hospitals.length} hospital${group.hospitals.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="hospitals-grid">${cards}</div>
            </div>`;
    }).join('');

    document.getElementById('hospitalsList').innerHTML = html;
    addHospitalMarkers(allHospitals);
}

function addHospitalMarkers(hospitals) {
    const colorMap = { multi: '#f59e0b', special: '#3b82f6', general: '#94a3b8' };
    const bounds = [[userLat, userLng]];

    hospitals.forEach((hospital) => {
        const cls = getGroupClass(hospital.groupId);
        const marker = L.marker([hospital.lat, hospital.lng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="width:28px;height:28px;background:${colorMap[cls]};border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:11px;box-shadow:0 4px 12px rgba(0,0,0,0.4);">${hospital.markerId}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            })
        }).addTo(map);

        marker.bindPopup(`
            <div style="min-width:200px;font-family:'DM Sans',sans-serif;">
                <div style="font-weight:700;margin-bottom:6px;font-size:14px;">${escapeHtml(hospital.name)}</div>
                <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">${hospital.distance} km away</div>
                <div style="color:#cbd5e1;font-size:11px;">${escapeHtml(hospital.address || 'Address unavailable')}</div>
            </div>`);

        markers.push(marker);
        bounds.push([hospital.lat, hospital.lng]);
    });

    if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    }
}

function clearHospitalMarkers() {
    markers.forEach((marker) => map.removeLayer(marker));
    markers = [];
}

function renderRating(score) {
    if (!score || score === 0) {
        return '<span style="color:#475569;font-size:0.7rem;">No rating data</span>';
    }

    const full = Math.floor(score);
    const half = (score - full) >= 0.3 ? 1 : 0;
    const empty = 5 - full - half;
    const fullStars = '★'.repeat(full);
    const halfStars = half ? '<span style="color:#f59e0b;opacity:0.55">★</span>' : '';
    const emptyStars = '<span style="color:#334155">★</span>'.repeat(empty);

    return '<div class="card-rating">'
        + '<span class="stars">' + fullStars + halfStars + emptyStars + '</span>'
        + '<span class="rating-val">' + score.toFixed(1) + '</span>'
        + '<span class="rating-src">&nbsp;| Geoapify</span>'
        + '</div>';
}

async function updateLocationFromInput() {
    const input = document.getElementById('locationInput');
    const value = input.value.trim();
    if (!value) {
        input.style.borderColor = '#ef4444';
        return;
    }

    try {
        const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: value })
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Location not found');
        }

        setCurrentLocation(data.lat, data.lng, data.formatted_address || value);
    } catch (error) {
        input.style.borderColor = '#ef4444';
        input.value = '';
        input.placeholder = 'Location not found. Try another city or area.';
    }
}

function useCurrentLocation() {
    const button = document.getElementById('currentLocationBtn');
    if (!navigator.geolocation) {
        button.textContent = 'Browser location unavailable';
        return;
    }

    button.textContent = 'Detecting...';
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const label = await getReadableLocation(lat, lng);
            setCurrentLocation(lat, lng, label || 'Current location');
            button.textContent = 'Use Current Location';
        },
        () => {
            button.textContent = 'Allow location access';
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

function setCurrentLocation(lat, lng, label) {
    userLat = lat;
    userLng = lng;
    locationLabel = label || '';
    saveLocation(label);
    writeURLState();
    updateLocationSummary();

    if (map) {
        map.setView([userLat, userLng], 14);
        userMarker.setLatLng([userLat, userLng]).bindPopup('<b>Your Location</b>');
    }

    searchHospitals();
}

function writeURLState() {
    const params = new URLSearchParams(window.location.search);
    params.set('lat', userLat);
    params.set('lng', userLng);
    if (locationLabel) {
        params.set('location_label', locationLabel);
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function updateLocationSummary() {
    const summary = locationLabel || `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;
    document.getElementById('pageSubtitle').textContent = summary;
    document.getElementById('locationInput').value = locationLabel || '';
}

async function getReadableLocation(lat, lng) {
    try {
        const response = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
        });
        const data = await response.json();
        if (data.success) {
            return data.formatted_address;
        }
    } catch (error) {
        console.warn('Reverse geocoding failed:', error.message);
    }
    return '';
}

function showOnMap(lat, lng) {
    map.setView([lat, lng], 16);
    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    markers.find((marker) => {
        const point = marker.getLatLng();
        return Math.abs(point.lat - lat) < 0.0001 && Math.abs(point.lng - lng) < 0.0001;
    })?.openPopup();
}

function badgeText(groupId) {
    if (groupId === 'multispecialty') {
        return 'Priority';
    }
    if (groupId === 'general') {
        return 'General';
    }
    return 'Specialist';
}

function getGroupClass(groupId) {
    if (groupId === 'multispecialty') {
        return 'multi';
    }
    if (groupId === 'general') {
        return 'general';
    }
    return 'special';
}

function saveLocation(label) {
    sessionStorage.setItem('medifind:selectedLocation', JSON.stringify({
        lat: userLat,
        lng: userLng,
        label: label || locationLabel
    }));
}

function readSavedLocation() {
    try {
        const raw = sessionStorage.getItem('medifind:selectedLocation');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function nearlySameLocation(lat1, lng1, lat2, lng2) {
    return Math.abs(lat1 - lat2) < 0.0001 && Math.abs(lng1 - lng2) < 0.0001;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
