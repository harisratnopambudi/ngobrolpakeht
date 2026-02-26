/* HT-PRO Manager - Dashboard Module (v2: pisah HT & Aksesoris) */

let chartRevenue, chartDist, chartTrend;

function renderDashboard() {
    const allUnits = getUnits(), bookings = getBookings();
    const todayStr = today();
    const now = new Date(), cM = now.getMonth(), cY = now.getFullYear();

    /* ── Pisahkan HT dan Aksesoris ── */
    const htUnits  = allUnits.filter(u => !u.type || u.type === 'ht');
    const accUnits = allUnits.filter(u => u.type === 'aksesoris');

    /* ── Statistik HT ── */
    const totalHT  = htUnits.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const availHT  = htUnits.reduce((s, u) => s + getAvailability(u.id, todayStr, todayStr).available, 0);
    const rentedHT = totalHT - availHT;

    /* ── Statistik Aksesoris ── */
    const totalAcc = accUnits.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const availAcc = accUnits.reduce((s, u) => s + getAccAvailability(u.id, todayStr, todayStr).available, 0);
    const rentedAcc = totalAcc - availAcc;

    /* ── Keuangan ── */
    const totalPiutang = bookings
        .filter(b => b.status_sewa === 'Aktif')
        .reduce((s, b) => s + (b.sisa_bayar || 0), 0);
    const monthRev = bookings
        .filter(b => b.status_sewa === 'Selesai')
        .reduce((s, b) => {
            const d = new Date(b.tanggal_mulai);
            return d.getMonth() === cM && d.getFullYear() === cY ? s + b.total_harga : s;
        }, 0);

    /* ── Icon Headset inline ── */
    const ICO_ACC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';

    /* ── Render 5 Stat Cards (tidak redundan) ── */
    document.getElementById('dashStats').innerHTML = `
<div class="stat-card">
  <div class="stat-icon" style="background:rgba(59,130,246,.15);color:var(--accent2)">${ICO.radio}</div>
  <div class="stat-value">${totalHT}</div>
  <div class="stat-label">Total Unit HT</div>
  <div style="font-size:.72rem;color:var(--text2);margin-top:4px">${availHT} tersedia &middot; ${rentedHT} disewa</div>
</div>
<div class="stat-card">
  <div class="stat-icon" style="background:rgba(20,184,166,.15);color:#14b8a6">${ICO_ACC}</div>
  <div class="stat-value">${totalAcc}</div>
  <div class="stat-label">Total Aksesoris</div>
  <div style="font-size:.72rem;color:var(--text2);margin-top:4px">${availAcc} tersedia &middot; ${rentedAcc} disewa</div>
</div>
<div class="stat-card">
  <div class="stat-icon" style="background:rgba(245,158,11,.15);color:var(--accent)">${ICO.signal}</div>
  <div class="stat-value">${rentedHT}</div>
  <div class="stat-label">HT Sedang Disewa</div>
  <div style="font-size:.72rem;color:var(--text2);margin-top:4px">${rentedAcc} aksesoris ikut disewa</div>
</div>
<div class="stat-card">
  <div class="stat-icon" style="background:rgba(245,158,11,.15);color:var(--accent)">${ICO.money}</div>
  <div class="stat-value">${rupiah(monthRev)}</div>
  <div class="stat-label">Pendapatan Bulan Ini</div>
</div>
<div class="stat-card">
  <div class="stat-icon" style="background:rgba(239,68,68,.15);color:var(--danger)">${ICO.warn}</div>
  <div class="stat-value">${rupiah(totalPiutang)}</div>
  <div class="stat-label">Total Piutang Aktif</div>
</div>`;

    /* ── Alerts: hampir jatuh tempo ── */
    const s = getSettings(); const remDays = s.reminderDays || 1;
    const alerts = bookings.filter(b => {
        if (b.status_sewa !== 'Aktif') return false;
        const end = new Date(b.tanggal_selesai);
        const diff = Math.ceil((end - now) / 864e5);
        return diff <= remDays && diff >= 0;
    });

    let alertHTML = '';
    if (alerts.length > 0) {
        alertHTML = '<div class="alert-box"><span class="alert-icon">' + ICO.bell +
            '</span><div class="alert-content"><h4>Perhatian! Segera Jatuh Tempo</h4><p>' +
            alerts.map(a => {
                // Gunakan waktu_expire_ms jika ada (presisi jam+menit), fallback ke akhir hari
                const expMs = a.waktu_expire_ms || new Date(a.tanggal_selesai + 'T23:59:59').getTime();
                const diff = expMs - Date.now();
                let sisaLabel = '';
                if (diff > 0) {
                    const totalMnt = Math.floor(diff / 60000);
                    const hari = Math.floor(totalMnt / 1440);
                    const jam  = Math.floor((totalMnt % 1440) / 60);
                    const mnt  = totalMnt % 60;
                    const parts = [];
                    if (hari > 0) parts.push(hari + 'h');
                    parts.push(String(jam).padStart(2,'0') + 'j');
                    parts.push(String(mnt).padStart(2,'0') + 'm');
                    sisaLabel = ` <span style="color:var(--accent);font-size:.85em">(⏱ ${parts.join(' ')} lagi)</span>`;
                }
                return `<strong>${a.ht_kode}</strong> (x${a.qty || 1}) — ${a.nama_penyewa} · habis ${fmtDate(a.tanggal_selesai)}${sisaLabel}`;
            }).join('<br>') +
            '</p></div></div>';
    }

    /* ── Overdue ── */
    const overdue = bookings.filter(b => b.status_sewa === 'Aktif' && b.tanggal_selesai < todayStr);
    if (overdue.length > 0) {
        alertHTML += '<div class="alert-box"><span class="alert-icon">' + ICO.warn +
            '</span><div class="alert-content"><h4>Terlambat Dikembalikan!</h4><p>' +
            overdue.map(a => `<strong>${a.ht_kode}</strong> (x${a.qty || 1}) — ${a.nama_penyewa} · harusnya ${fmtDate(a.tanggal_selesai)}`).join('<br>') +
            '</p></div></div>';
    }

    document.getElementById('dashAlerts').innerHTML = alertHTML;

    /* ── Recent Bookings ── */
    const recent = [...bookings].sort((a, b) => b.created_at - a.created_at).slice(0, 5);
    document.getElementById('dashRecentBookings').innerHTML = recent.length === 0
        ? '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:30px">Belum ada booking</td></tr>'
        : recent.map(b => {
            const isLate = b.status_sewa === 'Aktif' && b.tanggal_selesai < todayStr;
            return `<tr>
<td>${b.invoice_no}</td>
<td>${b.nama_penyewa}</td>
<td>${b.ht_kode} <span class="badge badge-gray" style="font-size:10px">x${b.qty || 1}</span></td>
<td>${b.durasi_hari} hari</td>
<td>${rupiah(b.total_harga)}</td>
<td><span class="badge ${b.status_bayar === 'Lunas' ? 'badge-success' : b.status_bayar === 'DP' ? 'badge-warning' : 'badge-danger'}">${b.status_bayar}</span></td>
<td><span class="badge ${b.status_sewa === 'Aktif' ? (isLate ? 'badge-danger' : 'badge-info') : b.status_sewa === 'Selesai' ? 'badge-success' : 'badge-gray'}">${isLate ? 'Terlambat' : b.status_sewa}</span></td>
</tr>`;
        }).join('');

    renderDashCharts(htUnits, accUnits, bookings);
}

function renderDashCharts(htUnits, accUnits, bookings) {
    const now = new Date();
    const todayStr = today();

    /* ── Chart 1: Pendapatan Bulanan 12 bulan terakhir ── */
    const labels = [], data = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(monthNames[d.getMonth()].substring(0, 3) + ' ' + d.getFullYear());
        const rev = bookings
            .filter(b => b.status_sewa === 'Selesai')
            .reduce((s, b) => {
                const bd = new Date(b.tanggal_mulai);
                return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear() ? s + b.total_harga : s;
            }, 0);
        data.push(rev);
    }
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(document.getElementById('chartRevenue'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Pendapatan', data, backgroundColor: 'rgba(245,158,11,.7)', borderRadius: 6, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => rupiah(v), color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(45,49,72,.5)' } }, x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } } } }
    });

    /* ── Plugin: tampilkan total di tengah donut ── */
    const centerLabelPlugin = {
        id: 'centerLabel',
        afterDraw(chart) {
            try {
                const { ctx, data, chartArea } = chart;
                if (!chartArea) return;
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                if (!total) return;
                const cx = chartArea.left + chartArea.width / 2;
                const cy = chartArea.top + chartArea.height / 2;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 18px Inter, sans-serif';
                ctx.fillStyle = '#e2e8f0';
                ctx.fillText(total, cx, cy - 8);
                ctx.font = '9px Inter, sans-serif';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText('unit', cx, cy + 9);
                ctx.restore();
            } catch(e) {}
        }
    };

    /* Custom plugin: garis penghubung + label luar donat */
    const pointerLabelPlugin = {
        id: 'pointerLabel',
        afterDraw(chart) {
            try {
                const { ctx, data, chartArea } = chart;
                if (!chartArea) return;
                const meta = chart.getDatasetMeta(0);
                const colors = data.datasets[0].backgroundColor;
                const labels = data.labels;
                const values = data.datasets[0].data;
                const total  = values.reduce((a, b) => a + b, 0);
                if (!total) return;

                const cx = chartArea.left + chartArea.width  / 2;
                const cy = chartArea.top  + chartArea.height / 2;

                ctx.save();
                meta.data.forEach((arc, i) => {
                    if (!values[i]) return;
                    const angle    = (arc.startAngle + arc.endAngle) / 2;
                    const outerR   = arc.outerRadius;
                    const midR     = outerR + 10;
                    const endR     = outerR + 22;
                    const labelR   = outerR + 28;
                    const color    = Array.isArray(colors) ? colors[i] : colors;

                    const x1 = cx + Math.cos(angle) * midR;
                    const y1 = cy + Math.sin(angle) * midR;
                    const x2 = cx + Math.cos(angle) * endR;
                    const y2 = cy + Math.sin(angle) * endR;
                    const lx = cx + Math.cos(angle) * labelR;
                    const ly = cy + Math.sin(angle) * labelR;

                    // Garis pendek dari arc keluar
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Titik ujung
                    ctx.beginPath();
                    ctx.arc(x2, y2, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();

                    // Label teks
                    const pct = Math.round(values[i] / total * 100);
                    const isRight = lx >= cx;
                    ctx.textAlign  = isRight ? 'left' : 'right';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = color;
                    ctx.fillText(labels[i], lx + (isRight ? 4 : -4), ly - 5);
                    ctx.font = '8px Inter, sans-serif';
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText(values[i] + ' unit (' + pct + '%)', lx + (isRight ? 4 : -4), ly + 5);
                });
                ctx.restore();
            } catch(e) {}
        }
    };

    const doughnutOptions = () => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        layout: { padding: 36 },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: ctx => ` ${ctx.label}: ${ctx.raw} unit`
                }
            }
        }
    });

    /* ── Chart 2a: Distribusi HT ── */
    const totalHT  = htUnits.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const availHT  = htUnits.reduce((s, u) => s + getAvailability(u.id, todayStr, todayStr).available, 0);
    const brokenHT = htUnits.filter(u => u.kondisi === 'Rusak').reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const rentedHT = Math.max(0, totalHT - availHT);
    const realAvailHT = Math.max(0, availHT - brokenHT);

    if (chartDist) chartDist.destroy();
    chartDist = new Chart(document.getElementById('chartDistribution'), {
        type: 'doughnut',
        data: {
            labels: ['Tersedia', 'Disewa', 'Rusak'],
            datasets: [{
                data: [realAvailHT, rentedHT, brokenHT],
                backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                borderWidth: 3,
                borderColor: '#1a1d2e',
                hoverBorderWidth: 3
            }]
        },
        options: doughnutOptions(),
        plugins: [centerLabelPlugin, pointerLabelPlugin]
    });

    /* ── Chart 2b: Distribusi Aksesoris ── */
    const totalAcc  = accUnits.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const availAcc  = accUnits.reduce((s, u) => s + getAccAvailability(u.id, todayStr, todayStr).available, 0);
    const brokenAcc = accUnits.filter(u => u.kondisi === 'Rusak').reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
    const rentedAcc = Math.max(0, totalAcc - availAcc);
    const realAvailAcc = Math.max(0, availAcc - brokenAcc);

    const accCanvas = document.getElementById('chartDistAcc');
    if (accCanvas) {
        if (window._chartDistAcc) window._chartDistAcc.destroy();
        if (totalAcc === 0) {
            // Tampilkan placeholder jika belum ada aksesoris
            const ctx2 = accCanvas.getContext('2d');
            ctx2.clearRect(0, 0, accCanvas.width, accCanvas.height);
        } else {
            window._chartDistAcc = new Chart(accCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Tersedia', 'Disewa', 'Rusak'],
                    datasets: [{
                        data: [realAvailAcc, rentedAcc, brokenAcc],
                        backgroundColor: ['#22c55e', '#3b82f6', '#ef4444'],
                        borderWidth: 3,
                        borderColor: '#1a1d2e',
                        hoverBorderWidth: 3
                    }]
                },
                options: doughnutOptions(),
                plugins: [centerLabelPlugin, pointerLabelPlugin]
            });
        }
    }

    /* ── Chart 3: Tren Order Mingguan ── */
    const weekLabels = [], weekData = [];
    for (let i = 7; i >= 0; i--) {
        const wStart = new Date(now); wStart.setDate(wStart.getDate() - i * 7);
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
        weekLabels.push('W' + (8 - i));
        const cnt = bookings.filter(b => { const d = new Date(b.created_at); return d >= wStart && d <= wEnd; }).length;
        weekData.push(cnt);
    }
    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(document.getElementById('chartTrend'), {
        type: 'line',
        data: { labels: weekLabels, datasets: [{ label: 'Order', data: weekData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', fill: true, tension: .4, pointBackgroundColor: '#3b82f6', pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(45,49,72,.5)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } }
    });
}
