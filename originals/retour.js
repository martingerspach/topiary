// Topiary v4.1 : le bouton « Retourner sur Topiary » des landings publiées (voir retour.css).
// Il se replie en flèche quand on descend dans la page et se déplie quand on remonte, en haut et en bas de page :
// il couvre moins la landing pendant la lecture et reste là quand on cherche la sortie.
// Son lien ramène aux Projets choisis (#projets) ; ?projet=<id> dit d’où l’on vient (le carrousel s’en servait, la rangée de capsules l’ignore).
(() => {
  // Ouverte depuis Topiary, la landing commence tout en haut. Le lecteur d'artefacts peut reposer la position de
  // défilement de la page d'où l'on vient (la section des projets, bien plus bas) : tant que le visiteur n'a pas
  // touché la page, pendant les 2,5 premières secondes, on revient en haut. Rien pour un lien avec ancre, un
  // rechargement ou un retour arrière, où le navigateur garde la position voulue.
  const nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  if (!location.hash && (!nav || nav.type === 'navigate')) {
    let touched = false;
    const mark = () => { touched = true; };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, mark, { capture: true, passive: true, once: true }));
    const t0 = performance.now();
    const top = () => { if (!touched && (scrollY || scrollX)) scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
    const watch = () => { if (touched || performance.now() - t0 > 2500) removeEventListener('scroll', watch); else top(); };
    top();
    addEventListener('load', top);
    addEventListener('scroll', watch, { passive: true });
  }

  const a = document.querySelector('.tp-retour');
  if (!a) return;

  // Banc, au téléphone : le bouton est en haut à droite (retour.css) ; tant que le bouton Pause du hero est à l'écran,
  // il se tient sous lui et remonte avec la page, puis reste à 14 px du haut
  const pause = a.dataset.projet === 'banc' ? document.querySelector('.pause') : null;
  const phone = matchMedia('(max-width: 600px)');
  function place() {
    if (!pause || !phone.matches) { a.style.removeProperty('--tp-top'); return; }
    a.style.setProperty('--tp-top', `${Math.max(14, Math.round(pause.getBoundingClientRect().bottom) + 8)}px`);
  }
  place();
  addEventListener('resize', place);
  addEventListener('load', place);

  // Au téléphone, déplié en haut de page il couvrait l'illustration du hero (Tiroir, Quart) : il se montre entier à
  // l'arrivée, le temps d'être lu, puis se replie en flèche ; il se déplie encore en bas de page et quand on remonte.
  let shown = !phone.matches;
  setTimeout(() => { shown = true; update(); }, 2500);
  let last = scrollY;
  let queued = false;
  function update() {
    queued = false;
    place();
    const y = scrollY;
    const d = y - last;
    const end = document.documentElement.scrollHeight - innerHeight;
    if (y < 240 && shown && phone.matches) a.classList.add('is-compact');
    else if (y < 240 || y > end - 160) a.classList.remove('is-compact');
    else if (d > 8) a.classList.add('is-compact');
    else if (d < -8) a.classList.remove('is-compact');
    if (Math.abs(d) > 8) last = y;
  }
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
})();
