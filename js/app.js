/* HT-PRO Manager - Core Application */
/* Data layer, utilities, navigation */

/* ========== DATA LAYER ========== */
const KEYS = { units: 'ht_units', bookings: 'bookings', settings: 'app_settings' };
function getUnits() { return JSON.parse(localStorage.getItem(KEYS.units) || '[]') }
function saveUnits(d) {
    localStorage.setItem(KEYS.units, JSON.stringify(d));
    if (typeof sb !== 'undefined') sb.pushData('ht_units', d);
}
function getBookings() { return JSON.parse(localStorage.getItem(KEYS.bookings) || '[]') }
function saveBookings(d) {
    localStorage.setItem(KEYS.bookings, JSON.stringify(d));
    if (typeof sb !== 'undefined') sb.pushData('bookings', d);
}
function getSettings() { return JSON.parse(localStorage.getItem(KEYS.settings) || '{}'); }
function saveSettingsData(d) {
    localStorage.setItem(KEYS.settings, JSON.stringify(d));
    if (typeof sb !== 'undefined') sb.pushData('ht_settings', d);
}

/* ========== UTILITIES ========== */
const rupiah = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtDate = d => { if (!d) return '-'; const p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0] };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const diffDays = (a, b) => { const d1 = new Date(a), d2 = new Date(b); return Math.max(1, Math.round((d2 - d1) / (864e5)) + 1) };
const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const htColors = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#e11d48'];

function getAvailability(unitId, startStr, endStr, excludeBookingId = null) {
    const unit = getUnits().find(u => u.id === unitId);
    if (!unit) return { total: 0, available: 0 };
    const total = parseInt(unit.quantity) || 0;
    if (!startStr || !endStr) return { total, available: total };
    const bookings = getBookings().filter(b => b.ht_id === unitId && b.status_sewa === 'Aktif' && b.id !== excludeBookingId);
    if (bookings.length === 0) return { total, available: total };
    let minAvail = total;
    const s = new Date(startStr); const e = new Date(endStr);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const used = bookings.reduce((sum, b) => (b.tanggal_mulai <= dStr && b.tanggal_selesai >= dStr) ? sum + (parseInt(b.qty) || 1) : sum, 0);
        const avail = Math.max(0, total - used);
        if (avail < minAvail) minAvail = avail;
    }
    return { total, available: minAvail };
}

/* ========== TOAST ========== */
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = (type === 'success' ? ICO.check : type === 'error' ? ICO.x : ICO.info) + ' ' + msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100px)'; setTimeout(() => t.remove(), 300) }, 3000)
}

/* ========== CONFIRM ========== */
let confirmCb = null;
function showConfirm(title, msg, cb) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    confirmCb = cb;
    document.getElementById('confirmYes').onclick = () => { closeConfirm(); if (confirmCb) confirmCb() };
    document.getElementById('confirmDialog').classList.add('show')
}
function closeConfirm() { document.getElementById('confirmDialog').classList.remove('show') }

/* ========== MODAL ========== */
function openModal(id) { document.getElementById(id).classList.add('show') }
function closeModal(id) { document.getElementById(id).classList.remove('show') }

/* ========== NAVIGATION ========== */
function navigateTo(page) {
    localStorage.setItem('lastPage', page);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => { a.classList.toggle('active', a.dataset.page === page) });
    document.getElementById('sidebar').classList.remove('open');
    if (page === 'dashboard') renderDashboard();
    if (page === 'inventory') renderInventory();
    if (page === 'booking') renderBookings();
    if (page === 'calendar') renderCalendar();
    if (page === 'report') renderReport();
    if (page === 'settings') loadSettings();
}

/* ========== DEMO DATA ========== */
function seedDemo() {
    if (localStorage.getItem('ht_init')) return; // Skip if manually reset
    const units = getUnits();
    // Re-seed if no quantity
    if (units.length > 0 && units[0].quantity === undefined) {
        localStorage.removeItem(KEYS.units);
        localStorage.removeItem(KEYS.bookings);
    }
    if (getUnits().length > 0) return;

    const newUnits = [
        { id: 'u1', kode: '', nama: 'Motorola DP1400', merk: 'Motorola', model: 'DP1400', frekuensi: 'UHF 403-470MHz', kondisi: 'Baik', quantity: 10, harga_per_hari: 50000, harga_per_minggu: 300000, foto: '', catatan: 'Unit andalan', created_at: Date.now() },
        { id: 'u2', kode: '', nama: 'Kenwood TK-3000', merk: 'Kenwood', model: 'TK-3000', frekuensi: 'UHF 440-480MHz', kondisi: 'Baik', quantity: 8, harga_per_hari: 45000, harga_per_minggu: 270000, foto: '', catatan: '', created_at: Date.now() },
        { id: 'u3', kode: '', nama: 'Hytera PD-405', merk: 'Hytera', model: 'PD-405', frekuensi: 'UHF 400-470MHz', kondisi: 'Baik', quantity: 5, harga_per_hari: 60000, harga_per_minggu: 360000, foto: '', catatan: 'Digital', created_at: Date.now() },
        { id: 'u4', kode: '', nama: 'Icom IC-F3003', merk: 'Icom', model: 'IC-F3003', frekuensi: 'VHF 136-174MHz', kondisi: 'Baik', quantity: 12, harga_per_hari: 55000, harga_per_minggu: 330000, foto: '', catatan: '', created_at: Date.now() },
        { id: 'u5', kode: '', nama: 'Motorola GP-338', merk: 'Motorola', model: 'GP-338', frekuensi: 'UHF 403-470MHz', kondisi: 'Baik', quantity: 6, harga_per_hari: 70000, harga_per_minggu: 420000, foto: '', catatan: 'Premium', created_at: Date.now() }
    ];
    saveUnits(newUnits);

    const now = new Date(); const bks = [];
    const demoB = [
        { nama: 'Budi Santoso', hp: '081234567890', alamat: 'Jl. Merdeka 10', ht_id: 'u2', qty: 2, dur: 3, sb: 'Lunas', ss: 'Aktif', kep: 'Event outdoor', daysAgo: 1 },
        { nama: 'Siti Rahayu', hp: '082345678901', alamat: 'Jl. Sudirman 5', ht_id: 'u5', qty: 1, dur: 5, sb: 'DP', ss: 'Aktif', kep: 'Festival musik', daysAgo: 2 },
        { nama: 'Ahmad Fauzi', hp: '083456789012', alamat: 'Jl. Asia Afrika 20', ht_id: 'u1', qty: 5, dur: 2, sb: 'Lunas', ss: 'Selesai', kep: 'Keamanan parkir', daysAgo: 5 },
        { nama: 'Rina Wati', hp: '084567890123', alamat: 'Jl. Gatot Subroto 15', ht_id: 'u3', qty: 2, dur: 7, sb: 'Lunas', ss: 'Selesai', kep: 'Proyek konstruksi', daysAgo: 10 },
        { nama: 'Dedi Kurniawan', hp: '085678901234', alamat: 'Jl. Pahlawan 8', ht_id: 'u4', qty: 3, dur: 3, sb: 'Belum Bayar', ss: 'Selesai', kep: 'Acara wisuda', daysAgo: 15 }
    ];

    demoB.forEach((b, i) => {
        const unit = newUnits.find(u => u.id === b.ht_id);
        const start = new Date(now); start.setDate(start.getDate() - b.daysAgo);
        const end = new Date(start); end.setDate(end.getDate() + b.dur - 1);
        const total = b.dur >= 7 ? (Math.floor(b.dur / 7) * unit.harga_per_minggu + (b.dur % 7) * unit.harga_per_hari) : b.dur * unit.harga_per_hari;
        const grandTotal = total * b.qty;

        const sY = start.getFullYear(), sM = String(start.getMonth() + 1).padStart(2, '0'), sD = String(start.getDate()).padStart(2, '0');
        const eY = end.getFullYear(), eM = String(end.getMonth() + 1).padStart(2, '0'), eD = String(end.getDate()).padStart(2, '0');

        bks.push({
            id: 'b' + i,
            invoice_no: 'INV-' + sY + sM + sD + '-' + String(i + 1).padStart(3, '0'),
            nama_penyewa: b.nama,
            no_hp: b.hp,
            alamat: b.alamat,
            keperluan: b.kep,
            ht_id: b.ht_id,
            ht_kode: unit.nama,
            qty: b.qty,
            tanggal_mulai: sY + '-' + sM + '-' + sD,
            tanggal_selesai: eY + '-' + eM + '-' + eD,
            durasi_hari: b.dur,
            harga_per_hari: unit.harga_per_hari,
            total_harga: grandTotal,
            dp: b.sb === 'DP' ? grandTotal * 0.3 : (b.sb === 'Lunas' ? grandTotal : 0),
            sisa_bayar: b.sb === 'Lunas' ? 0 : (b.sb === 'DP' ? grandTotal * 0.7 : grandTotal),
            status_bayar: b.sb,
            status_sewa: b.ss,
            catatan: '',
            created_at: start.getTime()
        });
    });
    saveBookings(bks);

    saveSettingsData(settings);
}

window.insertDummyData = function () {
    const units = getUnits();
    if (units.length === 0) {
        // Fix: Force seedDemo by removing the init flag momentarily
        localStorage.removeItem('ht_init');
        seedDemo();
        showToast('Data awal (Unit & Booking) berhasil dibuat');
        setTimeout(() => location.reload(), 1000);
        return;
    }

    const bks = getBookings();
    const now = new Date();
    const newBookings = [];

    for (let i = 0; i < 5; i++) {
        const u = units[Math.floor(Math.random() * units.length)];
        const dur = Math.floor(Math.random() * 5) + 1;
        const daysAgo = Math.floor(Math.random() * 10);

        const start = new Date(now); start.setDate(start.getDate() - daysAgo + (Math.random() > 0.5 ? 2 : -2));
        const end = new Date(start); end.setDate(end.getDate() + dur);

        const total = dur >= 7 ? (Math.floor(dur / 7) * u.harga_per_minggu + (dur % 7) * u.harga_per_hari) : dur * u.harga_per_hari;

        const pad = (n) => String(n).padStart(2, '0');
        const sStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
        const eStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

        newBookings.push({
            id: 'b' + Date.now() + i,
            invoice_no: 'INV-DUMMY-' + Date.now().toString().slice(-4) + i,
            nama_penyewa: ['Ali', 'Budi', 'Citra', 'Dewi', 'Eko'][i] + ' (Dummy)',
            no_hp: '0812345678' + i,
            alamat: 'Jl. Dummy No. ' + i,
            keperluan: 'Test Data',
            ht_id: u.id,
            ht_kode: u.nama,
            qty: 1,
            tanggal_mulai: sStr,
            tanggal_selesai: eStr,
            durasi_hari: dur,
            harga_per_hari: u.harga_per_hari,
            total_harga: total,
            dp: 0,
            sisa_bayar: total,
            status_bayar: 'Belum Bayar',
            status_sewa: 'Aktif',
            catatan: 'Generated dummy data',
            created_at: Date.now()
        });
    }


    // Debug logging
    console.log('Generating dummy data...', newBookings);

    try {
        const updatedBookings = [...bks, ...newBookings];
        saveBookings(updatedBookings);
        console.log('Bookings saved:', updatedBookings.length);

        showToast('5 Data Dummy berhasil ditambahkan');

        // Force reload after a short delay to ensure storage is updated
        setTimeout(() => {
            console.log('Reloading page...');
            location.reload();
        }, 1000);
    } catch (e) {
        console.error('Error saving dummy data:', e);
        alert('Error: ' + e.message);
    }
}

function updateClock() {
    const d = new Date();
    const el = document.getElementById('headerDate');
    if (el) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        el.textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} • ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}
