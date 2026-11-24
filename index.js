// DataForge : ouvrir, explorer et transformer des données en tableau. CSV (séparateur deviné, guillemets), TSV ou JSON, collés ou
// ouverts depuis un fichier ; tri, filtre, statistiques par colonne, colonnes calculées, suppression de doublons, et export en
// CSV, TSV, JSON, Markdown ou SQL.
const CSS = `
.dfTop{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.dfTop .btn,.dfRow .btn{width:auto;margin:0;padding:4px 10px}
.dfTop .f,.dfRow .f{width:auto;flex:1;min-width:0;margin:0}
.dfTop .f{min-width:200px}.dfRow>input.f{min-width:150px}
.dfGrid{display:grid;grid-template-columns:minmax(0,1fr) clamp(300px,25vw,420px);gap:12px}
@media (max-width:950px){.dfGrid{grid-template-columns:minmax(0,1fr)}}
.dfTable{overflow:auto;max-height:clamp(300px,calc(100vh - 250px),900px);border:2px solid var(--line);background:var(--bg0)}
.dfTable table{border-collapse:collapse;font:clamp(14px,.95vw,16px) monospace;min-width:100%}
.dfTable th{position:sticky;top:0;background:#241c40;color:#fff;cursor:var(--cp,pointer);text-align:left;white-space:nowrap;padding:6px 10px;border-bottom:2px solid var(--line)}
.dfTable th.sel{background:rgba(var(--pkr),.45)}
.dfTable td{padding:4px 10px;border-bottom:1px solid #241c40;white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;color:var(--lilac)}
.dfTable td.num{text-align:right;color:#c8e8ff}
.dfTable td.nul{color:#5a4a8a;font-style:italic}
.dfTable tr:hover td{background:#16122a}
.dfStats{font:15px monospace;color:var(--lilac);line-height:1.6}
.dfStats b{color:#fff}
.dfBars{display:block;width:100%;image-rendering:pixelated;margin-top:6px;background:#0b0816;border:2px solid var(--line)}
.dfRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.dfIn{width:100%;font:15px monospace;min-height:140px}
.dfSteps{margin:4px 0 6px;padding-left:22px;font-size:14px;line-height:1.5;max-height:180px;overflow:auto}
.dfMsg{font-size:14px;color:#ffd34f;min-height:16px;margin-top:4px}
.dfHelp{font-size:14px;color:var(--lilac);line-height:1.5}
.dfJoin{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}.dfJoin .dfRow{margin:0}.dfJoin .f{flex:0 1 auto}.dfJoin b{color:#fff;font-weight:normal}
`;
// ---------- lire ----------
function guessSep(text) { const line = text.split(/\r?\n/).slice(0, 5).join('\n'); let best = ',', n = -1; for (const s of [',', ';', '\t', '|']) { const c = line.split(s).length; if (c > n) { n = c; best = s; } } return best; }
function parseCSV(text, sep = guessSep(text)) {
  const rows = []; let row = [], f = '', q = false, i = 0;
  for (; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true; else if (c === sep) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; } else f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}
function parse(text) {
  const t = text.trim(); if (!t) throw new Error('rien à lire');
  if (t[0] === '[' || t[0] === '{') { let j = JSON.parse(t); if (!Array.isArray(j)) j = Object.values(j).find(Array.isArray) || [j];
    const cols = [...new Set(j.flatMap(o => o && typeof o === 'object' ? Object.keys(o) : ['valeur']))];
    return {cols, rows: j.map(o => cols.map(c => { const v = o && typeof o === 'object' ? o[c] : o; return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); })), from: 'JSON'}; }
  const sep = guessSep(t), r = parseCSV(t, sep), n = Math.max(...r.map(x => x.length)); const cols = r[0].map((c, i) => c.trim() || 'colonne ' + (i + 1)); while (cols.length < n) cols.push('colonne ' + (cols.length + 1));
  return {cols: uniq(cols), rows: r.slice(1).map(x => cols.map((_, i) => x[i] ?? '')), from: {',': 'CSV', ';': 'CSV ;', '\t': 'TSV', '|': 'CSV |'}[sep]};
}
// ---------- Excel (.xlsx) : une archive zip de fichiers XML, lue avec la décompression du navigateur, écrite sans compression ----------
async function unzip(buf) {  // nom → octets
  const d = new DataView(buf), u8 = new Uint8Array(buf), out = {};
  let e = buf.byteLength - 22; while (e >= 0 && d.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('ce n’est pas un fichier Excel (.xlsx)');
  let p = d.getUint32(e + 16, true); const n = d.getUint16(e + 10, true);
  for (let k = 0; k < n; k++) {
    if (d.getUint32(p, true) !== 0x02014b50) throw new Error('fichier Excel abîmé');
    const method = d.getUint16(p + 10, true), size = d.getUint32(p + 20, true), nl = d.getUint16(p + 28, true), xl = d.getUint16(p + 30, true), cl = d.getUint16(p + 32, true), off = d.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), at = off + 30 + d.getUint16(off + 26, true) + d.getUint16(off + 28, true), raw = u8.subarray(at, at + size);
    out[name] = method === 0 ? raw : method === 8 ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : null;
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function readXlsx(buf) {  // la première feuille ; les dates deviennent jj/mm/aaaa
  const z = await unzip(buf), xml = n => new DOMParser().parseFromString(z[n] ? new TextDecoder().decode(z[n]) : '<x/>', 'application/xml'), tags = (node, t) => [...node.getElementsByTagName(t)];
  let sheet = 'xl/worksheets/sheet1.xml';
  const rid = tags(xml('xl/workbook.xml'), 'sheet')[0]?.getAttribute('r:id');
  if (rid) { const t = tags(xml('xl/_rels/workbook.xml.rels'), 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target'); if (t) sheet = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); }
  if (!z[sheet]) throw new Error('feuille introuvable dans le fichier Excel');
  const strings = tags(xml('xl/sharedStrings.xml'), 'si').map(si => tags(si, 't').map(t => t.textContent).join(''));
  const st = xml('xl/styles.xml'), custom = new Map(tags(st, 'numFmt').map(f => [+f.getAttribute('numFmtId'), f.getAttribute('formatCode') || '']));
  const xfs = tags(st, 'cellXfs')[0], isDate = xfs ? tags(xfs, 'xf').map(x => { const id = +x.getAttribute('numFmtId'); return (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dmy]/i.test((custom.get(id) || '').replace(/\[[^\]]*\]|"[^"]*"/g, '')); }) : [];
  const day = v => { const t = new Date(Math.round((v - 25569) * 86400000)).toISOString(); return t.slice(0, 10).split('-').reverse().join('/') + (v % 1 ? ' ' + t.slice(11, 16) : ''); };
  const grid = [];
  for (const row of tags(xml(sheet), 'row')) {
    const r = []; let next = 0;
    for (const c of tags(row, 'c')) {
      const ref = c.getAttribute('r'), col = ref ? [...ref.replace(/[0-9]+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : next; next = col + 1;
      const t = c.getAttribute('t'), v = tags(c, 'v')[0]?.textContent ?? '';
      r[col] = t === 's' ? strings[+v] ?? '' : t === 'inlineStr' ? tags(c, 't').map(x => x.textContent).join('') : t === 'b' ? (v === '1' ? 'VRAI' : 'FAUX') : t === 'str' || t === 'e' || v === '' ? v
        : isDate[+c.getAttribute('s')] ? day(+v) : String(+(+v).toPrecision(15));  // 0.1 + 0.2 enregistré par Excel : 0.3
    }
    const rn = +row.getAttribute('r') - 1; grid[rn >= 0 ? rn : grid.length] = r;
  }
  const all = grid.filter(Boolean).map(r => Array.from(r, v => v ?? '')).filter(r => r.some(v => v !== ''));
  if (!all.length) throw new Error('feuille vide');
  const n = Math.max(...all.map(r => r.length)), cols = Array.from({length: n}, (_, i) => String(all[0][i] ?? '').trim() || 'colonne ' + (i + 1));
  return {cols: uniq(cols), rows: all.slice(1).map(r => cols.map((_, i) => r[i] ?? '')), from: 'Excel'};
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = ~0; for (const x of u) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zip(files) {  // {nom: texte} → une archive zip sans compression
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data), h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(12, 33, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nm, data); cd.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
  }
  const n = Object.keys(files).length, e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, cd.reduce((a, x) => a + x.length, 0), true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cd, new Uint8Array(e.buffer)], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function writeXlsx(cols, rows) {  // les nombres (même à la française) deviennent de vrais nombres ; 0612… et les très longs numéros restent du texte
  const esc = s => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const colName = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const cell = (v, r, i) => { if (v === '') return ''; const ref = colName(i) + r, n = num(v); return !isNaN(n) && !/^[-+]?0[0-9]/.test(v.trim()) && v.replace(/[^0-9]/g, '').length < 16 ? `<c r="${ref}"><v>${n}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`; };
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', R = 'http://schemas.openxmlformats.org/', T = R + 'officeDocument/2006/relationships';
  return zip({
    '[Content_Types].xml': X + `<Types xmlns="${R}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': X + `<Relationships xmlns="${R}package/2006/relationships"><Relationship Id="rId1" Type="${T}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': X + `<workbook xmlns="${R}spreadsheetml/2006/main" xmlns:r="${T}"><sheets><sheet name="Données" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': X + `<Relationships xmlns="${R}package/2006/relationships"><Relationship Id="rId1" Type="${T}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': X + `<worksheet xmlns="${R}spreadsheetml/2006/main"><sheetData>${[cols, ...rows].map((r, j) => `<row r="${j + 1}">${r.map((v, i) => cell(String(v ?? ''), j + 1, i)).join('')}</row>`).join('')}</sheetData></worksheet>`,
  });
}
// ---------- joindre : les lignes de B ajoutées à celles de A dont la colonne ia vaut la colonne ib de B (majuscules et espaces autour ignorés) ----------
function joinTables(A, B, ia, ib, keepAll) {
  const key = v => String(v ?? '').trim().toLowerCase(), idx = new Map();
  B.rows.forEach(r => { const k = key(r[ib]); if (k) { if (!idx.has(k)) idx.set(k, []); idx.get(k).push(r); } });
  const extra = B.cols.map((_, i) => i).filter(i => i !== ib), rows = []; let hit = 0;
  for (const r of A.rows) { const m = idx.get(key(r[ia])) || []; if (m.length) hit++;
    if (m.length) for (const x of m) rows.push([...r, ...extra.map(i => x[i] ?? '')]); else if (keepAll) rows.push([...r, ...extra.map(() => '')]); }  // plusieurs correspondances : une ligne pour chacune
  return {cols: uniq([...A.cols, ...extra.map(i => A.cols.includes(B.cols[i]) ? B.cols[i] + ' (2)' : B.cols[i])]), rows, from: A.from, hit};
}
const uniq = cols => cols.map((c, i) => cols.indexOf(c) === i ? c : c + ' ' + (i + 1));
// un nombre, à la française (1 234,5) ou à l'anglaise (1,234.5)
function num(s) { if (typeof s !== 'string') return NaN; let t = s.trim().replace(/[\s  ]/g, ''); if (!t || !/^[-+]?[0-9.,]+(e[-+]?[0-9]+)?%?$/i.test(t)) return NaN; const pct = t.endsWith('%'); if (pct) t = t.slice(0, -1);
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''); else if (t.includes(',')) t = /,[0-9]{3}$/.test(t) && t.split(',').length > 2 ? t.replace(/,/g, '') : t.replace(',', '.');
  const v = Number(t); return pct ? v / 100 : v; }
// ---------- écrire ----------
const csvCell = (v, sep) => /[\x22\n\r]/.test(v) || v.includes(sep) || /^\s|\s$/.test(v) ? '"' + v.replace(/\x22/g, '""') + '"' : v;
const FORMATS = {
  CSV: (c, r) => [c, ...r].map(x => x.map(v => csvCell(v, ',')).join(',')).join('\n'),
  'CSV ;': (c, r) => [c, ...r].map(x => x.map(v => csvCell(v, ';')).join(';')).join('\n'),
  TSV: (c, r) => [c, ...r].map(x => x.map(v => v.replace(/[\t\n]/g, ' ')).join('\t')).join('\n'),
  JSON: (c, r) => JSON.stringify(r.map(x => Object.fromEntries(c.map((k, i) => { const n = num(x[i]); return [k, x[i] === '' ? null : !isNaN(n) && /^-?[0-9]+(\.[0-9]+)?$/.test(x[i].trim()) ? n : x[i]]; }))), null, 2),
  Markdown: (c, r) => [c, c.map(() => '---'), ...r].map(x => '| ' + x.map(v => v.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |').join('\n'),
  SQL: (c, r) => { const id = s => '"' + s.replace(/\x22/g, '""') + '"'; return r.map(x => `INSERT INTO "donnees" (${c.map(id).join(', ')}) VALUES (${x.map(v => v === '' ? 'NULL' : !isNaN(num(v)) && /^-?[0-9]+(\.[0-9]+)?$/.test(v.trim()) ? v.trim() : "'" + v.replace(/'/g, "''") + "'").join(', ')});`).join('\n'); },
};
// ---------- les colonnes calculées : une petite formule avec les noms de colonnes entre crochets ----------
function compileFormula(src, cols) {
  const used = []; const js = src.replace(/\[([^\]]+)\]/g, (_, name) => { const i = cols.indexOf(name.trim()); if (i < 0) throw new Error('colonne inconnue : ' + name); used.push(i); return `v(${i})`; });
  if (/[;{}\x60=]|=>|\b(window|document|fetch|import|eval|Function|constructor|this|globalThis|require|process)\b/.test(js.replace(/[=!<>]=|&&|\|\|/g, ''))) throw new Error('formule refusée');  // seulement des calculs, rien d'autre
  if (/[a-zA-Z_$][\w$]*\s*\(/.test(js.replace(/\bv\(|\b(Math\.\w+|round|abs|min|max|upper|lower|len|concat|num|si)\(/g, ''))) throw new Error('fonction inconnue');
  const f = new Function('row', 'num', `const v = i => { const n = num(row[i]); return isNaN(n) ? row[i] : n; }, {round, abs, min, max} = Math, upper = s => String(s).toUpperCase(), lower = s => String(s).toLowerCase(), len = s => String(s).length, concat = (...a) => a.join(''), si = (c, a, b) => c ? a : b; return (${js});`);
  return row => { const r = f(row, num); return r === undefined || r === null || (typeof r === 'number' && !isFinite(r)) ? '' : typeof r === 'number' ? String(Math.round(r * 1e4) / 1e4) : String(r); };
}
// les étapes : chaque changement du tableau est une étape, qui désigne les colonnes par leur nom ; une suite d'étapes (une recette) se rejoue sur un autre fichier
const colOf = (T, name) => { const i = T.cols.indexOf(name); if (i < 0) throw new Error('la colonne « ' + name + ' » n’existe pas'); return i; };
function applyStep(T, s, B) {
  const cols = [...T.cols], rows = T.rows.map(r => [...r]), out = {cols, rows, from: T.from};
  const i = s.col !== undefined ? colOf(T, s.col) : -1;
  switch (s.op) {
    case 'rename': if (!s.to || (cols.includes(s.to) && s.to !== s.col)) throw new Error('nom « ' + s.to + ' » déjà pris'); cols[i] = s.to; return out;
    case 'delete': if (cols.length < 2) throw new Error('il faut garder au moins une colonne'); cols.splice(i, 1); rows.forEach(r => r.splice(i, 1)); return out;
    case 'upper': rows.forEach(r => r[i] = r[i].toUpperCase()); return out;
    case 'trim': rows.forEach(r => r[i] = r[i].trim().replace(/\s+/g, ' ')); return out;
    case 'dedupe': { const seen = new Set(); out.rows = rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); return out; }
    case 'empty': out.rows = rows.filter(r => r[i] !== ''); return out;
    case 'keep': { const t = String(s.text || '').toLowerCase(); out.rows = rows.filter(r => r.some(v => v.toLowerCase().includes(t))); return out; }
    case 'formula': { const f = compileFormula(s.src, cols); cols.push(cols.includes(s.name) ? s.name + ' ' + (cols.length + 1) : s.name); rows.forEach(r => { let v = ''; try { v = f(r); } catch {} r.push(v); }); return out; }
    case 'join': { if (!B) throw new Error('il manque le fichier à joindre « ' + s.file + ' »'); const r = joinTables(T, B, i, colOf(B, s.theirs), s.all); return {cols: r.cols, rows: r.rows, from: T.from, hit: r.hit}; }
  }
  throw new Error('étape inconnue : ' + s.op);
}
const stepText = s => ({ rename: () => 'Renommer « ' + s.col + ' » en « ' + s.to + ' »', delete: () => 'Supprimer la colonne « ' + s.col + ' »', upper: () => 'Majuscules dans « ' + s.col + ' »',
  trim: () => 'Espaces en trop dans « ' + s.col + ' »', dedupe: () => 'Enlever les lignes en double', empty: () => 'Enlever les lignes où « ' + s.col + ' » est vide',
  keep: () => 'Garder les lignes qui contiennent « ' + s.text + ' »', formula: () => 'Nouvelle colonne « ' + s.name + ' » = ' + s.src,
  join: () => 'Joindre « ' + s.file + ' » : « ' + s.col + ' » = « ' + s.theirs + ' »' + (s.all ? '' : ', seulement les lignes qui correspondent') })[s.op]?.() || s.op;

export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  // vérification : CSV avec guillemets et retours à la ligne aller-retour, nombres à la française, JSON, formule
  { const d = parse('nom;prix;note\n"Dupont; fils";1 234,50;"il a dit ""oui""\nensuite"\nMarie;12;'), back = parse(FORMATS['CSV ;'](d.cols, d.rows));
    console.assert(d.rows.length === 2 && d.rows[0][0] === 'Dupont; fils' && num(d.rows[0][1]) === 1234.5 && d.rows[0][2].includes('\n') && JSON.stringify(back) === JSON.stringify({...d, from: 'CSV ;'}) && num('1,234.5') === 1234.5 && num('12%') === .12, 'dataforge : CSV');
    const j = parse('[{"a":1,"b":{"c":2}},{"a":null}]'), f = compileFormula('[prix] * 2 + len([nom])', d.cols);
    const J = joinTables({cols: ['ville', 'n'], rows: [['Paris', '1'], ['Lyon', '2'], ['Nice', '3']]}, {cols: ['Ville', 'maire', 'n'], rows: [[' paris ', 'A', '9'], ['Lyon', 'B', '8'], ['Lyon', 'C', '7']]}, 0, 0, true);
    console.assert(J.cols.join() === 'ville,n,maire,n (2)' && J.rows.length === 4 && J.hit === 2 && J.rows[0].join() === 'Paris,1,A,9' && J.rows[3].join() === 'Nice,3,,' && joinTables(J, J, 0, 0, false).rows.length === 6, 'dataforge : jointure');
    writeXlsx(['nom', 'prix', 'tél', 'note'], [['Dupont & fils', '1 234,5', '0612345678', '<b>'], ['Marie', '12', '', 'é']]).arrayBuffer().then(readXlsx).then(x => console.assert(JSON.stringify(x.rows) === '[["Dupont & fils","1234.5","0612345678","<b>"],["Marie","12","","é"]]' && x.cols.join() === 'nom,prix,tél,note', 'dataforge : Excel', x));
    { const R = [{op: 'rename', col: 'prix', to: 'montant'}, {op: 'trim', col: 'nom'}, {op: 'formula', name: 'double', src: '[montant] * 2'}, {op: 'keep', text: 'mar'}, {op: 'upper', col: 'nom'}];
      const X = R.reduce((t, st) => applyStep(t, st), {cols: ['nom', 'prix'], rows: [['  Marie  Curie', '10'], ['Paul', '3'], ['Marc', '4,5']], from: 'CSV'});
      let err = ''; try { applyStep({cols: ['a'], rows: []}, R[0]); } catch (e) { err = e.message; }
      console.assert(X.cols.join() === 'nom,montant,double' && JSON.stringify(X.rows) === '[["MARIE CURIE","10","20"],["MARC","4,5","9"]]' && /« prix » n’existe pas/.test(err) && stepText(R[3]) === 'Garder les lignes qui contiennent « mar »', 'dataforge : recette', X, err); }
    console.assert(j.cols.join() === 'a,b' && j.rows[1][0] === '' && f(d.rows[0]) === '2481' && (() => { try { compileFormula('fetch("x")', d.cols); return false; } catch { return true; } })(), 'dataforge : JSON et formules'); }
  let data = null; try { data = await ctx.folder.read('dataforge'); } catch {}
  const SAMPLE = 'ville;pays;habitants;superficie_km2\nParis;France;2 102 650;105,4\nLyon;France;522 250;47,87\nMarseille;France;873 076;240,6\nBruxelles;Belgique;196 828;32,61\nGenève;Suisse;203 856;15,93\nMontréal;Canada;1 762 949;431,5\nLausanne;Suisse;140 202;41,37\nToulouse;France;504 078;118,3\nLiège;Belgique;195 278;69,39\nQuébec;Canada;549 459;485,8';
  let T = data?.cols ? {cols: data.cols, rows: data.rows, from: data.from || 'CSV'} : parse(SAMPLE);
  let sortC = -1, sortDir = 1, filter = '', selC = data?.selC ?? 2, history = [], steps = data?.steps || [];
  const recipes = data?.recipes || {};
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { const big = T.rows.length * T.cols.length > 200000; ctx.folder.write('dataforge', big ? {selC, recipes} : {cols: T.cols, rows: T.rows, from: T.from, selC, steps, recipes}).catch(() => {}); }, 600); };  // shortcut: un très gros tableau n'est pas gardé, il faudrait un fichier à part
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap wide'), head = el('div', 'agHead'), top = el('div', 'dfTop'), lay = el('div', 'dfGrid'), main = el('div'), side = el('div', 'sysCard px');
  head.append(el('span', 'label', 'DataForge · données en tableau')); lay.append(main, side); wrap.append(head, top, lay); view.append(wrap);
  const openB = el('button', 'btn px main', 'Ouvrir un fichier'), pasteB = el('button', 'btn px', 'Coller des données'), joinB = el('button', 'btn px', 'Joindre un fichier…'), file = el('input'), file2 = el('input'), search = el('input', 'f'), undoB = el('button', 'btn px', '↶ Annuler'), info = el('span', 'hint');
  file.type = file2.type = 'file'; file.accept = file2.accept = '.csv,.tsv,.txt,.json,.xlsx'; file.style.display = file2.style.display = 'none'; file.id = 'df_file'; file2.id = 'df_file2'; joinB.title = 'Ajouter les colonnes d’un autre fichier, ligne par ligne, grâce à une colonne commune'; search.placeholder = 'Filtrer les lignes…'; search.id = 'df_search'; info.id = 'df_info';
  top.append(openB, pasteB, joinB, undoB, search, info, file, file2);
  const pasteBox = el('div', 'sysCard px'); pasteBox.style.display = 'none';
  const ta = el('textarea', 'f dfIn'), go = el('button', 'btn px main', 'Lire'), msg = el('div', 'dfMsg'); ta.placeholder = 'Colle ici du CSV, du TSV (copié depuis un tableur) ou du JSON'; ta.id = 'df_paste';
  const pr = el('div', 'dfRow'); pr.append(go, btn('Fermer', () => pasteBox.style.display = 'none')); pasteBox.append(ta, pr, msg);
  const table = el('div', 'dfTable'); table.id = 'df_table';
  const joinBox = el('div', 'sysCard px dfJoin'); joinBox.style.display = 'none'; joinBox.id = 'df_join';
  main.append(pasteBox, joinBox, table);
  const colTitle = el('span', 'label'), stats = el('div', 'dfStats'), bars = el('canvas', 'dfBars'), colOps = el('div', 'dfRow'), calc = el('div'), out = el('div');
  stats.id = 'df_stats'; side.append(colTitle, stats, bars, colOps, el('span', 'label', 'Nouvelle colonne'), calc, el('span', 'label', 'Exporter'), out);
  function btn(t, f, title) { const b = el('button', 'btn px', t); b.onclick = f; if (title) b.title = title; return b; }
  const snapshot = () => { history.push(JSON.stringify({T, steps})); if (history.length > 30) history.shift(); };
  undoB.onclick = () => { const s = history.pop(); if (!s) return toast('Rien à annuler'); ({T, steps} = JSON.parse(s)); selC = Math.min(selC, T.cols.length - 1); save(); render(); };
  // un changement du tableau : appliqué, et noté dans les étapes
  function doStep(st, B) { let n; try { n = applyStep(T, st, B); } catch (e) { toast('Impossible : ' + e.message, true); return null; } snapshot(); T = n; steps.push(st); save(); render(); return n; }
  const readFile = async f => { if (f.size > 30e6) throw new Error('fichier trop gros (30 Mo au plus)'); if (/\.xls$/i.test(f.name)) throw new Error('ancien format Excel (.xls) : enregistre-le en .xlsx'); return /\.xlsx$/i.test(f.name) ? readXlsx(await f.arrayBuffer()) : parse(await f.text()); };
  function load(text, name) { try { loadT(typeof text === 'string' ? parse(text) : text, name); } catch (e) { msg.textContent = 'Lecture impossible : ' + e.message; pasteBox.style.display = ''; } }
  function loadT(t, name) { { if (!t.cols.length) throw new Error('aucune colonne'); snapshot(); T = t; steps = []; sortC = -1; filter = ''; search.value = ''; selC = Math.max(0, T.cols.findIndex((_, i) => T.rows.some(r => !isNaN(num(r[i]))))); msg.textContent = ''; pasteBox.style.display = 'none'; save(); render(); toast((name ? name + ' : ' : '') + T.rows.length + ' lignes'); }
  }
  openB.onclick = () => file.click();
  file.onchange = async () => { const f = file.files[0]; if (!f) return; file.value = ''; try { load(await readFile(f), f.name); } catch (e) { toast('Lecture impossible : ' + e.message); } };
  // ---------- joindre un deuxième fichier ----------
  joinB.onclick = () => file2.click();
  file2.onchange = async () => { const f = file2.files[0]; if (!f) return; file2.value = ''; let B; try { B = await readFile(f); } catch (e) { return toast('Lecture impossible : ' + e.message); } showJoin(B, f.name); };
  function showJoin(B, name) {
    const mine = el('select', 'f'), theirs = el('select', 'f'), mode = el('select', 'f'), what = el('div', 'hint'); mine.id = 'df_jmine'; theirs.id = 'df_jtheirs'; mode.id = 'df_jmode'; mine.translate = theirs.translate = false;
    T.cols.forEach((c, i) => mine.append(new Option(c, i))); B.cols.forEach((c, i) => theirs.append(new Option(c, i)));
    mode.append(new Option('Garder toutes mes lignes', 'all'), new Option('Seulement celles qui correspondent', 'match'));
    { let best = null; T.cols.forEach((c, i) => { const k = B.cols.findIndex(d => d.trim().toLowerCase() === c.trim().toLowerCase()); if (k >= 0 && !best) best = [i, k]; }); if (best) { mine.value = best[0]; theirs.value = best[1]; } }  // une colonne au même nom : c'est sûrement elle
    const preview = () => { const r = joinTables(T, B, +mine.value, +theirs.value, mode.value === 'all'); what.textContent = r.hit + ' de tes ' + T.rows.length + ' lignes trouvent une correspondance → ' + r.rows.length + ' lignes, ' + r.cols.length + ' colonnes.'; };
    mine.onchange = theirs.onchange = mode.onchange = preview;
    const ok = btn('Joindre', () => { const r = doStep({op: 'join', file: name, col: T.cols[+mine.value], theirs: B.cols[+theirs.value], all: mode.value === 'all'}, B); if (!r) return; const hit = r.hit; delete T.hit; joinBox.style.display = 'none'; toast(hit + ' lignes complétées'); });
    ok.classList.add('main'); ok.id = 'df_jgo';
    const r1 = el('div', 'dfRow'), r2 = el('div', 'dfRow'), r3 = el('div', 'dfRow'), title = el('div'); title.append(el('span', '', 'Joindre '), Object.assign(el('b', '', name), {translate: false}), ' (' + B.rows.length + ' ', el('span', '', 'lignes'), ')');
    r1.append(el('span', 'hint', 'Ma colonne'), mine, el('span', 'hint', '= sa colonne'), theirs); r2.append(mode); r3.append(ok, btn('Fermer', () => joinBox.style.display = 'none'));
    joinBox.replaceChildren(title, r1, r2, what, r3); joinBox.style.display = ''; preview();
  }
  pasteB.onclick = () => { pasteBox.style.display = ''; ta.focus(); };
  go.onclick = () => load(ta.value);
  search.oninput = () => { filter = search.value.toLowerCase(); renderTable(); };
  // ---------- le tableau ----------
  const view_ = (all = false) => { let idx = T.rows.map((_, i) => i); if (filter && !all) idx = idx.filter(i => T.rows[i].some(v => v.toLowerCase().includes(filter)));
    if (sortC >= 0) { const isNum = T.rows.every(r => r[sortC] === '' || !isNaN(num(r[sortC]))); idx.sort((a, b) => { const x = T.rows[a][sortC], y = T.rows[b][sortC]; if (x === '' || y === '') return (x === '') - (y === ''); return (isNum ? num(x) - num(y) : x.localeCompare(y, 'fr', {numeric: true})) * sortDir; }); }
    return idx; };
  function renderTable() {
    const idx = view_(), MAX = 500, tb = el('table'), hr = el('tr');
    tb.translate = false;
    hr.append(el('th', '', '#')); T.cols.forEach((c, i) => { const th = el('th', i === selC ? 'sel' : '', c + (sortC === i ? (sortDir > 0 ? ' ▲' : ' ▼') : '')); th.title = 'Clic : choisir et trier'; th.onclick = () => { if (selC === i) { if (sortC !== i) { sortC = i; sortDir = 1; } else if (sortDir > 0) sortDir = -1; else sortC = -1; } selC = i; save(); render(); }; hr.append(th); });
    tb.append(hr);
    for (const i of idx.slice(0, MAX)) { const tr = el('tr'); tr.append(el('td', 'nul', String(i + 1))); T.rows[i].forEach(v => { const td = el('td', v === '' ? 'nul' : !isNaN(num(v)) ? 'num' : '', v === '' ? '∅' : v); td.title = v; tr.append(td); }); tb.append(tr); }
    table.replaceChildren(tb);
    info.replaceChildren(el('span', '', T.from), ' · ' + idx.length + (filter ? ' / ' + T.rows.length : '') + ' ', el('span', '', 'lignes'), ' · ' + T.cols.length + ' ', el('span', '', 'colonnes'), ...(idx.length > MAX ? [' · ', el('span', '', '500 premières affichées')] : []));
  }
  // ---------- la colonne choisie ----------
  function renderSide() {
    if (selC < 0 || selC >= T.cols.length) selC = 0;
    const c = selC, vals = T.rows.map(r => r[c]), filled = vals.filter(v => v !== ''), nums = filled.map(num).filter(v => !isNaN(v)), isNum = filled.length && nums.length === filled.length;
    colTitle.textContent = T.cols[c] || ''; colTitle.translate = false;
    const line = (k, v) => [el('span', '', k), ' : ', Object.assign(el('b', '', String(v)), {translate: false}), el('br')];
    const f = v => Number.isInteger(v) ? v.toLocaleString('fr-FR') : v.toLocaleString('fr-FR', {maximumFractionDigits: 3});
    const counts = new Map(); filled.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const parts = [...line('Type', isNum ? 'nombres' : 'texte'), ...line('Remplies', filled.length + ' / ' + vals.length), ...line('Valeurs différentes', counts.size)];
    if (isNum) { const s = [...nums].sort((a, b) => a - b), sum = s.reduce((a, b) => a + b, 0), mean = sum / s.length, med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2, sd = Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / s.length);
      parts.push(...line('Minimum', f(s[0])), ...line('Maximum', f(s[s.length - 1])), ...line('Somme', f(sum)), ...line('Moyenne', f(mean)), ...line('Médiane', f(med)), ...line('Écart type', f(sd))); }
    stats.replaceChildren(...parts);
    // le graphique : histogramme pour les nombres, les valeurs les plus fréquentes pour le texte
    const W = 280, H = 120; bars.width = W; bars.height = H; const g = bars.getContext('2d'); g.fillStyle = '#0b0816'; g.fillRect(0, 0, W, H);
    let bins;
    if (isNum && counts.size > 8) { const mn = Math.min(...nums), mx = Math.max(...nums), k = 14; bins = Array.from({length: k}, (_, i) => [f(mn + (mx - mn) * i / k), 0]); nums.forEach(v => bins[Math.min(k - 1, Math.floor((v - mn) / ((mx - mn) || 1) * k))][1]++); }
    else bins = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const top = Math.max(1, ...bins.map(b => b[1])), bw = W / Math.max(1, bins.length);
    g.font = '11px monospace'; bins.forEach(([lab, n], i) => { const h = Math.round(n / top * (H - 22)); g.fillStyle = '#ff4fb0'; g.fillRect(Math.floor(i * bw) + 1, H - 12 - h, Math.max(1, Math.floor(bw) - 2), h); if (bw > 20) { g.fillStyle = '#8a7aa8'; g.fillText(String(lab).slice(0, Math.floor(bw / 6)), Math.floor(i * bw) + 1, H - 2); } });
    colOps.replaceChildren(
      Object.assign(el('input', 'f'), {value: T.cols[c], title: 'Renommer la colonne', translate: false, onchange: e => { const n = e.target.value.trim(); if (!n || T.cols.includes(n)) { e.target.value = T.cols[c]; return; } doStep({op: 'rename', col: T.cols[c], to: n}); }}),
      btn('Supprimer', () => { if (T.cols.length < 2) return; const k = Math.max(0, c - 1); if (doStep({op: 'delete', col: T.cols[c]})) { selC = k; render(); } }),
      btn('Majuscules', () => doStep({op: 'upper', col: T.cols[c]})),
      btn('Espaces', () => doStep({op: 'trim', col: T.cols[c]}), 'Enlever les espaces en trop'),
      btn('Doublons', () => { const n0 = T.rows.length; if (doStep({op: 'dedupe'})) toast((n0 - T.rows.length) + ' doublons enlevés'); }, 'Enlever les lignes en double'),
      btn('Vides', () => { const n0 = T.rows.length; if (doStep({op: 'empty', col: T.cols[c]})) toast((n0 - T.rows.length) + ' lignes enlevées'); }, 'Enlever les lignes où cette colonne est vide'),
      btn('Garder le filtre', () => { if (!filter) return toast('Écris d\'abord un filtre'); const t = filter; filter = ''; search.value = ''; doStep({op: 'keep', text: t}); }, 'Ne garder que les lignes filtrées'));
  }
  // ---------- les colonnes calculées ----------
  const fName = el('input', 'f'), fSrc = el('input', 'f'), fMsg = el('div', 'dfMsg'), fGo = el('button', 'btn px', 'Ajouter');
  fName.placeholder = 'Nom'; fName.value = 'densité'; fSrc.placeholder = '[habitants] / [superficie_km2]'; fSrc.value = '[habitants] / [superficie_km2]'; fSrc.id = 'df_formula'; fName.id = 'df_fname'; fName.translate = fSrc.translate = false;
  fSrc.oninput = () => { try { const f = compileFormula(fSrc.value, T.cols); fMsg.textContent = T.rows.length ? '→ ' + f(T.rows[0]) : ''; } catch (e) { fMsg.textContent = e.message; } };
  fGo.onclick = () => { try { compileFormula(fSrc.value, T.cols); } catch (e) { fMsg.textContent = e.message; return; } if (doStep({op: 'formula', name: fName.value.trim() || 'calcul', src: fSrc.value})) { selC = T.cols.length - 1; render(); } };
  const r1 = el('div', 'dfRow'), r2 = el('div', 'dfRow'); r1.append(fName); r2.append(fSrc, fGo);
  calc.append(r1, r2, fMsg, el('p', 'dfHelp', 'Les colonnes entre crochets, les opérations + - * / et les fonctions round, abs, min, max, upper, lower, len, concat, si(condition, oui, non).'));
  // ---------- l'export ----------
  const fmt = el('select', 'f'); for (const k of ['Excel', ...Object.keys(FORMATS)]) { const o = el('option', '', k === 'Excel' ? 'Excel (.xlsx)' : k); o.value = k; fmt.append(o); } fmt.value = data?.fmt || 'CSV'; fmt.translate = false;
  const dl = btn('Télécharger', () => { if (fmt.value === 'Excel') { const a = el('a'); a.href = URL.createObjectURL(writeXlsx(T.cols, view_(!onlyC.checked).map(i => T.rows[i]))); a.download = 'donnees.xlsx'; document.body.append(a); a.click(); a.remove(); return; } const ext = {CSV: 'csv', 'CSV ;': 'csv', TSV: 'tsv', JSON: 'json', Markdown: 'md', SQL: 'sql'}[fmt.value], txt = exportText(), a = el('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], {type: 'text/plain;charset=utf-8'})); a.download = 'donnees.' + ext; document.body.append(a); a.click(); a.remove(); });
  const cp = btn('Copier', () => navigator.clipboard.writeText(exportText()).then(() => toast(fmt.value === 'Excel' ? 'Copié en colonnes, à coller dans Excel' : 'Copié'), () => toast('Copie impossible')));
  const only = el('label', 'hint'), onlyC = el('input'); onlyC.type = 'checkbox'; only.append(onlyC, ' ', el('span', '', 'seulement les lignes filtrées'));
  const exportText = () => FORMATS[fmt.value === 'Excel' ? 'TSV' : fmt.value](T.cols, view_(!onlyC.checked).map(i => T.rows[i]));  // dans l'ordre du tri affiché
  const er = el('div', 'dfRow'); er.append(fmt, dl, cp); out.append(er, only);
  // ---------- les étapes et les recettes ----------
  const stList = el('ol', 'dfSteps'), stRow = el('div', 'dfRow'), rcSel = el('select', 'f'), rcRow = el('div', 'dfRow'), file3 = el('input'), stMsg = el('div', 'dfMsg');
  stList.id = 'df_steps'; rcSel.id = 'df_recipe'; rcSel.translate = false; file3.type = 'file'; file3.multiple = true; file3.accept = file.accept; file3.style.display = 'none'; stMsg.id = 'df_stmsg';
  const saveR = btn('Enregistrer la recette', async () => { if (!steps.length) return toast('Aucune étape pour l’instant : chaque changement du tableau en ajoute une'); const n = String(await ctx.host.ask?.('Nom de la recette :', Object.keys(recipes).length ? '' : 'Ma recette') || '').trim().slice(0, 40); if (!n) return;
    recipes[n] = steps.map(x => ({...x})); save(); renderSteps(); rcSel.value = n; toast('Recette « ' + n + ' » : ' + steps.length + ' étape' + (steps.length > 1 ? 's' : '')); }, 'Garder ces étapes sous un nom, pour les rejouer sur un autre fichier');
  saveR.id = 'df_rsave';
  const joinsOf = list => [...new Set(list.filter(x => x.op === 'join').map(x => x.file))];
  // rejouer : tout ou rien ; une étape impossible arrête et laisse le tableau comme avant
  function replay(list, base, tables = {}) {
    let cur = base;
    for (let k = 0; k < list.length; k++) { try { cur = applyStep(cur, list[k], list[k].op === 'join' ? tables[list[k].file] : null); } catch (e) { return {ok: false, msg: 'Étape ' + (k + 1) + ' (' + stepText(list[k]) + ') impossible : ' + e.message + '. Rien n’a changé.'}; } }
    delete cur.hit; return {ok: true, T: cur};
  }
  function finish(r, name, list, loaded) {
    if (!r.ok) { stMsg.textContent = r.msg; return false; }
    snapshot(); T = r.T; steps = loaded ? [...list] : [...steps, ...list]; sortC = -1; filter = ''; search.value = ''; save(); render(); stMsg.textContent = '';
    toast('Recette « ' + name + ' » : ' + list.length + ' étape' + (list.length > 1 ? 's' : '') + ' rejouée' + (list.length > 1 ? 's' : '') + ', ' + T.rows.length + ' lignes'); return true;
  }
  // les fichiers choisis d'un coup : le fichier à transformer (pour « sur un fichier »), et ceux à joindre, reconnus à leur nom (sinon dans l'ordre)
  let pending = null;
  file3.onchange = async () => { const fl = [...file3.files], p = pending; file3.value = ''; pending = null; if (!p || !fl.length) return; let read;
    try { read = await Promise.all(fl.map(async f => ({name: f.name, T: await readFile(f)}))); } catch (e) { return toast('Lecture impossible : ' + e.message, true); }
    const tables = {}, rest = [...read]; for (const n of p.joins) { const k = rest.findIndex(x => x.name === n); if (k >= 0) tables[n] = rest.splice(k, 1)[0].T; }
    let main = T; if (p.onFile) { const m = rest.shift(); if (!m) return toast('Choisis aussi le fichier à transformer', true); main = m.T; }
    for (const n of p.joins) if (!tables[n]) { const x = rest.shift(); if (x) tables[n] = x.T; }
    finish(replay(p.list, main, tables), p.name, p.list, p.onFile); };
  const runR = onFile => { const n = rcSel.value, list = recipes[n]; if (!list) return toast('Enregistre d’abord une recette', true); const joins = joinsOf(list);
    if (!onFile && !joins.length) return finish(replay(list, T), n, list, false);
    pending = {name: n, list, joins, onFile}; if (joins.length) toast((onFile ? 'Choisis le fichier à transformer et ' : 'Choisis ') + joins.map(j => '« ' + j + ' »').join(', ') + ' (Ctrl + clic pour plusieurs)'); file3.click(); };
  const playB = btn('Rejouer ici', () => runR(false), 'Rejouer la recette sur le tableau affiché'), playF = btn('Sur un fichier…', () => runR(true), 'Ouvrir un fichier et lui appliquer la recette');
  const delR = btn('✕', async () => { const n = rcSel.value; if (!recipes[n] || !(await ctx.host.confirm?.('Supprimer la recette « ' + n + ' » ?') ?? true)) return; delete recipes[n]; save(); renderSteps(); }, 'Supprimer cette recette');
  playB.id = 'df_rplay'; playF.id = 'df_rfile';
  stRow.append(saveR); rcRow.append(rcSel, playB, playF, delR);
  side.append(el('span', 'label', 'Étapes'), stList, stRow, el('span', 'label', 'Recettes'), rcRow, stMsg, file3);
  function renderSteps() {
    stList.replaceChildren(...steps.map(x => el('li', '', stepText(x)))); if (!steps.length) stList.append(Object.assign(el('li', 'hint', 'Chaque changement du tableau s’ajoute ici.'), {style: 'list-style:none'}));
    const cur = rcSel.value; rcSel.replaceChildren(...Object.keys(recipes).map(n => new Option(n + ' (' + recipes[n].length + ')', n))); if (recipes[cur]) rcSel.value = cur;
    for (const b of [playB, playF, delR]) b.disabled = !rcSel.options.length;
  }
  view.__df = { replay: (n, texts = {}) => finish(replay(recipes[n], T, Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, parse(v)]))), n, recipes[n], false), load: (text, name) => load(text, name), steps: () => steps.map(stepText), save: n => { recipes[n] = steps.map(x => ({...x})); save(); renderSteps(); return Object.keys(recipes); }, msg: () => stMsg.textContent,
    table: () => ({cols: T.cols, rows: T.rows}), join: (text, name, mine, theirs) => { const B = parse(text); const r = doStep({op: 'join', file: name, col: mine, theirs, all: true}, B); if (r) delete T.hit; return !!r; }, drop: n => { delete recipes[n]; save(); renderSteps(); } };  // le test
  function render() { renderTable(); renderSide(); renderSteps(); fSrc.oninput(); }
  render();
}
