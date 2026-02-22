/* HT-PRO Manager - Voucher Management Module */

/* ========== DATA LAYER ========== */
function getVouchers() { return JSON.parse(localStorage.getItem('ht_vouchers') || '[]'); }
function saveVouchers(d) { localStorage.setItem('ht_vouchers', JSON.stringify(d)); if (typeof sb !== 'undefined' && sb.client) sb.push('ht_vouchers'); }

/* ========== VOUCHER HELPERS ========== */
function findVoucher(kode) {
    if (!kode) return null;
    return getVouchers().find(v => v.kode.toUpperCase() === kode.trim().toUpperCase()) || null;
}

function isVoucherValid(v) {
    if (!v || !v.aktif) return { valid: false, msg: 'Kode voucher tidak aktif.' };
    const now = Date.now();
    if (v.tanggal_mulai && now < new Date(v.tanggal_mulai).getTime()) return { valid: false, msg: 'Voucher belum berlaku.' };
    if (v.tanggal_akhir && now > new Date(v.tanggal_akhir + 'T23:59:59').getTime()) return { valid: false, msg: 'Voucher sudah kadaluarsa.' };
    if (v.maks_penggunaan > 0 && v.jumlah_digunakan >= v.maks_penggunaan) return { valid: false, msg: 'Kuota voucher sudah habis.' };
    return { valid: true, msg: '' };
}

function hitungDiskon(v, subtotal) {
    if (!v) return 0;
    if (v.tipe === 'persen') {
        let diskon = Math.round(subtotal * v.nilai / 100);
        if (v.maks_diskon > 0) diskon = Math.min(diskon, v.maks_diskon);
        return diskon;
    } else if (v.tipe === 'nominal') {
        return Math.min(v.nilai, subtotal);
    }
    return 0;
}

/* Called by booking module after voucher is applied */
function incrementVoucherUsage(kode) {
    if (!kode) return;
    const vouchers = getVouchers();
    const idx = vouchers.findIndex(v => v.kode.toUpperCase() === kode.trim().toUpperCase());
    if (idx >= 0) {
        vouchers[idx].jumlah_digunakan = (vouchers[idx].jumlah_digunakan || 0) + 1;
        saveVouchers(vouchers);
    }
}

/* ========== RENDER VOUCHER PAGE ========== */
function renderVouchers() {
    const vouchers = getVouchers();
    const search = (document.getElementById('voucherSearch')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('voucherFilterStatus')?.value || '';

    const now = Date.now();
    const filtered = vouchers.filter(v => {
        const matchSearch = !search || v.kode.toLowerCase().includes(search) || (v.nama || '').toLowerCase().includes(search);
        if (!matchSearch) return false;
        if (filterStatus === 'aktif') return v.aktif && isVoucherValid(v).valid;
        if (filterStatus === 'nonaktif') return !v.aktif || !isVoucherValid(v).valid;
        return true;
    }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    const totalAktif = vouchers.filter(v => v.aktif && isVoucherValid(v).valid).length;
    const totalDiskon = vouchers.reduce((s, v) => s + (v.total_diskon_diberikan || 0), 0);

    document.getElementById('voucherStats').innerHTML = `
        <div class="voucher-stat-bar">
            <div class="vsb-item"><span class="vsb-val">${vouchers.length}</span><span class="vsb-lbl">Total Voucher</span></div>
            <div class="vsb-item vsb-green"><span class="vsb-val">${totalAktif}</span><span class="vsb-lbl">Aktif</span></div>
            <div class="vsb-item vsb-amber"><span class="vsb-val">${rupiah(totalDiskon)}</span><span class="vsb-lbl">Total Diskon Diberikan</span></div>
        </div>`;

    if (filtered.length === 0) {
        document.getElementById('voucherGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3a2 2 0 0 0-2 2v4a1 1 0 0 0 1 1 1 1 0 0 1 0 2 1 1 0 0 0-1 1v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4a1 1 0 0 0-1-1 1 1 0 0 1 0-2 1 1 0 0 0 1-1V7a2 2 0 0 0-2-2z"/></svg>
                </div>
                <h4>Belum ada voucher</h4>
                <p>Buat voucher pertama untuk promosi bisnis Anda</p>
            </div>`;
        return;
    }

    document.getElementById('voucherGrid').innerHTML = filtered.map(v => {
        const validity = isVoucherValid(v);
        const usagePercent = v.maks_penggunaan > 0 ? Math.min(100, Math.round((v.jumlah_digunakan || 0) / v.maks_penggunaan * 100)) : null;
        const usageBar = usagePercent !== null ? `
            <div class="voucher-usage-bar">
                <div class="vub-track"><div class="vub-fill" style="width:${usagePercent}%;background:${usagePercent >= 90 ? 'var(--danger)' : usagePercent >= 60 ? 'var(--accent)' : '#22c55e'}"></div></div>
                <span>${v.jumlah_digunakan || 0}/${v.maks_penggunaan} digunakan</span>
            </div>` : `<div class="voucher-usage-bar"><span style="color:var(--text2)">${v.jumlah_digunakan || 0}x digunakan • tidak terbatas</span></div>`;

        let statusBadge, statusClass;
        if (!v.aktif) { statusBadge = 'Nonaktif'; statusClass = 'badge-danger'; }
        else if (!validity.valid) { statusBadge = 'Expired/Habis'; statusClass = 'badge-warning'; }
        else { statusBadge = 'Aktif'; statusClass = 'badge-success'; }

        const nilaiLabel = v.tipe === 'persen'
            ? `${v.nilai}%${v.maks_diskon > 0 ? ' (maks ' + rupiah(v.maks_diskon) + ')' : ''}`
            : rupiah(v.nilai);

        const periodeLabel = v.tanggal_mulai || v.tanggal_akhir
            ? `${v.tanggal_mulai ? fmtDate(v.tanggal_mulai) : '∞'} - ${v.tanggal_akhir ? fmtDate(v.tanggal_akhir) : '∞'}`
            : 'Tidak ada batas waktu';

        return `<div class="voucher-card${!v.aktif || !validity.valid ? ' voucher-card-inactive' : ''}">
    <div class="voucher-card-left">
        <div class="voucher-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3a2 2 0 0 0-2 2v4a1 1 0 0 0 1 1 1 1 0 0 1 0 2 1 1 0 0 0-1 1v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4a1 1 0 0 0-1-1 1 1 0 0 1 0-2 1 1 0 0 0 1-1V7a2 2 0 0 0-2-2z"/></svg>
        </div>
        <div class="voucher-info">
            <div class="voucher-kode">${v.kode}</div>
            <div class="voucher-nama">${v.nama || 'Voucher Promo'}</div>
            <div class="voucher-periode">${periodeLabel}</div>
        </div>
    </div>
    <div class="voucher-card-right">
        <div class="voucher-nilai">
            <span class="voucher-diskon-val ${v.tipe === 'persen' ? 'voucher-persen' : 'voucher-nominal'}">${nilaiLabel}</span>
            <span class="voucher-diskon-lbl">${v.tipe === 'persen' ? 'Diskon' : 'Potongan'}</span>
        </div>
        <span class="badge ${statusClass}">${statusBadge}</span>
        ${usageBar}
        <div class="voucher-actions">
            <button class="btn btn-secondary btn-sm" onclick="editVoucher('${v.id}')" style="padding:5px 9px">${ICO.edit}</button>
            <button class="btn ${v.aktif ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleVoucherStatus('${v.id}')" style="padding:5px 9px;font-size:.72rem">${v.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteVoucher('${v.id}')" style="padding:5px 9px">${ICO.trash}</button>
        </div>
    </div>
</div>`;
    }).join('');
}

/* ========== VOUCHER MODAL ========== */
let editVoucherId = null;

function openVoucherModal(id) {
    editVoucherId = id || null;
    document.getElementById('voucherModalTitle').textContent = id ? 'Edit Voucher' : 'Buat Voucher Baru';
    const v = id ? getVouchers().find(x => x.id === id) : null;

    if (v) {
        document.getElementById('vcKode').value = v.kode || '';
        document.getElementById('vcNama').value = v.nama || '';
        document.getElementById('vcTipe').value = v.tipe || 'persen';
        document.getElementById('vcNilai').value = v.nilai || '';
        document.getElementById('vcMaksDiskon').value = v.maks_diskon || '';
        document.getElementById('vcMaksPenggunaan').value = v.maks_penggunaan || '';
        document.getElementById('vcTanggalMulai').value = v.tanggal_mulai || '';
        document.getElementById('vcTanggalAkhir').value = v.tanggal_akhir || '';
        document.getElementById('vcDeskripsi').value = v.deskripsi || '';
        document.getElementById('vcAktif').checked = v.aktif !== false;
    } else {
        document.getElementById('vcKode').value = generateVoucherCode();
        document.getElementById('vcNama').value = '';
        document.getElementById('vcTipe').value = 'persen';
        document.getElementById('vcNilai').value = '';
        document.getElementById('vcMaksDiskon').value = '';
        document.getElementById('vcMaksPenggunaan').value = '';
        document.getElementById('vcTanggalMulai').value = '';
        document.getElementById('vcTanggalAkhir').value = '';
        document.getElementById('vcDeskripsi').value = '';
        document.getElementById('vcAktif').checked = true;
    }
    toggleVoucherTipeFields();
    openModal('voucherModal');
}

function generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return 'PROMO-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function toggleVoucherTipeFields() {
    const tipe = document.getElementById('vcTipe').value;
    const maksDiskonRow = document.getElementById('vcMaksDiskonRow');
    if (maksDiskonRow) {
        if (tipe === 'persen') {
            maksDiskonRow.style.display = '';
        } else {
            // For nominal, hide the max discount field but keep maks penggunaan visible
            maksDiskonRow.style.display = '';
            const maksDiskonField = document.getElementById('vcMaksDiskon');
            if (maksDiskonField) {
                maksDiskonField.closest('.form-group').style.display = tipe === 'persen' ? '' : 'none';
            }
        }
    }
    const nilaiLabel = document.getElementById('vcNilaiLabel');
    if (nilaiLabel) nilaiLabel.textContent = tipe === 'persen' ? 'Diskon (%)' : 'Potongan Harga (Rp)';
    const nilaiPlaceholder = document.getElementById('vcNilai');
    if (nilaiPlaceholder) nilaiPlaceholder.placeholder = tipe === 'persen' ? '10 (artinya 10%)' : '50000';
}

function saveVoucher() {
    const kode = document.getElementById('vcKode').value.trim().toUpperCase();
    const nilai = parseFloat(document.getElementById('vcNilai').value) || 0;
    const tipe = document.getElementById('vcTipe').value;

    if (!kode) { showToast('Kode voucher wajib diisi', 'error'); return; }
    if (nilai <= 0) { showToast('Nilai diskon wajib diisi', 'error'); return; }
    if (tipe === 'persen' && nilai > 100) { showToast('Diskon persen tidak boleh lebih dari 100%', 'error'); return; }

    const vouchers = getVouchers();
    // Check duplicate kode
    const existing = vouchers.find(v => v.kode === kode && v.id !== editVoucherId);
    if (existing) { showToast('Kode voucher sudah digunakan, gunakan kode lain', 'error'); return; }

    const obj = {
        kode,
        nama: document.getElementById('vcNama').value.trim(),
        tipe,
        nilai,
        maks_diskon: parseInt(document.getElementById('vcMaksDiskon').value) || 0,
        maks_penggunaan: parseInt(document.getElementById('vcMaksPenggunaan').value) || 0,
        tanggal_mulai: document.getElementById('vcTanggalMulai').value,
        tanggal_akhir: document.getElementById('vcTanggalAkhir').value,
        deskripsi: document.getElementById('vcDeskripsi').value.trim(),
        aktif: document.getElementById('vcAktif').checked,
    };

    if (editVoucherId) {
        const idx = vouchers.findIndex(v => v.id === editVoucherId);
        if (idx >= 0) vouchers[idx] = { ...vouchers[idx], ...obj };
        showToast('Voucher berhasil diperbarui');
    } else {
        obj.id = 'v' + Date.now();
        obj.created_at = Date.now();
        obj.jumlah_digunakan = 0;
        obj.total_diskon_diberikan = 0;
        vouchers.push(obj);
        showToast('Voucher berhasil dibuat');
    }
    saveVouchers(vouchers);
    closeModal('voucherModal');
    renderVouchers();
}

function editVoucher(id) { openVoucherModal(id); }

function toggleVoucherStatus(id) {
    const vouchers = getVouchers();
    const idx = vouchers.findIndex(v => v.id === id);
    if (idx < 0) return;
    vouchers[idx].aktif = !vouchers[idx].aktif;
    saveVouchers(vouchers);
    showToast(vouchers[idx].aktif ? 'Voucher diaktifkan' : 'Voucher dinonaktifkan');
    renderVouchers();
}

function deleteVoucher(id) {
    const v = getVouchers().find(x => x.id === id);
    showConfirm('Hapus Voucher', `Hapus voucher "${v?.kode}"? Tindakan ini tidak bisa dibatalkan.`, () => {
        saveVouchers(getVouchers().filter(x => x.id !== id));
        showToast('Voucher dihapus');
        renderVouchers();
    });
}
