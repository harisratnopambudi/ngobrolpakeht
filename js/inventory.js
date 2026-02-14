/* HT-PRO Manager - Inventory Module */

let editHTId = null, htImageData = '';

function renderInventory() {
    const units = getUnits(); const search = (document.getElementById('invSearch').value || '').toLowerCase(); const filter = document.getElementById('invFilter').value;
    const todayStr = today();

    const filtered = units.filter(u => {
        // Search by Nama (Merk+Model) or Merk or Model
        const match = !search || u.nama.toLowerCase().includes(search) || u.merk.toLowerCase().includes(search) || u.model.toLowerCase().includes(search);

        const availData = getAvailability(u.id, todayStr, todayStr);
        const avail = availData.available;
        const total = availData.total;

        // Filter logic mapping
        // Tersedia -> avail > 0
        // Disewa -> avail < total
        // Rusak -> kondisi === 'Rusak'
        let fMatch = true;
        if (filter === 'Tersedia') fMatch = avail > 0;
        else if (filter === 'Disewa') fMatch = avail < total;
        else if (filter === 'Rusak') fMatch = u.kondisi === 'Rusak';

        return match && fMatch
    });

    const totalUnits = units.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const totalAvail = units.reduce((s, u) => s + getAvailability(u.id, todayStr, todayStr).available, 0);

    document.getElementById('invCounter').textContent = totalAvail + ' unit tersedia dari ' + totalUnits + ' total';

    if (filtered.length === 0) { document.getElementById('invGrid').innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICO.radio + '</div><h4>Belum ada unit HT</h4><p>Tambahkan unit HT pertama Anda</p></div>'; return }

    const bookings = getBookings();

    document.getElementById('invGrid').innerHTML = filtered.map(u => {
        const availData = getAvailability(u.id, todayStr, todayStr);
        const avail = availData.available;
        const total = availData.total;

        let badge = 'badge-success';
        let statusText = 'Tersedia';
        if (avail === 0) { badge = 'badge-danger'; statusText = 'Habis'; }
        else if (avail < total) { badge = 'badge-warning'; statusText = 'Sebagian Disewa'; }

        if (u.kondisi === 'Rusak') { badge = 'badge-danger'; statusText = 'Rusak'; }

        const totalRentedCount = bookings.filter(b => b.ht_id === u.id).length;
        const totalRev = bookings.filter(b => b.ht_id === u.id && b.status_sewa === 'Selesai').reduce((s, b) => s + b.total_harga, 0);

        return `<div class="inv-card">
<div class="inv-img">${u.foto ? '<img src="' + u.foto + '" alt="' + u.nama + '">' : '<span class="placeholder">' + ICO.radio + '</span>'}</div>
<div class="inv-body">
<div class="inv-header">
<span class="badge ${badge}">${statusText}</span>
<span class="unit-counter">${avail} / ${total} Unit</span>
</div>
<h4>${u.nama}</h4>
<div class="inv-meta">${u.merk} ${u.model}</div>
<div class="inv-price">${rupiah(u.harga_per_hari)} /hari</div>
<div style="font-size:.75rem;color:var(--text2)">${totalRentedCount}x sewa • ${rupiah(totalRev)} total</div>
</div>
<div class="inv-actions"><button class="btn btn-secondary btn-sm" onclick="editHT('${u.id}')">${ICO.edit} Edit</button><button class="btn btn-danger btn-sm" onclick="deleteHT('${u.id}')">${ICO.trash}</button></div>
</div>`
    }).join('')
}

function openHTModal(id) {
    editHTId = id || null; htImageData = '';
    document.getElementById('htModalTitle').textContent = id ? 'Edit Unit HT' : 'Tambah Unit HT';
    if (id) {
        const u = getUnits().find(x => x.id === id);
        if (u) {
            // document.getElementById('htKode').value = u.kode; // Removed
            // document.getElementById('htNama').value = u.nama; // Removed
            document.getElementById('htMerk').value = u.merk;
            document.getElementById('htModel').value = u.model;
            document.getElementById('htFreq').value = u.frekuensi;
            document.getElementById('htKondisi').value = u.kondisi;
            document.getElementById('htHargaHari').value = u.harga_per_hari;
            document.getElementById('htHargaMinggu').value = u.harga_per_minggu;
            document.getElementById('htQty').value = u.quantity || 1;
            document.getElementById('htCatatan').value = u.catatan;
            htImageData = u.foto || '';
            document.getElementById('htImgUpload').innerHTML = u.foto ? '<img src="' + u.foto + '">' : '<span class="upload-text">' + ICO.camera + ' Upload foto HT</span>'
        }
    } else {
        // document.getElementById('htKode').value = 'HT-' + String(getUnits().length + 1).padStart(3, '0'); // Removed
        // document.getElementById('htNama').value = ''; // Removed
        document.getElementById('htMerk').value = '';
        document.getElementById('htModel').value = '';
        document.getElementById('htFreq').value = '';
        document.getElementById('htKondisi').value = 'Baik';
        document.getElementById('htHargaHari').value = '';
        document.getElementById('htHargaMinggu').value = '';
        document.getElementById('htQty').value = '1';
        document.getElementById('htCatatan').value = '';
        document.getElementById('htImgUpload').innerHTML = '<span class="upload-text">' + ICO.camera + ' Upload foto HT</span>'
    }
    openModal('htModal');
}

function editHT(id) { openHTModal(id) }

function handleHTImage(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { htImageData = ev.target.result; document.getElementById('htImgUpload').innerHTML = '<img src="' + htImageData + '">' }; r.readAsDataURL(f) }

function saveHT() {
    // No htKode or htNama inputs anymore
    const merk = document.getElementById('htMerk').value.trim();
    const model = document.getElementById('htModel').value.trim();
    const quantity = parseInt(document.getElementById('htQty').value) || 1;

    if (!merk || !model) { showToast('Merk dan Model wajib diisi', 'error'); return }
    if (quantity < 1) { showToast('Jumlah unit minimal 1', 'error'); return }

    const units = getUnits();
    const nama = `${merk} ${model}`;
    // Internal code generation if needed, or just allow empty
    const kode = ''; // or `HT-${Date.now().toString().slice(-4)}`

    const obj = {
        id: editHTId ? undefined : 'u' + Date.now(), // Preserve ID if editing
        kode, // Hidden/Internal
        nama,
        merk,
        model,
        frekuensi: document.getElementById('htFreq').value.trim(),
        kondisi: document.getElementById('htKondisi').value,
        quantity,
        harga_per_hari: parseInt(document.getElementById('htHargaHari').value) || 0,
        harga_per_minggu: parseInt(document.getElementById('htHargaMinggu').value) || 0,
        foto: htImageData,
        catatan: document.getElementById('htCatatan').value.trim()
    };

    if (editHTId) {
        delete obj.id; // Don't overwrite ID if editing
        const idx = units.findIndex(u => u.id === editHTId);
        if (idx >= 0) { units[idx] = { ...units[idx], ...obj, created_at: units[idx].created_at } } // Keep created_at
        showToast('Unit HT berhasil diperbarui')
    } else {
        obj.created_at = Date.now();
        units.push(obj);
        showToast('Unit HT berhasil ditambahkan')
    }
    saveUnits(units); closeModal('htModal'); renderInventory();
}

function deleteHT(id) { const u = getUnits().find(x => x.id === id); showConfirm('Hapus Unit HT', 'Hapus ' + u.nama + '?', () => { saveUnits(getUnits().filter(x => x.id !== id)); showToast('Unit HT dihapus'); renderInventory() }) }
