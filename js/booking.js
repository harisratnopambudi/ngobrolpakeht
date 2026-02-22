/* HT-PRO Manager - Booking Module (v2 with Accessories) */

let editBookingId = null;
let datePickerInstance = null;
let ktpImg = '';
let selfieImg = '';
let _waktuMulaiMs = 0;      // timestamp ms waktu mulai sewa (realtime saat buka form)
let _tanggalSelesai = '';   // string 'YYYY-MM-DD' yang dipilih user
let _appliedVoucher = null; // voucher object yang sedang diterapkan
let _diskonAmount = 0;      // jumlah diskon dalam rupiah

/* ─── Hitung durasi dari waktu mulai ms ke tanggal selesai ──────────────
   Logika: expire = tanggal_selesai jam yang sama dengan jam mulai
   Durasi = jumlah hari penuh dari tanggal_mulai ke tanggal_selesai
   Contoh: mulai tgl 21 jam 10:00 → selesai tgl 22 → expire tgl 22 jam 10:00 → 1 hari
─────────────────────────────────────────────────────────────────────── */
function hitungDurasiDariTanggal(waktuMulaiMs, tanggalSelesaiStr) {
    if (!waktuMulaiMs || !tanggalSelesaiStr) return 0;
    const mulai = new Date(waktuMulaiMs);
    // Set jam mulai ke midnight untuk hitung selisih hari
    const mulaiMidnight = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate());
    const selesai = new Date(tanggalSelesaiStr);
    const selesaiMidnight = new Date(selesai.getFullYear(), selesai.getMonth(), selesai.getDate());
    const diffDays = Math.round((selesaiMidnight - mulaiMidnight) / 864e5);
    return Math.max(0, diffDays);
}

/* Expire = waktu mulai (jam persis) + durasi hari */
function hitungExpireDariTanggal(waktuMulaiMs, tanggalSelesaiStr) {
    const dur = hitungDurasiDariTanggal(waktuMulaiMs, tanggalSelesaiStr);
    return waktuMulaiMs + dur * 24 * 60 * 60 * 1000;
}

/* ========== TANGGAL SELESAI HANDLER ========== */
function onTanggalSelesaiChange() {
    const tsEl = document.getElementById('bkTanggalSelesai');
    if (!tsEl) return;
    _tanggalSelesai = tsEl.value; // 'YYYY-MM-DD'
    // Update durasi field dari tanggal yang dipilih
    const dur = _tanggalSelesai ? hitungDurasiDariTanggal(_waktuMulaiMs, _tanggalSelesai) : 0;
    const durEl = document.getElementById('bkDurasi');
    if (durEl && dur > 0) durEl.value = dur;
    calcBooking();
}

/* ========== DURASI INPUT HANDLER ========== */
function onDurasiInput() {
    // User ketik durasi langsung → hitung tanggal selesai otomatis
    const durEl = document.getElementById('bkDurasi');
    const dur = parseInt(durEl?.value) || 0;
    if (dur >= 1 && _waktuMulaiMs) {
        const mulai = new Date(_waktuMulaiMs);
        const selesai = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + dur);
        const toYMD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        _tanggalSelesai = toYMD(selesai);
        const tsEl = document.getElementById('bkTanggalSelesai');
        if (tsEl) tsEl.value = _tanggalSelesai;
    } else {
        _tanggalSelesai = '';
    }
    calcBooking();
}

function changeDurasi(delta) {
    const durEl = document.getElementById('bkDurasi');
    if (!durEl) return;
    const cur = parseInt(durEl.value) || 1;
    durEl.value = Math.max(1, cur + delta);
    onDurasiInput();
}

function handleKTPUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { ktpImg = ev.target.result; document.getElementById('ktpImgUpload').innerHTML = `<img src="${ktpImg}">`; };
    r.readAsDataURL(f);
}

function handleSelfieUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { selfieImg = ev.target.result; document.getElementById('selfieImgUpload').innerHTML = `<img src="${selfieImg}">`; };
    r.readAsDataURL(f);
}

function populateHTDropdown() {
    const units = getHTUnits ? getHTUnits() : getUnits().filter(u => !u.type || u.type === 'ht');
    const sel = document.getElementById('bkHT');
    sel.innerHTML = '<option value="">-- Pilih Unit HT --</option>';
    units.forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = u.nama + ' (' + rupiah(u.harga_per_hari) + '/hari)';
        o.dataset.harga = u.harga_per_hari; sel.appendChild(o);
    });
    sel.onchange = () => { const opt = sel.options[sel.selectedIndex]; document.getElementById('bkHargaHari').value = opt.dataset.harga || ''; calcBooking(); };
}

/* ========== ACCESSORIES PANEL ========== */
let _lastAccDates = '';

function renderAccPanel(startStr, endStr) {
    const panel = document.getElementById('bkAccPanel');
    const list = document.getElementById('bkAccList');
    if (!panel || !list) return;

    const currentDates = `${startStr}_${endStr}`;
    const accs = getAccessories ? getAccessories() : getUnits().filter(u => u.type === 'aksesoris');
    if (accs.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = '';

    // Collect current quantities before re-rendering
    const currentQtys = {};
    accs.forEach(a => {
        const el = document.getElementById('acc_' + a.id);
        if (el) currentQtys[a.id] = parseInt(el.value) || 0;
    });

    // Only update HTML if dates changed (optimization)
    if (_lastAccDates === currentDates && list.innerHTML !== '') {
        // Just update availability text/max if needed, but innerHTML is usually enough
        // If we skipped INNER_HTML, we'd need to update each item. 
        // For now, let's just ensure we use collected quantities.
    }

    list.innerHTML = accs.map(a => {
        const avail = (startStr && endStr) ? getAccAvailability(a.id, startStr, endStr, editBookingId).available : parseInt(a.quantity) || 0;
        const disabled = avail === 0 ? 'disabled' : '';
        const currentVal = Math.min(avail, currentQtys[a.id] || 0);

        return `<div class="acc-item">
    <div class="acc-info">
        <div class="acc-name">${a.nama}</div>
        <div class="acc-price">${rupiah(a.harga_per_hari)}/hari • stok ${avail}</div>
    </div>
    <div class="acc-qty-ctrl">
        <button type="button" class="acc-btn" onclick="changeAcc('${a.id}',-1)" ${disabled}>−</button>
        <input type="number" class="acc-qty-input" id="acc_${a.id}" value="${currentVal}" min="0" max="${avail}" data-harga="${a.harga_per_hari}" data-nama="${a.nama}" ${disabled} oninput="calcBooking()">
        <button type="button" class="acc-btn" onclick="changeAcc('${a.id}',1)" ${disabled}>+</button>
    </div>
</div>`;
    }).join('');

    _lastAccDates = currentDates;
}

function changeAcc(id, delta) {
    const el = document.getElementById('acc_' + id);
    if (!el) return;
    const max = parseInt(el.max) || 0;
    const cur = parseInt(el.value) || 0;
    el.value = Math.max(0, Math.min(max, cur + delta));
    calcBooking();
}

function getAccOrderData() {
    /* Returns array of {id, nama, qty, harga_per_hari} for non-zero qty accessories */
    const accs = getAccessories ? getAccessories() : getUnits().filter(u => u.type === 'aksesoris');
    return accs.map(a => {
        const el = document.getElementById('acc_' + a.id);
        const qty = el ? (parseInt(el.value) || 0) : 0;
        return { id: a.id, nama: a.nama, qty, harga_per_hari: a.harga_per_hari };
    }).filter(a => a.qty > 0);
}

function calcAccTotal(dur) {
    const accs = getAccOrderData();
    return accs.reduce((s, a) => s + a.qty * a.harga_per_hari * dur, 0);
}

/* ========== MAIN CALCULATION (realtime jam + tanggal selesai pilihan) ========== */
function calcBooking() {
    /* Durasi: baca dari field langsung (sudah diupdate oleh onDurasiInput/onTanggalSelesaiChange) */
    const durEl = document.getElementById('bkDurasi');
    const dur = _tanggalSelesai ? hitungDurasiDariTanggal(_waktuMulaiMs, _tanggalSelesai) : (parseInt(durEl?.value) || 0);
    // Jangan override durEl di sini — biarkan user yang kontrol

    /* Update expire display */
    const expEl = document.getElementById('bkExpireDisplay');
    if (expEl) {
        if (dur > 0 && _waktuMulaiMs) {
            const expMs = hitungExpireDariTanggal(_waktuMulaiMs, _tanggalSelesai);
            expEl.value = fmtDateTime(expMs);
        } else {
            expEl.value = '';
        }
    }

    if (!dur) {
        document.getElementById('bkTotal').value = '';
        document.getElementById('bkSisa').value = '';
        updatePriceBreakdown(0, 0, 0);
        return;
    }

    /* Untuk cek availability: rentang tanggal */
    const toYMD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const mulaiDate = _waktuMulaiMs ? new Date(_waktuMulaiMs) : new Date();
    const sStr = toYMD(mulaiDate);
    const eStr = _tanggalSelesai || sStr;

    if (_lastAccDates !== `${sStr}_${eStr}`) renderAccPanel(sStr, eStr);

    const htId = document.getElementById('bkHT').value;
    let htTotal = 0;
    if (htId && dur > 0) {
        const hpd = parseInt(document.getElementById('bkHargaHari').value) || 0;
        const unit = (getHTUnits ? getHTUnits() : getUnits().filter(u => !u.type || u.type === 'ht')).find(u => u.id === htId);
        const qty = parseInt(document.getElementById('bkQty').value) || 1;
        const availData = getAvailability(htId, sStr, eStr, editBookingId);
        const availEl = document.getElementById('bkAvailInfo');
        if (qty > availData.available) {
            document.getElementById('bkQty').style.borderColor = 'red';
            if (availEl) { availEl.textContent = `⚠ Hanya ${availData.available} unit tersedia`; availEl.style.color = 'var(--danger)'; }
        } else {
            document.getElementById('bkQty').style.borderColor = '';
            if (availEl) { availEl.textContent = `✓ ${availData.available} dari ${availData.total} unit tersedia`; availEl.style.color = 'var(--success)'; }
        }
        if (dur >= 7 && unit && unit.harga_per_minggu > 0) {
            const weeks = Math.floor(dur / 7), extraDays = dur % 7;
            htTotal = (weeks * unit.harga_per_minggu + extraDays * hpd) * qty;
        } else { htTotal = dur * hpd * qty; }
    }

    const accTotal = calcAccTotal(dur);
    const subtotal = htTotal + accTotal;

    // Apply voucher discount
    _diskonAmount = _appliedVoucher ? hitungDiskon(_appliedVoucher, subtotal) : 0;
    const total = Math.max(0, subtotal - _diskonAmount);

    document.getElementById('bkTotal').value = total;
    const dp = parseInt(document.getElementById('bkDP').value) || 0;
    document.getElementById('bkSisa').value = total - dp;
    updatePriceBreakdown(htTotal, accTotal, subtotal, _diskonAmount, total);
}

function updatePriceBreakdown(htTotal, accTotal, subtotal, diskon, total) {
    const el = document.getElementById('bkPriceBreakdown');
    if (!el) return;
    const accs = getAccOrderData();
    if (subtotal === 0 || (accs.length === 0 && htTotal === 0)) { el.style.display = 'none'; return; }
    el.style.display = '';
    const dur = _tanggalSelesai ? hitungDurasiDariTanggal(_waktuMulaiMs, _tanggalSelesai) : 0;
    let rows = '';
    if (htTotal > 0) rows += `<div class="pb-row"><span>HT (${dur} hari)</span><span>${rupiah(htTotal)}</span></div>`;
    accs.forEach(a => {
        rows += `<div class="pb-row pb-acc"><span>${a.nama} × ${a.qty} × ${dur} hari</span><span>${rupiah(a.qty * a.harga_per_hari * dur)}</span></div>`;
    });
    if (accs.length > 0 || diskon > 0) rows += `<div class="pb-row pb-subtotal"><span>Subtotal</span><span>${rupiah(subtotal)}</span></div>`;
    if (diskon > 0 && _appliedVoucher) {
        const discLabel = _appliedVoucher.tipe === 'persen' ? `Diskon ${_appliedVoucher.nilai}% (${_appliedVoucher.kode})` : `Potongan (${_appliedVoucher.kode})`;
        rows += `<div class="pb-row pb-diskon"><span>🏷️ ${discLabel}</span><span style="color:#22c55e">- ${rupiah(diskon)}</span></div>`;
    }
    rows += `<div class="pb-row pb-total"><span>Total Akhir</span><span>${rupiah(total)}</span></div>`;
    el.innerHTML = rows;
}

/* ========== VOUCHER APPLY (called from booking form) ========== */
function applyVoucherCode() {
    const kode = (document.getElementById('bkVoucherCode')?.value || '').trim();
    const msgEl = document.getElementById('bkVoucherMsg');
    if (!kode) {
        _appliedVoucher = null;
        _diskonAmount = 0;
        if (msgEl) { msgEl.textContent = ''; msgEl.className = 'voucher-msg'; }
        calcBooking();
        return;
    }
    const v = findVoucher(kode);
    if (!v) {
        _appliedVoucher = null;
        _diskonAmount = 0;
        if (msgEl) { msgEl.textContent = '✕ Kode voucher tidak ditemukan.'; msgEl.className = 'voucher-msg voucher-msg-error'; }
        calcBooking();
        return;
    }
    const validity = isVoucherValid(v);
    if (!validity.valid) {
        _appliedVoucher = null;
        _diskonAmount = 0;
        if (msgEl) { msgEl.textContent = '✕ ' + validity.msg; msgEl.className = 'voucher-msg voucher-msg-error'; }
        calcBooking();
        return;
    }
    _appliedVoucher = v;
    const subtotalEl = parseInt(document.getElementById('bkTotal')?.value) || 0;
    if (msgEl) {
        const discVal = v.tipe === 'persen' ? `${v.nilai}%${v.maks_diskon > 0 ? ' (maks ' + rupiah(v.maks_diskon) + ')' : ''}` : rupiah(v.nilai);
        msgEl.textContent = `✓ Voucher "${v.kode}" diterapkan! Diskon ${discVal} — ${v.nama || ''}`;
        msgEl.className = 'voucher-msg voucher-msg-success';
    }
    calcBooking();
}

function clearVoucher() {
    _appliedVoucher = null;
    _diskonAmount = 0;
    const codeEl = document.getElementById('bkVoucherCode');
    const msgEl = document.getElementById('bkVoucherMsg');
    if (codeEl) codeEl.value = '';
    if (msgEl) { msgEl.textContent = ''; msgEl.className = 'voucher-msg'; }
    calcBooking();
}

/* ========== GENERATE INVOICE NO ========== */
function genInvoice() {
    const d = today().replace(/-/g, '');
    const cnt = getBookings().filter(b => b.invoice_no.includes('INV-' + d)).length;
    return 'INV-' + d + '-' + String(cnt + 1).padStart(3, '0');
}

/* ========== OPEN BOOKING MODAL ========== */
function openBookingModal(id) {
    editBookingId = id || null;
    populateHTDropdown();
    document.getElementById('bookingModalTitle').textContent = id ? 'Edit Booking' : 'Booking Baru';
    ['bkNama', 'bkHP', 'bkAlamat', 'bkDateRange', 'bkTanggalSelesai', 'bkHargaHari', 'bkTotal', 'bkDP', 'bkSisa', 'bkKeperluan', 'bkCatatan'].forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
    /* Set waktu mulai realtime */
    if (!id) {
        _waktuMulaiMs = Date.now();
        _tanggalSelesai = '';
        const wmEl = document.getElementById('bkWaktuMulai');
        if (wmEl) wmEl.value = fmtDateTime(_waktuMulaiMs);
        const tsEl = document.getElementById('bkTanggalSelesai');
        if (tsEl) tsEl.value = '';
        const expEl = document.getElementById('bkExpireDisplay');
        if (expEl) expEl.value = '';
        const durEl = document.getElementById('bkDurasi');
        if (durEl) durEl.value = '';
    }
    document.getElementById('bkDP').value = '0';
    document.getElementById('bkStatusBayar').value = 'Belum Bayar';
    document.getElementById('bkQty').value = '1';
    const availEl = document.getElementById('bkAvailInfo'); if (availEl) availEl.textContent = '';
    const pbEl = document.getElementById('bkPriceBreakdown'); if (pbEl) pbEl.style.display = 'none';

    ktpImg = ''; selfieImg = '';
    _appliedVoucher = null;
    _diskonAmount = 0;
    const voucherCodeEl = document.getElementById('bkVoucherCode');
    const voucherMsgEl = document.getElementById('bkVoucherMsg');
    if (voucherCodeEl) voucherCodeEl.value = '';
    if (voucherMsgEl) { voucherMsgEl.textContent = ''; voucherMsgEl.className = 'voucher-msg'; }
    const ktpReset = '<span class="upload-text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Upload KTP</span>';
    const selfieReset = '<span class="upload-text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Upload Selfie</span>';
    document.getElementById('ktpImgUpload').innerHTML = ktpReset;
    document.getElementById('selfieImgUpload').innerHTML = selfieReset;
    document.getElementById('ktpImgInput').value = '';
    document.getElementById('selfieImgInput').value = '';

    /* Render empty acc panel */
    _lastAccDates = '';
    renderAccPanel('', '');

    if (id) {
        const b = getBookings().find(x => x.id === id);
        if (b) {
            document.getElementById('bkNama').value = b.nama_penyewa;
            document.getElementById('bkHP').value = b.no_hp;
            document.getElementById('bkAlamat').value = b.alamat;
            document.getElementById('bkQty').value = b.qty || 1;
            document.getElementById('bkDP').value = b.dp || 0;
            document.getElementById('bkStatusBayar').value = b.status_bayar;
            document.getElementById('bkKeperluan').value = b.keperluan || '';
            document.getElementById('bkCatatan').value = b.catatan || '';
            document.getElementById('bkHT').value = b.ht_id;
            document.getElementById('bkHargaHari').value = b.harga_per_hari;
            document.getElementById('bkDurasi').value = b.durasi_hari || 1;
            /* Restore waktu mulai dan tanggal selesai dari data tersimpan */
            _waktuMulaiMs = b.waktu_mulai_ms || (b.tanggal_mulai ? new Date(b.tanggal_mulai).getTime() : Date.now());
            _tanggalSelesai = b.tanggal_selesai || '';
            const wmEl = document.getElementById('bkWaktuMulai');
            if (wmEl) wmEl.value = fmtDateTime(_waktuMulaiMs);
            const tsEl = document.getElementById('bkTanggalSelesai');
            if (tsEl) tsEl.value = _tanggalSelesai;
            const expEl = document.getElementById('bkExpireDisplay');
            if (expEl && b.waktu_expire_ms) expEl.value = fmtDateTime(b.waktu_expire_ms);
            if (b.ktp_img) { ktpImg = b.ktp_img; document.getElementById('ktpImgUpload').innerHTML = `<img src="${ktpImg}">`; }
            if (b.selfie_img) { selfieImg = b.selfie_img; document.getElementById('selfieImgUpload').innerHTML = `<img src="${selfieImg}">`; }
        }
    }

    /* Restore accessories & recalc */
    if (id) {
        const b = getBookings().find(x => x.id === id);
        if (b) {
            const toYMD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            const sStr = toYMD(new Date(_waktuMulaiMs));
            renderAccPanel(sStr, _tanggalSelesai || sStr);
            if (b.accessories && b.accessories.length > 0) {
                b.accessories.forEach(a => {
                    const el = document.getElementById('acc_' + a.id);
                    if (el) el.value = a.qty;
                });
            }
            document.getElementById('bkTotal').value = b.total_harga;
            document.getElementById('bkSisa').value = b.sisa_bayar;
            calcBooking();
        }
    }
    openModal('bookingModal');
}

/* ========== SAVE BOOKING ========== */
function saveBooking() {
    const nama = document.getElementById('bkNama').value.trim();
    const htId = document.getElementById('bkHT').value;
    if (!_waktuMulaiMs) _waktuMulaiMs = Date.now();
    // Jika _tanggalSelesai masih kosong tapi durasi sudah diisi, hitung otomatis
    if (!_tanggalSelesai) {
        const durInput = parseInt(document.getElementById('bkDurasi')?.value) || 0;
        if (durInput >= 1 && _waktuMulaiMs) {
            const mulai = new Date(_waktuMulaiMs);
            const selesai = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + durInput);
            const toYMD2 = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            _tanggalSelesai = toYMD2(selesai);
        } else {
            showToast('Mohon isi Durasi Sewa atau pilih Tanggal Selesai', 'error'); return;
        }
    }

    const waktu_mulai_ms = _waktuMulaiMs;
    const durasi = hitungDurasiDariTanggal(waktu_mulai_ms, _tanggalSelesai);
    if (durasi < 1) { showToast('Tanggal selesai harus setelah tanggal mulai', 'error'); return; }

    const waktu_expire_ms = hitungExpireDariTanggal(waktu_mulai_ms, _tanggalSelesai);
    const toYMD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const mulai   = toYMD(new Date(waktu_mulai_ms));
    const selesai = _tanggalSelesai;

    if (!nama || !htId) { showToast('Mohon lengkapi Nama dan Unit HT', 'error'); return; }
    const qty = parseInt(document.getElementById('bkQty').value) || 1;
    const unit = (getHTUnits ? getHTUnits() : getUnits().filter(u => !u.type || u.type === 'ht')).find(u => u.id === htId);
    if (!unit) { showToast('Unit HT tidak ditemukan', 'error'); return; }
    const availData = getAvailability(htId, mulai, selesai, editBookingId);
    if (qty > availData.available) { showToast(`Stok HT tidak cukup! Hanya ${availData.available} unit tersedia.`, 'error'); return; }

    /* Validate accessories stock */
    const accOrder = getAccOrderData();
    for (const a of accOrder) {
        const accAvail = getAccAvailability(a.id, mulai, selesai, editBookingId).available;
        if (a.qty > accAvail) { showToast(`Stok ${a.nama} tidak cukup! Hanya ${accAvail} tersedia.`, 'error'); return; }
    }

    const total = parseInt(document.getElementById('bkTotal').value) || 0;
    const dp = parseInt(document.getElementById('bkDP').value) || 0;
    const subtotalSebelumDiskon = total + _diskonAmount;

    const bookingData = {
        nama_penyewa: nama,
        no_hp: document.getElementById('bkHP').value.trim(),
        alamat: document.getElementById('bkAlamat').value.trim(),
        keperluan: document.getElementById('bkKeperluan').value.trim(),
        ht_id: htId, ht_kode: unit.nama,
        tanggal_mulai: mulai, tanggal_selesai: selesai,
        waktu_mulai_ms, waktu_expire_ms,
        durasi_hari: durasi, harga_per_hari: unit.harga_per_hari,
        subtotal_harga: subtotalSebelumDiskon,
        diskon_voucher: _diskonAmount,
        kode_voucher: _appliedVoucher ? _appliedVoucher.kode : '',
        total_harga: total, dp, sisa_bayar: total - dp,
        status_bayar: document.getElementById('bkStatusBayar').value,
        catatan: document.getElementById('bkCatatan').value.trim(),
        qty, accessories: accOrder,
        ktp_img: ktpImg, selfie_img: selfieImg
    };

    const bookings = getBookings();
    if (editBookingId) {
        const idx = bookings.findIndex(b => b.id === editBookingId);
        if (idx >= 0) bookings[idx] = { ...bookings[idx], ...bookingData };
        showToast('Booking berhasil diperbarui');
    } else {
        bookingData.id = 'b' + Date.now();
        bookingData.invoice_no = genInvoice();
        bookingData.status_sewa = 'Aktif';
        bookingData.created_at = Date.now();
        bookings.push(bookingData);
        // Update voucher usage stats
        if (_appliedVoucher) {
            const vouchers = getVouchers();
            const vidx = vouchers.findIndex(v => v.kode === _appliedVoucher.kode);
            if (vidx >= 0) {
                vouchers[vidx].jumlah_digunakan = (vouchers[vidx].jumlah_digunakan || 0) + 1;
                vouchers[vidx].total_diskon_diberikan = (vouchers[vidx].total_diskon_diberikan || 0) + _diskonAmount;
                saveVouchers(vouchers);
            }
        }
        showToast('Booking berhasil dibuat');
    }
    saveBookings(bookings); closeModal('bookingModal'); renderBookings();
}

/* ========== COUNTDOWN UTIL ========== */
function daysCountdown(tanggalSelesai, _unused) {
    /* Coba pakai waktu_expire_ms (presisi jam), fallback ke tanggal */
    return null; // tidak dipakai langsung, pakai hoursCountdown
}

/* Hitung sisa jam dari expire. Positif = belum expire, negatif = sudah telat */
function hoursCountdown(b) {
    if (!b) return 0;
    const expMs = b.waktu_expire_ms || (b.tanggal_selesai ? new Date(b.tanggal_selesai + 'T23:59:59').getTime() : 0);
    return (expMs - Date.now()) / (1000 * 60 * 60);
}

/* ========== RENDER BOOKINGS TABLE ========== */
function renderBookings() {
    const bookings = getBookings();
    const search = (document.getElementById('bookSearch').value || '').toLowerCase();
    const fStatus = document.getElementById('bookFilterStatus').value;
    const fBayar = document.getElementById('bookFilterBayar').value;
    const filtered = bookings.filter(b => {
        const sm = !search || b.nama_penyewa.toLowerCase().includes(search) || b.invoice_no.toLowerCase().includes(search) || (b.ht_kode || '').toLowerCase().includes(search);
        return (!fStatus || b.status_sewa === fStatus) && (!fBayar || b.status_bayar === fBayar) && sm;
    });
    const sorted = [...filtered].sort((a, b) => b.created_at - a.created_at);
    const todayStr = today();
    const totalAktif = bookings.filter(b => b.status_sewa === 'Aktif').length;
    const totalPiutang = bookings.filter(b => b.status_sewa === 'Aktif').reduce((s, b) => s + (b.sisa_bayar || 0), 0);
    const totalLate = bookings.filter(b => b.status_sewa === 'Aktif' && hoursCountdown(b) < 0).length;
    const summaryEl = document.getElementById('bookSummary');
    if (summaryEl) summaryEl.innerHTML = `<div class="book-summary-bar">
        <div class="bsb-item"><span class="bsb-val">${totalAktif}</span><span class="bsb-lbl">Aktif</span></div>
        <div class="bsb-item bsb-danger"><span class="bsb-val">${totalLate}</span><span class="bsb-lbl">Terlambat</span></div>
        <div class="bsb-item bsb-warning"><span class="bsb-val">${rupiah(totalPiutang)}</span><span class="bsb-lbl">Total Piutang</span></div>
    </div>`;

    if (sorted.length === 0) { document.getElementById('bookTable').innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:30px">Belum ada booking</td></tr>'; return; }
    const waIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
    document.getElementById('bookTable').innerHTML = sorted.map(b => {
        const _hrs = b.status_sewa === 'Aktif' ? hoursCountdown(b) : null;
        const isLate = _hrs !== null && _hrs < 0;
        const countdown = _hrs;
        const qtyDisplay = b.qty ? ` <span class="badge badge-gray" style="font-size:10px">x${b.qty}</span>` : '';
        const accBadge = b.accessories && b.accessories.length > 0 ? `<span class="badge badge-info" style="font-size:9px;margin-left:2px">+${b.accessories.length} aksesoris</span>` : '';
        let countdownBadge = '';
        if (countdown !== null) {
            const absHrs = Math.ceil(Math.abs(countdown));
            if (isLate) {
                countdownBadge = `<div class="countdown-badge countdown-late">${absHrs}j telat · denda ${rupiah(absHrs * 5000)}</div>`;
            } else if (countdown <= 2) {
                countdownBadge = `<div class="countdown-badge countdown-urgent">${Math.ceil(countdown * 60)}m lagi!</div>`;
            } else if (countdown <= 24) {
                countdownBadge = `<div class="countdown-badge countdown-warn">${Math.ceil(countdown)}j lagi</div>`;
            } else {
                const hariSisa = Math.floor(countdown / 24);
                const jamSisa  = Math.ceil(countdown % 24);
                countdownBadge = `<div class="countdown-badge countdown-ok">${hariSisa}h ${jamSisa}j lagi</div>`;
            }
        }
        const actionBtns = b.status_sewa === 'Aktif' ? `
<button class="btn-tbl btn-tbl-edit" onclick="openBookingModal('${b.id}')" title="Edit">${ICO.edit}</button>
<button class="btn-tbl btn-tbl-ok" onclick="completeBooking('${b.id}')" title="Selesaikan">${ICO.check}</button>
<button class="btn-tbl btn-tbl-wa" onclick="sendWhatsApp('${b.id}')" title="WhatsApp">${waIcon}</button>
<button class="btn-tbl btn-tbl-danger" onclick="cancelBooking('${b.id}')" title="Batalkan">${ICO.x}</button>`
            : `<button class="btn-tbl btn-tbl-edit" onclick="showBookingDetail('${b.id}')" title="Detail">${ICO.info}</button>
${b.status_sewa === 'Dibatalkan' || b.status_sewa === 'Selesai' ? `<button class="btn-tbl btn-tbl-danger" onclick="deleteBooking('${b.id}')" title="Hapus">${ICO.trash}</button>` : ''}`;
        return `<tr class="${isLate ? 'row-late' : ''}">
<td><a href="javascript:void(0)" onclick="showBookingDetail('${b.id}')" style="color:var(--accent);font-weight:600">${b.invoice_no}</a></td>
<td><a href="javascript:void(0)" onclick="showCustomerHistory('${b.no_hp}')" class="customer-link">${b.nama_penyewa}</a></td>
<td>${b.ht_kode}${qtyDisplay}${accBadge}</td>
<td>${fmtDate(b.tanggal_mulai)}</td>
<td>${fmtDate(b.tanggal_selesai)}${countdownBadge}</td>
<td>${b.durasi_hari}h</td>
<td>${rupiah(b.total_harga)}</td>
<td><span class="badge ${b.status_bayar === 'Lunas' ? 'badge-success' : b.status_bayar === 'DP' ? 'badge-warning' : 'badge-danger'}">${b.status_bayar}</span></td>
<td><span class="badge ${b.status_sewa === 'Aktif' ? (isLate ? 'badge-danger' : 'badge-info') : b.status_sewa === 'Selesai' ? 'badge-success' : 'badge-gray'}">${isLate ? 'Terlambat' : b.status_sewa}</span></td>
<td><div class="tbl-actions">${actionBtns}</div></td>
</tr>`;
    }).join('');
}

function completeBooking(id) { showConfirm('Selesaikan Booking', 'Tandai booking ini sebagai selesai?', () => { const bookings = getBookings(); const idx = bookings.findIndex(b => b.id === id); if (idx < 0) return; bookings[idx].status_sewa = 'Selesai'; saveBookings(bookings); showToast('Booking selesai'); renderBookings(); }); }
function cancelBooking(id) { showConfirm('Batalkan Booking', 'Yakin ingin membatalkan booking ini?', () => { const bookings = getBookings(); const idx = bookings.findIndex(b => b.id === id); if (idx < 0) return; bookings[idx].status_sewa = 'Dibatalkan'; saveBookings(bookings); showToast('Booking dibatalkan'); renderBookings(); }); }
function deleteBooking(id) { showConfirm('Hapus Booking', 'Hapus data booking ini secara permanen?', () => { saveBookings(getBookings().filter(b => b.id !== id)); showToast('Booking dihapus'); renderBookings(); }); }

function sendWhatsApp(id) {
    const b = getBookings().find(x => x.id === id);
    if (!b || !b.no_hp) { showToast('Nomor HP tidak tersedia', 'error'); return; }
    const s = getSettings();
    const _waHrs = hoursCountdown(b);
    const isLate = _waHrs < 0;
    const jamTelat = Math.ceil(Math.abs(_waHrs));
    const dendaWA  = jamTelat * 5000;
    const jamSisaWA = Math.ceil(_waHrs);
    /* Susun daftar item yang disewa */
    const itemLines = [`• ${b.ht_kode} × ${b.qty} unit`];
    if (b.accessories && b.accessories.length > 0) {
        b.accessories.forEach(a => itemLines.push(`• ${a.nama} × ${a.qty} unit`));
    }
    const itemList = itemLines.join('\n');

    const expireStr = fmtDateTime(b.waktu_expire_ms) || fmtDate(b.tanggal_selesai);
    let msg = isLate
        ? `Halo ${b.nama_penyewa}, ini pengingat dari *${s.bizName || 'HT-PRO'}*.\n\n*Item yang disewa:*\n${itemList}\n\nSudah _${jamTelat} jam_ melewati batas pengembalian (*${expireStr}*).\n*Denda: ${rupiah(dendaWA)} (${jamTelat} jam × Rp5.000/jam)*\nMohon segera dikembalikan. Terima kasih 🙏`
        : `Halo ${b.nama_penyewa}, pengingat dari *${s.bizName || 'HT-PRO'}*.\n\n*Item yang disewa:*\n${itemList}\n\nMasa sewa berakhir *${expireStr}* (${jamSisaWA} jam lagi).\nSisa tagihan: *${rupiah(b.sisa_bayar)}*\n\nTerima kasih 🙏`;
    const phone = b.no_hp.replace(/\D/g, '').replace(/^0/, '62');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function showCustomerHistory(hp) {
    const bookings = getBookings().filter(b => b.no_hp === hp).sort((a, b) => b.created_at - a.created_at);
    if (bookings.length === 0) return;
    const first = bookings[0];
    const totalRevenue = bookings.reduce((s, b) => s + b.total_harga, 0);
    document.getElementById('detailContent').innerHTML = `
<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3rem;color:#000;flex-shrink:0">${first.nama_penyewa[0].toUpperCase()}</div>
    <div><h3 style="margin:0;font-size:1rem">${first.nama_penyewa}</h3><p style="margin:2px 0 0;color:var(--text2);font-size:.8rem">${hp}</p></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
    <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${bookings.length}</div><div style="font-size:.7rem;color:var(--text2)">Total Sewa</div></div>
    <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center"><div style="font-size:.95rem;font-weight:800;color:var(--success)">${rupiah(totalRevenue)}</div><div style="font-size:.7rem;color:var(--text2)">Total Nilai</div></div>
    <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center"><div style="font-size:.95rem;font-weight:800;color:var(--accent2)">${rupiah(Math.round(totalRevenue / bookings.length))}</div><div style="font-size:.7rem;color:var(--text2)">Rata-rata</div></div>
</div>
<h4 style="margin-bottom:10px;font-size:.82rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Riwayat Sewa</h4>
${bookings.map(b => `<div style="padding:10px 12px;background:var(--bg);border-radius:8px;margin-bottom:6px;border-left:3px solid ${b.status_sewa === 'Selesai' ? 'var(--success)' : b.status_sewa === 'Aktif' ? 'var(--accent2)' : 'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600;font-size:.83rem">${b.invoice_no}</span><span class="badge ${b.status_sewa === 'Selesai' ? 'badge-success' : b.status_sewa === 'Aktif' ? 'badge-info' : 'badge-gray'}">${b.status_sewa}</span></div>
    <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${b.ht_kode} (x${b.qty || 1}) • ${fmtDate(b.tanggal_mulai)} — ${fmtDate(b.tanggal_selesai)} • <strong style="color:var(--accent)">${rupiah(b.total_harga)}</strong></div>
    ${b.accessories && b.accessories.length > 0 ? `<div style="font-size:.72rem;color:var(--accent2);margin-top:2px">+${b.accessories.map(a => a.nama + ' ×' + a.qty).join(', ')}</div>` : ''}
</div>`).join('')}`;
    document.getElementById('detailPrintBtn').style.display = 'none';
    openModal('detailModal');
    setTimeout(() => { document.getElementById('detailPrintBtn').style.display = ''; }, 0);
}

function showBookingDetail(id) {
    const b = getBookings().find(x => x.id === id); if (!b) return;
    const s = getSettings();
    const _cdHrs = hoursCountdown(b);
    const isLate = b.status_sewa === 'Aktif' && _cdHrs < 0;
    const absHrsDt = Math.ceil(Math.abs(_cdHrs));
    const waIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
    const accRows = b.accessories && b.accessories.length > 0
        ? b.accessories.map(a => `<tr><td style="color:var(--text2);padding:5px 0">${a.nama} × ${a.qty} unit (${b.durasi_hari} hari × ${rupiah(a.harga_per_hari)}/hari)</td><td style="text-align:right">${rupiah(a.qty * a.harga_per_hari * b.durasi_hari)}</td></tr>`).join('') : '';

    document.getElementById('detailContent').innerHTML = `
<div style="text-align:center;margin-bottom:16px"><h2 style="font-size:1.1rem">${s.bizName || 'HT-PRO Manager'}</h2><p style="font-size:.75rem;color:var(--text2)">${s.bizAddress || ''}<br>${s.bizPhone || ''} • ${s.bizEmail || ''}</p></div>
<hr style="border-color:var(--border);margin:12px 0">
<table style="width:100%">
<tr><td style="color:var(--text2);width:120px;padding:5px 0">Invoice</td><td><strong>${b.invoice_no}</strong></td></tr>
<tr><td style="color:var(--text2);padding:5px 0">Penyewa</td><td>${b.nama_penyewa}</td></tr>
<tr><td style="color:var(--text2);padding:5px 0">No. HP</td><td><a href="tel:${b.no_hp}" style="color:var(--accent)">${b.no_hp}</a></td></tr>
<tr><td style="color:var(--text2);padding:5px 0">Alamat</td><td>${b.alamat || '-'}</td></tr>
<tr><td style="color:var(--text2);padding:5px 0">Unit HT</td><td>${b.ht_kode} <span class="badge badge-gray">x${b.qty || 1} unit</span></td></tr>
${b.accessories && b.accessories.length > 0 ? `<tr><td style="color:var(--text2);padding:5px 0">Aksesoris</td><td>${b.accessories.map(a => `<span class="badge badge-info" style="margin-right:4px">${a.nama} ×${a.qty}</span>`).join('')}</td></tr>` : ''}
<tr><td style="color:var(--text2);padding:5px 0">Jam Booking</td><td><strong style="color:var(--accent)">${fmtDateTime(b.waktu_mulai_ms) || fmtDate(b.tanggal_mulai)}</strong></td></tr>
<tr><td style="color:var(--text2);padding:5px 0">Jam Pengembalian</td><td><strong style="color:${b.status_sewa === 'Aktif' && hoursCountdown(b) < 0 ? 'var(--danger)' : 'var(--accent2)'}">${fmtDateTime(b.waktu_expire_ms) || fmtDate(b.tanggal_selesai)}</strong></td></tr>
<tr><td style="color:var(--text2);padding:5px 0">Durasi</td><td>${b.durasi_hari} hari (${b.durasi_hari * 24} jam)</td></tr>
<tr><td style="color:var(--text2);padding:5px 0">Keperluan</td><td>${b.keperluan || '-'}</td></tr>
${b.catatan ? `<tr><td style="color:var(--text2);padding:5px 0">Catatan</td><td>${b.catatan}</td></tr>` : ''}
${isLate ? `<tr><td colspan="2"><div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px;margin-top:8px;color:var(--danger);font-size:.83rem;font-weight:600">⚠ Terlambat ${absHrsDt} jam · Denda: ${rupiah(absHrsDt * 5000)}</div></td></tr>` : ''}
</table>
${(b.ktp_img || b.selfie_img) ? `<div class="detail-docs">
<div class="doc-item"><h4>Foto KTP</h4>${b.ktp_img ? `<img src="${b.ktp_img}" class="doc-preview">` : ' <div class="doc-preview" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:.8rem">Tidak ada</div>'}</div>
<div class="doc-item"><h4>Foto Selfie</h4>${b.selfie_img ? `<img src="${b.selfie_img}" class="doc-preview">` : ' <div class="doc-preview" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:.8rem">Tidak ada</div>'}</div>
</div>`: ''}
<hr style="border-color:var(--border);margin:12px 0">
<table style="width:100%">
<tr><td style="color:var(--text2)">${b.ht_kode} × ${b.qty || 1} unit (${b.durasi_hari} hari × ${rupiah(b.harga_per_hari)}/hari)</td><td style="text-align:right">${rupiah(b.harga_per_hari * b.durasi_hari * (b.qty || 1))}</td></tr>
${accRows}
<tr><td style="color:var(--text2);font-weight:600">Total</td><td style="text-align:right;font-weight:700;color:var(--accent)">${rupiah(b.total_harga)}</td></tr>
<tr><td style="color:var(--text2)">DP</td><td style="text-align:right">${rupiah(b.dp)}</td></tr>
<tr><td style="color:var(--text2)">Sisa</td><td style="text-align:right;font-weight:700;color:${b.sisa_bayar > 0 ? 'var(--danger)' : 'var(--success)'}">${rupiah(b.sisa_bayar)}</td></tr>
<tr><td style="color:var(--text2)">Status Bayar</td><td style="text-align:right"><span class="badge ${b.status_bayar === 'Lunas' ? 'badge-success' : b.status_bayar === 'DP' ? 'badge-warning' : 'badge-danger'}">${b.status_bayar}</span></td></tr>
</table>
${b.status_sewa === 'Aktif' ? `<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
${b.sisa_bayar > 0 ? `<button class="btn btn-success btn-sm" onclick="quickPay('${b.id}');closeModal('detailModal')">${ICO.money} Lunasi Sekarang</button>` : ''}
<button class="btn btn-secondary btn-sm" onclick="sendWhatsApp('${b.id}')">${waIcon} Kirim WA</button>
<button class="btn btn-secondary btn-sm" onclick="openBookingModal('${b.id}');closeModal('detailModal')">${ICO.edit} Edit</button>
</div>`: ''}`;
    document.getElementById('detailPrintBtn').style.display = '';
    document.getElementById('detailPrintBtn').onclick = () => printInvoice(b);
    document.getElementById('detailPDFBtn').style.display = '';
    document.getElementById('detailPDFBtn').onclick = () => downloadInvoicePDF(b);
    openModal('detailModal');
}

function quickPay(id) {
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id); if (idx < 0) return;
    bookings[idx].status_bayar = 'Lunas';
    bookings[idx].dp = bookings[idx].total_harga;
    bookings[idx].sisa_bayar = 0;
    saveBookings(bookings); showToast('Pembayaran dilunasi'); renderBookings();
}

function exportBookingsCSV() {
    const bookings = getBookings();
    const search = (document.getElementById('bookSearch').value || '').toLowerCase();
    const fStatus = document.getElementById('bookFilterStatus').value;
    const fBayar = document.getElementById('bookFilterBayar').value;
    const filtered = bookings.filter(b => {
        const sm = !search || b.nama_penyewa.toLowerCase().includes(search) || b.invoice_no.toLowerCase().includes(search);
        return (!fStatus || b.status_sewa === fStatus) && (!fBayar || b.status_bayar === fBayar) && sm;
    });
    const header = ['Invoice', 'Penyewa', 'No HP', 'Unit HT', 'Qty', 'Aksesoris', 'Tgl Mulai', 'Tgl Selesai', 'Durasi', 'Total', 'DP', 'Sisa', 'Status Bayar', 'Status Sewa'];
    const rows = filtered.map(b => [
        b.invoice_no, b.nama_penyewa, b.no_hp, b.ht_kode, b.qty || 1,
        (b.accessories || []).map(a => a.nama + '×' + a.qty).join('; '),
        b.tanggal_mulai, b.tanggal_selesai, b.durasi_hari,
        b.total_harga, b.dp, b.sisa_bayar, b.status_bayar, b.status_sewa
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'booking_' + today() + '.csv'; a.click();
    showToast('CSV berhasil diexport');
}

function printInvoice(b) {
    const s = getSettings();
    const accTableRows = b.accessories && b.accessories.length > 0
        ? b.accessories.map(a => `<tr>
            <td><span style="display:block;font-weight:500">${a.nama} × ${a.qty} unit</span><span style="font-size:12px;color:#666">Aksesoris • ${b.durasi_hari} hari × ${rupiah(a.harga_per_hari)}/unit/hari</span></td>
            <td style="text-align:center">${a.qty}</td>
            <td style="text-align:right">${rupiah(a.harga_per_hari)}/hari</td>
            <td style="text-align:right">${rupiah(a.qty * a.harga_per_hari * b.durasi_hari)}</td>
        </tr>`).join('') : '';

    document.getElementById('printArea').innerHTML = `
<div class="print-invoice">
    <div class="print-header">
        <div class="print-brand">${s.logo ? `<img src="${s.logo}">` : ''}<h1>${s.bizName || 'HT-PRO Manager'}</h1><p>${s.bizAddress || ''}<br>${s.bizPhone || ''}</p></div>
        <div class="invoice-meta"><h2>INVOICE</h2><p>#${b.invoice_no}</p><span>${fmtDate(b.tanggal_mulai)}</span></div>
    </div>
    <div class="print-grid">
        <div class="print-col"><h3>Ditagihkan Kepada</h3><p>${b.nama_penyewa}</p><div>${b.alamat || ''}<br>${b.no_hp}</div></div>
        <div class="print-col"><h3>Detail Sewa</h3>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0"><span>Jam Booking</span><strong>${b.waktu_mulai_ms ? fmtDateTime(b.waktu_mulai_ms) : fmtDate(b.tanggal_mulai)}</strong></div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0"><span>Jam Pengembalian</span><strong>${b.waktu_expire_ms ? fmtDateTime(b.waktu_expire_ms) : fmtDate(b.tanggal_selesai)}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Durasi</span><strong>${b.durasi_hari} Hari (${b.durasi_hari * 24} Jam)</strong></div>
        </div>
    </div>
    <table class="print-table">
        <thead><tr><th>Deskripsi</th><th style="text-align:center">Qty</th><th style="text-align:right">Harga</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
        <tr>
            <td><span style="display:block;font-weight:600">${b.ht_kode} × ${b.qty} unit</span><span style="font-size:12px;color:#666">${b.durasi_hari} hari • Booking: ${b.waktu_mulai_ms ? fmtDateTime(b.waktu_mulai_ms) : fmtDate(b.tanggal_mulai)} → Kembali: ${b.waktu_expire_ms ? fmtDateTime(b.waktu_expire_ms) : fmtDate(b.tanggal_selesai)}</span></td>
            <td style="text-align:center">${b.qty}</td>
            <td style="text-align:right">${rupiah(b.harga_per_hari)}/hari</td>
            <td style="text-align:right">${rupiah(b.harga_per_hari * b.durasi_hari * (b.qty || 1))}</td>
        </tr>
        ${accTableRows}
        </tbody>
    </table>
    <div class="print-summary" style="position:relative"><table>
        ${b.subtotal_harga && b.diskon_voucher > 0 ? `<tr><td>Subtotal</td><td>${rupiah(b.subtotal_harga)}</td></tr>` : ''}
        ${b.diskon_voucher > 0 ? `<tr><td>🏷️ Diskon Voucher (${b.kode_voucher})</td><td style="color:#16a34a">- ${rupiah(b.diskon_voucher)}</td></tr>` : ''}
        <tr><td>Total</td><td>${rupiah(b.total_harga)}</td></tr>
        <tr><td>Pembayaran (DP)</td><td>- ${rupiah(b.dp)}</td></tr>
        <tr class="total-row"><td>Sisa Tagihan</td><td class="${b.sisa_bayar > 0 ? 'status-unpaid' : 'status-paid'}">${rupiah(b.sisa_bayar)}</td></tr>
    </table>${b.status_bayar === 'Lunas' ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-60%,-50%) rotate(-30deg);border:5px solid #16a34a;color:#16a34a;font-size:48px;font-weight:900;padding:6px 28px;border-radius:10px;letter-spacing:10px;opacity:.6;font-family:Arial,sans-serif;white-space:nowrap;pointer-events:none">LUNAS</div>` : ''}</div>
    <div class="print-footer"><p>Terima kasih atas kepercayaan Anda!<br>Harap simpan bukti ini sebagai referensi.</p></div>
</div>`;
    document.getElementById('printArea').style.display = 'block';
    setTimeout(() => { window.print(); document.getElementById('printArea').style.display = 'none'; }, s.logo ? 500 : 300);
}

async function downloadInvoicePDF(b) {
    const btn = document.getElementById('detailPDFBtn');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '⏳ Proses...';
    btn.disabled = true;

    try {
        const s = getSettings();

        /* Gunakan HTML yang sama persis dengan printInvoice */
        const accTableRows = b.accessories && b.accessories.length > 0
            ? b.accessories.map(a => `<tr>
                <td><span style="display:block;font-weight:500">${a.nama} × ${a.qty} unit</span><span style="font-size:12px;color:#666">Aksesoris • ${b.durasi_hari} hari × ${rupiah(a.harga_per_hari)}/unit/hari</span></td>
                <td style="text-align:center">${a.qty}</td>
                <td style="text-align:right">${rupiah(a.harga_per_hari)}/hari</td>
                <td style="text-align:right">${rupiah(a.qty * a.harga_per_hari * b.durasi_hari)}</td>
            </tr>`).join('') : '';

        const invoiceHTML = `
<div class="print-invoice">
    <div class="print-header">
        <div class="print-brand">${s.logo ? `<img src="${s.logo}">` : ''}<h1>${s.bizName || 'HT-PRO Manager'}</h1><p>${s.bizAddress || ''}<br>${s.bizPhone || ''}</p></div>
        <div class="invoice-meta"><h2>INVOICE</h2><p>#${b.invoice_no}</p><span>${fmtDate(b.tanggal_mulai)}</span></div>
    </div>
    <div class="print-grid">
        <div class="print-col"><h3>Ditagihkan Kepada</h3><p>${b.nama_penyewa}</p><div>${b.alamat || ''}<br>${b.no_hp}</div></div>
        <div class="print-col"><h3>Detail Sewa</h3>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0"><span>Jam Booking</span><strong>${b.waktu_mulai_ms ? fmtDateTime(b.waktu_mulai_ms) : fmtDate(b.tanggal_mulai)}</strong></div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0"><span>Jam Pengembalian</span><strong>${b.waktu_expire_ms ? fmtDateTime(b.waktu_expire_ms) : fmtDate(b.tanggal_selesai)}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Durasi</span><strong>${b.durasi_hari} Hari (${b.durasi_hari * 24} Jam)</strong></div>
        </div>
    </div>
    <table class="print-table">
        <thead><tr><th>Deskripsi</th><th style="text-align:center">Qty</th><th style="text-align:right">Harga</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
        <tr>
            <td><span style="display:block;font-weight:600">${b.ht_kode} × ${b.qty} unit</span><span style="font-size:12px;color:#666">${b.durasi_hari} hari • Booking: ${b.waktu_mulai_ms ? fmtDateTime(b.waktu_mulai_ms) : fmtDate(b.tanggal_mulai)} → Kembali: ${b.waktu_expire_ms ? fmtDateTime(b.waktu_expire_ms) : fmtDate(b.tanggal_selesai)}</span></td>
            <td style="text-align:center">${b.qty}</td>
            <td style="text-align:right">${rupiah(b.harga_per_hari)}/hari</td>
            <td style="text-align:right">${rupiah(b.harga_per_hari * b.durasi_hari * (b.qty || 1))}</td>
        </tr>
        ${accTableRows}
        </tbody>
    </table>
    <div class="print-summary" style="position:relative"><table>
        ${b.subtotal_harga && b.diskon_voucher > 0 ? `<tr><td>Subtotal</td><td>${rupiah(b.subtotal_harga)}</td></tr>` : ''}
        ${b.diskon_voucher > 0 ? `<tr><td>🏷️ Diskon Voucher (${b.kode_voucher})</td><td style="color:#16a34a">- ${rupiah(b.diskon_voucher)}</td></tr>` : ''}
        <tr><td>Total</td><td>${rupiah(b.total_harga)}</td></tr>
        <tr><td>Pembayaran (DP)</td><td>- ${rupiah(b.dp)}</td></tr>
        <tr class="total-row"><td>Sisa Tagihan</td><td class="${b.sisa_bayar > 0 ? 'status-unpaid' : 'status-paid'}">${rupiah(b.sisa_bayar)}</td></tr>
    </table>${b.status_bayar === 'Lunas' ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-60%,-50%) rotate(-30deg);border:5px solid #16a34a;color:#16a34a;font-size:48px;font-weight:900;padding:6px 28px;border-radius:10px;letter-spacing:10px;opacity:.6;font-family:Arial,sans-serif;white-space:nowrap;pointer-events:none">LUNAS</div>` : ''}</div>
    <div class="print-footer"><p>Terima kasih atas kepercayaan Anda!<br>Harap simpan bukti ini sebagai referensi.</p></div>
</div>`;

        /* Inject CSS classes identik dengan @media print di style.css */
        const css = `
            * { box-sizing: border-box; }
            .print-invoice { font-family: Helvetica, Arial, sans-serif; color: #1f2937; padding: 40px; width: 794px; background: #fff; }
            .print-header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
            .print-brand img { height: 60px; margin-bottom: 10px; max-width: 200px; object-fit: contain; display: block; }
            .print-brand h1 { margin: 0; font-size: 22px; color: #111; font-weight: 800; }
            .print-brand p { margin: 4px 0 0; font-size: 13px; color: #4b5563; line-height: 1.4; }
            .invoice-meta { text-align: right; }
            .invoice-meta h2 { margin: 0 0 10px; font-size: 36px; color: #d1d5db; letter-spacing: 4px; font-weight: 800; }
            .invoice-meta p { margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #374151; }
            .invoice-meta span { display: block; font-size: 13px; color: #6b7280; margin-top: 4px; }
            .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .print-col h3 { font-size: 11px; text-transform: uppercase; color: #9ca3af; margin: 0 0 10px; font-weight: 700; letter-spacing: 1px; }
            .print-col p { margin: 0; font-weight: 700; color: #111; font-size: 15px; }
            .print-col div { margin-top: 5px; color: #4b5563; font-size: 14px; line-height: 1.5; }
            .print-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .print-table th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; }
            .print-table td { padding: 16px 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #1f2937; }
            .print-table td:last-child, .print-table th:last-child { text-align: right; }
            .print-table td:first-child { font-weight: 600; color: #111; }
            .print-summary { display: flex; justify-content: flex-end; position: relative; }
            .print-summary table { width: 350px; border-collapse: collapse; }
            .print-summary td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151; }
            .print-summary td:first-child { color: #6b7280; font-weight: 500; }
            .print-summary .total-row td { font-size: 20px; font-weight: 800; border-top: 2px solid #111; padding-top: 20px; color: #111; }
            .status-paid { color: #16a34a; }
            .status-unpaid { color: #dc2626; }
            .print-footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; padding-top: 24px; }
        `;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:#fff;width:794px';
        wrapper.innerHTML = `<style>${css}</style>${invoiceHTML}`;
        document.body.appendChild(wrapper);

        if (s.logo) await new Promise(r => setTimeout(r, 600));
        else await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 794,
            windowWidth: 794
        });
        document.body.removeChild(wrapper);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const imgH  = (canvas.height * pageW) / canvas.width;

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, pageW, imgH);
        pdf.save(`Invoice_${b.invoice_no}_${b.nama_penyewa.replace(/\s+/g,'_')}.pdf`);
        showToast('PDF berhasil diunduh!');

    } catch (err) {
        console.error('PDF error:', err);
        showToast('Gagal membuat PDF', 'error');
    } finally {
        btn.innerHTML = origHTML;
        btn.disabled = false;
    }
}
