/* HT-PRO Manager - Report Module */

let chartRR, chartRRanking, chartRYoY;

function renderReport() {
    const bookings = getBookings().filter(b => b.status_sewa === 'Selesai');
    const period = document.getElementById('reportPeriod').value;
    const from = document.getElementById('reportFrom').value; const to = document.getElementById('reportTo').value;

    let filtered = bookings;
    if (period === 'custom' && from && to) { filtered = bookings.filter(b => b.tanggal_mulai >= from && b.tanggal_mulai <= to) }

    const totalRev = filtered.reduce((s, b) => s + b.total_harga, 0);
    const avgRev = filtered.length ? Math.round(totalRev / filtered.length) : 0;
    const maxOrder = filtered.reduce((m, b) => b.total_harga > m ? b.total_harga : m, 0);

    document.getElementById('reportSummary').innerHTML = `
<div class="report-card"><div class="rc-value">${rupiah(totalRev)}</div><div class="rc-label">Total Pendapatan</div></div>
<div class="report-card"><div class="rc-value">${filtered.length}</div><div class="rc-label">Total Order</div></div>
<div class="report-card"><div class="rc-value">${rupiah(avgRev)}</div><div class="rc-label">Rata-rata / Order</div></div>
<div class="report-card"><div class="rc-value">${rupiah(maxOrder)}</div><div class="rc-label">Order Terbesar</div></div>`;

    // Monthly revenue chart
    const now = new Date(); const labels = [], data = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1); labels.push(monthNames[d.getMonth()].substring(0, 3));
        const rev = filtered.reduce((s, b) => { const bd = new Date(b.tanggal_mulai); return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear() ? s + b.total_harga : s }, 0); data.push(rev)
    }
    const maxRev = Math.max(...data);
    if (chartRR) chartRR.destroy();
    chartRR = new Chart(document.getElementById('chartReportRevenue'), { type: 'bar', data: { labels, datasets: [{ label: 'Pendapatan', data, backgroundColor: data.map(v => v === maxRev && v > 0 ? 'rgba(245,158,11,.9)' : 'rgba(59,130,246,.6)'), borderRadius: 6, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => rupiah(v), color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(45,49,72,.5)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } } });

    // HT ranking (by Quantity rented)
    const units = getUnits();
    const ranking = {};
    filtered.forEach(b => {
        ranking[b.ht_kode] = (ranking[b.ht_kode] || 0) + (parseInt(b.qty) || 1)
    });

    const rankSorted = Object.entries(ranking).sort((a, b) => b[1] - a[1]);

    if (chartRRanking) chartRRanking.destroy();
    chartRRanking = new Chart(document.getElementById('chartReportRanking'), { type: 'bar', data: { labels: rankSorted.map(r => r[0]), datasets: [{ label: 'Unit Disewa', data: rankSorted.map(r => r[1]), backgroundColor: 'rgba(34,197,94,.6)', borderRadius: 6, borderSkipped: false }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(45,49,72,.5)' } }, y: { ticks: { color: '#94a3b8' }, grid: { display: false } } } } });

    // YoY comparison
    const thisYear = now.getFullYear(); const lyLabels = [], tyData = [], lyData = [];
    for (let i = 0; i < 12; i++) {
        lyLabels.push(monthNames[i].substring(0, 3));
        tyData.push(filtered.reduce((s, b) => { const d = new Date(b.tanggal_mulai); return d.getMonth() === i && d.getFullYear() === thisYear ? s + b.total_harga : s }, 0));
        lyData.push(bookings.reduce((s, b) => { const d = new Date(b.tanggal_mulai); return d.getMonth() === i && d.getFullYear() === thisYear - 1 ? s + b.total_harga : s }, 0))
    }
    if (chartRYoY) chartRYoY.destroy();
    chartRYoY = new Chart(document.getElementById('chartReportYoY'), { type: 'line', data: { labels: lyLabels, datasets: [{ label: thisYear.toString(), data: tyData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.1)', fill: true, tension: .3 }, { label: (thisYear - 1).toString(), data: lyData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.05)', fill: true, tension: .3, borderDash: [5, 5] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { y: { ticks: { callback: v => rupiah(v), color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(45,49,72,.5)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } } });

    // Detail table
    document.getElementById('reportTable').innerHTML = filtered.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:30px">Tidak ada transaksi</td></tr>' :
        [...filtered].sort((a, b) => b.created_at - a.created_at).map(b => `<tr><td>${b.invoice_no}</td><td>${b.nama_penyewa}</td><td>${b.ht_kode} (x${b.qty || 1})</td><td>${b.durasi_hari} hari</td><td>${rupiah(b.total_harga)}</td><td><span class="badge badge-success">Selesai</span></td><td>${fmtDate(b.tanggal_mulai)}</td></tr>`).join('');
}

function printReport() { window.print() }
