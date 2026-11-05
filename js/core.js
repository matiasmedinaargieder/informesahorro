/* ===== Lectura del Excel (formato original y formato actualizado) ===== */
const N = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[_\-]{3,}/g, '').replace(/\s+/g, ' ').trim();
const cellOf = (ws, r, c) => ws[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })];
const numAt = (ws, r, c) => { const x = cellOf(ws, r, c); return x && x.t === 'n' && isFinite(x.v) ? x.v : null; };
const strAt = (ws, r, c) => { const x = cellOf(ws, r, c); return x && typeof x.v === 'string' ? x.v.trim() : ''; };

function findRow(ws, re, maxR) {
  for (let r = 1; r <= maxR; r++)
    for (const c of [1, 2]) { const s = strAt(ws, r, c); if (s && re.test(N(s))) return r; }
  return 0;
}

const ROW_RE = {
  elec: { tpot: /^total pot/, tte: /^total (te|energia)/, tdto: /^(total dto|importe del descuento)/,
          ie: /^(i\. ?electrico|impuesto electrico)/, iva: /^iva$/, cm: /^(total )?costes? (de )?mercad/,
          total: /^total factura/, sav: /^ahorro (en esta )?factura/, ann: /^ahorro anual/ },
  gas:  { ttf: /^total (tf|termino fijo)/, ttv: /^total (tv|termino variable)/, hid: /hidrocarb/,
          iva: /^iva$/, total: /^total factura/, sav: /^ahorro (en esta )?factura/, ann: /^ahorro anual/ }
};

function parseSheet(name, ws) {
  if (!ws || !ws['!ref']) return null;
  const rg = XLSX.utils.decode_range(ws['!ref']);
  const maxR = rg.e.r + 1, maxC = rg.e.c + 1;
  const R = {};
  for (const k in ROW_RE.gas) R[k] = findRow(ws, ROW_RE.gas[k], maxR);
  const gas = R.ttf && R.ttv && R.total;
  let kind, rows;
  if (gas) { kind = 'gas'; rows = R; }
  else {
    rows = {};
    for (const k in ROW_RE.elec) rows[k] = findRow(ws, ROW_RE.elec[k], maxR);
    if (!(rows.tpot && rows.tte && rows.total)) return null;
    kind = 'elec';
  }
  if (numAt(ws, rows.total, 3) === null) return { name, kind, error: 'sin_valores' };
  const g = (r, c) => (r ? (numAt(ws, r, c) || 0) : 0);
  // ---- cabeceras: tipo (fijo/indexado) y nombre de comercializadora
  let typeRow = 0, best = 0;
  for (let r = 1; r <= 14; r++) {
    let n = 0;
    for (let c = 3; c <= maxC; c++) if (/fijo|index|omie/i.test(strAt(ws, r, c))) n++;
    if (n > best) { best = n; typeRow = r; }
  }
  let hdrRow = 0;
  for (let r = 1; r <= 14; r++) if (N(strAt(ws, r, 2)) === 'actual' || N(strAt(ws, r, 3)).startsWith('actual')) { hdrRow = r; break; }
  const cols = [];
  for (let c = 3; c <= maxC; c++) {
    const t = numAt(ws, rows.total, c);
    if (t === null || t <= 0) continue;
    const pot = g(kind === 'gas' ? rows.ttf : rows.tpot, c);
    const ene = kind === 'gas' ? g(rows.ttv, c) : g(rows.tte, c) + g(rows.tdto, c);
    const serv = kind === 'gas' ? 0 : g(rows.cm, c);
    const ie = kind === 'gas' ? g(rows.hid, c) : g(rows.ie, c);
    const iva = g(rows.iva, c);
    let otros = t - (pot + ene + serv + ie + iva); if (Math.abs(otros) < 0.005) otros = 0;
    const typeText = typeRow ? strAt(ws, typeRow, c) : '';
    let nm = hdrRow ? strAt(ws, hdrRow, c).replace(/^actual\s*/i, '').trim() : '';
    if (/^oferta [a-z]$/i.test(nm)) nm = '';
    cols.push({ c, letter: XLSX.utils.encode_col(c - 1), total: t, pot, ene, serv, ie, iva, otros, typeText, brand: nm,
                annual: rows.ann ? numAt(ws, rows.ann, c) : null });
  }
  if (!cols.length || cols[0].c !== 3 || cols.length < 2) return null;
  // ---- datos del cliente / asesor / consumo
  const clientRaw = strAt(ws, 6, 1);
  const client = /^cliente:/i.test(clientRaw) ? '' : clientRaw;
  const adv = {};
  for (let r = 2; r <= 4; r++) {
    const l = N(strAt(ws, r, 3));
    if (l.startsWith('asesor')) { adv.name = strAt(ws, r, 4); adv.email = strAt(ws, r, 5); }
    else if (l.startsWith('movil')) adv.mobile = strAt(ws, r, 4) || (numAt(ws, r, 4) || '');
    else if (l.startsWith('oficina')) adv.office = strAt(ws, r, 4) || (numAt(ws, r, 4) || '');
  }
  let kwh = null;
  for (let r = 1; r <= maxR; r++) {
    const l = N(strAt(ws, r, 1));
    if (/^(kwh factura|consumo de la factura)/.test(l)) {
      // valor en la propia celda, la de al lado en B o la de debajo
      kwh = numAt(ws, r + 1, 1) ?? null; break;
    }
  }
  let tariff = '';
  if (kind === 'elec') {
    const m = /(\d)\s*\.?\s*(\d)\s*TD/i.exec(strAt(ws, 7, 1)) || /(\d)\s*\.?\s*(\d)\s*TD/i.exec(name);
    tariff = m ? `${m[1]}.${m[2]}TD` : name;
  } else {
    const m = /RL\s*\.?\s*0?(\d)/i.exec(name + ' ' + strAt(ws, 7, 1));
    tariff = m ? `RL${m[1]}` : name;
  }
  return { name, kind, tariff, client, address: strAt(ws, 6, 4), advisor: adv, kwh, cols };
}

function parseWorkbook(wb) {
  const out = [];
  for (const nm of wb.SheetNames) {
    let p = null;
    try { p = parseSheet(nm, wb.Sheets[nm]); } catch (e) { p = null; }
    if (p) out.push(p);
  }
  return out;
}

/* ===== Cálculo del informe ===== */
function typeOf(text) { return /index|omie/i.test(text || '') ? 'idx' : 'fix'; }
function typeLabel(o) {
  if (o.type === 'idx') return 'Indexado';
  const t = (o.typeText || '').trim();
  if (!t || /^fijo$/i.test(t)) return 'Precio fijo';
  if (/fijo/i.test(t)) return 'Precio fijo';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function buildModel(sheet, opts) {
  opts = opts || {};
  const actual = sheet.cols[0];
  let offers = sheet.cols.slice(1).map(o => ({
    ...o,
    type: (opts.types && opts.types[o.letter]) || typeOf(o.typeText),
    saving: actual.total - o.total,
    pct: actual.total ? (actual.total - o.total) / actual.total : 0
  }));
  offers.sort((a, b) => b.saving - a.saving);
offers.forEach((o, i) => { o.rank = i + 1; o.label = o.brand ? o.brand : `Oferta ${i + 1}`; o.sub = typeLabel(o); });
  const bestOf = t => offers.filter(o => o.type === t)[0] || null;
  return { sheet, actual, offers, bestFix: bestOf('fix'), bestIdx: bestOf('idx'), kind: sheet.kind };
}
