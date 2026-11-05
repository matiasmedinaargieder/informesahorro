/* ===== Formato ===== */
const nf = (v, d) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtP = v => nf(Math.abs(v) * 100, 1);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const COL = { idx: '#2563eb', fix: '#2a9d8f', neg: '#e5484d', act: '#9aa3b2' };

const S = { file: null, sheets: [], sel: null, opts: { client: '', period: '', showNames: true, types: {} } };
const $ = id => document.getElementById(id);

/* ===== Informe ===== */
function renderReport() {
  const sh = S.sel; if (!sh) return;
  const m = buildModel(sh, { types: S.opts.types, showNames: S.opts.showNames });
  const gas = m.kind === 'gas';
  const dec = m.actual.total < 1500 ? 2 : 0;
  const E = v => nf(v, dec) + ' €';
  const client = (S.opts.client || '').trim(), period = (S.opts.period || '').trim();
  const sub = [client, 'Tarifa ' + sh.tariff, period].filter(Boolean).join(' · ')
    + (sh.kwh ? ` (consumo facturado: ${nf(sh.kwh, 0)} kWh)` : '');
  const kpi = (title, best, cls, kind) => {
    if (!best) return `<div class="kpi"><div class="l">${title}</div><div class="v none">—</div><div class="s">No hay ofertas ${kind === 'fix' ? 'de precio fijo' : 'indexadas'}</div></div>`;
    if (best.saving <= 0) return `<div class="kpi"><div class="l">${title}</div><div class="v none">—</div><div class="s">Sin ahorro (${esc(best.label)})</div></div>`;
    const an = best.annual && best.annual > 0 ? `<div class="s2">≈ ${nf(best.annual, 0)} € al año</div>` : '';
    return `<div class="kpi"><div class="l">${title}</div><div class="v ${cls}">${E(best.saving)}</div>
      <div class="s">${fmtP(best.pct)}% menos en esta factura · ${esc(best.label)}</div>${an}</div>`;
  };
  const maxAbs = Math.max(...m.offers.map(o => Math.abs(o.saving)), 1);
  const maxTot = Math.max(m.actual.total, ...m.offers.map(o => o.total));
  const colorOf = o => (o.saving <= 0 ? COL.neg : o.type === 'idx' ? COL.idx : COL.fix);
  const hasIdx = m.offers.some(o => o.type === 'idx'), hasFix = m.offers.some(o => o.type === 'fix'), hasNeg = m.offers.some(o => o.saving <= 0);
  const leg = [hasIdx ? ['Indexado', COL.idx] : null, hasFix ? ['Precio fijo', COL.fix] : null, hasNeg ? ['Sin ahorro', COL.neg] : null]
    .filter(Boolean).map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');

  const rowsA = m.offers.map(o => {
    const w = Math.max(Math.abs(o.saving) / maxAbs * 100, 2.5);
    const sign = o.saving >= 0 ? '+' : '−';
    return `<div class="br"><div class="n">${esc(o.label)}<small>${esc(o.sub)}</small></div>
      <div class="trk"><div class="fl" style="width:${w}%;background:${colorOf(o)}"></div></div>
      <div class="val ${o.saving > 0 ? 'pos' : 'neg'}">${sign}${E(Math.abs(o.saving))}<small>${fmtP(o.pct)}%</small></div></div>`;
  }).join('');
  const rowsB = [`<div class="brs"><div class="n">Actual<small style="display:block;font-size:11px;font-weight:500;color:#64748b">Tu factura hoy</small></div>
      <div class="trk"><div class="fl" style="width:${m.actual.total / maxTot * 100}%;background:${COL.act}"></div></div><div class="val">${E(m.actual.total)}</div></div>`]
    .concat(m.offers.map(o => `<div class="brs"><div class="n">${esc(o.label)}<small style="display:block;font-size:11px;font-weight:500;color:#64748b">${esc(o.sub)}</small></div>
      <div class="trk"><div class="fl" style="width:${o.total / maxTot * 100}%;background:${colorOf(o)}"></div></div><div class="val">${E(o.total)}</div></div>`)).join('');

  // ---- desglose
  const cols = [{ t: 'Actual', d: m.actual }];
  if (m.bestFix) cols.push({ t: `${m.bestFix.label} · Fijo`, d: m.bestFix });
  if (m.bestIdx) cols.push({ t: `${m.bestIdx.label} · Indexado`, d: m.bestIdx });
  const CON = gas
    ? [['pot', 'Término fijo', '#2563eb'], ['ene', 'Consumo de gas', '#f59e0b'], ['ie', 'Imp. hidrocarburos', '#8b5cf6'], ['iva', 'IVA', '#94a3b8'], ['otros', 'Otros', '#d4d8df']]
    : [['pot', 'Potencia', '#2563eb'], ['ene', 'Energía', '#f59e0b'], ['serv', 'Servicios de ajuste', '#14b8a6'], ['ie', 'Imp. eléctrico', '#8b5cf6'], ['iva', 'IVA', '#94a3b8'], ['otros', 'Otros', '#d4d8df']];
  const con = CON.filter(([k]) => cols.some(c => Math.abs(c.d[k]) >= 0.005));
  const maxC = Math.max(...cols.map(c => c.d.total));
  const stack = cols.map(c => `<div class="brs"><div class="n">${esc(c.t)}</div><div class="trk">${con.map(([k, , colr]) => c.d[k] > 0 ? `<div class="seg" style="width:${c.d[k] / maxC * 100}%;background:${colr}"></div>` : '').join('')}</div><div class="val">${E(c.d.total)}</div></div>`).join('');
  const legC = con.map(([, t, colr]) => `<span><i style="background:${colr}"></i>${t}</span>`).join('');
  const tbl = `<table><thead><tr><th></th>${cols.map(c => `<th>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>
    ${con.map(([k, t]) => `<tr><td>${t}</td>${cols.map(c => `<td>${E(c.d[k])}</td>`).join('')}</tr>`).join('')}
    <tr class="tot"><td>Total factura</td>${cols.map(c => `<td>${E(c.d.total)}</td>`).join('')}</tr></tbody></table>`;
  const cmpTxt = cols.length === 3 ? 'la mejor oferta de precio fijo y la mejor de indexado' : cols.length === 2 ? 'la mejor oferta' : 'las ofertas';

  const a = sh.advisor || {};
  const adv = a.name ? `<br><b>Tu asesor:</b> ${esc([a.name, a.email, a.mobile || a.office].filter(Boolean).join(' · '))}` : '';
  const baseTxt = period ? `el consumo de ${esc(period)}` : 'el consumo de la factura analizada';

  $('report').innerHTML = `
  <div class="blk"><div class="head"><div><h1>Ahorro en tu factura de ${gas ? 'gas' : 'luz'}</h1><div class="sub">${esc(sub)}</div></div><img class="logo" src="${LOGO}" alt=""></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Tu factura actual</div><div class="v">${E(m.actual.total)}</div><div class="s">${period ? esc(period) + ', ' : ''}IVA incluido</div></div>
      ${kpi('Mejor ahorro con precio fijo', m.bestFix, 'fix', 'fix')}
      ${kpi('Mejor ahorro con indexado', m.bestIdx, 'idx', 'idx')}
    </div></div>
  <div class="blk"><div class="box"><h2>¿Cuánto te ahorras con cada oferta?</h2>
    <p class="d">Ahorro en euros ${period ? 'durante ' + esc(period) : 'en esta factura'} frente a tu factura actual.</p>
    <div class="legend">${leg}</div><div class="bars">${rowsA}</div></div></div>
  <div class="blk"><div class="box"><h2>Lo que pagarías con cada oferta</h2>
    <p class="d">Importe total de la factura (con IVA) según la oferta elegida.</p>
    <div class="stack">${rowsB}</div></div></div>
  <div class="blk"><div class="box"><h2>¿De dónde sale el ahorro?</h2>
    <p class="d">Desglose de tu factura: situación actual frente a ${cmpTxt}.</p>
    <div class="legend">${legC}</div><div class="stack">${stack}</div>${tbl}</div></div>
  <div class="blk"><div class="foot">Ahorro calculado con ${baseTxt}. Las ofertas indexadas dependen del precio del mercado, por lo que su importe puede variar en cada factura; las de precio fijo mantienen el precio pactado. Simulación orientativa: los precios pueden cambiar hasta la contratación.${adv}</div></div>`;
  $('previewWrap').hidden = false;
}

/* ===== PDF ===== */
async function makePdf() {
  if (!window.html2canvas || !window.jspdf) throw new Error('lib');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 12, GAP = 4;
  const paint = () => { doc.setFillColor(245, 246, 248); doc.rect(0, 0, W, H, 'F'); };
  paint(); let y = M;
  const blocks = document.querySelectorAll('#report .blk');
  for (const el of blocks) {
    const cv = await html2canvas(el, { scale: 2.5, backgroundColor: '#f5f6f8', useCORS: true, logging: false });
    const w = W - 2 * M, h = cv.height * w / cv.width;
    if (y + h > H - M && y > M) { doc.addPage(); paint(); y = M; }
    doc.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', M, y, w, h);
    y += h + GAP;
  }
  const slug = (S.opts.client || S.sel.client || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'cliente';
  const filename = `Informe_ahorro_${slug}.pdf`;
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) { await dl.save({ filename, data: doc.output('blob') }); }
  else { doc.save(filename); }
}
function pdfError(e) {
  if (e && e.code === 'declined') return ['Descarga cancelada.', ''];
  if (e && e.message === 'lib') return ['No se han podido cargar las herramientas de PDF. Revisa la conexión y recarga la página.', 'err'];
  return ['No he podido generar el PDF. Inténtalo de nuevo.', 'err'];
}

/* ===== Interfaz ===== */
function status(msg, cls) { const s = $('status'); s.textContent = msg || ''; s.className = cls || ''; }
const fmtSize = b => (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB');

function resetAll() {
  S.file = null; S.sheets = []; S.sel = null; S.opts = { client: '', period: '', showNames: false, types: {} };
  $('file').value = ''; $('fileInfo').hidden = true; $('picker').hidden = true; $('adv').hidden = true;
  $('previewWrap').hidden = true; $('go').disabled = true; $('drop').hidden = false; status('');
}

async function loadFile(f) {
  if (!f) return;
  if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) { status('Ese archivo no es un Excel (.xlsx). Prueba con otro.', 'err'); return; }
  resetAll(); S.file = f;
  $('fnm').textContent = f.name; $('fsz').textContent = fmtSize(f.size); $('fileInfo').hidden = false;
  if (!window.XLSX) { status('No se ha podido cargar el lector de Excel. Revisa la conexión y recarga la página.', 'err'); return; }
  status('Leyendo el Excel…');
  try {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const all = parseWorkbook(wb);
    S.sheets = all.filter(s => !s.error);
    if (!S.sheets.length) {
      status(all.some(s => s.error)
        ? 'El Excel no trae los importes calculados. Ábrelo en Excel, guárdalo (Ctrl+G) y vuelve a subirlo.'
        : 'No he encontrado ninguna simulación de luz o gas en este archivo.', 'err');
      return;
    }
    status(`${S.sheets.length === 1 ? 'Simulación encontrada' : S.sheets.length + ' simulaciones encontradas'}. Pulsa “Convertir a PDF”.`);
    $('go').disabled = false;
  } catch (e) { status('No he podido leer el archivo. ¿Está dañado o protegido con contraseña?', 'err'); }
}

function showPicker(msg) {
  $('pickMsg').textContent = msg;
  $('chips').innerHTML = S.sheets.map((s, i) => `<button class="chip${S.sel === s ? ' on' : ''}" data-i="${i}">${esc(s.name)} <small>· ${esc(s.client || 'sin nombre de cliente')}</small></button>`).join('');
  $('picker').hidden = false;
}

function prepareOptions() {
  const sh = S.sel;
  S.opts.client = S.opts.client || sh.client || '';
  $('oClient').value = S.opts.client; $('oPeriod').value = S.opts.period || '';
  const hasBrand = sh.cols.some(c => c.brand);
  $('namesRow').hidden = !hasBrand; $('oNames').checked = S.opts.showNames;
  const m = buildModel(sh, { types: S.opts.types, showNames: false });
  $('typesTbl').innerHTML = `<thead><tr><th>Oferta</th><th>Columna</th><th>Tipo</th></tr></thead><tbody>` + m.offers.map(o =>
    `<tr><td>${esc(o.label)}${o.brand ? ` <span class="tag">(${esc(o.brand)})</span>` : ''}</td><td>${o.letter}${o.typeText ? ` <span class="tag">· ${esc(o.typeText)}</span>` : ''}</td>
     <td><select data-col="${o.letter}"><option value="fix"${o.type === 'fix' ? ' selected' : ''}>Precio fijo</option><option value="idx"${o.type === 'idx' ? ' selected' : ''}>Indexado</option></select></td></tr>`).join('') + '</tbody>';
  $('adv').hidden = false;
}

async function convert() {
  const btn = $('go'); btn.disabled = true;
  try {
    if (!S.sel) {
      const named = S.sheets.filter(s => s.client);
      if (S.sheets.length === 1) S.sel = S.sheets[0];
      else if (named.length === 1) S.sel = named[0];
      else { showPicker('Hay varias simulaciones en este Excel. ¿Cuál quieres convertir?'); status(''); btn.disabled = false; return; }
    }
    $('picker').hidden = S.sheets.length < 2;
    if (S.sheets.length > 1) showPicker('Simulación elegida (puedes cambiarla):');
    status('Generando el informe…');
    prepareOptions(); renderReport();
    await new Promise(r => setTimeout(r, 60));
    await makePdf();
    status('PDF descargado ✓', 'ok');
  } catch (e) { const [m, c] = pdfError(e); status(m, c); }
  btn.disabled = false;
}

const drop = $('drop'), fin = $('file');
drop.addEventListener('click', () => fin.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fin.click(); } });
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { if (!drop.contains(e.target)) e.preventDefault(); });
fin.addEventListener('change', () => loadFile(fin.files[0]));
$('rm').addEventListener('click', resetAll);
$('go').addEventListener('click', convert);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  S.sel = S.sheets[+b.dataset.i]; S.opts.client = ''; S.opts.types = {}; convert();
});
$('oClient').addEventListener('input', e => { S.opts.client = e.target.value; renderReport(); });
$('oPeriod').addEventListener('input', e => { S.opts.period = e.target.value; renderReport(); });
$('oNames').addEventListener('change', e => { S.opts.showNames = e.target.checked; renderReport(); prepareOptionsKeep(); });
function prepareOptionsKeep() { const c = $('oClient').value, p = $('oPeriod').value; prepareOptions(); $('oClient').value = c; $('oPeriod').value = p; }
$('typesTbl').addEventListener('change', e => {
  const s = e.target.closest('select'); if (!s) return;
  S.opts.types[s.dataset.col] = s.value; renderReport(); prepareOptionsKeep();
});
async function downloadNow() { status('Generando el PDF…'); try { await makePdf(); status('PDF descargado ✓', 'ok'); } catch (e) { const [m, c] = pdfError(e); status(m, c); } }
$('regen').addEventListener('click', () => { renderReport(); downloadNow(); });
$('dl').addEventListener('click', downloadNow);
