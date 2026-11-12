// DataForge : ouvrir, explorer et transformer des données en tableau. CSV (séparateur deviné, guillemets), TSV ou JSON, collés ou
// ouverts depuis un fichier ; tri, filtre, statistiques par colonne, colonnes calculées, suppression de doublons, et export en
// CSV, TSV, JSON, Markdown ou SQL.
const CSS = `
.dfTop{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.dfTop .btn,.dfRow .btn{width:auto;margin:0;padding:4px 10px}
.dfTop .f,.dfRow .f{width:auto;flex:1;min-width:0;margin:0}
.dfGrid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px}
@media (max-width:950px){.dfGrid{grid-template-columns:minmax(0,1fr)}}
.dfTable{overflow:auto;max-height:480px;border:2px solid var(--line);background:var(--bg0)}
.dfTable table{border-collapse:collapse;font:12px monospace;min-width:100%}
.dfTable th{position:sticky;top:0;background:#241c40;color:#fff;cursor:var(--cp,pointer);text-align:left;white-space:nowrap;padding:4px 8px;border-bottom:2px solid var(--line)}
.dfTable th.sel{background:rgba(var(--pkr),.45)}
.dfTable td{padding:2px 8px;border-bottom:1px solid #241c40;white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;color:var(--lilac)}
.dfTable td.num{text-align:right;color:#c8e8ff}
.dfTable td.nul{color:#5a4a8a;font-style:italic}
.dfTable tr:hover td{background:#16122a}
.dfStats{font:12px monospace;color:var(--lilac);line-height:1.6}
.dfStats b{color:#fff}
.dfBars{display:block;width:100%;image-rendering:pixelated;margin-top:6px;background:#0b0816;border:2px solid var(--line)}
.dfRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.dfIn{width:100%;font:12px monospace;min-height:120px}
.dfMsg{font-size:12px;color:#ffd34f;min-height:16px;margin-top:4px}
.dfHelp{font-size:12px;color:var(--lilac);line-height:1.5}
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
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  // vérification : CSV avec guillemets et retours à la ligne aller-retour, nombres à la française, JSON, formule
  { const d = parse('nom;prix;note\n"Dupont; fils";1 234,50;"il a dit ""oui""\nensuite"\nMarie;12;'), back = parse(FORMATS['CSV ;'](d.cols, d.rows));
    console.assert(d.rows.length === 2 && d.rows[0][0] === 'Dupont; fils' && num(d.rows[0][1]) === 1234.5 && d.rows[0][2].includes('\n') && JSON.stringify(back) === JSON.stringify({...d, from: 'CSV ;'}) && num('1,234.5') === 1234.5 && num('12%') === .12, 'dataforge : CSV');
    const j = parse('[{"a":1,"b":{"c":2}},{"a":null}]'), f = compileFormula('[prix] * 2 + len([nom])', d.cols);
    console.assert(j.cols.join() === 'a,b' && j.rows[1][0] === '' && f(d.rows[0]) === '2481' && (() => { try { compileFormula('fetch("x")', d.cols); return false; } catch { return true; } })(), 'dataforge : JSON et formules'); }
  let data = null; try { data = await ctx.folder.read('dataforge'); } catch {}
  const SAMPLE = 'ville;pays;habitants;superficie_km2\nParis;France;2 102 650;105,4\nLyon;France;522 250;47,87\nMarseille;France;873 076;240,6\nBruxelles;Belgique;196 828;32,61\nGenève;Suisse;203 856;15,93\nMontréal;Canada;1 762 949;431,5\nLausanne;Suisse;140 202;41,37\nToulouse;France;504 078;118,3\nLiège;Belgique;195 278;69,39\nQuébec;Canada;549 459;485,8';
  let T = data?.cols ? {cols: data.cols, rows: data.rows, from: data.from || 'CSV'} : parse(SAMPLE);
  let sortC = -1, sortDir = 1, filter = '', selC = data?.selC ?? 2, history = [];
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { const big = T.rows.length * T.cols.length > 200000; ctx.folder.write('dataforge', big ? {selC} : {cols: T.cols, rows: T.rows, from: T.from, selC}).catch(() => {}); }, 600); };  // shortcut: un très gros tableau n'est pas gardé, il faudrait un fichier à part
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), top = el('div', 'dfTop'), lay = el('div', 'dfGrid'), main = el('div'), side = el('div', 'sysCard px');
  head.append(el('span', 'label', 'DataForge · données en tableau')); lay.append(main, side); wrap.append(head, top, lay); view.append(wrap);
  const openB = el('button', 'btn px main', 'Ouvrir un fichier'), pasteB = el('button', 'btn px', 'Coller des données'), file = el('input'), search = el('input', 'f'), undoB = el('button', 'btn px', '↶ Annuler'), info = el('span', 'hint');
  file.type = 'file'; file.accept = '.csv,.tsv,.txt,.json'; file.style.display = 'none'; search.placeholder = 'Filtrer les lignes…'; search.id = 'df_search'; info.id = 'df_info';
  top.append(openB, pasteB, undoB, search, info, file);
  const pasteBox = el('div', 'sysCard px'); pasteBox.style.display = 'none';
  const ta = el('textarea', 'f dfIn'), go = el('button', 'btn px main', 'Lire'), msg = el('div', 'dfMsg'); ta.placeholder = 'Colle ici du CSV, du TSV (copié depuis un tableur) ou du JSON'; ta.id = 'df_paste';
  const pr = el('div', 'dfRow'); pr.append(go, btn('Fermer', () => pasteBox.style.display = 'none')); pasteBox.append(ta, pr, msg);
  const table = el('div', 'dfTable'); table.id = 'df_table';
  main.append(pasteBox, table);
  const colTitle = el('span', 'label'), stats = el('div', 'dfStats'), bars = el('canvas', 'dfBars'), colOps = el('div', 'dfRow'), calc = el('div'), out = el('div');
  stats.id = 'df_stats'; side.append(colTitle, stats, bars, colOps, el('span', 'label', 'Nouvelle colonne'), calc, el('span', 'label', 'Exporter'), out);
  function btn(t, f, title) { const b = el('button', 'btn px', t); b.onclick = f; if (title) b.title = title; return b; }
  const snapshot = () => { history.push(JSON.stringify(T)); if (history.length > 30) history.shift(); };
  undoB.onclick = () => { const s = history.pop(); if (!s) return toast('Rien à annuler'); T = JSON.parse(s); selC = Math.min(selC, T.cols.length - 1); save(); render(); };
  function load(text, name) { try { const t = parse(text); if (!t.cols.length) throw new Error('aucune colonne'); snapshot(); T = t; sortC = -1; filter = ''; search.value = ''; selC = Math.max(0, T.cols.findIndex((_, i) => T.rows.some(r => !isNaN(num(r[i]))))); msg.textContent = ''; pasteBox.style.display = 'none'; save(); render(); toast((name ? name + ' : ' : '') + T.rows.length + ' lignes'); }
    catch (e) { msg.textContent = 'Lecture impossible : ' + e.message; pasteBox.style.display = ''; } }
  openB.onclick = () => file.click();
  file.onchange = async () => { const f = file.files[0]; if (!f) return; if (f.size > 30e6) return toast('Fichier trop gros (30 Mo au plus)'); load(await f.text(), f.name); file.value = ''; };
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
    g.font = '9px monospace'; bins.forEach(([lab, n], i) => { const h = Math.round(n / top * (H - 22)); g.fillStyle = '#ff4fb0'; g.fillRect(Math.floor(i * bw) + 1, H - 12 - h, Math.max(1, Math.floor(bw) - 2), h); if (bw > 20) { g.fillStyle = '#8a7aa8'; g.fillText(String(lab).slice(0, Math.floor(bw / 6)), Math.floor(i * bw) + 1, H - 2); } });
    colOps.replaceChildren(
      Object.assign(el('input', 'f'), {value: T.cols[c], title: 'Renommer la colonne', translate: false, onchange: e => { const n = e.target.value.trim(); if (!n || T.cols.includes(n)) { e.target.value = T.cols[c]; return; } snapshot(); T.cols[c] = n; save(); render(); }}),
      btn('Supprimer', () => { if (T.cols.length < 2) return; snapshot(); T.cols.splice(c, 1); T.rows.forEach(r => r.splice(c, 1)); selC = Math.max(0, c - 1); save(); render(); }),
      btn('Majuscules', () => { snapshot(); T.rows.forEach(r => r[c] = r[c].toUpperCase()); save(); render(); }),
      btn('Espaces', () => { snapshot(); T.rows.forEach(r => r[c] = r[c].trim().replace(/\s+/g, ' ')); save(); render(); }, 'Enlever les espaces en trop'),
      btn('Doublons', () => { snapshot(); const seen = new Set(), n0 = T.rows.length; T.rows = T.rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); toast((n0 - T.rows.length) + ' doublons enlevés'); save(); render(); }, 'Enlever les lignes en double'),
      btn('Vides', () => { snapshot(); const n0 = T.rows.length; T.rows = T.rows.filter(r => r[c] !== ''); toast((n0 - T.rows.length) + ' lignes enlevées'); save(); render(); }, 'Enlever les lignes où cette colonne est vide'),
      btn('Garder le filtre', () => { if (!filter) return toast('Écris d\'abord un filtre'); snapshot(); const keep = new Set(view_()); T.rows = T.rows.filter((_, i) => keep.has(i)); filter = ''; search.value = ''; save(); render(); }, 'Ne garder que les lignes filtrées'));
  }
  // ---------- les colonnes calculées ----------
  const fName = el('input', 'f'), fSrc = el('input', 'f'), fMsg = el('div', 'dfMsg'), fGo = el('button', 'btn px', 'Ajouter');
  fName.placeholder = 'Nom'; fName.value = 'densité'; fSrc.placeholder = '[habitants] / [superficie_km2]'; fSrc.value = '[habitants] / [superficie_km2]'; fSrc.id = 'df_formula'; fName.id = 'df_fname'; fName.translate = fSrc.translate = false;
  fSrc.oninput = () => { try { const f = compileFormula(fSrc.value, T.cols); fMsg.textContent = T.rows.length ? '→ ' + f(T.rows[0]) : ''; } catch (e) { fMsg.textContent = e.message; } };
  fGo.onclick = () => { let f; try { f = compileFormula(fSrc.value, T.cols); } catch (e) { fMsg.textContent = e.message; return; } const name = fName.value.trim() || 'calcul'; snapshot(); T.cols.push(T.cols.includes(name) ? name + ' ' + (T.cols.length + 1) : name); T.rows.forEach(r => { let v = ''; try { v = f(r); } catch {} r.push(v); }); selC = T.cols.length - 1; save(); render(); };
  const r1 = el('div', 'dfRow'), r2 = el('div', 'dfRow'); r1.append(fName); r2.append(fSrc, fGo);
  calc.append(r1, r2, fMsg, el('p', 'dfHelp', 'Les colonnes entre crochets, les opérations + - * / et les fonctions round, abs, min, max, upper, lower, len, concat, si(condition, oui, non).'));
  // ---------- l'export ----------
  const fmt = el('select', 'f'); for (const k of Object.keys(FORMATS)) { const o = el('option', '', k); o.value = k; fmt.append(o); } fmt.value = data?.fmt || 'CSV'; fmt.translate = false;
  const dl = btn('Télécharger', () => { const ext = {CSV: 'csv', 'CSV ;': 'csv', TSV: 'tsv', JSON: 'json', Markdown: 'md', SQL: 'sql'}[fmt.value], txt = exportText(), a = el('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], {type: 'text/plain;charset=utf-8'})); a.download = 'donnees.' + ext; document.body.append(a); a.click(); a.remove(); });
  const cp = btn('Copier', () => navigator.clipboard.writeText(exportText()).then(() => toast('Copié'), () => toast('Copie impossible')));
  const only = el('label', 'hint'), onlyC = el('input'); onlyC.type = 'checkbox'; only.append(onlyC, ' ', el('span', '', 'seulement les lignes filtrées'));
  const exportText = () => FORMATS[fmt.value](T.cols, view_(!onlyC.checked).map(i => T.rows[i]));  // dans l'ordre du tri affiché
  const er = el('div', 'dfRow'); er.append(fmt, dl, cp); out.append(er, only);
  function render() { renderTable(); renderSide(); fSrc.oninput(); }
  render();
}
