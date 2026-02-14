/* HT-PRO Manager - Authentication Module */

// Function to handle login form submit
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnSubmit');
    const err = document.getElementById('errorMsg');

    // Reset UI
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    err.style.display = 'none';

    try {
        if (!sb.client) sb.init();

        const { data, error } = await sb.client.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Success
        location.href = 'admin.html';

    } catch (error) {
        console.error('Login error:', error);
        const errDiv = document.getElementById('errorMsg');
        const errText = document.getElementById('errorText');
        if (errDiv && errText) {
            errText.textContent = error.message.includes('Invalid login') ? 'Email atau password salah' : error.message;
            errDiv.classList.remove('hidden');
            errDiv.classList.add('visible');
        }
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

// Function to check session (used in admin.html)
async function checkSession() {
    if (!sb.client) sb.init();

    const { data: { session } } = await sb.client.auth.getSession();

    if (!session) {
        // Redirect to login if no session
        location.href = 'login.html';
    } else {
        // Optional: Update UI with user info
        console.log('Logged in as:', session.user.email);

        // Force Cloud Sync on Admin Load
        if (typeof sb.forceSync === 'function') {
            await sb.forceSync();
        }
    }
}

// Function to handle logout
async function handleLogout() {
    if (!sb.client) sb.init();

    const { error } = await sb.client.auth.signOut();
    if (!error) {
        location.href = 'login.html';
    } else {
        alert('Logout error: ' + error.message);
    }
}

// Auto-check session if on admin page (simple check based on URL)
if (window.location.pathname.includes('admin.html')) {
    checkSession();
}
