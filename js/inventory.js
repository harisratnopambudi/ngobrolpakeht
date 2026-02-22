/* HT-PRO Manager - Inventory Module (v2 with Accessories) */

let editHTId = null, htImageData = '';

/* ========== ICON CONSTANTS ========== */
const ICO_HEADSET = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';

function renderInventory() {
    const units = getUnits();
    const search = (document.getElementById('invSearch').value || '').toLowerCase();
    const filter = document.getElementById('invFilter').value;
    const typeFilter = document.getElementById('invTypeFilter') ? document.getElementById('invTypeFilter').value : '';
    const todayStr = today();

    /* Split into HT and accessories */
    const htUnits = units.filter(u => !u.type || u.type === 'ht');
    const accUnits = units.filter(u => u.type === 'aksesoris');

    const totalHTUnits = htUnits.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const totalHTAvail = htUnits.reduce((s, u) => s + getAvailability(u.id, todayStr, todayStr).available, 0);
    const totalAccUnits = accUnits.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const totalAccAvail = accUnits.reduce((s, u) => s + getAccAvailability(u.id, todayStr, todayStr).available, 0);

    const ICO_HT_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12" y2="6.01"/></svg>';
    const ICO_ACC_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
    document.getElementById('invCounter').innerHTML =
        `<div class="inv-counter-bar">
            <span class="ctr-chip ctr-chip-ht">${ICO_HT_SM} <strong>${totalHTAvail}</strong> / ${totalHTUnits} HT tersedia</span>`
        + (accUnits.length > 0
            ? `<span class="ctr-chip ctr-chip-acc">${ICO_ACC_SM} <strong>${totalAccAvail}</strong> / ${totalAccUnits} aksesoris tersedia <span class="ctr-sub">${accUnits.length} jenis</span></span>`
            : '') +
        `</div>`;

    /* Filter function */
    const matchUnit = (u) => {
        const isHT = !u.type || u.type === 'ht';
        const matchSearch = !search || u.nama.toLowerCase().includes(search) || u.merk.toLowerCase().includes(search) || u.model.toLowerCase().includes(search);
        if (typeFilter === 'ht' && !isHT) return false;
        if (typeFilter === 'aksesoris' && isHT) return false;
        if (!isHT) return matchSearch; // accessories skip status filter
        const availData = getAvailability(u.id, todayStr, todayStr);
        let fMatch = true;
        if (filter === 'Tersedia') fMatch = availData.available > 0;
        else if (filter === 'Disewa') fMatch = availData.available < availData.total;
        else if (filter === 'Rusak') fMatch = u.kondisi === 'Rusak';
        return matchSearch && fMatch;
    };

    const filteredHT = htUnits.filter(matchUnit);
    const filteredAcc = accUnits.filter(matchUnit);
    const bookings = getBookings();

    /* Render HT cards */
    const htHTML = filteredHT.length === 0
        ? `<div class="empty-state"><div class="empty-icon">${ICO.radio}</div><h4>Belum ada unit HT</h4><p>Tambahkan unit HT pertama Anda</p></div>`
        : filteredHT.map(u => renderHTCard(u, bookings, todayStr)).join('');

    /* Render Accessory cards */
    const accHTML = filteredAcc.length === 0 ? '' : filteredAcc.map(u => renderAccCard(u, bookings)).join('');

    let finalHTML = '';
    if (!typeFilter || typeFilter === 'ht') {
        finalHTML += `<div class="inv-section-title"><span class="inv-section-icon">${ICO.radio}</span> Unit Handy Talkie</div>`;
        finalHTML += `<div class="inv-grid">${htHTML}</div>`;
    }
    if ((!typeFilter || typeFilter === 'aksesoris') && (accUnits.length > 0 || typeFilter === 'aksesoris')) {
        finalHTML += `<div class="inv-section-title" style="margin-top:28px"><span class="inv-section-icon">${ICO_HEADSET}</span> Aksesoris</div>`;
        finalHTML += accHTML
            ? `<div class="inv-grid inv-grid-acc">${accHTML}</div>`
            : `<div style="padding:20px;color:var(--text2);font-size:.85rem">Belum ada aksesoris</div>`;
    }

    document.getElementById('invGrid').innerHTML = finalHTML;
}

function renderHTCard(u, bookings, todayStr) {
    const availData = getAvailability(u.id, todayStr, todayStr);
    const avail = availData.available, total = availData.total;
    let badge = 'badge-success', statusText = 'Tersedia';
    if (avail === 0) { badge = 'badge-danger'; statusText = 'Habis'; }
    else if (avail < total) { badge = 'badge-warning'; statusText = 'Sebagian'; }
    if (u.kondisi === 'Rusak') { badge = 'badge-danger'; statusText = 'Rusak'; }
    const totalRev = bookings.filter(b => b.ht_id === u.id && b.status_sewa === 'Selesai').reduce((s, b) => s + b.total_harga, 0);

    return `<div class="inv-card">
<div class="inv-img">${u.foto ? `<img src="${u.foto}" alt="${u.nama}">` : `<span class="placeholder">${ICO.radio}</span>`}</div>
<div class="inv-body">
    <h4>${u.nama}</h4>
    <div class="inv-meta">${u.merk} ${u.model}${u.frekuensi ? ' · ' + u.frekuensi : ''}</div>
    <div class="inv-price">${rupiah(u.harga_per_hari)}<span style="font-size:.68rem;color:var(--text2);font-weight:400">/hari</span></div>
</div>
<div class="inv-card-right">
    <span class="badge ${badge}">${statusText}</span>
    <span style="font-size:.7rem;color:var(--text2);white-space:nowrap">${avail}/${total} unit</span>
    <div class="inv-actions">
        <button class="btn btn-secondary btn-sm" onclick="editHT('${u.id}')" style="padding:5px 9px">${ICO.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteHT('${u.id}')" style="padding:5px 9px">${ICO.trash}</button>
    </div>
</div>
</div>`;
}

function renderAccCard(u, bookings) {
    const total = parseInt(u.quantity) || 0;
    const kondisiBadge = u.kondisi === 'Rusak' ? 'badge-danger' : u.kondisi === 'Rusak Ringan' ? 'badge-warning' : 'badge-success';
    return `<div class="inv-card inv-card-acc">
<div class="inv-img">${u.foto ? `<img src="${u.foto}" alt="${u.nama}">` : `<span class="placeholder">${ICO_HEADSET}</span>`}</div>
<div class="inv-body">
    <h4>${u.nama}</h4>
    <div class="inv-meta">${u.merk} ${u.model}</div>
    <div class="inv-price">${rupiah(u.harga_per_hari)}<span style="font-size:.68rem;color:var(--text2);font-weight:400">/hari</span></div>
</div>
<div class="inv-card-right">
    <span class="badge ${kondisiBadge}">${u.kondisi}</span>
    <span style="font-size:.7rem;color:var(--text2);white-space:nowrap">${total} unit</span>
    <div class="inv-actions">
        <button class="btn btn-secondary btn-sm" onclick="editHT('${u.id}')" style="padding:5px 9px">${ICO.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteHT('${u.id}')" style="padding:5px 9px">${ICO.trash}</button>
    </div>
</div>
</div>`;
}

/* ========== MODAL ========== */
function openHTModal(id) {
    editHTId = id || null; htImageData = '';
    document.getElementById('htModalTitle').textContent = id ? 'Edit Item' : 'Tambah Item';
    const u = id ? getUnits().find(x => x.id === id) : null;
    const isAcc = u && u.type === 'aksesoris';

    /* Type selector */
    const typeEl = document.getElementById('htType');
    if (typeEl) typeEl.value = isAcc ? 'aksesoris' : 'ht';

    /* Toggle freq field visibility */
    toggleHTTypeFields();

    if (u) {
        document.getElementById('htMerk').value = u.merk || '';
        document.getElementById('htModel').value = u.model || '';
        document.getElementById('htFreq').value = u.frekuensi || '';
        document.getElementById('htKondisi').value = u.kondisi || 'Baik';
        document.getElementById('htHargaHari').value = u.harga_per_hari || '';
        document.getElementById('htHargaMinggu').value = u.harga_per_minggu || '';
        document.getElementById('htQty').value = u.quantity || 1;
        document.getElementById('htCatatan').value = u.catatan || '';
        htImageData = u.foto || '';
        document.getElementById('htImgUpload').innerHTML = u.foto ? `<img src="${u.foto}">` : `<span class="upload-text">${ICO.camera} Upload foto</span>`;
    } else {
        document.getElementById('htMerk').value = '';
        document.getElementById('htModel').value = '';
        document.getElementById('htFreq').value = '';
        document.getElementById('htKondisi').value = 'Baik';
        document.getElementById('htHargaHari').value = '';
        document.getElementById('htHargaMinggu').value = '';
        document.getElementById('htQty').value = '1';
        document.getElementById('htCatatan').value = '';
        document.getElementById('htImgUpload').innerHTML = `<span class="upload-text">${ICO.camera} Upload foto</span>`;
    }
    openModal('htModal');
}

function toggleHTTypeFields() {
    const typeEl = document.getElementById('htType');
    if (!typeEl) return;
    const isAcc = typeEl.value === 'aksesoris';
    const freqRow = document.getElementById('htFreqRow');
    if (freqRow) freqRow.style.display = isAcc ? 'none' : '';
    const weeklyRow = document.getElementById('htWeeklyRow');
    if (weeklyRow) weeklyRow.style.display = isAcc ? 'none' : '';
    /* Update placeholder labels */
    const merkLabel = document.querySelector('label[for="htMerk"]');
    if (merkLabel) merkLabel.textContent = isAcc ? 'Merk' : 'Merk';
    const modelLabel = document.querySelector('label[for="htModel"]');
    if (modelLabel) modelLabel.textContent = isAcc ? 'Nama Produk' : 'Model';
}

function editHT(id) { openHTModal(id) }

function handleHTImage(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { htImageData = ev.target.result; document.getElementById('htImgUpload').innerHTML = `<img src="${htImageData}">`; }; r.readAsDataURL(f); }

function saveHT() {
    const merk = document.getElementById('htMerk').value.trim();
    const model = document.getElementById('htModel').value.trim();
    const quantity = parseInt(document.getElementById('htQty').value) || 1;
    const typeEl = document.getElementById('htType');
    const itemType = typeEl ? typeEl.value : 'ht';

    if (!merk) { showToast('Merk wajib diisi', 'error'); return; }
    if (!model) { showToast(itemType === 'aksesoris' ? 'Nama produk wajib diisi' : 'Model wajib diisi', 'error'); return; }
    if (quantity < 1) { showToast('Jumlah minimal 1', 'error'); return; }

    const units = getUnits();
    const nama = `${merk} ${model}`;
    const obj = {
        type: itemType,
        kode: '',
        nama,
        merk,
        model,
        frekuensi: itemType === 'ht' ? document.getElementById('htFreq').value.trim() : '',
        kondisi: document.getElementById('htKondisi').value,
        quantity,
        harga_per_hari: parseInt(document.getElementById('htHargaHari').value) || 0,
        harga_per_minggu: itemType === 'ht' ? (parseInt(document.getElementById('htHargaMinggu').value) || 0) : 0,
        foto: htImageData,
        catatan: document.getElementById('htCatatan').value.trim()
    };

    if (editHTId) {
        const idx = units.findIndex(u => u.id === editHTId);
        if (idx >= 0) { units[idx] = { ...units[idx], ...obj, created_at: units[idx].created_at }; }
        showToast((itemType === 'aksesoris' ? 'Aksesoris' : 'Unit HT') + ' berhasil diperbarui');
    } else {
        obj.id = (itemType === 'aksesoris' ? 'acc' : 'u') + Date.now();
        obj.created_at = Date.now();
        units.push(obj);
        showToast((itemType === 'aksesoris' ? 'Aksesoris' : 'Unit HT') + ' berhasil ditambahkan');
    }
    saveUnits(units); closeModal('htModal'); renderInventory();
}

function deleteHT(id) {
    const u = getUnits().find(x => x.id === id);
    showConfirm('Hapus Item', 'Hapus ' + u.nama + '?', () => {
        saveUnits(getUnits().filter(x => x.id !== id));
        showToast('Item dihapus');
        renderInventory();
    });
}
