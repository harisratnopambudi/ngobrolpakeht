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
        [...filtered].sort((a, b) => b.created_at - a.created_at).map(b => `<tr><td data-label="Invoice">${b.invoice_no}</td><td data-label="Penyewa">${b.nama_penyewa}</td><td data-label="Unit">${b.ht_kode} (x${b.qty || 1})</td><td data-label="Durasi">${b.durasi_hari} hari</td><td data-label="Total">${rupiah(b.total_harga)}</td><td data-label="Status"><span class="badge badge-success">Selesai</span></td><td data-label="Tanggal">${fmtDate(b.tanggal_mulai)}</td></tr>`).join('');
}

function printReport() {
    const s = getSettings();
    const period = document.getElementById('reportPeriod').value;
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    let periodStr = period.charAt(0).toUpperCase() + period.slice(1);
    if (period === 'custom' && from && to) periodStr += ` (${fmtDate(from)} - ${fmtDate(to)})`;

    // 1. Get Chart Images
    const imgRev = chartRR ? chartRR.toBase64Image() : '';
    const imgRank = chartRRanking ? chartRRanking.toBase64Image() : '';
    const imgYoY = chartRYoY ? chartRYoY.toBase64Image() : '';

    // 2. Extract summary data
    // We assume the order of cards in the DOM matches our desired extraction
    const summaryCards = document.querySelectorAll('#reportSummary .report-card');
    const summaries = Array.from(summaryCards).map(card => ({
        val: card.querySelector('.rc-value').innerText,
        lbl: card.querySelector('.rc-label').innerText
    }));

    // 3. Clone table
    const tableHTML = document.getElementById('reportTable').innerHTML;

    document.getElementById('printArea').innerHTML = `
    <div class="print-container">
        <div class="print-header">
            <div class="print-brand">
                ${s.logo ? `<img src="${s.logo}">` : ''}
                <h1>${s.bizName || 'HT-PRO Manager'}</h1>
                <p>${s.bizAddress || ''}<br>${s.bizPhone || ''}</p>
            </div>
            <div class="print-meta">
                <h2>LAPORAN KEUANGAN</h2>
                <p>Periode: ${periodStr}</p>
                <p>Dicetak: ${new Date().toLocaleDateString('id-ID')}</p>
            </div>
        </div>

        <div class="print-section-title">Ringkasan Eksekutif</div>
        <div class="print-summary-grid">
            ${summaries.map(s => `
                <div class="print-summary-card">
                    <span class="print-summary-val">${s.val}</span>
                    <span class="print-summary-lbl">${s.lbl}</span>
                </div>
            `).join('')}
        </div>

        <div class="print-section-title">Analisis Grafik</div>
        <div class="print-charts">
            <div class="print-chart-box">
                <h4>Tren Pendapatan Bulanan</h4>
                <img src="${imgRev}">
            </div>
            <div class="print-chart-box">
                <h4>Unit Terlaris</h4>
                <img src="${imgRank}">
            </div>
        </div>
        <div class="print-charts" style="margin-top:20px">
             <div class="print-chart-box" style="grid-column: span 2">
                <h4>Perbandingan Tahun ke Tahun (YoY)</h4>
                <img src="${imgYoY}" style="max-height:250px">
            </div>
        </div>

        <div class="print-section-title" style="page-break-before:always">Rincian Transaksi</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Invoice</th>
                    <th>Penyewa</th>
                    <th>Unit</th>
                    <th>Durasi</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Tanggal</th>
                </tr>
            </thead>
            <tbody>
                ${tableHTML}
            </tbody>
        </table>

        <div class="print-signature">
            <div class="signature-box">
                <p style="margin-bottom:50px">Mengetahui,</p>
                <div class="signature-line"></div>
                <p>Manager Operasional</p>
            </div>
        </div>

        <div class="print-footer">
            Dokumen ini dicetak otomatis oleh sistem HT-PRO Manager.
        </div>
    </div>`;

    document.getElementById('printArea').style.display = 'block';

    // Allow images to render
    setTimeout(() => {
        window.print();
        document.getElementById('printArea').style.display = 'none';
        document.getElementById('printArea').innerHTML = '';
    }, 800);
}
