/* HT-PRO Manager - Main Entry Point */

document.addEventListener('DOMContentLoaded', () => {
    console.log('HT-PRO Manager Starting...');

    // Initial data seed
    try {
        if (typeof seedDemo === 'function') seedDemo();
    } catch (e) { console.error('Seed Demo Failed:', e); }

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
