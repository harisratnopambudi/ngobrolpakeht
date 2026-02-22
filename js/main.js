/* HT-PRO Manager - Main Entry Point */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('HT-PRO Manager Starting...');

    // One-time Purge of Demo Data
    if (!localStorage.getItem('ht_purged_v1')) {
        console.log('☁ Purging demo data for clean start...');
        localStorage.setItem('ht_units', '[]');
        localStorage.setItem('bookings', '[]');
        localStorage.setItem('ht_purged_v1', '1');
        // Wait for Supabase to init then push empty
        setTimeout(async () => {
            if (typeof sb !== 'undefined' && sb.client) {
                await sb.syncUp(true);
                console.log('☁ Cloud purged.');
                if (typeof navigateTo === 'function') navigateTo(localStorage.getItem('lastPage') || 'dashboard');
            }
        }, 2000);
    }


    // Initialize Calendar
    try {
        if (typeof initCal === 'function') initCal();
    } catch (e) { console.error('Calendar Init Failed:', e); }

    // Update Branding (Logo & Name) based on Settings
    try {
        if (typeof updateBranding === 'function') updateBranding();
    } catch (e) { console.error('Branding Update Failed:', e); }

    // Start Clock
    try {
        if (typeof updateClock === 'function') { updateClock(); setInterval(updateClock, 60000); }
    } catch (e) { console.error('Clock Init Failed:', e); }

    // Load last page
    const lastPage = localStorage.getItem('lastPage') || 'dashboard';
    try {
        if (typeof navigateTo === 'function') navigateTo(lastPage);
        else console.error('navigateTo function missing!');
    } catch (e) {
        console.error('Navigation Failed:', e);
        alert('Gagal memuat aplikasi. Mohon refresh atau cek konsol browser.');
    }
});
