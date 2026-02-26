/* HT-PRO Manager - Settings Module */

// Update sidebar and header branding based on settings
function updateBranding() {
    const s = getSettings();
    const c = document.getElementById('sidebarLogoContainer');
    if (c) {
        if (s.logo) {
            c.innerHTML = `<img src="${s.logo}" style="width:auto;height:40px;margin-bottom:8px;object-fit:contain;display:block;margin-left:auto;margin-right:auto"><h2 style="font-size:1.1rem;margin:0">${s.bizName || 'HT-PRO'}</h2><p style="font-size:0.7rem;opacity:0.7;margin-top:2px">${s.bizTagline || 'Manajemen Sewa HT'}</p>`;
        } else {
            // Default with SVG icon
            c.innerHTML = `<h2><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align:middle;margin-right:4px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>${s.bizName || 'HT-PRO'}</h2><p>Manajemen Sewa HT</p>`;
        }
    }
    const brand = document.getElementById('headerBrand');
    if (brand) brand.innerHTML = '<strong>' + (s.bizName || 'HT-PRO Manager') + '</strong>';
}

function loadSettings() {
    const s = getSettings();
    updateBranding();

    // Fill forms if page is active
    if (document.getElementById('setBizName')) {
        document.getElementById('setBizName').value = s.bizName || '';
        document.getElementById('setBizPhone').value = s.bizPhone || '';
        document.getElementById('setBizEmail').value = s.bizEmail || '';
        document.getElementById('setBizAddress').value = s.bizAddress || '';
        document.getElementById('setReminderDays').value = s.reminderDays != null ? s.reminderDays : 1;
        if (s.logo) { document.getElementById('logoUpload').innerHTML = '<img src="' + s.logo + '">' }
    }
}

function saveSettings() {
    const s = getSettings();
    s.bizName = document.getElementById('setBizName').value.trim();
    s.bizPhone = document.getElementById('setBizPhone').value.trim();
    s.bizEmail = document.getElementById('setBizEmail').value.trim();
    s.bizAddress = document.getElementById('setBizAddress').value.trim();
    s.reminderDays = parseInt(document.getElementById('setReminderDays').value) || 1;
    saveSettingsData(s);
    updateBranding();
    showToast('Pengaturan disimpan');
}

function handleLogoUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        const s = getSettings(); s.logo = ev.target.result;
        saveSettingsData(s);
        document.getElementById('logoUpload').innerHTML = '<img src="' + ev.target.result + '">';
        updateBranding();
        showToast('Logo diperbarui')
    };
    r.readAsDataURL(f)
}

function backupData() {
    const data = { ht_units: getUnits(), bookings: getBookings(), app_settings: getSettings() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'htpro_backup_' + today() + '.json'; a.click(); showToast('Backup berhasil diunduh')
}

function restoreData(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const d = JSON.parse(ev.target.result); if (d.ht_units) saveUnits(d.ht_units); if (d.bookings) saveBookings(d.bookings); if (d.app_settings) saveSettingsData(d.app_settings); updateBranding(); showToast('Data berhasil di-restore'); navigateTo('dashboard') } catch (err) { showToast('File tidak valid', 'error') } }; r.readAsText(f); e.target.value = '' }

window.resetData = function () {
    console.log('Reset Data requested');
    // alert('Reset triggered'); // Debugging
    if (typeof showConfirm !== 'function') {
        alert('Error: showConfirm function missing');
        return;
    }
    showConfirm('Reset Data Program', 'Apakah Anda yakin ingin MENGHAPUS SEMUA DATA TRANSAKSI (Booking & Unit)?\n\nPengaturan (Nama toko, Logo) TIDAK akan dihapus.', () => {
        // Keep settings, only clear data
        localStorage.setItem('ht_units', '[]');
        localStorage.setItem('bookings', '[]');   // KEY BENAR: 'bookings' bukan 'ht_bookings'
        localStorage.setItem('ht_init', '1');

        showToast('Data Transaksi berhasil dihapus (Settings aman)');
        setTimeout(() => location.reload(), 1000);
    })
};
