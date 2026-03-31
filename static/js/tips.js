// ===================================================================
// AI DOCTOR ANALYSIS - TIPS.JS
// Health tips display
// ===================================================================

const HEALTH_TIPS = {
    home_care: [
        { icon: '💧', title: 'Stay Hydrated', desc: 'Drink 8-10 glasses of water daily to keep your body functioning optimally.' },
        { icon: '🏃', title: 'Regular Exercise', desc: 'At least 30 minutes of physical activity daily improves overall health.' },
        { icon: '😴', title: 'Quality Sleep', desc: '7-8 hours of sleep helps body repair and boosts immunity.' },
        { icon: '🧘', title: 'Manage Stress', desc: 'Practice meditation or deep breathing for 10 minutes daily.' },
        { icon: '🧼', title: 'Hand Hygiene', desc: 'Wash hands regularly with soap for at least 20 seconds.' },
        { icon: '🌞', title: 'Vitamin D', desc: 'Get 15-20 minutes of sunlight daily for vitamin D synthesis.' }
    ],
    medicine_safety: [
        { icon: '⚠️', title: 'No Self-Medication', desc: 'Always consult a doctor before taking any medicine.' },
        { icon: '📅', title: 'Check Expiry Dates', desc: 'Never use expired medications - they can be harmful.' },
        { icon: '💊', title: 'Right Dosage', desc: 'Take medicines only in prescribed dosages.' },
        { icon: '🔒', title: 'Safe Storage', desc: 'Store medicines in cool, dry place away from children.' },
        { icon: '⏰', title: 'Timely Intake', desc: 'Take medicines at prescribed times for best results.' },
        { icon: '📝', title: 'Read Labels', desc: 'Always read medicine labels and instructions carefully.' }
    ],
    nutrition: [
        { icon: '🥗', title: 'Balanced Diet', desc: 'Include fruits, vegetables, proteins, and whole grains daily.' },
        { icon: '🚫', title: 'Reduce Processed Foods', desc: 'Limit junk food, sodas, and processed snacks.' },
        { icon: '🥦', title: 'Eat Vegetables', desc: 'Aim for at least 5 servings of vegetables per day.' },
        { icon: '🍎', title: 'Fresh Fruits', desc: 'Include 2-3 servings of fresh fruits daily.' }
    ],
    fitness: [
        { icon: '🤸', title: 'Morning Stretching', desc: 'Start your day with 10 minutes of stretching exercises.' },
        { icon: '👟', title: 'Walk 10,000 Steps', desc: 'Aim for 10,000 steps daily for cardiovascular health.' },
        { icon: '💪', title: 'Strength Training', desc: 'Include strength exercises 2-3 times per week.' }
    ],
    mental_health: [
        { icon: '🧘', title: 'Meditation', desc: 'Practice mindfulness meditation for mental clarity.' },
        { icon: '👥', title: 'Social Connections', desc: 'Maintain healthy relationships with family and friends.' },
        { icon: '📖', title: 'Learn New Things', desc: 'Keep your mind active by learning new skills.' }
    ]
};

const CATEGORY_LABELS = {
    home_care: '🏠 Home Care',
    medicine_safety: '💊 Medicine Safety',
    nutrition: '🥗 Nutrition',
    fitness: '🏋️ Fitness',
    mental_health: '🧠 Mental Health'
};

function loadTips() {
    const container = document.getElementById('tipsContainer');
    
    let html = '';
    Object.entries(HEALTH_TIPS).forEach(([category, tips]) => {
        html += `
            <div class="tips-category">
                <h2>${CATEGORY_LABELS[category]}</h2>
                <div class="tips-grid">
        `;
        
        tips.forEach(tip => {
            html += `
                <div class="tip-card">
                    <div class="tip-icon">${tip.icon}</div>
                    <h3>${tip.title}</h3>
                    <p>${tip.desc}</p>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load tips on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTips);
} else {
    loadTips();
}
