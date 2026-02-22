/* HT-PRO Manager - Core Application */
/* Data layer, utilities, navigation */

/* ========== DATA LAYER ========== */
const KEYS = { units: 'ht_units', bookings: 'bookings', settings: 'app_settings' };
function getUnits() { return JSON.parse(localStorage.getItem(KEYS.units) || '[]') }
function saveUnits(d) { localStorage.setItem(KEYS.units, JSON.stringify(d)) }
function getBookings() { return JSON.parse(localStorage.getItem(KEYS.bookings) || '[]') }
function saveBookings(d) { localStorage.setItem(KEYS.bookings, JSON.stringify(d)) }
function getSettings() { return JSON.parse(localStorage.getItem(KEYS.settings) || '{}'); }
function saveSettingsData(d) { localStorage.setItem(KEYS.settings, JSON.stringify(d)) }

/* ========== UNIT HELPERS ========== */
function getHTUnits() { return getUnits().filter(u => !u.type || u.type === 'ht') }
function getAccessories() { return getUnits().filter(u => u.type === 'aksesoris') }

/* ========== UTILITIES ========== */
const rupiah = v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtDate = d => { if (!d) return '-'; const p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0] };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const diffDays = (a, b) => { const d1 = new Date(a), d2 = new Date(b); return Math.max(1, Math.round((d2 - d1) / (864e5))) };

/* ── Waktu realtime & denda ── */
const DENDA_PER_JAM = 5000;

/* Hitung denda: expire = timestamp ms, sekarang dibanding expire */
function hitungDenda(expireTimestamp) {
    const now = Date.now();
    if (now <= expireTimestamp) return { terlambat: false, jamTelat: 0, denda: 0 };
    const jamTelat = Math.ceil((now - expireTimestamp) / (1000 * 60 * 60));
    return { terlambat: true, jamTelat, denda: jamTelat * DENDA_PER_JAM };
}

/* Hitung expire timestamp dari waktu_mulai (ms) + durasi_hari */
function hitungExpire(waktuMulaiMs, durasiHari) {
    return waktuMulaiMs + durasiHari * 24 * 60 * 60 * 1000;
}

/* Format timestamp ke string tanggal + jam: "21/02/2025 14:17" */
function fmtDateTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    const tgl = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    const jam = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    return tgl + ' ' + jam;
}

/* Sisa waktu dari sekarang ke expire, dalam bentuk string */
function sisaWaktu(expireTimestamp) {
    const diff = expireTimestamp - Date.now();
    if (diff <= 0) return null; // sudah lewat
    const totalMenit = Math.floor(diff / 60000);
    const jam = Math.floor(totalMenit / 60);
    const menit = totalMenit % 60;
    if (jam >= 24) {
        const hari = Math.floor(jam / 24);
        const sisaJam = jam % 24;
        return hari + 'h ' + (sisaJam > 0 ? sisaJam + 'j' : '');
    }
    return jam + 'j ' + menit + 'm';
}
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

/* Get accessory availability (simple: total stock - currently rented) */
function getAccAvailability(accId, startStr, endStr, excludeBookingId = null) {
    const acc = getUnits().find(u => u.id === accId);
    if (!acc) return { total: 0, available: 0 };
    const total = parseInt(acc.quantity) || 0;
    if (!startStr || !endStr) return { total, available: total };
    const bookings = getBookings().filter(b => b.status_sewa === 'Aktif' && b.id !== excludeBookingId);
    let used = 0;
    const s = new Date(startStr), e = new Date(endStr);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        let dayUsed = 0;
        bookings.forEach(b => {
            if (b.tanggal_mulai <= dStr && b.tanggal_selesai >= dStr && b.accessories) {
                const found = b.accessories.find(a => a.id === accId);
                if (found) dayUsed += (parseInt(found.qty) || 0);
            }
        });
        if (dayUsed > used) used = dayUsed;
    }
    return { total, available: Math.max(0, total - used) };
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
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => { a.classList.toggle('active', a.dataset.page === page) });
    document.getElementById('sidebar').classList.remove('open');
    localStorage.setItem('lastPage', page);
    if (page === 'dashboard') renderDashboard();
    if (page === 'inventory') renderInventory();
    if (page === 'booking') renderBookings();
    if (page === 'calendar') renderCalendar();
    if (page === 'report') renderReport();
    if (page === 'settings') loadSettings();
    if (page === 'voucher') renderVouchers();
}

function updateClock() {
    const d = new Date();
    const el = document.getElementById('headerDate');
    if (el) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const daysMob = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const jam = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            el.textContent = `${daysMob[d.getDay()]} ${d.getDate()}/${d.getMonth()+1} • ${jam}`;
        } else {
            el.textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} • ${jam}`;
        }
    }
}
