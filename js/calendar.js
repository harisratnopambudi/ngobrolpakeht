/* HT-PRO Manager - Calendar Module */

let calYear, calMonth;

function initCal() { const d = new Date(); calYear = d.getFullYear(); calMonth = d.getMonth() }

function calNav(dir) { calMonth += dir; if (calMonth < 0) { calMonth = 11; calYear-- } if (calMonth > 11) { calMonth = 0; calYear++ } renderCalendar() }

function renderCalendar() {
    document.getElementById('calTitle').textContent = monthNames[calMonth] + ' ' + calYear;
    const firstDay = new Date(calYear, calMonth, 1).getDay(); const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const todayD = new Date(); const todayStr = today();

    // Filter active bookings
    const bookings = getBookings().filter(b => b.status_sewa === 'Aktif');

    const units = getUnits(); const unitColorMap = {}; units.forEach((u, i) => { unitColorMap[u.id] = htColors[i % htColors.length] });

    let html = '';
    ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach(d => { html += `<div class="cal-day-header">${d}</div>` });
    const startDay = (firstDay === 0 ? 0 : firstDay);
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) { html += `<div class="cal-day other-month"><span class="day-num">${prevDays - i}</span></div>` }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const isToday = dateStr === todayStr;
        const dayBookings = bookings.filter(b => b.tanggal_mulai <= dateStr && b.tanggal_selesai >= dateStr);

        html += `<div class="cal-day${isToday ? ' today' : ''}" onclick="showDayDetail('${dateStr}')"><span class="day-num">${d}</span>`;
        dayBookings.slice(0, 3).forEach(b => {
            const color = unitColorMap[b.ht_id] || '#666';
            const qtyLabel = b.qty > 1 ? ` (x${b.qty})` : '';
            // ht_kode now stores the name.
            html += `<div class="cal-event" style="background:${color}20;color:${color};border-left:3px solid ${color}" onclick="event.stopPropagation();showBookingDetail('${b.id}')">${b.ht_kode}${qtyLabel}</div>`
        });
        if (dayBookings.length > 3) html += `<div style="font-size:.6rem;color:var(--text2)">+${dayBookings.length - 3} lagi</div>`;
        html += `</div>`
    }

    const totalCells = startDay + daysInMonth; const remaining = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
    for (let i = 1; i <= remaining; i++) { html += `<div class="cal-day other-month"><span class="day-num">${i}</span></div>` }

    document.getElementById('calGrid').innerHTML = html;

    // Legend: Use u.nama instead of code - nama
    document.getElementById('calLegend').innerHTML = units.map((u, i) => `<div class="legend-item"><div class="legend-color" style="background:${htColors[i % htColors.length]}"></div>${u.nama}</div>`).join('');
}

function showDayDetail(dateStr) {
    const bookings = getBookings().filter(b => b.status_sewa === 'Aktif' && b.tanggal_mulai <= dateStr && b.tanggal_selesai >= dateStr);
    if (bookings.length === 0) { showToast('Tidak ada booking pada tanggal ini', 'info'); return }
    document.getElementById('detailContent').innerHTML = `<h4 style="margin-bottom:12px">Booking pada ${fmtDate(dateStr)}</h4>` + bookings.map(b => `<div style="padding:10px;background:var(--bg);border-radius:8px;margin-bottom:8px;border:1px solid var(--border)"><strong>${b.ht_kode}</strong> (x${b.qty || 1}) — ${b.nama_penyewa}<br><span style="font-size:.78rem;color:var(--text2)">${fmtDate(b.tanggal_mulai)} s/d ${fmtDate(b.tanggal_selesai)} • ${rupiah(b.total_harga)}</span></div>`).join('');
    document.getElementById('detailPrintBtn').style.display = 'none';
    openModal('detailModal');
    setTimeout(() => { document.getElementById('detailPrintBtn').style.display = '' }, 0);
}
