// ===================================================================
// AI DOCTOR ANALYSIS - CONTACT.JS (Flask version)
// ===================================================================

document.getElementById('contactForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();
    
    // Hide previous messages
    document.getElementById('successMsg').style.display = 'none';
    document.getElementById('errorMsg').style.display = 'none';
    
    // Validate
    if (!name || !email || !message) {
        document.getElementById('errorMsg').textContent = 'Please fill in all fields.';
        document.getElementById('errorMsg').style.display = 'block';
        return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        document.getElementById('errorMsg').textContent = 'Please enter a valid email address.';
        document.getElementById('errorMsg').style.display = 'block';
        return false;
    }
    
    try {
        // Send to Flask backend
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, message })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('successMsg').textContent = result.message;
            document.getElementById('successMsg').style.display = 'block';
            document.getElementById('contactForm').reset();
            
            // Scroll to success message
            document.getElementById('successMsg').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            throw new Error(result.error || 'Failed to send message');
        }
    } catch (error) {
        document.getElementById('errorMsg').textContent = 'Error sending message: ' + error.message;
        document.getElementById('errorMsg').style.display = 'block';
    }
    
    return false;
});
