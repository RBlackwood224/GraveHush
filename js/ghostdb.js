// GRAVEHUSH — the 100 ghosts, built from trait building blocks
'use strict';

GH.EVIDENCE = ['cold', 'emf', 'voice', 'writing', 'prints', 'lens', 'motion'];
GH.ORIGINS = ['drowned', 'burned', 'hanged', 'child', 'plague', 'murdered', 'bride', 'cursed'];
GH.WEAK = ['salt', 'fire', 'holy', 'light', 'name', 'smoke'];
GH.BEHAVIORS = [
  'stalker', 'shy', 'lonely', 'mimic_voice', 'mimic_form', 'slammer', 'light_eater', 'cold_aura',
  'thrower', 'fast_dark', 'sound_hunter', 'teleporter', 'wanderer', 'territorial', 'patient', 'frenzy',
  'accelerating', 'invisible', 'shifter', 'looper', 'listener', 'silence', 'trickster', 'collector',
  'whisperer', 'weeper', 'giggler', 'possessor', 'mirror', 'phantom'
];
const CONFLICT = [['patient', 'frenzy'], ['wanderer', 'territorial'], ['sound_hunter', 'accelerating'],
  ['invisible', 'mimic_form'], ['shy', 'stalker'], ['silence', 'listener'], ['lonely', 'teleporter']];

// name, region, origin, signature behaviour, weakness
const RAW = [
  ['Lidérc', 'hu', 'cursed', 'possessor', 'name'], ['Bába', 'hu', 'cursed', 'collector', 'salt'],
  ['Mumus', 'hu', 'murdered', 'stalker', 'light'], ['Szépasszony', 'hu', 'bride', 'mimic_form', 'holy'],
  ['Lúdvérc', 'hu', 'burned', 'wanderer', 'fire'], ['Garabonciás', 'hu', 'cursed', 'shifter', 'holy'],
  ['Vasorrú', 'hu', 'cursed', 'accelerating', 'salt'], ['Fene', 'hu', 'plague', 'frenzy', 'smoke'],
  ['Banshee', 'ie', 'bride', 'weeper', 'name'], ['Dullahan', 'ie', 'murdered', 'teleporter', 'light'],
  ['Fetch', 'ie', 'cursed', 'mimic_form', 'name'], ['Pooka', 'ie', 'cursed', 'trickster', 'salt'],
  ['Bean Nighe', 'sc', 'drowned', 'weeper', 'smoke'], ['Bodach', 'sc', 'murdered', 'stalker', 'salt'],
  ['Gwrach-y-Rhibyn', 'wl', 'plague', 'silence', 'holy'], ['Grey Lady', 'en', 'bride', 'wanderer', 'light'],
  ['Boggart', 'en', 'cursed', 'thrower', 'salt'], ["Will-o'-the-Wisp", 'en', 'drowned', 'looper', 'fire'],
  ['Dame Blanche', 'fr', 'bride', 'phantom', 'holy'], ['Lavandière', 'fr', 'drowned', 'whisperer', 'holy'],
  ['Ankou', 'fr', 'plague', 'patient', 'light'], ['Revenant', 'fr', 'murdered', 'territorial', 'fire'],
  ['Moura', 'pt', 'cursed', 'mirror', 'name'], ['Santa Compaña', 'es', 'plague', 'teleporter', 'fire'],
  ['Estantigua', 'es', 'murdered', 'cold_aura', 'holy'], ['Feu Follet', 'fr', 'burned', 'light_eater', 'salt'],
  ['Moine Noir', 'fr', 'cursed', 'sound_hunter', 'holy'], ['La Llorona', 'mx', 'drowned', 'lonely', 'name'],
  ['La Planchada', 'mx', 'plague', 'territorial', 'light'], ['El Silbón', 've', 'murdered', 'whisperer', 'smoke'],
  ['La Sayona', 've', 'bride', 'lonely', 'holy'], ['La Tunda', 'co', 'cursed', 'mimic_form', 'fire'],
  ['Patasola', 'co', 'murdered', 'accelerating', 'salt'], ['La Viuda', 'co', 'bride', 'slammer', 'light'],
  ['Rusalka', 'ru', 'drowned', 'listener', 'fire'], ['Upyr', 'ru', 'plague', 'frenzy', 'holy'],
  ['Domovoi', 'ru', 'cursed', 'territorial', 'salt'], ['Kikimora', 'ru', 'cursed', 'phantom', 'smoke'],
  ['Poludnitsa', 'pl', 'burned', 'silence', 'name'], ['Strzyga', 'pl', 'cursed', 'possessor', 'holy'],
  ['Mora', 'pl', 'murdered', 'stalker', 'smoke'], ['Bludička', 'cz', 'drowned', 'looper', 'light'],
  ['Navka', 'ua', 'drowned', 'giggler', 'holy'], ['Strigoi', 'ro', 'plague', 'accelerating', 'fire'],
  ['Moroi', 'ro', 'child', 'invisible', 'salt'], ['Iele', 'ro', 'bride', 'wanderer', 'smoke'],
  ['Draugr', 'no', 'drowned', 'patient', 'fire'], ['Myling', 'se', 'child', 'giggler', 'name'],
  ['Mara', 'se', 'cursed', 'silence', 'holy'], ['Gjenganger', 'no', 'hanged', 'slammer', 'name'],
  ['Huldra', 'no', 'cursed', 'mimic_voice', 'light'], ['Nachzehrer', 'de', 'plague', 'collector', 'salt'],
  ['Weiße Frau', 'de', 'bride', 'mirror', 'light'], ['Erlkönig', 'de', 'child', 'whisperer', 'fire'],
  ['Liekkiö', 'fi', 'burned', 'giggler', 'salt'], ['Kalma', 'fi', 'plague', 'cold_aura', 'smoke'],
  ['Vrykolakas', 'gr', 'plague', 'slammer', 'holy'], ['Mormo', 'gr', 'child', 'stalker', 'fire'],
  ['Empusa', 'gr', 'cursed', 'mimic_form', 'holy'], ['Keres', 'gr', 'murdered', 'frenzy', 'name'],
  ['Monaciello', 'it', 'child', 'thrower', 'salt'], ['Onryō', 'jp', 'murdered', 'shifter', 'salt'],
  ['Yūrei', 'jp', 'hanged', 'invisible', 'smoke'], ['Ubume', 'jp', 'bride', 'weeper', 'name'],
  ['Funayūrei', 'jp', 'drowned', 'collector', 'salt'], ['Zashiki-warashi', 'jp', 'child', 'trickster', 'name'],
  ['Okiku', 'jp', 'murdered', 'listener', 'salt'], ['Hanako-san', 'jp', 'child', 'territorial', 'name'],
  ['Kuchisake-onna', 'jp', 'murdered', 'listener', 'smoke'], ['Noppera-bō', 'jp', 'cursed', 'mimic_form', 'light'],
  ['Diao Si Gui', 'cn', 'hanged', 'lonely', 'fire'], ['Shui Gui', 'cn', 'drowned', 'stalker', 'fire'],
  ['E Gui', 'cn', 'plague', 'frenzy', 'smoke'], ['Jiangshi', 'cn', 'plague', 'sound_hunter', 'salt'],
  ['Gwisin', 'kr', 'murdered', 'invisible', 'salt'], ['Cheonyeo Gwisin', 'kr', 'bride', 'whisperer', 'name'],
  ['Mul Gwisin', 'kr', 'drowned', 'mimic_voice', 'holy'], ['Pontianak', 'my', 'bride', 'phantom', 'fire'],
  ['Kuntilanak', 'id', 'bride', 'giggler', 'name'], ['Pocong', 'id', 'murdered', 'teleporter', 'holy'],
  ['Toyol', 'my', 'child', 'collector', 'salt'], ['Krasue', 'th', 'burned', 'light_eater', 'holy'],
  ['Mae Nak', 'th', 'bride', 'mimic_voice', 'holy'], ['Phi Pop', 'th', 'cursed', 'possessor', 'smoke'],
  ['Tiyanak', 'ph', 'child', 'mimic_voice', 'name'], ['White Lady of Balete', 'ph', 'murdered', 'wanderer', 'light'],
  ['Churel', 'in', 'bride', 'mimic_form', 'fire'], ['Bhoot', 'in', 'murdered', 'cold_aura', 'smoke'],
  ['Vetala', 'in', 'hanged', 'trickster', 'holy'], ['Brahmarakshas', 'in', 'cursed', 'patient', 'name'],
  ['Ghoul', 'ar', 'plague', 'sound_hunter', 'fire'], ['Qarinah', 'ar', 'cursed', 'mirror', 'holy'],
  ['Tikoloshe', 'za', 'cursed', 'invisible', 'salt'], ['Adze', 'gh', 'plague', 'light_eater', 'smoke'],
  ['Bell Witch', 'us', 'cursed', 'whisperer', 'name'], ['Resurrection Mary', 'us', 'bride', 'looper', 'light'],
  ['Bloody Mary', 'us', 'cursed', 'mirror', 'name'], ['Hatman', 'us', 'hanged', 'silence', 'light'],
  ['Shadow Person', 'us', 'murdered', 'fast_dark', 'light'], ['Black-Eyed Child', 'us', 'child', 'listener', 'salt']
];

// default sprite form by origin
const FORMS = {
  drowned: ['drowned'], burned: ['burned'], hanged: ['hanged'], child: ['child'], plague: ['plague', 'monk'],
  murdered: ['shadow', 'tall', 'faceless'], bride: ['bride', 'woman'], cursed: ['monk', 'woman', 'tall', 'faceless']
};

(function build() {
  const r = GH.rng(1337);
  const combos = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++) combos.push([a, b, c]);
  const used = {};
  const conflicts = (list, b) => list.includes(b) || CONFLICT.some(p => (p[0] === b && list.includes(p[1])) || (p[1] === b && list.includes(p[0])));
  GH.GHOSTS = RAW.map((row, idx) => {
    const [name, region, origin, sig, weak] = row;
    // unique (origin, evidence trio) so every ghost can be told apart
    let combo;
    const order = r.shuffle(combos.slice());
    for (const c of order) { const k = origin + c.join(''); if (!used[k]) { used[k] = 1; combo = c; break; } }
    const beh = [sig];
    let guard = 0;
    while (beh.length < 3 && guard++ < 200) { const b = r.pick(GH.BEHAVIORS); if (!conflicts(beh, b)) beh.push(b); }
    let immune = 'none';
    if (r.chance(0.4)) { const opts = ['holy', 'fire', 'salt', 'light'].filter(w => w !== weak); immune = r.pick(opts); }
    const speed = r.range(0.92, 1.12);
    return {
      idx, name, region, origin, beh, weak, immune, speed,
      evidence: combo.map(i => GH.EVIDENCE[i]),
      forms: FORMS[origin]
    };
  });
})();

GH.ghostHas = (g, b) => g.beh.includes(b);

// first names of the dead — the ghost's human name, known from the start
GH.DEAD_NAMES = {
  modern: ['Agnes Varga', 'Elias Moreau', 'Clara Hollis', 'Henrik Dahl', 'Ilona Szabo', 'Jakob Weiss', 'Lena Dubois', 'Thomas Reed', 'Marta Kovacs', 'Oscar Lind', 'Rosa Bianchi', 'Victor Lambert', 'Edith Crane', 'Samuel Price', 'Nora Fehér', 'Paul Garnier', 'Greta Holm', 'Arthur Bell', 'Irene Toth', 'Hugo Martin'],
  medieval: ['Agnes of Ely', 'Brother Anselm', 'Mathilde Roux', 'Wulfric the Miller', 'Ilona Bathor', 'Gisela of Thorn', 'Aldous Crane', 'Mother Hilde', 'Sister Odile', 'Bertram the Smith', 'Margit Kun', 'Edmund Hale', 'Isolde Marchand', 'Old Tobias', 'Ermengarde', 'Father Simeon', 'Rowena Ashby', 'Gaspard Leroy', 'Hedvig', 'Anna Gerold']
};
