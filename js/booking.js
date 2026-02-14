/* HT-PRO Manager - Booking Module */

let editBookingId = null;
let datePickerInstance = null;
let ktpImg = '';
let selfieImg = '';

function handleKTPUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        ktpImg = ev.target.result;
        document.getElementById('ktpImgUpload').innerHTML = `<img src="${ktpImg}">`;
    };
    r.readAsDataURL(f);
}

function handleSelfieUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        selfieImg = ev.target.result;
        document.getElementById('selfieImgUpload').innerHTML = `<img src="${selfieImg}">`;
    };
    r.readAsDataURL(f);
}

function populateHTDropdown() {
    const units = getUnits();
    const sel = document.getElementById('bkHT'); sel.innerHTML = '<option value="">-- Pilih Unit HT --</option>';
    // Display Merk + Model (stored in u.nama)
    units.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = u.nama + ' (' + rupiah(u.harga_per_hari) + '/hari)'; o.dataset.harga = u.harga_per_hari; sel.appendChild(o) });
    sel.onchange = () => { const opt = sel.options[sel.selectedIndex]; document.getElementById('bkHargaHari').value = opt.dataset.harga || ''; calcBooking() };
}

function calcBooking() {
    let mulai = '', selesai = '';

    // 1. Get Dates from Flatpickr
    if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
        mulai = datePickerInstance.selectedDates[0];
        selesai = datePickerInstance.selectedDates[1] || mulia; // Typo fix: mulia -> mulai
        selesai = datePickerInstance.selectedDates[1] || mulai;
    } else {
        // Fallback or external call
        const rangeVal = document.getElementById('bkDateRange').value;
        const parts = rangeVal.split(' to ');
        if (parts.length === 2) {
            mulai = parts[0]; selesai = parts[1];
        } else if (parts.length === 1 && parts[0]) {
            mulai = parts[0]; selesai = parts[0];
        }
    }

    if (!mulai) {
        document.getElementById('bkDurasi').value = '';
        document.getElementById('bkTotal').value = '';
        document.getElementById('bkSisa').value = '';
        return;
    }

    const toYMD = (d) => {
        if (typeof d === 'string') return d;
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };

    const sStr = toYMD(mulai);
    const eStr = toYMD(selesai);

    // 2. Calculate Duration (Independent of Unit)
    const dur = diffDays(sStr, eStr);
    document.getElementById('bkDurasi').value = dur;

    // 3. Calculate Price & Availability (Dependent on Unit)
    const htId = document.getElementById('bkHT').value;

    if (htId && dur > 0) {
        const hpd = parseInt(document.getElementById('bkHargaHari').value) || 0;
        const unit = getUnits().find(u => u.id === htId);
        const qty = parseInt(document.getElementById('bkQty').value) || 1;

        const availData = getAvailability(htId, sStr, eStr, editBookingId);
        if (qty > availData.available) {
            showToast(`Hanya tersedia ${availData.available} unit untuk tanggal ini`, 'error');
            document.getElementById('bkQty').style.borderColor = 'red';
        } else {
            document.getElementById('bkQty').style.borderColor = '';
        }

        let total;
        if (dur >= 7 && unit && unit.harga_per_minggu > 0) {
            const weeks = Math.floor(dur / 7);
            const extraDays = dur % 7;
            total = (weeks * unit.harga_per_minggu + extraDays * hpd) * qty;
        } else {
            total = dur * hpd * qty;
        }

        document.getElementById('bkTotal').value = total;
        const dp = parseInt(document.getElementById('bkDP').value) || 0;
        document.getElementById('bkSisa').value = total - dp;
    } else {
        // Clear price fields if Unit not selected yet
        document.getElementById('bkTotal').value = '';
        document.getElementById('bkSisa').value = '';
    }
}

function genInvoice() { const d = today().replace(/-/g, ''); const bks = getBookings(); const cnt = bks.filter(b => b.invoice_no.includes('INV-' + d)).length; return 'INV-' + d + '-' + String(cnt + 1).padStart(3, '0') }

function openBookingModal() {
    editBookingId = null; populateHTDropdown();
    document.getElementById('bookingModalTitle').textContent = 'Booking Baru';
    ['bkNama', 'bkHP', 'bkAlamat', 'bkDateRange', 'bkDurasi', 'bkHargaHari', 'bkTotal', 'bkDP', 'bkSisa', 'bkKeperluan', 'bkCatatan'].forEach(id => { const el = document.getElementById(id); if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '' });
    document.getElementById('bkDP').value = '0'; document.getElementById('bkStatusBayar').value = 'Belum Bayar';
    document.getElementById('bkQty').value = '1';

    // Reset Images
    ktpImg = ''; selfieImg = '';
    document.getElementById('ktpImgUpload').innerHTML = '<span class="upload-text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Upload KTP</span>';
    document.getElementById('selfieImgUpload').innerHTML = '<span class="upload-text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Upload Selfie</span>';
    document.getElementById('ktpImgInput').value = '';
    document.getElementById('selfieImgInput').value = '';

    if (datePickerInstance) datePickerInstance.destroy();
    if (typeof flatpickr !== 'undefined') {
        datePickerInstance = flatpickr("#bkDateRange", {
            mode: "range",
            minDate: "today",
            dateFormat: "Y-m-d",
            onChange: function (selectedDates, dateStr, instance) {
                calcBooking();
            }
        });
    } else {
        console.error("Flatpickr not loaded");
    }

    openModal('bookingModal');
}

function saveBooking() {
    const nama = document.getElementById('bkNama').value.trim(); const htId = document.getElementById('bkHT').value;

    let mulai = '', selesai = '';
    if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
        const toYMD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        mulai = toYMD(datePickerInstance.selectedDates[0]);
        selesai = toYMD(datePickerInstance.selectedDates[1] || datePickerInstance.selectedDates[0]);
    } else {
        const rangeVal = document.getElementById('bkDateRange').value;
        const parts = rangeVal.split(' to ');
        if (parts.length === 2) { mulai = parts[0]; selesai = parts[1]; }
        else if (parts.length === 1 && parts[0]) { mulai = parts[0]; selesai = parts[0]; }
    }

    if (!mulai || !selesai) { showToast('Mohon pilih periode sewa (Mulai - Selesai)', 'error'); return; }

    const qty = parseInt(document.getElementById('bkQty').value) || 1;

    if (!nama || !htId) { showToast('Mohon lengkapi data wajib', 'error'); return }

    const units = getUnits(); const unit = units.find(u => u.id === htId); if (!unit) { showToast('Unit HT tidak ditemukan', 'error'); return }

    const availData = getAvailability(htId, mulai, selesai, editBookingId);
    if (qty > availData.available) {
        showToast(`Stok tidak cukup! Hanya tersedia ${availData.available} unit.`, 'error');
        return;
    }

    const durasi = parseInt(document.getElementById('bkDurasi').value) || 1; const total = parseInt(document.getElementById('bkTotal').value) || 0; const dp = parseInt(document.getElementById('bkDP').value) || 0;

    const booking = { id: 'b' + Date.now(), invoice_no: genInvoice(), nama_penyewa: nama, no_hp: document.getElementById('bkHP').value.trim(), alamat: document.getElementById('bkAlamat').value.trim(), keperluan: document.getElementById('bkKeperluan').value.trim(), ht_id: htId, ht_kode: unit.nama, tanggal_mulai: mulai, tanggal_selesai: selesai, durasi_hari: durasi, harga_per_hari: unit.harga_per_hari, total_harga: total, dp, sisa_bayar: total - dp, status_bayar: document.getElementById('bkStatusBayar').value, status_sewa: 'Aktif', catatan: document.getElementById('bkCatatan').value.trim(), created_at: Date.now(), qty: qty, ktp_img: ktpImg, selfie_img: selfieImg };

    const bookings = getBookings(); bookings.push(booking); saveBookings(bookings);

    closeModal('bookingModal'); showToast('Booking berhasil dibuat'); renderBookings();
}

function renderBookings() {
    const bookings = getBookings(); const search = (document.getElementById('bookSearch').value || '').toLowerCase();
    const fStatus = document.getElementById('bookFilterStatus').value; const fBayar = document.getElementById('bookFilterBayar').value;
    const filtered = bookings.filter(b => { const sm = !search || b.nama_penyewa.toLowerCase().includes(search) || b.invoice_no.toLowerCase().includes(search) || b.ht_kode.toLowerCase().includes(search); const fs = !fStatus || b.status_sewa === fStatus; const fb = !fBayar || b.status_bayar === fBayar; return sm && fs && fb });
    const sorted = [...filtered].sort((a, b) => b.created_at - a.created_at); const todayStr = today();
    if (sorted.length === 0) { document.getElementById('bookTable').innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text2);padding:30px">Belum ada booking</td></tr>'; return }
    document.getElementById('bookTable').innerHTML = sorted.map(b => {
        const isLate = b.status_sewa === 'Aktif' && b.tanggal_selesai < todayStr;
        const qtyDisplay = b.qty ? ` <span class="badge badge-gray" style="font-size:10px">x${b.qty}</span>` : '';
        return `<tr>
<td data-label="Invoice"><a href="javascript:void(0)" onclick="showBookingDetail('${b.id}')" style="color:var(--accent)">${b.invoice_no}</a></td>
<td data-label="Penyewa">${b.nama_penyewa}</td><td data-label="Unit HT">${b.ht_kode}${qtyDisplay}</td><td data-label="Mulai">${fmtDate(b.tanggal_mulai)}</td><td data-label="Selesai">${fmtDate(b.tanggal_selesai)}</td><td data-label="Durasi">${b.durasi_hari} hari</td><td data-label="Total">${rupiah(b.total_harga)}</td>
<td data-label="Bayar"><span class="badge ${b.status_bayar === 'Lunas' ? 'badge-success' : b.status_bayar === 'DP' ? 'badge-warning' : 'badge-danger'}">${b.status_bayar}</span></td>
<td data-label="Status"><span class="badge ${b.status_sewa === 'Aktif' ? (isLate ? 'badge-danger' : 'badge-info') : b.status_sewa === 'Selesai' ? 'badge-success' : 'badge-gray'}">${isLate ? 'Terlambat' : b.status_sewa}</span></td>
<td data-label="Aksi">${b.status_sewa === 'Aktif' ? `<button class="btn btn-success btn-sm" onclick="completeBooking('${b.id}')">${ICO.check} Selesai</button> <button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')">${ICO.x}</button>` : ''}</td>
</tr>`}).join('')
}

function completeBooking(id) { showConfirm('Selesaikan Booking', 'Tandai booking ini sebagai selesai?', () => { const bookings = getBookings(); const idx = bookings.findIndex(b => b.id === id); if (idx < 0) return; bookings[idx].status_sewa = 'Selesai'; saveBookings(bookings); showToast('Booking selesai'); renderBookings() }) }
function cancelBooking(id) { showConfirm('Batalkan Booking', 'Apakah Anda yakin ingin membatalkan booking ini?', () => { const bookings = getBookings(); const idx = bookings.findIndex(b => b.id === id); if (idx < 0) return; bookings[idx].status_sewa = 'Dibatalkan'; saveBookings(bookings); showToast('Booking dibatalkan'); renderBookings() }) }

function showBookingDetail(id) {
    const b = getBookings().find(x => x.id === id); if (!b) return; const s = getSettings();
    document.getElementById('detailContent').innerHTML = `
<div style="text-align:center;margin-bottom:16px"><h2 style="font-size:1.1rem">${s.bizName || 'HT-PRO Manager'}</h2><p style="font-size:.75rem;color:var(--text2)">${s.bizAddress || ''}<br>${s.bizPhone || ''} • ${s.bizEmail || ''}</p></div>
<hr style="border-color:var(--border);margin:12px 0"><table style="width:100%">
<tr><td style="color:var(--text2);width:120px">Invoice</td><td><strong>${b.invoice_no}</strong></td></tr>
<tr><td style="color:var(--text2)">Penyewa</td><td>${b.nama_penyewa}</td></tr>
<tr><td style="color:var(--text2)">No. HP</td><td>${b.no_hp}</td></tr>
<tr><td style="color:var(--text2)">Alamat</td><td>${b.alamat}</td></tr>
<tr><td style="color:var(--text2)">Unit HT</td><td>${b.ht_kode} <span class="badge badge-gray">x${b.qty || 1} unit</span></td></tr>
<tr><td style="color:var(--text2)">Periode</td><td>${fmtDate(b.tanggal_mulai)} — ${fmtDate(b.tanggal_selesai)} (${b.durasi_hari} hari)</td></tr>
<tr><td style="color:var(--text2)">Keperluan</td><td>${b.keperluan || '-'}</td></tr></table>
${(b.ktp_img || b.selfie_img) ? `
<div class="detail-docs">
    <div class="doc-item">
        <h4>Foto KTP</h4>
        ${b.ktp_img ? `<img src="${b.ktp_img}" class="doc-preview" onclick="const w=window.open();w.document.write('<img src=\\'${b.ktp_img}\\'>')">` : '<div class="doc-preview" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:0.8rem">Tidak ada</div>'}
    </div>
    <div class="doc-item">
        <h4>Foto Selfie</h4>
        ${b.selfie_img ? `<img src="${b.selfie_img}" class="doc-preview" onclick="const w=window.open();w.document.write('<img src=\\'${b.selfie_img}\\'>')">` : '<div class="doc-preview" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:0.8rem">Tidak ada</div>'}
    </div>
</div>` : ''}
<hr style="border-color:var(--border);margin:12px 0"><table style="width:100%">
<tr><td style="color:var(--text2)">Harga/hari</td><td style="text-align:right">${rupiah(b.harga_per_hari)}</td></tr>
<tr><td style="color:var(--text2)">Total</td><td style="text-align:right;font-weight:700;color:var(--accent)">${rupiah(b.total_harga)}</td></tr>
<tr><td style="color:var(--text2)">DP</td><td style="text-align:right">${rupiah(b.dp)}</td></tr>
<tr><td style="color:var(--text2)">Sisa</td><td style="text-align:right">${rupiah(b.sisa_bayar)}</td></tr>
<tr><td style="color:var(--text2)">Status Bayar</td><td style="text-align:right"><span class="badge ${b.status_bayar === 'Lunas' ? 'badge-success' : b.status_bayar === 'DP' ? 'badge-warning' : 'badge-danger'}">${b.status_bayar}</span></td></tr>
</table>`;
    document.getElementById('detailPrintBtn').onclick = () => printInvoice(b);
    openModal('detailModal');
}

function printInvoice(b) {
    const s = getSettings();
    document.getElementById('printArea').innerHTML = `
    <div class="print-invoice">
        <div class="print-header">
            <div class="print-brand">
                ${s.logo ? `<img src="${s.logo}">` : ''}
                <h1>${s.bizName || 'HT-PRO Manager'}</h1>
                <p>${s.bizAddress || ''}<br>${s.bizPhone || ''}</p>
            </div>
            <div class="invoice-meta">
                <h2>INVOICE</h2>
                <p>#${b.invoice_no}</p>
                <span>${fmtDate(b.tanggal_mulai)}</span>
            </div>
        </div>

        <div class="print-grid">
            <div class="print-col">
                <h3>Ditagihkan Kepada</h3>
                <p>${b.nama_penyewa}</p>
                <div>${b.alamat || ''}<br>${b.no_hp}</div>
            </div>
            <div class="print-col">
                <h3>Detail Sewa</h3>
                <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0"><span>Tgl Mulai</span> <strong>${fmtDate(b.tanggal_mulai)}</strong></div>
                <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0"><span>Tgl Selesai</span> <strong>${fmtDate(b.tanggal_selesai)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Durasi</span> <strong>${b.durasi_hari} Hari</strong></div>
            </div>
        </div>

        <table class="print-table">
            <thead>
                <tr>
                    <th>Deskripsi Item</th>
                    <th style="text-align:center">Qty</th>
                    <th style="text-align:right">Harga Satuan</th>
                    <th style="text-align:right">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <span style="display:block;font-weight:600">${b.ht_kode}</span>
                        <span style="font-size:12px;color:#666">Sewa unit HT selama ${b.durasi_hari} hari</span>
                    </td>
                    <td style="text-align:center">${b.qty}</td>
                    <td style="text-align:right">${rupiah(b.total_harga / b.qty)}</td>
                    <td style="text-align:right">${rupiah(b.total_harga)}</td>
                </tr>
            </tbody>
        </table>

        <div class="print-summary">
            <table>
                <tr><td>Subtotal</td><td>${rupiah(b.total_harga)}</td></tr>
                <tr><td>Pembayaran (DP)</td><td>- ${rupiah(b.dp)}</td></tr>
                <tr class="total-row"><td>Sisa Tagihan</td><td class="${b.sisa_bayar > 0 ? 'status-unpaid' : 'status-paid'}">${rupiah(b.sisa_bayar)}</td></tr>
            </table>
        </div>

        <div class="print-footer">
            <p>Terima kasih atas kepercayaan Anda!<br>Syarat & Ketentuan berlaku. Harap simpan bukti pembayaran ini.</p>
        </div>
    </div>`;

    document.getElementById('printArea').style.display = 'block';

    // Safety delay for image loading
    const delay = s.logo ? 500 : 300;

    setTimeout(() => {
        window.print();
        document.getElementById('printArea').style.display = 'none';
    }, delay);
}
