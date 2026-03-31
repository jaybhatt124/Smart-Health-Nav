let selectedLocation = null;
let pendingSearch = null;

document.addEventListener('DOMContentLoaded', () => {
    const bodyParts = document.querySelectorAll('.body-part');
    const illnessCards = document.querySelectorAll('.illness-card');
    const hoverLabel = document.getElementById('hoverLabel');
    const detectBtn = document.getElementById('detectLocationBtn');
    const openManualBtn = document.getElementById('openManualLocationBtn');
    const saveManualBtn = document.getElementById('searchManualLocationBtn');
    const manualInput = document.getElementById('manualLocationInput');

    restoreSavedLocation();
    updateLocationStatus();

    if (bodyParts.length && hoverLabel) {
        bodyParts.forEach((part) => {
            part.addEventListener('mouseenter', () => {
                hoverLabel.textContent = part.dataset.name;
                document.querySelectorAll(`[data-part="${part.dataset.part}"]`).forEach((item) => {
                    item.style.fill = 'rgba(59,130,246,0.45)';
                    item.style.stroke = '#60a5fa';
                    item.style.strokeWidth = '1.5';
                });
            });

            part.addEventListener('mouseleave', () => {
                hoverLabel.textContent = 'Click any body part';
                document.querySelectorAll(`[data-part="${part.dataset.part}"]`).forEach((item) => {
                    item.style.fill = 'transparent';
                    item.style.stroke = '';
                    item.style.strokeWidth = '';
                });
            });

            part.addEventListener('click', () => {
                startSearch('body_part', part.dataset.part, part.dataset.name);
            });
        });
    }

    illnessCards.forEach((card) => {
        card.addEventListener('click', () => {
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.style.transform = '';
            }, 180);
            startSearch('illness', card.dataset.illness, card.dataset.name);
        });
    });

    detectBtn?.addEventListener('click', () => {
        pendingSearch = null;
        detectLocation();
    });

    openManualBtn?.addEventListener('click', () => {
        pendingSearch = null;
        showManualModal('Enter your city, area, or pincode to save a location for search.');
    });

    saveManualBtn?.addEventListener('click', () => {
        geocodeManualInput(manualInput, saveManualBtn);
    });

    manualInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            geocodeManualInput(manualInput, saveManualBtn);
        }
    });
});

function startSearch(searchType, searchValue, displayName) {
    pendingSearch = { searchType, searchValue, displayName };

    if (selectedLocation?.lat && selectedLocation?.lng) {
        navigateTo(
            searchType,
            searchValue,
            displayName,
            selectedLocation.lat,
            selectedLocation.lng,
            selectedLocation.label
        );
        return;
    }

    detectLocation();
}

function detectLocation() {
    showOverlay('Detecting your location...');

    if (!navigator.geolocation) {
        tryIPLocation();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            const label = await getReadableLocation(lat, lng);

            hideOverlay();

            if (accuracy > 5000) {
                showConfirmModal(lat, lng, label, 'GPS accuracy looks low (' + Math.round(accuracy) + 'm).');
                return;
            }

            saveSelectedLocation(lat, lng, label || 'Current location');
            if (pendingSearch) {
                navigateTo(
                    pendingSearch.searchType,
                    pendingSearch.searchValue,
                    pendingSearch.displayName,
                    lat,
                    lng,
                    label
                );
            }
        },
        () => {
            showOverlay('Trying network-based location...');
            tryIPLocation();
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

async function tryIPLocation() {
    try {
        const response = await fetch(
            'https://api.geoapify.com/v1/ipinfo?apiKey=be7be3e5dcfc48069a16d4813b1bf16d',
            { signal: AbortSignal.timeout(6000) }
        );
        const data = await response.json();
        const lat = data?.location?.latitude;
        const lng = data?.location?.longitude;
        const label = data?.city?.name || data?.state?.name || 'Detected network location';

        hideOverlay();

        if (lat && lng) {
            showConfirmModal(lat, lng, label, 'This looks like a network/IP-based location. Please confirm it.');
            return;
        }
    } catch (error) {
        console.warn('IP location failed:', error.message);
    }

    hideOverlay();
    showManualModal('Could not detect your location automatically. Please enter it manually.');
}

function showConfirmModal(lat, lng, label, note) {
    removeModal();

    const modal = document.createElement('div');
    modal.id = 'locationModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);' +
        'backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML =
        '<div style="background:#111827;border:1px solid rgba(255,255,255,0.12);border-radius:20px;' +
        'padding:2rem;max-width:420px;width:100%;font-family:\'DM Sans\',sans-serif;color:#f1f5f9;">' +
            '<div style="font-size:2rem;text-align:center;margin-bottom:0.75rem;">Location</div>' +
            '<h3 style="font-family:\'Syne\',sans-serif;font-size:1.1rem;font-weight:700;text-align:center;margin-bottom:0.5rem;">Use this location?</h3>' +
            '<div style="background:#1a2235;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center;">' +
                '<div style="font-size:1.05rem;margin-bottom:4px;color:#06b6d4;">' + escapeHtml(label || (lat.toFixed(4) + ', ' + lng.toFixed(4))) + '</div>' +
                '<div style="font-size:0.72rem;color:#64748b;">' + escapeHtml(note) + '</div>' +
                '<a href="https://maps.google.com/?q=' + lat + ',' + lng + '" target="_blank" style="font-size:0.75rem;color:#3b82f6;text-decoration:none;display:inline-block;margin-top:6px;">Verify on Google Maps</a>' +
            '</div>' +
            '<button id="confirmYes" style="width:100%;padding:11px;margin-bottom:0.75rem;background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:12px;color:white;cursor:pointer;font-weight:600;font-size:0.9rem;">Use this location</button>' +
            '<div style="text-align:center;color:#475569;font-size:0.75rem;margin-bottom:0.75rem;">or type the correct place</div>' +
            '<input id="manualAddress" placeholder="Ahmedabad, Himmatnagar, 380009..." style="width:100%;padding:11px 14px;background:#1a2235;border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f1f5f9;font-size:0.88rem;outline:none;margin-bottom:0.75rem;font-family:\'DM Sans\',sans-serif;"/>' +
            '<button id="confirmSearch" style="width:100%;padding:11px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border:none;border-radius:12px;color:white;cursor:pointer;font-weight:600;font-size:0.9rem;">Search typed location</button>' +
        '</div>';

    document.body.appendChild(modal);

    document.getElementById('confirmYes').onclick = () => {
        saveSelectedLocation(lat, lng, label || 'Selected location');
        removeModal();
        if (pendingSearch) {
            navigateTo(
                pendingSearch.searchType,
                pendingSearch.searchValue,
                pendingSearch.displayName,
                lat,
                lng,
                label
            );
        }
    };
    document.getElementById('confirmSearch').onclick = () => {
        geocodeModalAddress();
    };
    document.getElementById('manualAddress').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            geocodeModalAddress();
        }
    });
}

function showManualModal(reason) {
    removeModal();

    const modal = document.createElement('div');
    modal.id = 'locationModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);' +
        'backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML =
        '<div style="background:#111827;border:1px solid rgba(255,255,255,0.12);border-radius:20px;' +
        'padding:2rem;max-width:420px;width:100%;font-family:\'DM Sans\',sans-serif;color:#f1f5f9;">' +
            '<div style="font-size:2rem;text-align:center;margin-bottom:0.75rem;">Manual Location</div>' +
            '<h3 style="font-family:\'Syne\',sans-serif;font-size:1.1rem;font-weight:700;text-align:center;margin-bottom:0.5rem;">Enter Your Location</h3>' +
            '<p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-bottom:1.25rem;">' + escapeHtml(reason) + '</p>' +
            '<input id="manualAddress" placeholder="Ahmedabad, Bopal, Navrangpura..." style="width:100%;padding:12px 16px;background:#1a2235;border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f1f5f9;font-size:0.9rem;outline:none;margin-bottom:1rem;font-family:\'DM Sans\',sans-serif;"/>' +
            '<div style="display:flex;gap:0.75rem;">' +
                '<button id="cancelBtn" style="flex:1;padding:12px;background:#1a2235;border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#94a3b8;cursor:pointer;font-size:0.875rem;">Cancel</button>' +
                '<button id="searchBtn" style="flex:2;padding:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border:none;border-radius:12px;color:white;cursor:pointer;font-weight:600;font-size:0.875rem;">Save and continue</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    document.getElementById('cancelBtn').onclick = removeModal;
    document.getElementById('searchBtn').onclick = () => {
        geocodeModalAddress();
    };
    document.getElementById('manualAddress').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            geocodeModalAddress();
        }
    });
}

async function geocodeModalAddress() {
    const input = document.getElementById('manualAddress');
    const button = document.getElementById('confirmSearch') || document.getElementById('searchBtn');
    await geocodeAddressFromInput(input, button, true);
}

async function geocodeManualInput(input, button) {
    await geocodeAddressFromInput(input, button, false);
}

async function geocodeAddressFromInput(input, button, closeModalOnSuccess) {
    const address = input?.value?.trim();
    if (!address) {
        if (input) {
            input.style.borderColor = '#ef4444';
        }
        return;
    }

    const defaultButtonText = button?.textContent || 'Search';
    if (button) {
        button.textContent = 'Searching...';
        button.disabled = true;
    }

    try {
        const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Address not found');
        }

        saveSelectedLocation(data.lat, data.lng, data.formatted_address || address);
        if (closeModalOnSuccess) {
            removeModal();
        }
        if (pendingSearch) {
            navigateTo(
                pendingSearch.searchType,
                pendingSearch.searchValue,
                pendingSearch.displayName,
                data.lat,
                data.lng,
                data.formatted_address || address
            );
        }
    } catch (error) {
        if (input) {
            input.style.borderColor = '#ef4444';
            input.value = '';
            input.placeholder = 'Location not found. Try another city or area.';
        }
    } finally {
        if (button) {
            button.textContent = defaultButtonText;
            button.disabled = false;
        }
    }
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

function saveSelectedLocation(lat, lng, label) {
    selectedLocation = { lat, lng, label };
    sessionStorage.setItem('medifind:selectedLocation', JSON.stringify(selectedLocation));
    updateLocationStatus();
}

function restoreSavedLocation() {
    try {
        const raw = sessionStorage.getItem('medifind:selectedLocation');
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            selectedLocation = parsed;
        }
    } catch (error) {
        console.warn('Could not restore saved location:', error.message);
    }
}

function updateLocationStatus() {
    const status = document.getElementById('selectedLocationStatus');
    const input = document.getElementById('manualLocationInput');
    if (!status) {
        return;
    }

    if (selectedLocation) {
        status.textContent = 'Selected location: ' + (selectedLocation.label || (selectedLocation.lat.toFixed(4) + ', ' + selectedLocation.lng.toFixed(4)));
        if (input) {
            input.value = selectedLocation.label || '';
        }
    } else {
        status.textContent = 'No location selected yet.';
    }
}

function navigateTo(searchType, searchValue, displayName, lat, lng, locationLabel) {
    let url = '/hospitals?lat=' + lat + '&lng=' + lng + '&name=' + encodeURIComponent(displayName);
    if (locationLabel) {
        url += '&location_label=' + encodeURIComponent(locationLabel);
    }
    url += searchType === 'illness'
        ? '&illness_type=' + encodeURIComponent(searchValue)
        : '&part=' + encodeURIComponent(searchValue);
    window.location.href = url;
}

function showOverlay(message) {
    document.querySelectorAll('.body-part').forEach((part) => {
        part.style.pointerEvents = 'none';
    });
    document.querySelectorAll('.illness-card').forEach((card) => {
        card.style.pointerEvents = 'none';
    });

    const overlay = document.getElementById('locationOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        const text = overlay.querySelector('.loc-text');
        if (text) {
            text.textContent = message || 'Detecting your location...';
        }
    }
}

function hideOverlay() {
    document.querySelectorAll('.body-part').forEach((part) => {
        part.style.pointerEvents = '';
    });
    document.querySelectorAll('.illness-card').forEach((card) => {
        card.style.pointerEvents = '';
    });

    const overlay = document.getElementById('locationOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    const hoverLabel = document.getElementById('hoverLabel');
    if (hoverLabel) {
        hoverLabel.textContent = 'Click any body part';
    }
}

function removeModal() {
    document.getElementById('locationModal')?.remove();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function toggleMenu() {
    document.querySelector('.nav')?.classList.toggle('active');
}
