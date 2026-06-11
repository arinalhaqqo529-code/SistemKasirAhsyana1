/* ===================================================
   KASIR ATK & PRINT-FOTOCOPY — app.js  v2
   Fitur baru: dark mode, riwayat hari ini default,
   checkbox bulk delete, layanan ATK lengkap,
   import/export Excel & PDF
   =================================================== */
'use strict';

// ===== CONSTANTS =====
const LAYANAN = {
  ATK: [
    'Pulpen','Pensil','Pensil Warna','Pulpen Gel','Spidol Permanen','Spidol Whiteboard',
    'Buku Tulis','Buku Gambar','Buku Folio','Block Note','Agenda/Diary',
    'Penghapus','Penggaris','Penggaris Segitiga','Busur Derajat',
    'Staples & Isi Staples','Klip Kertas (Binder Clip)','Gembok Kertas',
    'Tipe-X (Correction Pen)','Correction Tape','Lem Kertas','Lem Stick',
    'Map Plastik','Map Karton','Ordner/Binder','Stopmap Kertas','Hanging Folder',
    'Amplop Putih','Amplop Coklat','Amplop Besar',
    'Sticky Note','Label Sticker','Kertas HVS A4','Kertas HVS F4','Kertas Buffalo',
    'Kertas Inkjet Foto','Plastik Laminating','Tinta Printer','Cartridge Printer',
    'Materai 10000','Materai 6000',
    'Gunting','Cutter','Isi Cutter','Penjepit Rambut Kertas',
    'Kalkulator','Tempat Pensil','Rautan Pensil',
    'Dan lain-lain'
  ],
  'Print-Fotocopy': [
    'Fotocopy Hitam Putih','Fotocopy Warna','Fotocopy Bolak-Balik',
    'Print Hitam Putih','Print Warna','Print Foto','Print Copy',
    'Laminating A4','Laminating F4','Laminating ID Card',
    'Scan Dokumen','Scan ke PDF','Scan ke JPEG',
    'Jilid Kawat','Jilid Spiral','Jilid Lem Panas','Jilid Mika',
    'Cetak Banner','Cetak Spanduk','Cetak Poster','Cetak ID Card',
    'Cetak Undangan','Cetak Stiker','Cetak Buku Kenangan',
    'Binder Ring','Plastik Cover Jilid',
    'Pengiriman Email / WhatsApp File','Kartu Nama',
    'Dan lain-lain'
  ]
};

const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ===== STATE =====
let transactions = [];
let filteredData  = [];
let deleteTargetId   = null;
let deleteBulkMode   = false;
let charts = {};
let viewMode = 'today';  // 'today' | 'all'
let pendingImportData = [];

// ===== LOCAL STORAGE =====
const LS_KEY      = 'kasir_atk_transactions';
const LS_INIT_KEY = 'kasir_atk_initialized';   // flag: sudah pernah dibuka sebelumnya

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    // Jika key ada (meski isinya array kosong []), gunakan itu — jangan timpa
    if (raw !== null) {
      transactions = JSON.parse(raw);
      if (!Array.isArray(transactions)) transactions = [];
    } else {
      transactions = [];
    }
  } catch(e) {
    console.warn('Gagal load localStorage:', e);
    transactions = [];
  }
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(transactions));
    localStorage.setItem(LS_INIT_KEY, '1');  // tandai sudah diinisialisasi
  } catch(e) {
    console.warn('Gagal menyimpan ke localStorage:', e);
    showToast('⚠️ Gagal menyimpan data! Coba gunakan browser lain.', 'error');
  }
}

// Cek apakah localStorage tersedia dan berfungsi
function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return true;
  } catch(e) { return false; }
}

// Dark mode persist
function loadDarkMode() {
  const dark = localStorage.getItem('kasir_dark') === '1';
  applyDark(dark);
  document.getElementById('darkModeToggle').checked = dark;
  document.getElementById('darkModeToggle2').checked = dark;
}
function toggleDarkMode(on) {
  localStorage.setItem('kasir_dark', on ? '1' : '0');
  applyDark(on);
  document.getElementById('darkModeToggle').checked = on;
  document.getElementById('darkModeToggle2').checked = on;
}
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  // re-render charts with correct colors
  if (document.getElementById('page-dashboard').classList.contains('active')) renderCharts();
}

// ===== HELPERS =====
function rupiah(n) { return 'Rp ' + Math.round(n||0).toLocaleString('id-ID'); }
function parseRupiah(str) { return parseInt((str||'').toString().replace(/\D/g,'')) || 0; }
function formatRupiah(input) {
  const v = parseRupiah(input.value);
  input.value = v === 0 ? '' : v.toLocaleString('id-ID');
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }
function nextNo() { return transactions.length === 0 ? 1 : Math.max(...transactions.map(t=>t.no)) + 1; }
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
       + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function today() { return new Date().toISOString().split('T')[0]; }

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(()=>{ t.className='toast'; }, 2800);
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const el = document.getElementById('topbarTime');
  if (el) el.textContent = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const sd = document.getElementById('sidebarDate');
  if (sd) sd.textContent = now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
setInterval(updateClock, 1000);
updateClock();

// ===== NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('[data-page="'+name+'"]').forEach(n=>n.classList.add('active'));
  const titles = {dashboard:'Dashboard', transaksi:'Input Transaksi', riwayat:'Riwayat Transaksi'};
  document.getElementById('pageTitle').textContent = titles[name]||name;
  if (name==='dashboard') refreshDashboard();
  if (name==='riwayat')   { setViewMode(viewMode, true); }
  if (name==='transaksi') initForm();
  closeSidebar();
}
document.querySelectorAll('[data-page]').forEach(el=>{
  el.addEventListener('click', e=>{ e.preventDefault(); showPage(el.dataset.page); });
});
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }
document.getElementById('menuBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('overlay').addEventListener('click', closeSidebar);

// ===== VIEW MODE (hari ini / semua) =====
function setViewMode(mode, force=false) {
  if (viewMode === mode && !force) return;
  viewMode = mode;
  document.getElementById('btnViewToday').classList.toggle('active', mode==='today');
  document.getElementById('btnViewAll').classList.toggle('active', mode==='all');
  // reset filter inputs when switching
  document.getElementById('filterSearch').value = '';
  document.getElementById('filterDate').value   = '';
  document.getElementById('filterMonth').value  = '';
  document.getElementById('filterJenis').value  = '';
  if (mode==='today') {
    const todayStr = today();
    renderHistory(transactions.filter(t=>t.datetime.startsWith(todayStr)));
  } else {
    renderHistory(transactions);
  }
}

// ===== FORM =====
function initForm() {
  const no = nextNo(), padded = String(no).padStart(3,'0');
  document.getElementById('fNoTrans').value = 'TRX-'+padded;
  document.getElementById('transNoBadge').textContent = '#'+padded;
  document.getElementById('fDateTime').value = new Date().toLocaleString('id-ID');
  document.getElementById('fJenis').value = '';
  document.getElementById('fLayanan').innerHTML = '<option value="">-- Pilih Layanan --</option>';
  document.getElementById('fJumlah').value = '';
  document.getElementById('fKeterangan').value = '';
  document.querySelector('input[name="fPayment"][value="Cash"]').checked = true;
}

function updateLayanan() {
  const jenis = document.getElementById('fJenis').value;
  const sel = document.getElementById('fLayanan');
  sel.innerHTML = '<option value="">-- Pilih Layanan --</option>';
  (LAYANAN[jenis]||[]).forEach(l=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; sel.appendChild(o); });
}

function resetForm() { initForm(); }

function saveTransaksi() {
  const jenis   = document.getElementById('fJenis').value;
  const layanan = document.getElementById('fLayanan').value;
  const jumlah  = parseRupiah(document.getElementById('fJumlah').value);
  const payment = document.querySelector('input[name="fPayment"]:checked').value;
  const ket     = document.getElementById('fKeterangan').value.trim();
  if (!jenis)           { showToast('Pilih jenis transaksi!','error'); return; }
  if (!layanan)         { showToast('Pilih detail layanan!','error'); return; }
  if (!jumlah||jumlah<=0){ showToast('Masukkan jumlah transaksi!','error'); return; }
  const no = nextNo();
  transactions.push({ id:genId(), no, datetime:new Date().toISOString(), jenis, layanan, jumlah, payment, keterangan:ket });
  save();
  showToast('✅ Transaksi #'+String(no).padStart(3,'0')+' berhasil disimpan!', 'success');
  initForm();
}

// ===== HISTORY RENDER =====
function renderHistory(data) {
  filteredData = data || [];
  const tbody = document.getElementById('historyBody');
  // uncheck "select all"
  const ca = document.getElementById('checkAll');
  if (ca) ca.checked = false;
  updateBulkDeleteBtn();

  if (!filteredData.length) {
    const isToday = viewMode==='today';
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${isToday ? '📭 Belum ada transaksi hari ini' : '📭 Belum ada data transaksi'}</td></tr>`;
    updateRekap([]);
    return;
  }
  const sorted = [...filteredData].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
  tbody.innerHTML = sorted.map((t,i)=>`
    <tr data-id="${t.id}">
      <td class="no-print col-check">
        <label class="cb-label">
          <input type="checkbox" class="row-check" value="${t.id}" onchange="onRowCheck()">
          <span class="cb-custom"></span>
        </label>
      </td>
      <td><strong>${i+1}</strong></td>
      <td style="white-space:nowrap;font-size:12px">${fmtDateTime(t.datetime)}</td>
      <td><span class="badge ${t.jenis==='ATK'?'badge-atk':'badge-print'}">${t.jenis}</span></td>
      <td>${t.layanan}</td>
      <td style="font-weight:700;white-space:nowrap">${rupiah(t.jumlah)}</td>
      <td><span class="badge ${t.payment==='Cash'?'badge-cash':'badge-transfer'}">${t.payment}</span></td>
      <td style="max-width:180px;font-size:12px;color:var(--text-muted)">${t.keterangan||'—'}</td>
      <td class="no-print">
        <div class="action-btns">
          <button class="btn-icon btn-edit" onclick="openEdit('${t.id}')">✏️ Edit</button>
          <button class="btn-icon btn-delete" onclick="openDelete('${t.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
  updateRekap(filteredData);
}

function updateRekap(data) {
  const atk      = data.filter(t=>t.jenis==='ATK').reduce((s,t)=>s+t.jumlah,0);
  const print    = data.filter(t=>t.jenis==='Print-Fotocopy').reduce((s,t)=>s+t.jumlah,0);
  const cash     = data.filter(t=>t.payment==='Cash').reduce((s,t)=>s+t.jumlah,0);
  const transfer = data.filter(t=>t.payment==='Transfer').reduce((s,t)=>s+t.jumlah,0);
  document.getElementById('rekapATK').textContent = rupiah(atk);
  document.getElementById('rekapPrint').textContent = rupiah(print);
  document.getElementById('rekapCash').textContent = rupiah(cash);
  document.getElementById('rekapTransfer').textContent = rupiah(transfer);
  document.getElementById('rekapGrand').textContent = rupiah(atk+print);
}

// ===== CHECKBOX BULK DELETE =====
function toggleCheckAll(el) {
  document.querySelectorAll('.row-check').forEach(cb=>{ cb.checked = el.checked; });
  updateBulkDeleteBtn();
}
function onRowCheck() {
  const all = document.querySelectorAll('.row-check');
  const checked = document.querySelectorAll('.row-check:checked');
  document.getElementById('checkAll').checked = all.length === checked.length && all.length > 0;
  updateBulkDeleteBtn();
}
function updateBulkDeleteBtn() {
  const checked = document.querySelectorAll('.row-check:checked');
  const btn = document.getElementById('btnBulkDelete');
  const cnt = document.getElementById('selectedCount');
  if (checked.length > 0) {
    btn.style.display = 'inline-flex';
    cnt.textContent = checked.length;
  } else {
    btn.style.display = 'none';
  }
}
function bulkDelete() {
  const checked = [...document.querySelectorAll('.row-check:checked')].map(cb=>cb.value);
  if (!checked.length) return;
  deleteBulkMode = true;
  deleteTargetId = checked;
  document.getElementById('deleteConfirmText').textContent =
    `Anda yakin ingin menghapus ${checked.length} transaksi yang dipilih? Tindakan ini tidak dapat dibatalkan.`;
  document.getElementById('deleteOverlay').classList.add('open');
}

// ===== FILTER =====
function applyFilter() {
  const search = document.getElementById('filterSearch').value.toLowerCase();
  const date   = document.getElementById('filterDate').value;
  const month  = document.getElementById('filterMonth').value;
  const jenis  = document.getElementById('filterJenis').value;
  let base = viewMode==='today' ? transactions.filter(t=>t.datetime.startsWith(today())) : [...transactions];
  if (search) base = base.filter(t=>
    t.layanan.toLowerCase().includes(search)||t.jenis.toLowerCase().includes(search)||
    t.payment.toLowerCase().includes(search)||(t.keterangan||'').toLowerCase().includes(search));
  if (date)  base = base.filter(t=>t.datetime.startsWith(date));
  if (month) base = base.filter(t=>t.datetime.startsWith(month));
  if (jenis) base = base.filter(t=>t.jenis===jenis);
  renderHistory(base);
}
function clearFilter() {
  ['filterSearch','filterDate','filterMonth'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('filterJenis').value='';
  setViewMode(viewMode, true);
}

// ===== EDIT =====
function openEdit(id) {
  const t = transactions.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('editId').value = id;
  document.getElementById('editJenis').value = t.jenis;
  updateEditLayanan();
  setTimeout(()=>{ document.getElementById('editLayanan').value = t.layanan; }, 0);
  document.getElementById('editJumlah').value = t.jumlah.toLocaleString('id-ID');
  document.getElementById('editKeterangan').value = t.keterangan||'';
  document.querySelector(`input[name="editPayment"][value="${t.payment}"]`).checked = true;
  document.getElementById('modalOverlay').classList.add('open');
}
function updateEditLayanan() {
  const jenis = document.getElementById('editJenis').value;
  const sel = document.getElementById('editLayanan');
  sel.innerHTML = '';
  (LAYANAN[jenis]||[]).forEach(l=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; sel.appendChild(o); });
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
function updateTransaksi() {
  const id  = document.getElementById('editId').value;
  const idx = transactions.findIndex(x=>x.id===id);
  if (idx===-1) return;
  transactions[idx].jenis      = document.getElementById('editJenis').value;
  transactions[idx].layanan    = document.getElementById('editLayanan').value;
  transactions[idx].jumlah     = parseRupiah(document.getElementById('editJumlah').value);
  transactions[idx].payment    = document.querySelector('input[name="editPayment"]:checked').value;
  transactions[idx].keterangan = document.getElementById('editKeterangan').value;
  save(); closeModal();
  showToast('✅ Transaksi berhasil diperbarui!','success');
  applyFilter();
}

// ===== DELETE =====
function openDelete(id) {
  deleteBulkMode = false;
  deleteTargetId = id;
  document.getElementById('deleteConfirmText').textContent = 'Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.';
  document.getElementById('deleteOverlay').classList.add('open');
}
function closeDelete() { deleteTargetId=null; deleteBulkMode=false; document.getElementById('deleteOverlay').classList.remove('open'); }
function confirmDelete() {
  if (!deleteTargetId) return;
  if (deleteBulkMode && Array.isArray(deleteTargetId)) {
    const ids = new Set(deleteTargetId);
    const count = ids.size;
    transactions = transactions.filter(t=>!ids.has(t.id));
    save(); closeDelete();
    showToast(`🗑️ ${count} transaksi berhasil dihapus!`,'success');
  } else {
    transactions = transactions.filter(t=>t.id!==deleteTargetId);
    save(); closeDelete();
    showToast('🗑️ Transaksi berhasil dihapus!','success');
  }
  applyFilter();
}

// ===== DASHBOARD =====
function refreshDashboard() {
  const total = transactions.reduce((s,t)=>s+t.jumlah,0);
  const atk   = transactions.filter(t=>t.jenis==='ATK').reduce((s,t)=>s+t.jumlah,0);
  const print = transactions.filter(t=>t.jenis==='Print-Fotocopy').reduce((s,t)=>s+t.jumlah,0);
  const cnt   = transactions.filter(t=>t.datetime.startsWith(today())).length;
  document.getElementById('statTotal').textContent = rupiah(total);
  document.getElementById('statATK').textContent   = rupiah(atk);
  document.getElementById('statPrint').textContent = rupiah(print);
  document.getElementById('statToday').textContent = cnt + ' Transaksi';
  renderRecentTable();
  renderCharts();
}

function renderRecentTable() {
  const sorted = [...transactions].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime)).slice(0,5);
  const tbody = document.getElementById('recentBody');
  if (!sorted.length) { tbody.innerHTML='<tr><td colspan="5" class="empty-state">Belum ada transaksi</td></tr>'; return; }
  tbody.innerHTML = sorted.map(t=>`
    <tr>
      <td style="font-size:12px">${fmtDateTime(t.datetime)}</td>
      <td><span class="badge ${t.jenis==='ATK'?'badge-atk':'badge-print'}">${t.jenis}</span></td>
      <td>${t.layanan}</td>
      <td style="font-weight:700">${rupiah(t.jumlah)}</td>
      <td><span class="badge ${t.payment==='Cash'?'badge-cash':'badge-transfer'}">${t.payment}</span></td>
    </tr>`).join('');
}

// ===== CHARTS =====
function destroyChart(k) { if (charts[k]) { charts[k].destroy(); charts[k]=null; } }
function isDark() { return document.body.classList.contains('dark'); }
function chartTickColor() { return isDark() ? '#64748b' : '#94a3b8'; }
function chartGridColor() { return isDark() ? '#1e293b' : '#f1f5f9'; }

function renderCharts() {
  renderHarianChart(); renderBulananChart(); renderDonutChart(); renderPaymentChart();
}
function baseScaleOpts() {
  return {
    x: { grid:{display:false}, ticks:{font:{size:10}, color:chartTickColor()} },
    y: { grid:{color:chartGridColor()}, ticks:{font:{size:10}, color:chartTickColor(),
      callback: v => v>=1000000?(v/1000000).toFixed(1)+'jt':v>=1000?(v/1000).toFixed(0)+'rb':v } }
  };
}
function tooltipCallback() { return { label: ctx => ' '+rupiah(ctx.raw) }; }

function renderHarianChart() {
  destroyChart('harian');
  const labels=[],atkData=[],printData=[];
  for (let i=29;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    labels.push(d.getDate()+'/'+(d.getMonth()+1));
    const day=transactions.filter(t=>t.datetime.startsWith(ds));
    atkData.push(day.filter(t=>t.jenis==='ATK').reduce((s,t)=>s+t.jumlah,0));
    printData.push(day.filter(t=>t.jenis==='Print-Fotocopy').reduce((s,t)=>s+t.jumlah,0));
  }
  charts.harian = new Chart(document.getElementById('chartHarian').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'ATK',data:atkData,backgroundColor:'rgba(22,163,74,.7)',borderRadius:4,barPercentage:.7},
      {label:'Print-Fotocopy',data:printData,backgroundColor:'rgba(234,88,12,.7)',borderRadius:4,barPercentage:.7}
    ]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{display:true,labels:{font:{size:11},boxWidth:12,color:chartTickColor()}},
               tooltip:{callbacks:tooltipCallback()}},
      scales:baseScaleOpts()}
  });
}

function renderBulananChart() {
  destroyChart('bulanan');
  const now=new Date(),labels=[],data=[];
  for (let i=11;i>=0;i--) {
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    labels.push(BULAN[d.getMonth()]);
    data.push(transactions.filter(t=>t.datetime.startsWith(d.toISOString().substr(0,7))).reduce((s,t)=>s+t.jumlah,0));
  }
  const ctx=document.getElementById('chartBulanan').getContext('2d');
  const grad=ctx.createLinearGradient(0,0,0,200);
  grad.addColorStop(0,'rgba(37,99,235,.3)'); grad.addColorStop(1,'rgba(37,99,235,0)');
  charts.bulanan = new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{label:'Total',data,borderColor:'#2563eb',backgroundColor:grad,
      borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#2563eb',fill:true,tension:.4}]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{display:false},tooltip:{callbacks:tooltipCallback()}},
      scales:baseScaleOpts()}
  });
}

function donutOpts(labels, data, colors) {
  return {
    type:'doughnut', data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:true,cutout:'65%',
      plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,color:chartTickColor()}},
               tooltip:{callbacks:tooltipCallback()}}}
  };
}
function renderDonutChart() {
  destroyChart('donut');
  const atk=transactions.filter(t=>t.jenis==='ATK').reduce((s,t)=>s+t.jumlah,0);
  const print=transactions.filter(t=>t.jenis==='Print-Fotocopy').reduce((s,t)=>s+t.jumlah,0);
  charts.donut = new Chart(document.getElementById('chartDonut').getContext('2d'),
    donutOpts(['ATK','Print-Fotocopy'],[atk||1,print||1],['#16a34a','#ea580c']));
}
function renderPaymentChart() {
  destroyChart('payment');
  const cash=transactions.filter(t=>t.payment==='Cash').reduce((s,t)=>s+t.jumlah,0);
  const tr=transactions.filter(t=>t.payment==='Transfer').reduce((s,t)=>s+t.jumlah,0);
  charts.payment = new Chart(document.getElementById('chartPayment').getContext('2d'),
    donutOpts(['Cash','Transfer'],[cash||1,tr||1],['#2563eb','#7c3aed']));
}

// ===== EXPORT EXCEL =====
function exportExcel() {
  if (!filteredData.length) { alert('Tidak ada data untuk diekspor!'); return; }
  const sorted=[...filteredData].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
  const rows=sorted.map((t,i)=>({'No':i+1,'Tanggal':fmtDateTime(t.datetime),'Jenis Transaksi':t.jenis,
    'Detail Layanan':t.layanan,'Jumlah (Rp)':t.jumlah,'Metode Pembayaran':t.payment,'Keterangan':t.keterangan||''}));
  const atk=filteredData.filter(t=>t.jenis==='ATK').reduce((s,t)=>s+t.jumlah,0);
  const print=filteredData.filter(t=>t.jenis==='Print-Fotocopy').reduce((s,t)=>s+t.jumlah,0);
  const cash=filteredData.filter(t=>t.payment==='Cash').reduce((s,t)=>s+t.jumlah,0);
  const transfer=filteredData.filter(t=>t.payment==='Transfer').reduce((s,t)=>s+t.jumlah,0);
  rows.push({});
  rows.push({'No':'REKAP','Jenis Transaksi':'Total ATK','Jumlah (Rp)':atk});
  rows.push({'Jenis Transaksi':'Total Print-Fotocopy','Jumlah (Rp)':print});
  rows.push({'Jenis Transaksi':'Total Cash','Jumlah (Rp)':cash});
  rows.push({'Jenis Transaksi':'Total Transfer','Jumlah (Rp)':transfer});
  rows.push({'Jenis Transaksi':'GRAND TOTAL','Jumlah (Rp)':atk+print});
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:5},{wch:20},{wch:18},{wch:22},{wch:14},{wch:18},{wch:28}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Transaksi');
  XLSX.writeFile(wb,'Laporan_Kasir_ATK_'+today()+'.xlsx');
}

// ===== EXPORT PDF =====
function exportPDF() {
  if (!filteredData.length) { alert('Tidak ada data untuk diekspor!'); return; }
  const sorted=[...filteredData].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
  const now=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const atk=filteredData.filter(t=>t.jenis==='ATK').reduce((s,t)=>s+t.jumlah,0);
  const print=filteredData.filter(t=>t.jenis==='Print-Fotocopy').reduce((s,t)=>s+t.jumlah,0);
  const cash=filteredData.filter(t=>t.payment==='Cash').reduce((s,t)=>s+t.jumlah,0);
  const transfer=filteredData.filter(t=>t.payment==='Transfer').reduce((s,t)=>s+t.jumlah,0);
  const rows=sorted.map((t,i)=>`<tr>
    <td>${i+1}</td><td>${fmtDateTime(t.datetime)}</td><td>${t.jenis}</td>
    <td>${t.layanan}</td><td style="text-align:right">${rupiah(t.jumlah)}</td>
    <td>${t.payment}</td><td>${t.keterangan||''}</td></tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Laporan Kasir ATK & Print-Fotocopy</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
  h2{text-align:center;font-size:16px;margin-bottom:2px}
  .sub{text-align:center;font-size:11px;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{background:#1e3a5f;color:white;padding:8px;text-align:left;font-size:11px}
  td{padding:6px 8px;border-bottom:1px solid #eee;font-size:11px}
  tr:nth-child(even) td{background:#f8fafc}
  .rekap table{width:360px}
  .grand{font-weight:bold;font-size:13px;background:#1e3a5f!important;color:white}
  @media print{body{padding:0}}
</style></head><body>
<h2>🖨️ Laporan Transaksi — Kasir ATK & Print-Fotocopy</h2>
<div class="sub">Dicetak: ${now} | ${sorted.length} transaksi</div>
<table><thead><tr><th>No</th><th>Tanggal</th><th>Jenis</th><th>Layanan</th><th>Jumlah</th><th>Pembayaran</th><th>Keterangan</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="rekap"><strong>📊 Rekap Penjualan</strong>
<table style="margin-top:8px">
  <tr><td>Total ATK</td><td style="text-align:right;font-weight:600">${rupiah(atk)}</td></tr>
  <tr><td>Total Print-Fotocopy</td><td style="text-align:right;font-weight:600">${rupiah(print)}</td></tr>
  <tr><td>Total Cash</td><td style="text-align:right;font-weight:600">${rupiah(cash)}</td></tr>
  <tr><td>Total Transfer</td><td style="text-align:right;font-weight:600">${rupiah(transfer)}</td></tr>
  <tr class="grand"><td>GRAND TOTAL</td><td style="text-align:right">${rupiah(atk+print)}</td></tr>
</table></div>
<script>window.onload=()=>window.print()<\/script>
</body></html>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close();
}

// ===== PRINT =====
function printLaporan() {
  document.getElementById('printSubtitle').textContent =
    'Dicetak: '+new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    +' | '+filteredData.length+' transaksi';
  document.querySelector('.print-header').style.display='block';
  window.print();
  document.querySelector('.print-header').style.display='none';
}

// ===== IMPORT EXCEL =====
function importExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, {defval:''});
      // Parse rows
      pendingImportData = [];
      const preview = [];
      raw.forEach((row, idx) => {
        // Accept flexible column names
        const tanggal  = row['Tanggal'] || row['tanggal'] || '';
        const jenis    = (row['Jenis Transaksi'] || row['Jenis'] || row['jenis'] || '').toString().trim();
        const layanan  = (row['Detail Layanan'] || row['Layanan'] || row['layanan'] || '').toString().trim();
        const jumlah   = parseRupiah(row['Jumlah (Rp)'] || row['Jumlah'] || row['jumlah'] || 0);
        const payment  = (row['Metode Pembayaran'] || row['Pembayaran'] || row['pembayaran'] || 'Cash').toString().trim();
        const ket      = (row['Keterangan'] || row['keterangan'] || '').toString().trim();
        // Skip summary/rekap rows
        if (!jenis || ['REKAP','GRAND TOTAL','Total ATK','Total Print-Fotocopy','Total Cash','Total Transfer'].includes(jenis)) return;
        // Validate
        let status = 'ok', statusText = '✅ Valid';
        if (!['ATK','Print-Fotocopy'].includes(jenis)) { status='warn'; statusText='⚠️ Jenis tidak dikenal (akan disimpan)'; }
        if (!jumlah) { status='err'; statusText='❌ Jumlah kosong (dilewati)'; }
        // Parse datetime
        let dtIso = new Date().toISOString();
        if (tanggal) {
          // Try to parse dd/mm/yyyy hh:mm or dd/mm/yyyy
          const parts = tanggal.toString().split(' ');
          const datePart = parts[0];
          const timePart = parts[1] || '00:00';
          const dp = datePart.split(/[\/\-]/);
          if (dp.length===3) {
            const d = new Date(`${dp[2]}-${dp[1].padStart(2,'0')}-${dp[0].padStart(2,'0')}T${timePart}:00`);
            if (!isNaN(d)) dtIso = d.toISOString();
          }
        }
        preview.push({ idx:idx+1, tanggal:tanggal||'Sekarang', jenis, layanan, jumlah, payment, ket, status, statusText });
        if (status !== 'err') {
          pendingImportData.push({ id:genId(), no:0, datetime:dtIso, jenis, layanan, jumlah, payment, keterangan:ket });
        }
      });

      if (!preview.length) { alert('Tidak ada data valid di file Excel ini.'); return; }
      // Show preview modal
      document.getElementById('importInfo').textContent = `Ditemukan ${preview.length} baris. ${pendingImportData.length} baris siap diimport.`;
      document.getElementById('importPreviewBody').innerHTML = preview.map(r=>`
        <tr>
          <td>${r.idx}</td>
          <td style="font-size:11px">${r.tanggal}</td>
          <td>${r.jenis}</td>
          <td>${r.layanan||'—'}</td>
          <td>${rupiah(r.jumlah)}</td>
          <td>${r.payment}</td>
          <td style="font-size:11px">${r.ket||'—'}</td>
          <td class="import-${r.status}">${r.statusText}</td>
        </tr>`).join('');
      document.getElementById('importOverlay').classList.add('open');
    } catch(err) { alert('Gagal membaca file: '+err.message); }
  };
  reader.readAsBinaryString(file);
}

function closeImport() {
  pendingImportData = [];
  document.getElementById('importOverlay').classList.remove('open');
}

function confirmImport() {
  if (!pendingImportData.length) { closeImport(); return; }
  // Re-number
  let nextN = nextNo();
  pendingImportData.forEach(t=>{ t.no = nextN++; });
  transactions.push(...pendingImportData);
  save();
  closeImport();
  showToast(`✅ ${pendingImportData.length} transaksi berhasil diimport!`, 'success');
  pendingImportData = [];
  applyFilter();
}

// ===== TEMPLATE DOWNLOAD =====
// Bonus: user can download a template Excel for easier import
function downloadTemplate() {
  const rows = [
    {'Tanggal':'18/06/2025 09:30','Jenis Transaksi':'ATK','Detail Layanan':'Pulpen','Jumlah (Rp)':5000,'Metode Pembayaran':'Cash','Keterangan':'Contoh data'},
    {'Tanggal':'18/06/2025 10:00','Jenis Transaksi':'Print-Fotocopy','Detail Layanan':'Fotocopy Hitam Putih','Jumlah (Rp)':3000,'Metode Pembayaran':'Transfer','Keterangan':''},
  ];
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:22},{wch:18},{wch:28},{wch:14},{wch:18},{wch:20}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Template');
  XLSX.writeFile(wb,'Template_Import_Kasir.xlsx');
}

// ===== SEED DEMO DATA =====
// Hanya jalan SEKALI saat pertama kali aplikasi dibuka (belum ada flag initialized)
function seedDemoData() {
  const alreadyInitialized = localStorage.getItem(LS_INIT_KEY) === '1';
  // Jika sudah pernah dibuka sebelumnya, JANGAN timpa — meskipun data kosong
  // (pengguna mungkin sengaja menghapus semua transaksi)
  if (alreadyInitialized) return;

  // First install: isi contoh data demo
  const jenisOpts = ['ATK','Print-Fotocopy'];
  const payments  = ['Cash','Transfer'];
  const kets = ['Pelanggan reguler','Bayar lunas','Pesanan khusus','','',''];
  for (let i=0; i<35; i++) {
    const daysAgo = Math.floor(Math.random()*30);
    const d = new Date();
    d.setDate(d.getDate()-daysAgo);
    d.setHours(8+Math.floor(Math.random()*10), Math.floor(Math.random()*60), 0);
    const jenis   = jenisOpts[Math.floor(Math.random()*jenisOpts.length)];
    const opts    = LAYANAN[jenis].slice(0,-1);
    const layanan = opts[Math.floor(Math.random()*opts.length)];
    const payment = payments[Math.floor(Math.random()*payments.length)];
    const jumlah  = (Math.floor(Math.random()*200)+10)*500;
    transactions.push({ id:genId(), no:i+1, datetime:d.toISOString(), jenis, layanan, jumlah, payment, keterangan:kets[Math.floor(Math.random()*kets.length)] });
  }
  save(); // save() juga set flag LS_INIT_KEY = '1'
}

// ===== INIT =====
(function init() {
  if (!isStorageAvailable()) {
    // LocalStorage tidak tersedia (mode private/incognito di beberapa browser)
    console.warn('localStorage tidak tersedia. Data tidak akan tersimpan.');
    // Tetap jalankan app dengan data sementara
    transactions = [];
  } else {
    load();         // baca data dari localStorage
    seedDemoData(); // seed hanya jika first-install (tidak ada flag)
  }
  loadDarkMode();
  showPage('dashboard');
})();
