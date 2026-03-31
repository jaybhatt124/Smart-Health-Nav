"""
MediFind - AI Doctor Analysis
SSIP Project 2024-25

Hospital search: fetches ALL hospitals nearby, then groups them
by specialty using comprehensive keyword matching on name + address.
Multispecialty hospitals appear in EVERY body part search.
"""

from flask import Flask, render_template, request, jsonify
import requests
import math

import os

app = Flask(__name__)
GEOAPIFY_API_KEY = os.environ.get('GEOAPIFY_API_KEY', 'be7be3e5dcfc48069a16d4813b1bf16d')

PRIORITY_HOSPITALS = []  # Removed hardcoded hospitals
MULTISPECIALTY_WORDS = [
    'safal', 'hope', 'medistar', 'sterling', 'apollo', 'shalby',
    'zydus', 'kiran', 'nirma', 'vedanta', 'narayana', 'manipal',
    'kokilaben', 'fortis', 'max', 'medanta', 'medicity',
    'multispecialt', 'multi specialt', 'super specialt',
    'superspecialt', 'multi-specialt',
    'general hospital', 'civil hospital', 'district hospital',
    'government hospital', 'govt hospital', 'municipal hospital',
    'medical college', 'medical center', 'medical centre',
    'institute of medical', 'hospital and research',
    'hospital & research', 'comprehensive',
]

SPECIALTIES = {
    'orthopedic': {
        'label': '🦴 Orthopedic & Bone Hospitals',
        'icon': '🦴',
        'keywords': [
            'ortho','orthopedic','orthopaedic','orthopedics','orthopaedics',
            'bone','bones','joint','joints','fracture','spine','spinal',
            'disc','lumbar','cervical','scolio','arthroplasty','arthritis',
            'ligament','tendon','musculo','skeletal','trauma center',
            'sports medicine','sports injury','hand surgery','knee surgery',
            'shoulder surgery','hip replacement','total knee','total hip',
        ],
    },
    'physio': {
        'label': '💪 Physiotherapy & Rehabilitation',
        'icon': '💪',
        'keywords': [
            'physio','physiotherapy','physiotherapist','physiother',
            'rehab','rehabilitation','sport rehab','sports rehab',
            'musculoskeletal','chiro','chiropractic','occupational therapy',
        ],
    },
    'neurology': {
        'label': '🧠 Neurology & Brain Hospitals',
        'icon': '🧠',
        'keywords': [
            'neuro','neurology','neurological','neurologist',
            'neurosurg','neuroscience','brain','stroke','cranio',
            'epilepsy','parkinson','alzheimer',
        ],
    },
    'ent': {
        'label': '👂 ENT (Ear, Nose & Throat)',
        'icon': '👂',
        'keywords': [
            'ent','ear','nose','throat','sinus','tonsil',
            'otolaryngology','audiolog','hearing','rhinology',
            'laryngology','thyroid',
        ],
    },
    'ophthalmology': {
        'label': '👁️ Eye Hospitals',
        'icon': '👁️',
        'keywords': [
            'eye','ophthalm','vision','retina','cataract','lasik',
            'glaucoma','netralaya','drishti','ocular','vitreo',
        ],
    },
    'cardiology': {
        'label': '❤️ Cardiology & Heart Hospitals',
        'icon': '❤️',
        'keywords': [
            'cardio','cardiac','cardiology','cardiologist',
            'heart','cardiovascular','angioplasty','bypass',
            'pacemaker','coronary',
        ],
    },
    'pulmonology': {
        'label': '🫁 Pulmonology & Chest Hospitals',
        'icon': '🫁',
        'keywords': [
            'pulmo','pulmonary','pulmonologist','lung','lungs',
            'chest hospital','respiratory','asthma clinic','tb hospital',
            'tuberculosis','broncho','thoracic',
        ],
    },
    'gastro': {
        'label': '🫃 Gastroenterology Hospitals',
        'icon': '🫃',
        'keywords': [
            'gastro','gastroenterology','gastroenterologist',
            'digestive','intestine','bowel','colon','colonoscopy',
            'endoscopy','abdominal','gastric',
        ],
    },
    'liver': {
        'label': '🫀 Liver & Hepatology',
        'icon': '🫀',
        'keywords': [
            'liver','hepato','hepatology','hepatologist',
            'pancrea','bile','jaundice','cirrhosis','liver transplant',
        ],
    },
    'oncology': {
        'label': '🎗️ Cancer & Oncology',
        'icon': '🎗️',
        'keywords': [
            'onco','oncology','oncologist','cancer','tumour','tumor',
            'radiotherapy','chemotherapy','radiation','haematology',
        ],
    },
    'nephrology': {
        'label': '🫘 Kidney & Nephrology',
        'icon': '🫘',
        'keywords': [
            'nephro','nephrology','nephrologist','kidney','renal',
            'dialysis','urology','urologist','urinary',
        ],
    },
    'endocrinology': {
        'label': '💊 Diabetes & Endocrinology',
        'icon': '💊',
        'keywords': [
            'endocrin','endocrinology','diabetes','diabetology',
            'diabetologist','hormone','insulin','bariatric',
        ],
    },
    'dermatology': {
        'label': '🧴 Skin & Dermatology',
        'icon': '🧴',
        'keywords': [
            'derma','dermatology','dermatologist','skin clinic',
            'cosmet','cosmetic','hair clinic','trichology',
        ],
    },
    'psychiatry': {
        'label': '🧘 Psychiatry & Mental Health',
        'icon': '🧘',
        'keywords': [
            'psychiatr','psychology','mental health','mental hospital',
            'de-addiction','addiction','counselling','counseling',
        ],
    },
    'general': {
        'label': '🏥 General Medicine',
        'icon': '🏥',
        'keywords': [
            'general medicine','general physician','family medicine',
            'primary care','polyclinic','nursing home',
        ],
    },
}

BODY_PART_SPECIALTIES = {
    'head':      ['neurology', 'ent', 'ophthalmology', 'psychiatry'],
    'neck':      ['ent', 'neurology', 'orthopedic'],
    'chest':     ['cardiology', 'pulmonology'],
    'stomach':   ['gastro', 'liver'],
    'shoulders': ['orthopedic', 'physio'],
    'arms':      ['orthopedic', 'physio'],
    'back':      ['orthopedic', 'neurology', 'physio'],
    'knees':     ['orthopedic', 'physio'],
    'legs':      ['orthopedic', 'physio'],
    'feet':      ['orthopedic', 'physio'],
}

ILLNESS_SPECIALTIES = {
    'fever':         ['general'],
    'cough':         ['pulmonology', 'ent'],
    'cold':          ['ent', 'general'],
    'diarrhea':      ['gastro'],
    'cancer':        ['oncology'],
    'heart_disease': ['cardiology'],
    'bp':            ['cardiology', 'general'],
    'diabetes':      ['endocrinology'],
    'asthma':        ['pulmonology'],
    'kidney':        ['nephrology'],
    'skin':          ['dermatology'],
    'eye':           ['ophthalmology'],
}

COMMON_ILLNESSES = {
    'fever':         {'icon': '🌡️', 'label': 'Fever'},
    'cough':         {'icon': '😷', 'label': 'Cough'},
    'cold':          {'icon': '🤧', 'label': 'Cold & Flu'},
    'diarrhea':      {'icon': '🚽', 'label': 'Diarrhea'},
    'cancer':        {'icon': '🎗️', 'label': 'Cancer'},
    'heart_disease': {'icon': '❤️',  'label': 'Heart Disease'},
    'bp':            {'icon': '💉', 'label': 'High BP'},
    'diabetes':      {'icon': '💊', 'label': 'Diabetes'},
    'asthma':        {'icon': '🫁', 'label': 'Asthma'},
    'kidney':        {'icon': '🫘', 'label': 'Kidney Issues'},
    'skin':          {'icon': '🧴', 'label': 'Skin Problems'},
    'eye':           {'icon': '👁️', 'label': 'Eye Problems'},
}

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng/2)**2)
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)), 2)

def is_multispecialty(name, address=''):
    text = (name + ' ' + address).lower()
    return any(w in text for w in MULTISPECIALTY_WORDS)

def get_specialty_score(name, address, specialty_id):
    text = (name + ' ' + address).lower()
    return sum(1 for kw in SPECIALTIES[specialty_id]['keywords'] if kw in text)

def classify_hospital(hospital, needed_specialties):
    name = hospital['name']
    address = hospital['address']
    matched = []
    for spec_id in needed_specialties:
        score = get_specialty_score(name, address, spec_id)
        if score > 0:
            matched.append((spec_id, score))
    matched.sort(key=lambda x: -x[1])
    return [m[0] for m in matched]

def get_priority_hospitals(user_lat, user_lng, radius_meters):
    curated = []
    for hospital in PRIORITY_HOSPITALS:
        distance = calculate_distance(user_lat, user_lng, hospital['lat'], hospital['lng'])
        if distance <= radius_meters / 1000:
            curated.append({
                'name': hospital['name'],
                'address': hospital['address'],
                'lat': hospital['lat'],
                'lng': hospital['lng'],
                'distance': distance,
                'type': hospital['type'],
                'place_id': f"priority:{hospital['name'].lower()}",
                'popularity': 10.0,
                'display_rating': 4.8,
                'priority_rank': 2,
                'source': 'curated',
            })
    return curated

def trim_groups(groups, limit):
    remaining = max(limit, 0)
    trimmed = []

    for group in groups:
        if remaining <= 0:
            break

        hospitals = group.get('hospitals', [])[:remaining]
        if not hospitals:
            continue

        trimmed.append({
            **group,
            'hospitals': hospitals,
        })
        remaining -= len(hospitals)

    return trimmed

@app.route('/')
def index():
    return render_template('index.html', illnesses=COMMON_ILLNESSES)

@app.route('/hospitals')
def hospitals():
    return render_template('hospitals.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/tips')
def tips():
    return render_template('tips.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/api/search-hospitals', methods=['POST'])
def search_hospitals():
    try:
        data         = request.get_json()
        body_part    = data.get('body_part', '').lower().strip()
        illness_type = data.get('illness_type', '').lower().strip()
        user_lat     = float(data.get('lat', 0))
        user_lng     = float(data.get('lng', 0))
        radius       = int(data.get('radius', 5000))
        limit        = int(data.get('limit', 30))

        if not user_lat or not user_lng:
            return jsonify({'error': 'Missing location'}), 400

        if illness_type and illness_type in ILLNESS_SPECIALTIES:
            needed_specialties = ILLNESS_SPECIALTIES[illness_type]
            search_label = COMMON_ILLNESSES.get(illness_type, {}).get('label', illness_type.title())
        elif body_part and body_part in BODY_PART_SPECIALTIES:
            needed_specialties = BODY_PART_SPECIALTIES[body_part]
            search_label = body_part.title()
        else:
            needed_specialties = ['general']
            search_label = 'General'

        print(f"\n{'='*55}")
        print(f"Search: {search_label} | specialties: {needed_specialties}")
        print(f"Location: {user_lat},{user_lng} | radius: {radius}m")

        raw = get_priority_hospitals(user_lat, user_lng, radius)

        resp = requests.get(
            'https://api.geoapify.com/v2/places',
            params={
                'categories': 'healthcare.hospital,healthcare.clinic_or_praxis,healthcare',
                'filter': f'circle:{user_lng},{user_lat},{radius}',
                'bias': f'proximity:{user_lng},{user_lat}',
                'limit': 50,
                'apiKey': GEOAPIFY_API_KEY,
            },
            timeout=15
        )

        if resp.status_code == 200:
            for place in resp.json().get('features', []):
                props  = place.get('properties', {})
                coords = place.get('geometry', {}).get('coordinates', [])
                if len(coords) < 2:
                    continue
                name    = props.get('name') or props.get('address_line1') or 'Healthcare Facility'
                address = props.get('formatted') or props.get('address_line2') or ''
                cats    = props.get('categories', [])
                ptype   = ('Hospital' if 'healthcare.hospital' in cats
                           else 'Clinic' if 'healthcare.clinic_or_praxis' in cats
                           else 'Healthcare')
                dist = calculate_distance(user_lat, user_lng, coords[1], coords[0])

                # Geoapify rank object: popularity (log-scale ~0-9) and importance (0-1)
                rank       = props.get('rank', {})
                popularity = float(rank.get('popularity', 0) or 0)
                importance = float(rank.get('importance', 0) or 0)

                # Normalize to 1.0-5.0 display rating
                if popularity > 0:
                    display_rating = round(1.0 + (min(popularity, 9.0) / 9.0) * 4.0, 1)
                elif importance > 0:
                    display_rating = round(1.0 + importance * 4.0, 1)
                else:
                    display_rating = 0  # No data

                raw.append({
                    'name': name, 'address': address,
                    'lat': coords[1], 'lng': coords[0],
                    'distance': dist, 'type': ptype,
                    'place_id': props.get('place_id', ''),
                    'popularity': popularity,
                    'display_rating': display_rating,
                    'priority_rank': 0,
                    'source': 'geoapify',
                })

        print(f"Geoapify: {len(raw)} places")

        multi_bucket = []
        spec_buckets = {s: [] for s in needed_specialties}
        unmatched    = []
        seen         = set()

        # Sort raw by popularity desc first, then distance as tiebreaker
        for h in sorted(raw, key=lambda x: (-x.get('priority_rank', 0), -x.get('popularity', 0), x['distance'])):
            uid = f"{h.get('name', '').strip().lower()}|{h.get('address', '').strip().lower()}"
            if uid in seen:
                continue
            seen.add(uid)

            if is_multispecialty(h['name'], h['address']):
                h['specialty_label'] = '⭐ Multispecialty'
                multi_bucket.append(h)
                continue

            matched_specs = classify_hospital(h, needed_specialties)
            if matched_specs:
                primary = matched_specs[0]
                spec_info = SPECIALTIES.get(primary, {})
                h['specialty_label'] = spec_info.get('label', primary)
                spec_buckets[primary].append(h)
            else:
                h['specialty_label'] = '🏥 General'
                unmatched.append(h)

        groups = []

        if multi_bucket:
            groups.append({
                'id': 'multispecialty',
                'label': '⭐ Multispecialty Hospitals',
                'icon': '⭐',
                'hospitals': multi_bucket
            })

        for spec_id in needed_specialties:
            bucket = spec_buckets.get(spec_id, [])
            if bucket:
                spec = SPECIALTIES.get(spec_id, {})
                groups.append({
                    'id': spec_id,
                    'label': spec.get('label', spec_id.title()),
                    'icon': spec.get('icon', '🏥'),
                    'hospitals': bucket
                })

        # Only add general fallback if NO specialty results at all
        total_specialty = sum(len(g['hospitals']) for g in groups)
        if total_specialty == 0 and unmatched:
            groups.append({
                'id': 'general',
                'label': '🏥 Hospitals Nearby',
                'icon': '🏥',
                'hospitals': unmatched[:15]
            })

        groups = trim_groups(groups, limit)
        total = sum(len(g['hospitals']) for g in groups)
        print(f"Groups: {[(g['id'], len(g['hospitals'])) for g in groups]}")

        return jsonify({
            'success': True,
            'groups': groups,
            'total': total,
            'search_label': search_label,
            'radius_km': radius / 1000,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/geocode', methods=['POST'])
def geocode_address():
    try:
        address = request.get_json().get('address', '')
        if not address:
            return jsonify({'error': 'Address required'}), 400
        resp = requests.get(
            'https://api.geoapify.com/v1/geocode/search',
            params={
                'text': address,
                'limit': 1,
                'filter': 'countrycode:in',
                'bias': 'countrycode:in',
                'apiKey': GEOAPIFY_API_KEY,
            },
            timeout=10
        )
        if resp.status_code == 200:
            features = resp.json().get('features', [])
            if features:
                f = features[0]
                coords = f['geometry']['coordinates']
                return jsonify({
                    'success': True,
                    'lat': coords[1], 'lng': coords[0],
                    'formatted_address': f['properties'].get('formatted', address)
                })
        return jsonify({'error': 'Address not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/reverse-geocode', methods=['POST'])
def reverse_geocode():
    try:
        data = request.get_json() or {}
        lat = float(data.get('lat', 0))
        lng = float(data.get('lng', 0))

        if not lat or not lng:
            return jsonify({'error': 'Latitude and longitude required'}), 400

        resp = requests.get(
            'https://api.geoapify.com/v1/geocode/reverse',
            params={
                'lat': lat,
                'lon': lng,
                'format': 'json',
                'apiKey': GEOAPIFY_API_KEY,
            },
            timeout=10
        )

        if resp.status_code == 200:
            results = resp.json().get('results', [])
            if results:
                result = results[0]
                return jsonify({
                    'success': True,
                    'formatted_address': result.get('formatted') or result.get('city') or result.get('state') or f'{lat}, {lng}',
                    'city': result.get('city', ''),
                    'state': result.get('state', ''),
                    'country': result.get('country', ''),
                })

        return jsonify({'error': 'Location name not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/contact', methods=['POST'])
def submit_contact():
    try:
        data = request.get_json()
        print(f"Contact: {data.get('name')} ({data.get('email')})")
        return jsonify({'success': True, 'message': 'Thank you!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("="*55)
    print("🏥 MediFind — Specialty Grouped Hospital Search")
    print("🌐 Open: http://localhost:5000")
    print("="*55)
    app.run(debug=False, host='0.0.0.0', port=5000)
