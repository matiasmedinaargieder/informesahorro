/* ===== Formato ===== */
const nf = (v, d) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtP = v => nf(Math.abs(v) * 100, 1);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const COL = { idx: '#2563eb', fix: '#2a9d8f', neg: '#e5484d', act: '#9aa3b2' };

const S = { file: null, sheets: [], sel: null, pfile: null, psheets: [], opts: { client: '', period: '', showNames: true, types: {} } };
const $ = id => document.getElementById(id);

/* ===== Informe ===== */
function renderComparison() {
  const sh = S.sel;
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

  return `<div class="rep">
  <div class="blk"><div class="head"><div><h1>Ahorro en tu factura de ${gas ? 'gas' : 'luz'}</h1><div class="sub">${esc(sub)}</div></div><img class="logo" src="img/logo.png" alt=""></div>
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
  <div class="blk"><div class="foot">Ahorro calculado con ${baseTxt}. Las ofertas indexadas dependen del precio del mercado, por lo que su importe puede variar en cada factura; las de precio fijo mantienen el precio pactado. Simulación orientativa: los precios pueden cambiar hasta la contratación.${adv}</div></div>
  </div>`;
}

/* ===== Informe de ajuste de potencia ===== */
function renderPower(p) {
  const E = v => nf(v, 2) + ' €';
  const kw = v => nf(v, Number.isInteger(v) ? 0 : 2);
  const who = (S.opts.clientEdited ? S.opts.client : (p.holder || S.opts.client) || '').trim();
  const sub = [who, p.cups ? 'CUPS ' + p.cups : '', 'Tarifa ' + p.tariff].filter(Boolean).join(' · ')
    + (p.days ? ` (${nf(p.days, Number.isInteger(p.days) ? 0 : 2)} días facturados)` : '');
  const pct = p.totalOldIva ? (p.totalOldIva - p.totalNewIva) / p.totalOldIva : 0;
  const good = p.savMIva > 0.005;
  const per = p.periods.filter(x => x.kwOld > 0 || x.kwNew > 0);
  const maxKw = Math.max(...per.map(x => Math.max(x.kwOld, x.kwNew)), 1);
  const maxT = Math.max(p.totalOldIva, p.totalNewIva, 1);

  const kpi3 = good
    ? `<div class="kpi"><div class="l">Ahorro mensual</div><div class="v fix">${E(p.savMIva)}</div><div class="s">${fmtP(pct)}% menos en potencia · IVA incluido</div>${p.savAIva > 0 ? `<div class="s2">≈ ${E(p.savAIva)} al año</div>` : ''}</div>`
    : `<div class="kpi"><div class="l">${p.savMIva < -0.005 ? 'Sobrecoste mensual' : 'Ahorro mensual'}</div><div class="v ${p.savMIva < -0.005 ? 'neg' : 'none'}">${p.savMIva < -0.005 ? '−' + E(Math.abs(p.savMIva)) : '—'}</div><div class="s">${p.savMIva < -0.005 ? 'La nueva potencia cuesta más' : 'Sin cambios en el coste'}</div></div>`;

  const rowsKw = per.map(x => {
    const d = x.kwNew - x.kwOld;
    const dTxt = Math.abs(d) < 1e-9 ? 'sin cambios' : `${d < 0 ? '−' : '+'}${kw(Math.abs(d))} kW`;
    const dCls = Math.abs(d) < 1e-9 ? 'muted' : d < 0 ? 'pos' : 'neg';
    return `<div class="brp"><div class="n">${x.label}</div>
      <div class="twin"><div class="trk"><div class="fl" style="width:${x.kwOld / maxKw * 100}%;background:${COL.act}"></div></div>
      <div class="trk"><div class="fl" style="width:${x.kwNew / maxKw * 100}%;background:${COL.fix}"></div></div></div>
      <div class="val">${kw(x.kwOld)} → ${kw(x.kwNew)} kW<small class="${dCls}">${dTxt}</small></div></div>`;
  }).join('');

  const stack = `<div class="brs"><div class="n">Actual<small style="display:block;font-size:11px;font-weight:500;color:#64748b">Tu potencia hoy</small></div>
      <div class="trk"><div class="fl" style="width:${p.totalOldIva / maxT * 100}%;background:${COL.act}"></div></div><div class="val">${E(p.totalOldIva)}</div></div>
    <div class="brs"><div class="n">Con ajuste<small style="display:block;font-size:11px;font-weight:500;color:#64748b">Potencia nueva</small></div>
      <div class="trk"><div class="fl" style="width:${p.totalNewIva / maxT * 100}%;background:${COL.fix}"></div></div><div class="val">${E(p.totalNewIva)}</div></div>`;

  const sv = v => `<td class="${v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : ''}">${v > 0.005 ? '+' : v < -0.005 ? '−' : ''}${E(Math.abs(v))}</td>`;
  const tbl = `<table class="pw"><thead><tr><th>Periodo</th><th>kW hoy</th><th>kW nueva</th><th>€/kW·día</th><th>Coste hoy</th><th>Coste nuevo</th><th>Ahorro</th></tr></thead><tbody>
    ${per.map(x => `<tr><td>${x.label}</td><td>${kw(x.kwOld)}</td><td>${kw(x.kwNew)}</td><td>${nf(x.price, 6)}</td><td>${E(x.costOld)}</td><td>${E(x.costNew)}</td>${sv(x.costOld - x.costNew)}</tr>`).join('')}
    <tr class="sub"><td colspan="4">Total potencia (sin IVA)</td><td>${E(p.totalOld)}</td><td>${E(p.totalNew)}</td>${sv(p.totalOld - p.totalNew)}</tr>
    <tr><td colspan="4">IVA (${nf(p.rate * 100, 0)}%)</td><td>${E(p.ivaOld)}</td><td>${E(p.ivaNew)}</td>${sv(p.ivaOld - p.ivaNew)}</tr>
    <tr class="tot"><td colspan="4">Total con IVA</td><td>${E(p.totalOldIva)}</td><td>${E(p.totalNewIva)}</td>${sv(p.totalOldIva - p.totalNewIva)}</tr></tbody></table>`;
  const sum = `<div class="sum">
    <div class="${p.savMIva < 0 ? 'bad' : ''}"><span>Ahorro mensual</span><b>${E(p.savMIva)}</b><small>Sin IVA: ${E(p.savM)}</small></div>
    <div class="${p.savAIva < 0 ? 'bad' : ''}"><span>Ahorro anual estimado</span><b>${E(p.savAIva)}</b><small>Sin IVA: ${E(p.savA)}</small></div></div>`;

  const noteBlk = p.note ? `<div class="blk"><div class="box note"><h2>A tener en cuenta</h2><p>${esc(p.note)}</p></div></div>` : '';
  const contact = p.contact && p.contact.length ? `<br><b>Argieder</b> · ${esc(p.contact.join(' · '))}` : '';
  return `<div class="rep">
  <div class="blk"><div class="head"><div><h1>Ahorro con el ajuste de potencia</h1><div class="sub">${esc(sub)}</div></div><img class="logo" src="img/logo.png" alt=""></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Pagas hoy por potencia</div><div class="v">${E(p.totalOldIva)}</div><div class="s">${p.days ? nf(p.days, Number.isInteger(p.days) ? 0 : 2) + ' días, ' : ''}IVA incluido</div></div>
      <div class="kpi"><div class="l">Pagarías con el ajuste</div><div class="v idx">${E(p.totalNewIva)}</div><div class="s">IVA incluido</div></div>
      ${kpi3}
    </div></div>
  <div class="blk"><div class="box"><h2>¿Qué potencia contratarías?</h2>
    <p class="d">Potencia contratada hoy frente a la potencia que se contrataría en cada periodo (kW).</p>
    <div class="legend"><span><i style="background:${COL.act}"></i>Actual</span><span><i style="background:${COL.fix}"></i>Con ajuste</span></div>
    <div class="bars">${rowsKw}</div></div></div>
  <div class="blk"><div class="box"><h2>¿Cuánto pagas de potencia?</h2>
    <p class="d">Coste de la potencia en el periodo facturado: situación actual frente a la potencia nueva.</p>
    <div class="stack">${stack}</div>${tbl}${sum}</div></div>
  ${noteBlk}
  <div class="blk"><div class="foot">Ahorro calculado con ${p.days ? nf(p.days, Number.isInteger(p.days) ? 0 : 2) + ' días de facturación' : 'el periodo facturado'}; el ahorro anual se estima a partir del mensual (365 días). Simulación orientativa: los precios de la potencia pueden variar.${contact}</div></div>
  </div>`;
}

function renderReport() {
  const parts = [];
  if (S.sel) parts.push(renderComparison());
  S.psheets.forEach(p => parts.push(renderPower(p)));
  if (!parts.length) return;
  $('report').innerHTML = parts.join('');
  $('previewWrap').hidden = false;
}

/* ===== PDF ===== */
async function makePdf() {
  if (!window.html2canvas || !window.jspdf) throw new Error('lib');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const { jsPDF } = window.jspdf;
  
  const reps = [...document.querySelectorAll('#report > .rep')];
  const W = 210, M = 12, contentW = W - 2 * M;
  let doc = null;
  // Un informe por página (altura a medida); con un solo Excel queda como una única página.
  for (const rep of reps) {
    const cv = await html2canvas(rep, { scale: 2, backgroundColor: '#f5f6f8', useCORS: true, logging: false });
    const contentH = cv.height * contentW / cv.width;
    const H = Math.max(contentH + 2 * M, 297);
    if (!doc) doc = new jsPDF({ unit: 'mm', format: [W, H] }); else doc.addPage([W, H], 'p');
    doc.setFillColor(245, 246, 248);
    doc.rect(0, 0, W, H, 'F');
    doc.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', M, M, contentW, contentH);
  }

  const slug = (S.opts.client || (S.sel && S.sel.client) || (S.psheets[0] && S.psheets[0].holder) || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'cliente';
  const filename = `${(!S.sel && S.psheets.length) ? 'Informe_potencia' : 'Informe_ahorro'}_${slug}.pdf`;
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

function refreshState() {
  const any = S.sheets.length || S.psheets.length;
  $('adv').hidden = true; $('previewWrap').hidden = true; $('go').disabled = !any;
}
function resetComp() {
  S.file = null; S.sheets = []; S.sel = null; S.opts = { client: '', period: '', showNames: false, types: {} };
  $('file').value = ''; $('fileInfo').hidden = true; $('picker').hidden = true;
  refreshState(); status('');
}
function resetPow() {
  S.pfile = null; S.psheets = [];
  $('fileP').value = ''; $('fileInfoP').hidden = true;
  refreshState(); status('');
}

async function loadFile(f) {
  if (!f) return;
  if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) { status('Ese archivo no es un Excel (.xlsx). Prueba con otro.', 'err'); return; }
  resetComp(); S.file = f;
  $('fnm').textContent = f.name; $('fsz').textContent = fmtSize(f.size); $('fileInfo').hidden = false;
  if (!window.XLSX) { status('No se ha podido cargar el lector de Excel. Revisa la conexión y recarga la página.', 'err'); return; }
  status('Leyendo el Excel…');
  try {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const all = parseWorkbook(wb);
    S.sheets = all.filter(s => !s.error);
    if (!S.sheets.length) {
      if (!all.length && parsePowerWorkbook(wb).some(s => !s.error)) { status('Este Excel es de ajuste de potencia. Súbelo en el cuadro “Ajuste de potencia”.', 'err'); return; }
      status(all.some(s => s.error)
        ? 'El Excel no trae los importes calculados. Ábrelo en Excel, guárdalo (Ctrl+G) y vuelve a subirlo.'
        : 'No he encontrado ninguna simulación de luz o gas en este archivo.', 'err');
      return;
    }
    status(`${S.sheets.length === 1 ? 'Simulación encontrada' : S.sheets.length + ' simulaciones encontradas'}. Pulsa “Convertir a PDF”.`);
    $('go').disabled = false;
  } catch (e) { status('No he podido leer el archivo. ¿Está dañado o protegido con contraseña?', 'err'); }
}


async function loadPower(f) {
  if (!f) return;
  if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) { status('Ese archivo no es un Excel (.xlsx). Prueba con otro.', 'err'); return; }
  resetPow(); S.pfile = f;
  $('fnmP').textContent = f.name; $('fszP').textContent = fmtSize(f.size); $('fileInfoP').hidden = false;
  if (!window.XLSX) { status('No se ha podido cargar el lector de Excel. Revisa la conexión y recarga la página.', 'err'); return; }
  status('Leyendo el Excel…');
  try {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const all = parsePowerWorkbook(wb);
    S.psheets = all.filter(s => !s.error);
    if (!S.psheets.length) {
      if (all.some(s => s.error)) status('El Excel no trae los importes calculados. Ábrelo en Excel, guárdalo (Ctrl+G) y vuelve a subirlo.', 'err');
      else if (parseWorkbook(wb).some(s => !s.error)) status('Este Excel es una comparativa de comercializadoras. Súbelo en el cuadro “Comparativa de comercializadoras”.', 'err');
      else status('No he encontrado datos de potencia. ¿Has rellenado la potencia contratada y la nueva?', 'err');
      return;
    }
    status(`Ajuste de potencia encontrado (${S.psheets.map(s => s.tariff).join(' y ')}). Pulsa “Convertir a PDF”.`);
    $('go').disabled = false;
  } catch (e) { status('No he podido leer el archivo. ¿Está dañado o protegido con contraseña?', 'err'); }
}

function showPicker(msg) {
  $('pickMsg').textContent = msg;
  $('chips').innerHTML = S.sheets.map((s, i) => `<button class="chip${S.sel === s ? ' on' : ''}" data-i="${i}">${esc(s.name)} <small>· ${esc(s.client || 'sin nombre de cliente')}</small></button>`).join('');
  $('picker').hidden = false;
}

function prepareOptions() {
  const sh = S.sel, ps = S.psheets[0];
  S.opts.client = S.opts.client || (sh && sh.client) || (ps && ps.holder) || '';
  $('oClient').value = S.opts.client; $('oPeriod').value = S.opts.period || '';
  $('oPeriod').closest('label').hidden = !sh;
  if (!sh) { $('namesRow').hidden = true; $('typesTbl').innerHTML = ''; $('adv').hidden = false; return; }
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
    if (S.sheets.length && !S.sel) {
      const named = S.sheets.filter(s => s.client);
      if (S.sheets.length === 1) S.sel = S.sheets[0];
      else if (named.length === 1) S.sel = named[0];
      else { showPicker('Hay varias simulaciones en este Excel. ¿Cuál quieres convertir?'); status(''); btn.disabled = false; return; }
    }
    $('picker').hidden = S.sheets.length < 2;
    if (S.sheets.length > 1 && S.sel) showPicker('Simulación elegida (puedes cambiarla):');
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
$('rm').addEventListener('click', resetComp);
$('go').addEventListener('click', convert);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  S.sel = S.sheets[+b.dataset.i]; S.opts.client = ''; S.opts.types = {}; convert();
});
$('oClient').addEventListener('input', e => { S.opts.client = e.target.value; S.opts.clientEdited = true; renderReport(); });
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

/* ===== Cuadro del Excel de ajuste de potencia ===== */
const dropP = $('dropP'), finP = $('fileP');
dropP.addEventListener('click', () => finP.click());
dropP.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finP.click(); } });
['dragenter', 'dragover'].forEach(ev => dropP.addEventListener(ev, e => { e.preventDefault(); dropP.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => dropP.addEventListener(ev, e => { e.preventDefault(); dropP.classList.remove('over'); }));
dropP.addEventListener('drop', e => loadPower(e.dataTransfer.files[0]));
finP.addEventListener('change', () => loadPower(finP.files[0]));
$('rmP').addEventListener('click', resetPow);
