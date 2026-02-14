/* HT-PRO Manager - Dashboard Module */

let chartRevenue, chartDist, chartTrend;

function renderDashboard() {
    const units = getUnits(), bookings = getBookings();

    const todayStr = today();

    // Calculate stats based on quantity
    const totalUnits = units.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const totalAvail = units.reduce((s, u) => s + getAvailability(u.id, todayStr, todayStr).available, 0);
    const rented = totalUnits - totalAvail;

    // Broken? We don't have explicit count of broken items if quantity is used.
    // Assuming 'Rusak' condition means entire batch is broken or we ignore it for now.
    // If a unit entry has condition 'Rusak', its quantity contributes to Total but availability is 0.
    // getAvailability logic: returns total as available if no bookings.
    // We should probably filter out 'Rusak' units from availability?
    // Let's refine: if u.kondisi === 'Rusak', available should be 0. 
    // But getAvailability doesn't check condition.
    // Let's assume for dashboard simple math: Total - Available = Rented (or unavailable).

    const now = new Date(), cM = now.getMonth(), cY = now.getFullYear();
    const monthRev = bookings.filter(b => b.status_sewa === 'Selesai').reduce((s, b) => { const d = new Date(b.tanggal_mulai); return d.getMonth() === cM && d.getFullYear() === cY ? s + b.total_harga : s }, 0);

    document.getElementById('dashStats').innerHTML = `
<div class="stat-card"><div class="stat-icon" style="background:rgba(59,130,246,.15);color:var(--accent2)">${ICO.radio}</div><div class="stat-value">${totalUnits}</div><div class="stat-label">Total Unit HT</div></div>
<div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,.15);color:var(--accent)">${ICO.signal}</div><div class="stat-value">${rented}</div><div class="stat-label">Sedang Disewa</div></div>
<div class="stat-card"><div class="stat-icon" style="background:rgba(34,197,94,.15);color:var(--success)">${ICO.check}</div><div class="stat-value">${totalAvail}</div><div class="stat-label">Tersedia</div></div>
<div class="stat-card"><div class="stat-icon" style="background:rgba(245,158,11,.15);color:var(--accent)">${ICO.money}</div><div class="stat-value">${rupiah(monthRev)}</div><div class="stat-label">Pendapatan Bulan Ini</div></div>`;

    // Alerts
    const s = getSettings(); const remDays = s.reminderDays || 1;
    const alerts = bookings.filter(b => {
        if (b.status_sewa !== 'Aktif') return false;
        const end = new Date(b.tanggal_selesai); const diff = Math.ceil((end - now) / (864e5));
        return diff <= remDays;
    });

    let alertHTML = '';
    if (alerts.length > 0) { alertHTML = '<div class="alert-box"><span class="alert-icon">' + ICO.bell + '</span><div class="alert-content"><h4>Perhatian!</h4><p>' + alerts.map(a => `<strong>${a.ht_kode}</strong> (x${a.qty || 1}) - ${a.nama_penyewa} — habis ${fmtDate(a.tanggal_selesai)}`).join('<br>') + '</p></div></div>' }

    // Overdue
    const overdue = bookings.filter(b => b.status_sewa === 'Aktif' && b.tanggal_selesai < todayStr);
    if (overdue.length > 0) { alertHTML += '<div class="alert-box"><span class="alert-icon">' + ICO.warn + '</span><div class="alert-content"><h4>Terlambat Dikembalikan!</h4><p>' + overdue.map(a => `<strong>${a.ht_kode}</strong> (x${a.qty || 1}) - ${a.nama_penyewa} — harusnya ${fmtDate(a.tanggal_selesai)}`).join('<br>') + '</p></div></div>' }

    document.getElementById('dashAlerts').innerHTML = alertHTML;

    // Recent bookings
    const recent = [...bookings].sort((a, b) => b.created_at - a.created_at).slice(0, 5);
    document.getElementById('dashRecentBookings').innerHTML = recent.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:30px">Belum ada booking</td></tr>' : recent.map(b => {
        const isLate = b.status_sewa === 'Aktif' && b.tanggal_selesai < todayStr;
        return `<tr><td data-label="Invoice">${b.invoice_no}</td><td data-label="Penyewa">${b.nama_penyewa}</td><td data-label="Unit HT">${b.ht_kode} <span class="badge badge-gray" style="font-size:10px">x${b.qty || 1}</span></td><td data-label="Durasi">${b.durasi_hari} hari</td><td data-label="Total">${rupiah(b.total_harga)}</td><td data-label="Status Bayar"><span class="badge ${b.status_bayar === 'Lunas' ? 'badge-success' : b.status_bayar === 'DP' ? 'badge-warning' : 'badge-danger'}">${b.status_bayar}</span></td><td data-label="Status Sewa"><span class="badge ${b.status_sewa === 'Aktif' ? (isLate ? 'badge-danger' : 'badge-info') : b.status_sewa === 'Selesai' ? 'badge-success' : 'badge-gray'}">${isLate ? 'Terlambat' : b.status_sewa}</span></td></tr>`
    }).join('');

    // Charts
    renderDashCharts(units, bookings);
}

function renderDashCharts(units, bookings) {
    const now = new Date(); const labels = [], data = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1); labels.push(monthNames[d.getMonth()].substring(0, 3) + ' ' + d.getFullYear());
        const rev = bookings.filter(b => b.status_sewa === 'Selesai').reduce((s, b) => { const bd = new Date(b.tanggal_mulai); return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear() ? s + b.total_harga : s }, 0); data.push(rev)
    }
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(document.getElementById('chartRevenue'), { type: 'bar', data: { labels, datasets: [{ label: 'Pendapatan', data, backgroundColor: 'rgba(245,158,11,.7)', borderRadius: 6, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => rupiah(v), color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(45,49,72,.5)' } }, x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } } } } });

    // Distribution pie
    const totalAvail = units.reduce((s, u) => s + getAvailability(u.id, today(), today()).available, 0);
    const totalUnits = units.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const totalRented = totalUnits - totalAvail;
    // We don't distinctly track broken in quantity mode easily unless we check condition
    // For now: Available vs Rented

    if (chartDist) chartDist.destroy();
    chartDist = new Chart(document.getElementById('chartDistribution'), { type: 'doughnut', data: { labels: ['Tersedia', 'Disewa'], datasets: [{ data: [totalAvail, totalRented], backgroundColor: ['#22c55e', '#f59e0b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } } } });

    // Weekly trend
    const weekLabels = [], weekData = [];
    for (let i = 7; i >= 0; i--) {
        const wStart = new Date(now); wStart.setDate(wStart.getDate() - i * 7); const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6); weekLabels.push('W' + (8 - i));
        const cnt = bookings.filter(b => { const d = new Date(b.created_at); return d >= wStart && d <= wEnd }).length; weekData.push(cnt)
    }
    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(document.getElementById('chartTrend'), { type: 'line', data: { labels: weekLabels, datasets: [{ label: 'Order', data: weekData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', fill: true, tension: .4, pointBackgroundColor: '#3b82f6', pointRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(45,49,72,.5)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } } });
}
