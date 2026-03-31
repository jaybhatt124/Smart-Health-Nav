// ===================================================================
// MEDIFIND — MAIN.JS
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    const bodyParts    = document.querySelectorAll('.body-part');
    const illnessCards = document.querySelectorAll('.illness-card');
    const hoverLabel   = document.getElementById('hoverLabel');

    // ── Body part hover + click ──────────────────────────────────
    if (bodyParts.length && hoverLabel) {
        bodyParts.forEach(part => {
            part.addEventListener('mouseenter', () => {
                hoverLabel.textContent = part.dataset.name;
                document.querySelectorAll(`[data-part="${part.dataset.part}"]`).forEach(p => {
                    p.style.fill        = 'rgba(59,130,246,0.45)';
                    p.style.stroke      = '#60a5fa';
                    p.style.strokeWidth = '1.5';
                });
            });
            part.addEventListener('mouseleave', () => {
                hoverLabel.textContent = 'Click any body part';
                document.querySelectorAll(`[data-part="${part.dataset.part}"]`).forEach(p => {
                    p.style.fill        = 'transparent';
                    p.style.stroke      = '';
                    p.style.strokeWidth = '';
                });
            });
            part.addEventListener('click', () => {
                hoverLabel.textContent = '📍 Getting your location...';
                getLocationAndNavigate('body_part', part.dataset.part, part.dataset.name);
            });
        });
    }

    // ── Illness cards ────────────────────────────────────────────
    illnessCards.forEach(card => {
        card.addEventListener('click', () => {
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.style.transform = '', 180);
            getLocationAndNavigate('illness', card.dataset.illness, card.dataset.name);
        });
    });
});

// ===================================================================
// LOCATION — Step 1: try browser GPS
//            Step 2: if denied/failed → Geoapify IP location (accurate)
//            Step 3: if all fail → manual input modal
// ===================================================================

function getLocationAndNavigate(searchType, searchValue, displayName) {
    showOverlay('📍 Detecting your location...');

    if (!navigator.geolocation) {
        // No GPS support at all — go straight to IP location
        tryIPLocation(searchType, searchValue, displayName);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // ✅ GPS SUCCESS
        (position) => {
            const lat      = position.coords.latitude;
            const lng      = position.coords.longitude;
            const accuracy = position.coords.accuracy; // metres
            console.log('GPS success:', lat, lng, '± ' + accuracy + 'm');

            hideOverlay();

            // If accuracy is worse than 10km it's likely ISP/IP based — confirm with user
            if (accuracy > 10000) {
                showConfirmModal(searchType, searchValue, displayName, lat, lng, Math.round(accuracy));
            } else {
                navigateTo(searchType, searchValue, displayName, lat, lng);
            }
        },

        // ❌ GPS FAILED — use Geoapify IP geolocation
        (error) => {
            console.warn('GPS failed (code ' + error.code + ') — trying IP location');
            showOverlay('📡 Using IP location...');
            tryIPLocation(searchType, searchValue, displayName);
        },

        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
        }
    );
}

// ===================================================================
// STEP 2: Geoapify IP-based geolocation
// More accurate than other IP services for Indian cities
// ===================================================================

async function tryIPLocation(searchType, searchValue, displayName) {
    try {
        // Geoapify IP geolocation — uses your actual network location
        const res  = await fetch(
            'https://api.geoapify.com/v1/ipinfo?apiKey=be7be3e5dcfc48069a16d4813b1bf16d',
            { signal: AbortSignal.timeout(6000) }
        );
        const data = await res.json();

        console.log('IP location response:', data);

        const lat  = data?.location?.latitude;
        const lng  = data?.location?.longitude;
        const city = data?.city?.name || '';

        if (lat && lng) {
            hideOverlay();
            console.log('IP location:', lat, lng, city);
            // Always show confirm for IP location so user can correct if wrong
            showConfirmModal(searchType, searchValue, displayName, lat, lng, null, city);
            return;
        }
    } catch (e) {
        console.warn('Geoapify IP location failed:', e.message);
    }

    // All automatic methods failed
    hideOverlay();
    showManualModal(searchType, searchValue, displayName,
        'Could not detect your location automatically.');
}

// ===================================================================
// CONFIRM MODAL — shown for IP location or low-accuracy GPS
// User sees detected city and can confirm or type their own
// ===================================================================

function showConfirmModal(searchType, searchValue, displayName, lat, lng, accuracyM, city) {
    removeModal();

    const cityLine = city
        ? '<strong style="color:#06b6d4">' + city + '</strong>'
        : lat.toFixed(4) + ', ' + lng.toFixed(4);

    const accuracyNote = accuracyM
        ? 'GPS accuracy: ±' + accuracyM + 'm (low)'
        : 'Detected via IP location';

    const modal = document.createElement('div');
    modal.id    = 'locationModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);' +
        'backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML =
        '<div style="background:#111827;border:1px solid rgba(255,255,255,0.12);border-radius:20px;' +
        'padding:2rem;max-width:420px;width:100%;font-family:\'DM Sans\',sans-serif;color:#f1f5f9;">' +

            '<div style="font-size:2rem;text-align:center;margin-bottom:0.75rem;">📍</div>' +
            '<h3 style="font-family:\'Syne\',sans-serif;font-size:1.1rem;font-weight:700;' +
                'text-align:center;margin-bottom:0.5rem;">Is this your location?</h3>' +

            '<div style="background:#1a2235;border:1px solid rgba(255,255,255,0.08);' +
                'border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:center;">' +
                '<div style="font-size:1.1rem;margin-bottom:4px;">' + cityLine + '</div>' +
                '<div style="font-size:0.72rem;color:#64748b;">' + accuracyNote + '</div>' +
                '<a href="https://maps.google.com/?q=' + lat + ',' + lng + '" target="_blank" ' +
                    'style="font-size:0.75rem;color:#3b82f6;text-decoration:none;display:inline-block;margin-top:6px;">' +
                    '🗺️ Verify on Google Maps</a>' +
            '</div>' +

            '<button id="confirmYes" style="width:100%;padding:11px;margin-bottom:0.75rem;' +
                'background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:12px;' +
                'color:white;cursor:pointer;font-weight:600;font-size:0.9rem;">' +
                '✅ Yes, find hospitals here' +
            '</button>' +

            '<div style="text-align:center;color:#475569;font-size:0.75rem;margin-bottom:0.75rem;">' +
                '— or enter correct location —' +
            '</div>' +

            '<input id="manualAddress" placeholder="Type your city e.g. Himmatnagar, Vadodara..." ' +
                'style="width:100%;padding:11px 14px;background:#1a2235;' +
                'border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f1f5f9;' +
                'font-size:0.88rem;outline:none;margin-bottom:0.75rem;font-family:\'DM Sans\',sans-serif;"/>' +

            '<button id="confirmSearch" style="width:100%;padding:11px;' +
                'background:linear-gradient(135deg,#3b82f6,#06b6d4);border:none;border-radius:12px;' +
                'color:white;cursor:pointer;font-weight:600;font-size:0.9rem;">' +
                '🔍 Search with typed location' +
            '</button>' +

        '</div>';

    document.body.appendChild(modal);

    document.getElementById('confirmYes').onclick = function() {
        removeModal();
        navigateTo(searchType, searchValue, displayName, lat, lng);
    };
    document.getElementById('confirmSearch').onclick = function() {
        geocodeAndNavigate(searchType, searchValue, displayName);
    };
    document.getElementById('manualAddress').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') geocodeAndNavigate(searchType, searchValue, displayName);
    });

    setTimeout(() => document.getElementById('manualAddress')?.focus(), 200);
}

// ===================================================================
// MANUAL MODAL — GPS fully failed
// ===================================================================

function showManualModal(searchType, searchValue, displayName, reason) {
    removeModal();

    const modal = document.createElement('div');
    modal.id    = 'locationModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);' +
        'backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML =
        '<div style="background:#111827;border:1px solid rgba(255,255,255,0.12);border-radius:20px;' +
        'padding:2rem;max-width:420px;width:100%;font-family:\'DM Sans\',sans-serif;color:#f1f5f9;">' +

            '<div style="font-size:2.5rem;text-align:center;margin-bottom:1rem;">📍</div>' +
            '<h3 style="font-family:\'Syne\',sans-serif;font-size:1.1rem;font-weight:700;' +
                'text-align:center;margin-bottom:0.5rem;">Enter Your Location</h3>' +
            '<p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-bottom:1.25rem;">' +
                reason + '<br><br>' +
                'Type your city, area or pincode:' +
            '</p>' +

            '<input id="manualAddress" placeholder="e.g. Himmatnagar, Vadodara, 388001..." ' +
                'style="width:100%;padding:12px 16px;background:#1a2235;' +
                'border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f1f5f9;' +
                'font-size:0.9rem;outline:none;margin-bottom:1rem;font-family:\'DM Sans\',sans-serif;"/>' +

            '<div style="display:flex;gap:0.75rem;">' +
                '<button id="cancelBtn" style="flex:1;padding:12px;background:#1a2235;' +
                    'border:1px solid rgba(255,255,255,0.1);border-radius:12px;' +
                    'color:#94a3b8;cursor:pointer;font-size:0.875rem;">Cancel</button>' +
                '<button id="searchBtn" style="flex:2;padding:12px;' +
                    'background:linear-gradient(135deg,#3b82f6,#06b6d4);border:none;' +
                    'border-radius:12px;color:white;cursor:pointer;font-weight:600;font-size:0.875rem;">' +
                    '🔍 Find Hospitals</button>' +
            '</div>' +

            '<p style="text-align:center;margin-top:1rem;font-size:0.72rem;color:#475569;">' +
                '💡 For auto GPS: Chrome address bar → 🔒 → Site settings → Location → Allow' +
            '</p>' +

        '</div>';

    document.body.appendChild(modal);

    document.getElementById('cancelBtn').onclick  = removeModal;
    document.getElementById('searchBtn').onclick  = function() {
        geocodeAndNavigate(searchType, searchValue, displayName);
    };
    document.getElementById('manualAddress').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') geocodeAndNavigate(searchType, searchValue, displayName);
    });

    setTimeout(() => document.getElementById('manualAddress')?.focus(), 100);
}

// ===================================================================
// GEOCODE typed address → navigate
// ===================================================================

async function geocodeAndNavigate(searchType, searchValue, displayName) {
    const input   = document.getElementById('manualAddress');
    const address = input?.value?.trim();
    if (!address) { if (input) input.style.borderColor = '#ef4444'; return; }

    const btn = document.getElementById('confirmSearch') || document.getElementById('searchBtn');
    if (btn) { btn.textContent = '🔄 Searching...'; btn.disabled = true; }

    try {
        const res  = await fetch('/api/geocode', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ address: address })
        });
        const data = await res.json();

        if (data.success) {
            removeModal();
            navigateTo(searchType, searchValue, displayName, data.lat, data.lng);
        } else {
            throw new Error(data.error || 'Not found');
        }
    } catch (err) {
        if (btn) { btn.textContent = '🔍 Find Hospitals'; btn.disabled = false; }
        if (input) {
            input.style.borderColor = '#ef4444';
            input.placeholder = '⚠️ Not found — try another city name';
            input.value = '';
        }
    }
}

// ===================================================================
// NAVIGATE to hospitals page
// ===================================================================

function navigateTo(searchType, searchValue, displayName, lat, lng) {
    let url = '/hospitals?lat=' + lat + '&lng=' + lng +
              '&name=' + encodeURIComponent(displayName);
    url += searchType === 'illness'
        ? '&illness_type=' + encodeURIComponent(searchValue)
        : '&part='         + encodeURIComponent(searchValue);
    console.log('→ Navigating:', url);
    window.location.href = url;
}

// ===================================================================
// OVERLAY + MODAL HELPERS
// ===================================================================

function showOverlay(msg) {
    document.querySelectorAll('.body-part').forEach(p  => p.style.pointerEvents = 'none');
    document.querySelectorAll('.illness-card').forEach(c => c.style.pointerEvents = 'none');
    const ov = document.getElementById('locationOverlay');
    if (ov) {
        ov.style.display = 'flex';
        const t = ov.querySelector('.loc-text');
        if (t && msg) t.textContent = msg;
    }
}

function hideOverlay() {
    document.querySelectorAll('.body-part').forEach(p  => p.style.pointerEvents = '');
    document.querySelectorAll('.illness-card').forEach(c => c.style.pointerEvents = '');
    const ov = document.getElementById('locationOverlay');
    if (ov) ov.style.display = 'none';
    const hl = document.getElementById('hoverLabel');
    if (hl) hl.textContent = 'Click any body part';
}

function removeModal() {
    document.getElementById('locationModal')?.remove();
}

function toggleMenu() {
    document.querySelector('.nav')?.classList.toggle('active');
}
