// lancé par le test « local » de NeoDex : l'exemple des villes, le tri, le filtre, une colonne calculée, des données JSON collées
module.exports = async ({ pj, sleep }) => {
  const info = () => pj(`document.getElementById('df_info').textContent`);
  const firstCol = () => pj(`[...document.querySelectorAll('#df_table tr')].slice(1, 4).map(r => r.cells[1].textContent).join(',')`);
  await sleep(500);
  if (!/10 lignes · 4 colonnes/.test(await info())) throw new Error('exemple : ' + await info());
  if (!/Moyenne : 705/.test(await pj(`document.getElementById('df_stats').textContent`))) throw new Error('stats : ' + await pj(`document.getElementById('df_stats').textContent`));
  await pj(`document.querySelectorAll('#df_table th')[3].click(), document.querySelectorAll('#df_table th')[3].click(), 0`); await sleep(100);
  if (await firstCol() !== 'Paris,Montréal,Marseille') throw new Error('tri : ' + await firstCol());
  await pj(`(() => { const s = document.getElementById('df_search'); s.value = 'suisse'; s.dispatchEvent(new Event('input')); })(), 0`); await sleep(100);
  if (!/2 \/ 10/.test(await info())) throw new Error('filtre : ' + await info());
  await pj(`(() => { const s = document.getElementById('df_search'); s.value = ''; s.dispatchEvent(new Event('input')); })(), 0`);
  await pj(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Ajouter').click(), 0`); await sleep(100);
  if (!/5 colonnes/.test(await info()) || !/Maximum : 19/.test(await pj(`document.getElementById('df_stats').textContent`))) throw new Error('colonne calculée : ' + await info() + ' ' + await pj(`document.getElementById('df_stats').textContent`));
  await pj(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Coller des données').click(), 0`);
  await pj(`(() => { const t = document.getElementById('df_paste'); t.value = '[{"x": 1, "y": "a"}, {"x": 2.5, "y": "b"}, {"x": 4}]'; })(), [...document.querySelectorAll('button')].find(b => b.textContent === 'Lire').click(), 0`); await sleep(100);
  if (!/JSON · 3 lignes · 2 colonnes/.test(await info())) throw new Error('JSON : ' + await info());
  await pj(`[...document.querySelectorAll('button')].find(b => b.textContent === '↶ Annuler').click(), 0`); await sleep(200);
  const give = (id, name, b64) => pj(`(() => { const u = Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0)), dt = new DataTransfer(); dt.items.add(new File([u], '${name}')); const f = document.getElementById('${id}'); f.files = dt.files; f.dispatchEvent(new Event('change')); })(), 0`);
  let excel = 'Excel non testé (SheetJS absent)';
  try {
    const XLSX = require(require.resolve('xlsx', { paths: [process.cwd()] })), ws = XLSX.utils.aoa_to_sheet([['nom', 'date', 'valeur'], ['Alice', 0, 3.5], ['Bob', 0, 1234]]);
    ws.B2 = { t: 'n', v: 45306, z: 'm/d/yy' }; ws.B3 = { t: 'n', v: 45307.5, z: 'dd/mm/yyyy hh:mm' }; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Feuille');
    await give('df_file', 'test.xlsx', XLSX.write(wb, { type: 'base64', bookType: 'xlsx', compression: true })); await sleep(600);
    if (!/Excel · 2 lignes · 3 colonnes/.test(await info())) throw new Error('Excel : ' + await info());
    const cells = await pj(`[...document.querySelectorAll('#df_table tr')].slice(1).map(r => [...r.cells].slice(1).map(c => c.textContent).join('|')).join(' / ')`);
    if (cells !== 'Alice|15/01/2024|3.5 / Bob|16/01/2024 12:00|1234') throw new Error('cellules Excel : ' + cells);
    excel = 'Excel lu (dates comprises)';
    await pj(`[...document.querySelectorAll('button')].find(b => b.textContent === '↶ Annuler').click(), 0`); await sleep(200);
  } catch (e) { if (!/Cannot find module/.test(e.message)) throw e; }
  // joindre : les maires de 3 villes (dont une écrite autrement), en gardant toutes les lignes
  await give('df_file2', 'maires.csv', Buffer.from('Ville;maire\nparis ;Anne Hidalgo\nLyon;Grégory Doucet\nGenève;Christina Kitsos\nNantes;Johanna Rolland').toString('base64')); await sleep(300);
  const jt = await pj(`[document.getElementById('df_jmine').selectedOptions[0].textContent, document.querySelector('#df_join .hint:last-of-type')?.textContent]`);
  if (jt[0] !== 'ville') throw new Error('colonne commune pas trouvée : ' + jt[0]);
  await pj(`document.getElementById('df_jgo').click(), 0`); await sleep(200);
  const joined = await pj(`[...document.querySelectorAll('#df_table tr')].slice(1).map(r => r.cells[1].textContent + '=' + r.cells[r.cells.length - 1].textContent)`);
  if (!/10 lignes · 6 colonnes/.test(await info()) || !joined.includes('Paris=Anne Hidalgo') || !joined.includes('Genève=Christina Kitsos') || !joined.includes('Toulouse=∅')) throw new Error('jointure : ' + await info() + ' ' + joined.join(', '));
  return 'tri, filtre, stats, colonne calculée, JSON, annuler, ' + excel + ', jointure (3 villes complétées) ok';
};
