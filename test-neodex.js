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
  return 'tri, filtre, stats, colonne calculée, JSON et annuler ok';
};
