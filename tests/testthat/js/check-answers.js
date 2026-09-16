/* PURPOSE: run the real webex.js against a DOM stub, and assert the verdict it reaches.
 * ROLE: the package had no javascript test at all, which is why two faults lived in
 *   solveme_func unseen -- a tolerated answer used to come out carrying webex-correct AND
 *   webex-incorrect, and its section could then never reach "all correct".
 *   It now also guards the MEMORY (an answer is remembered under what its question says, so that
 *   inserting a question cannot make a stored answer come back on the wrong one), the OWNERSHIP
 *   rule (a question belongs to the nearest .webex-check, and a widget in a solution to nobody)
 *   and the FREEZE (a submitted section stops accepting answers, of every kind).
 * WARNING: the stub is a real TREE, with parents, and that is what makes the last two testable.
 *   It used to be a bag of objects whose getElementsByClassName() returned a hand-written list, so
 *   `closest()` answered nothing and a missing freeze passed in silence.
 * Usage: node check-answers.js <path to webex.js>   -- exits non-zero on the first failure.
 * Driven by tests/testthat/test-js.R, which skips when node is not installed. */
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");

// --- un DOM minuscule, mais un vrai arbre -------------------------------------------------------
class CL {
  constructor(){ this.s = new Set(); }
  add(c){ this.s.add(c); } remove(c){ this.s.delete(c); }
  contains(c){ return this.s.has(c); }
  toggle(c, on){ on ? this.s.add(c) : this.s.delete(c); }
  list(){ const v = [...this.s].filter(c => c === "webex-correct" || c === "webex-incorrect");
          return v.sort().join(" ") || "(aucune)"; }
}

// Le moteur de sélecteurs : juste les formes que webex.js écrit -- une classe, un nom de balise,
// une liste séparée par des virgules, un descendant, et l'attribut `[id^='exr-']`.
function simple(n, sel) {
  sel = sel.trim();
  const neg = /^(.*?):not\((.+)\)$/.exec(sel);           // `.a:not(.b)`, which webex.js writes
  if (neg) return (neg[1] === "" || simple(n, neg[1])) && !simple(n, neg[2]);
  if (sel.startsWith(".")) return n.classList.contains(sel.slice(1));
  if (sel === "[id^='exr-']") return typeof n.id === "string" && n.id.indexOf("exr-") === 0;
  return n.tag === sel;
}

class El {
  constructor(tag, cls = "", props = {}) {
    this.tag = tag;
    this.classList = new CL();
    cls.split(" ").filter(Boolean).forEach(c => this.classList.add(c));
    this.kids = []; this.parentElement = null;
    this.id = ""; this.value = ""; this.textContent = ""; this._html = "";
    this.dataset = {}; this.attrs = {};
    Object.assign(this, props);
  }
  /* innerHTML est une VRAIE affectation de contenu : update_total_correct() écrit le compteur
     ainsi, et check_func() relit ensuite la classe du <label> qui s'y trouve. Un stub qui rendrait
     toujours un label vide laisserait passer un « Bien joué ! » qui n'a jamais été gagné. */
  set innerHTML(html) {
    this._html = String(html);
    this.kids = [];
    const m = /<label class='([^']*)'>([\s\S]*?)<\/label>/.exec(this._html);
    if (m) { const l = new El("label", m[1]); l.textContent = m[2]; this.add(l); }
  }
  get innerHTML() { return this._html; }
  add(...kids) { for (const k of kids) { k.parentElement = this; this.kids.push(k); } return this; }
  get nextSibling() {
    if (!this.parentElement) return null;
    const k = this.parentElement.kids;
    return k[k.indexOf(this) + 1] || null;
  }
  descendants() { const o = []; for (const k of this.kids) { o.push(k, ...k.descendants()); } return o; }
  matches(sel) { return sel.split(",").some(s => simple(this, s)); }
  closest(sel) { let n = this; while (n) { if (n.matches(sel)) return n; n = n.parentElement; } return null; }
  querySelectorAll(sel) {
    const out = [];
    for (const part of sel.split(",")) {
      const steps = part.trim().split(/\s+/);
      let pool = [this];
      for (const st of steps) pool = pool.flatMap(n => n.descendants().filter(d => simple(d, st)));
      for (const n of pool) if (out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByClassName(c) { return this.descendants().filter(n => n.classList.contains(c)); }
  getElementsByTagName(t) { return this.descendants().filter(n => n.tag === t); }
  contains(el) { return el === this || this.descendants().indexOf(el) !== -1; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  insertAdjacentHTML() {}
  appendChild(c) { this.add(c); }
  insertBefore(node, ref) {
    node.parentElement = this;
    const i = ref ? this.kids.indexOf(ref) : -1;
    if (i === -1) this.kids.push(node); else this.kids.splice(i, 0, node);
    return node;
  }
}

const out = console.error.bind(console);
global.console = { log(){} };
global.window = { addEventListener(){} };
global.location = { pathname: "/seance.html" };

// Le document EST un noeud : tout ce que webex.js lui demande, un noeud sait déjà le faire.
let ROOT = new El("body");
function page(root) {
  ROOT = root;
  global.document = {
    title: "Une séance",
    documentElement: {},
    getElementsByClassName: c => ROOT.getElementsByClassName(c),
    getElementsByTagName:   t => ROOT.getElementsByTagName(t),
    querySelectorAll: sel => ROOT.querySelectorAll(sel),
    querySelector: sel => ROOT.querySelectorAll(sel)[0] || null,
    getElementById: id => ROOT.descendants().find(k => k.attrs.id === id) || null,
    createElement: tag => new El(tag)
  };
  return root;
}
page(new El("body"));
eval(src);

const R = [];
const check = (label, got, want) => R.push([got === want ? "✓" : "✗", label, got, want]);

// --- les champs à trous -------------------------------------------------------------------------
function field(answers, {tol, ignorecase, regex} = {}) {
  const el = new El("input", "webex-solveme nospaces");
  if (ignorecase) el.classList.add("ignorecase");
  if (regex) el.classList.add("regex");
  // ce que window.onload fait au chargement : la normalisation porte sur la chaîne JSON entière
  let json = JSON.stringify(answers.map(String));
  if (ignorecase) json = json.toLowerCase();
  json = json.replace(/\s/g, "");
  el.dataset = { answer: json, tol: tol };
  return el;
}
function type(f, v){ f.value = v; solveme_func.call(f); return f.classList.list(); }

// LA PANNE : dans la tolérance mais orthographe différente
let f = field([5.2], {tol: 0.1});
check("5.2 tol .1 <- '5.20'",  type(f, "5.20"), "webex-correct");
check("5.2 tol .1 <- '5.2'",   type(f, "5.2"),  "webex-correct");
check("5.2 tol .1 <- '5,2'",   type(f, "5,2"),  "webex-correct");
check("5.2 tol .1 <- '9'",     type(f, "9"),    "webex-incorrect");
check("5.2 tol .1 <- ''",      type(f, ""),     "(aucune)");

// tolérance sur un entier, l'usage réel des intervalles de confiance
f = field([12, "12%"], {tol: 1});
check("12 tol 1 <- '11.5'",    type(f, "11.5"), "webex-correct");
check("12 tol 1 <- '12%'",     type(f, "12%"),  "webex-correct");
check("12 tol 1 <- '20'",      type(f, "20"),   "webex-incorrect");

// la notation 1/x ne doit PAS être lue comme le nombre 1
f = field(["1/2.41"], {tol: 0.01});
check("1/2.41 <- '1/2.41'",    type(f, "1/2.41"), "webex-correct");
check("1/2.41 <- '1'",         type(f, "1"),      "webex-incorrect");
check("1/2.41 <- '1/2.410'",   type(field(["1/2.41"], {tol: 0.01}), "1/2.410"), "webex-correct");
check("1/2.41 <- '0.415'",     type(field(["1/2.41"], {tol: 0.01}), "0.415"),   "webex-correct");
check("1/2.29 <- '1/2.30'",    type(field(["1/2.29"], {tol: 0.0038}), "1/2.30"), "webex-correct");
check("1/2.29 <- '1/2.20'",    type(field(["1/2.29"], {tol: 0.0038}), "1/2.20"), "webex-incorrect");
check("1.44 <- '1,44'",        type(field(["1.44"], {tol: 0.005}), "1,44"),      "webex-correct");
check("1.44 <- '1.45'",        type(field(["1.44"], {tol: 0.005}), "1.45"),      "webex-incorrect");

// un ratio recopié tel que le tableau l'écrit : « ×2,14 », « *2,14 », « ÷1,87 » -- la magnitude
f = () => field(["×2.14", "2.14"], {tol: 0.005});
check("×2.14 <- '×2,14'",      type(f(), "×2,14"), "webex-correct");
check("×2.14 <- '*2,14'",      type(f(), "*2,14"), "webex-correct");
check("×2.14 <- 'x2.14'",      type(f(), "x2.14"), "webex-correct");
check("×2.14 <- '2,14'",       type(f(), "2,14"),  "webex-correct");
check("×2.14 <- '×2,15'",      type(f(), "×2,15"), "webex-incorrect");
check("×2.14 <- '×2,1'",       type(f(), "×2,1"),  "webex-incorrect");
f = () => field(["÷1.87", "1.87"], {tol: 0.005});
check("÷1.87 <- '÷1,87'",      type(f(), "÷1,87"),  "webex-correct");
check("÷1.87 <- '/1,87'",      type(f(), "/1,87"),  "webex-correct");
check("÷1.87 <- '1/1,87'",     type(f(), "1/1,87"), "webex-correct");
check("÷1.87 <- '1,87'",       type(f(), "1,87"),   "webex-correct");
check("÷1.87 <- '÷1,9'",       type(f(), "÷1,9"),   "webex-incorrect");
check("÷1.87 seul <- '1/1.87'", type(field(["÷1.87"], {tol: 0.005}), "1/1.87"), "webex-correct");
// l'écriture inverse n'ouvre rien quand aucune réponse attendue n'en est une
check("12 tol 1 <- '1/12'",    type(field(["12"], {tol: 1}), "1/12"),  "webex-incorrect");
check("12 tol 1 <- '÷12'",     type(field(["12"], {tol: 1}), "÷12"),   "webex-incorrect");
// une cote « 1/2.41 » reste une VALEUR : ses écritures inverses passent, la magnitude nue non
f = () => field(["1/2.41"], {tol: 0.01});
check("1/2.41 <- '÷2,41'",     type(f(), "÷2,41"),  "webex-correct");
check("1/2.41 <- '/2.41'",     type(f(), "/2.41"),  "webex-correct");
check("1/2.41 <- '2.41'",      type(f(), "2.41"),   "webex-incorrect");
check("×2.14 sans tol <- '*2.14'", type(field(["×2.14", "2.14"]), "*2.14"), "webex-incorrect");

// LA PANNE : un nombre COLLÉ depuis un tableau, avec le séparateur de milliers du producteur.
// Aucun n'est l'espace ASCII -- tabxplor pose U+2007 dans les chiffres, U+00A0 dans les libellés,
// U+202F ailleurs --, et sans `tol` la vérification se réduit à une égalité de chaînes.
f = field(["723844"]);
check("723844 <- '723\\u2007844'", type(f, "723 844"), "webex-correct");
check("723844 <- '723\\u00a0844'", type(f, "723 844"), "webex-correct");
check("723844 <- '723\\u202f844'", type(f, "723 844"), "webex-correct");
check("723844 <- '723 844'",       type(f, "723 844"),      "webex-correct");
check("723844 <- '723845'",        type(f, "723845"),       "webex-incorrect");
// et la réponse ATTENDUE peut elle aussi en porter une : la normalisation du chargement l'ôte
check("'1 497' <- '1497'", type(field(["1 497"]), "1497"), "webex-correct");

// regex, et le mélange tol + ignorecase que le HTML cassait
f = field(["\\d{1,4}"], {regex: true});
check("regex <- '42'",         type(f, "42"),   "webex-correct");
check("regex <- 'abc'",        type(f, "abc"),  "webex-incorrect");
f = field(["Oui"], {ignorecase: true, tol: 0.5});
check("ignorecase <- 'oui'",   type(f, "oui"),  "webex-correct");

// --- une section vérifiée, telle que le filtre Lua l'écrit --------------------------------------
// <div class="webex-check"> ... questions ... <button/><span class="webex-total_correct"/> </div>
function section(exr, ...content) {
  const sec = new El("div", "webex-check unchecked");
  const btn = new El("button", "webex-check-button");
  const span = new El("span", "webex-total_correct");
  const inner = new El("div", "", { id: exr });
  sec.add(inner.add(...content), btn, span);
  sec.btn = btn; sec.span = span;
  return sec;
}
const label = sec => sec.span.innerHTML.replace(/<[^>]*>/g, "").trim().replace(/\s+/g, " ");

const a = field([5.2], {tol: 0.1}), b = field([3], {tol: 0.1});
let sec = page(new El("body").add(section("exr-un", a, b))).kids[0];
type(a, "5.20"); type(b, "3");
update_total_correct();
check("compteur, 2 justes", label(sec), "2 / 2 correct");
type(b, "99");
update_total_correct();
check("compteur, 1 faux",   label(sec), "1 / 2 correct ; 1 incorrect");
type(b, "");
update_total_correct();
check("compteur, 1 sans réponse", label(sec), "1 / 2 correct");

// L'APPARTENANCE. Une partie soumise à part est une section DANS la section : ses questions sont
// à elle. Sans cette règle, l'englobante affichait « 0 / 2 » sur un énoncé qui ne demande rien,
// et son bouton ne pouvait jamais être satisfait.
const dedans = field([7], {tol: 0.1});
const fille  = section("exr-mere-part", dedans);
const mere   = section("exr-mere");
mere.kids[0].add(fille);
page(new El("body").add(mere));
type(dedans, "7");
update_total_correct();
check("la mère ne compte pas la fille", label(mere), "0 / 0 correct");
check("la fille compte la sienne",      label(fille), "1 / 1 correct");

// Un widget dans une solution est une illustration, jamais une question.
const dansSol = field([9], {tol: 0.1});
const sol = new El("div", "webex-solution").add(dansSol);
const propre = field([4], {tol: 0.1});
const s = section("exr-sol", propre, sol);
page(new El("body").add(s));
type(propre, "4"); type(dansSol, "9");
update_total_correct();
check("un widget dans une solution ne compte pour personne", label(s), "1 / 1 correct");

// --- où le bouton se pose -----------------------------------------------------------------------
// PANNE GARDÉE : posé en fin de section, il se retrouvait sous la partie imbriquée ET sous la
// réponse -- deux boutons identiques empilés au bas d'un exercice, et un bouton qui s'enfuit vers
// le bas au moment même où on le presse, puisque la réponse apparaît au-dessus de lui.
function placed(children) {
  const sec = new El("div", "webex-check");
  const exo = new El("div", "", { id: "exr-p" });
  sec.add(exo.add(...children));
  const b = new El("button", "webex-check-button"), sp = new El("span", "webex-total_correct");
  webex_place(sec, b, sp);
  return sec.descendants().filter(k => k !== exo).map(k =>
      k === b ? "BOUTON" : k === sp ? "compteur"
      : k.classList.contains("webex-check")    ? "part"
      : k.classList.contains("webex-unlocked") ? "correction"
      : k.classList.contains("webex-solution") ? "solution" : "prose").join(" ");
}
check("avant une partie imbriquée",
      placed([new El("p"), new El("div", "webex-check")]),   "prose BOUTON compteur part");
check("avant une réponse repliée",
      placed([new El("p"), new El("div", "webex-solution")]), "prose BOUTON compteur solution");
check("mais pas avant une correction",
      placed([new El("div", "webex-solution webex-unlocked"), new El("p")]),
      "correction prose BOUTON compteur");
check("sans rien de tel, à la fin",
      placed([new El("p"), new El("p")]),                     "prose prose BOUTON compteur");

// --- le gel : après « Soumettre », plus rien ne bouge --------------------------------------------
const LABELS = { "--show_answers": '"Soumettre"', "--try_again": '"Réessayer"',
                 "--welldone": '"Bien joué !"',
                 "--webex-reset": '"⚠︎ Réinitialiser mes réponses"',
                 "--webex-reset-confirm": '"⚠︎ Confirmer"',
                 "--webex-progress": '"Exercices terminés :"' };
global.window.getComputedStyle = () => ({ getPropertyValue: n => LABELS[n] || "" });

const gi = field([1], {tol: 0.1});
const gs = new El("select", "webex-select");
const gt = new El("textarea");
const gc = new El("span", "webex-cell");
const gsec = section("exr-gel", gi, gs, gt, new El("div", "webex-clickcell").add(gc));
page(new El("body").add(gsec));
type(gi, "1"); gc.dataset = { answer: "1" }; clickcell_func.call(gc);
update_total_correct();
check_func.call(gsec.btn);
const gele = el => (el.attrs.disabled ? "gelé" : "libre");
check("le champ est gelé",        gele(gi), "gelé");
check("le menu déroulant aussi",  gele(gs), "gelé");
check("la zone de texte aussi",   gele(gt), "gelé");
check("la case sort du clavier",  gc.attrs.tabindex, "-1");
// et elle n'accepte plus de clic, ce que `pointer-events: none` ne dit qu'à la souris
gc.classList.remove("webex-correct");
clickcell_func.call(gc);
check("une case gelée ne répond plus", gc.classList.list(), "(aucune)");
check_func.call(gsec.btn);                                    // « Réessayer »
check("« Réessayer » rend le menu", gele(gs), "libre");
check("... et la case",             gc.attrs.tabindex, "0");

// Le gel s'arrête à SA section : une partie déjà soumise ne doit pas être rendue par sa mère.
const fi = field([2], {tol: 0.1});
const mi = field([3], {tol: 0.1});
const f2 = section("exr-g-part", fi);
const m2 = section("exr-g", mi);
m2.kids[0].add(f2);
page(new El("body").add(m2));
type(fi, "2"); type(mi, "3");
update_total_correct();
check_func.call(f2.btn);                                      // la fille est soumise
check_func.call(m2.btn);                                      // puis la mère
check_func.call(m2.btn);                                      // et la mère est reprise
check("la fille reste gelée", gele(fi), "gelé");
check("la mère est rendue",   gele(mi), "libre");

// --- la mémoire : sous quel nom une réponse est retenue -----------------------------------------
// L'INVARIANT : la clé vient de ce que la question DIT. Si elle venait de son rang, insérer une
// question décalerait toutes les suivantes et une réponse reviendrait sur la mauvaise question.
const fitb = (exr, answer, tol) => {
  const el = field(answer, {tol});
  const box = new El("div", "", { id: exr });
  box.add(el);
  el.exr = exr;
  return el;
};
function keys(els) {
  const body = new El("body");
  els.forEach(e => body.add(e.closest("[id^='exr-']") || e));
  page(body);
  return webex_widgets();
}

const q1 = fitb("exr-musee", [45], 0.1);
const q2 = fitb("exr-musee", [19], 0.1);
const q0 = fitb("exr-musee", [77], 0.1);            // la question qu'on insère AVANT les deux autres

const avant = keys([q1, q2]);
const apres = keys([q0, q1, q2]);
check("clé stable d'un rendu à l'autre", keys([q1, q2])[0].key, avant[0].key);
check("insérer une question avant",      apres[2].key,          avant[1].key);
check("... ne décale pas la première",   apres[1].key,          avant[0].key);
check("... et la nouvelle diffère",      apres[0].key === avant[0].key ? "égale" : "distincte",
                                         "distincte");
check("question modifiée = autre clé",
      keys([fitb("exr-musee", [46], 0.1)])[0].key === avant[0].key ? "égale" : "distincte",
      "distincte");
check("autre exercice = autre clé",
      keys([fitb("exr-cinema", [45], 0.1)])[0].key === avant[0].key ? "égale" : "distincte",
      "distincte");
check("deux questions identiques",
      (() => { const k = keys([fitb("exr-x", [7]), fitb("exr-x", [7])]);
               return k[0].key === k[1].key ? "égales" : "distinctes"; })(), "distinctes");

// --- aller-retour : ce qu'on a tapé revient, avec son verdict -----------------------------------
function store() {
  const m = new Map();
  return { setItem: (k, v) => m.set(k, String(v)), getItem: k => m.has(k) ? m.get(k) : null,
           removeItem: k => m.delete(k), size: () => m.size };
}
const p1 = fitb("exr-musee", [45], 0.1), p2 = fitb("exr-musee", [19], 0.1);
webex_store = store();
webex_page  = webex_page_key();
webex_list  = keys([p1, p2]);
type(p1, "45"); type(p2, "99");
webex_ready = true;
webex_save();

const n1 = fitb("exr-musee", [45], 0.1), n2 = fitb("exr-musee", [19], 0.1);
webex_ready = false;
webex_list  = keys([n1, n2]);
webex_restore();
check("la réponse juste revient",   n1.value + " " + n1.classList.list(), "45 webex-correct");
check("la fausse aussi",            n2.value + " " + n2.classList.list(), "99 webex-incorrect");

// une page sans stockage ne doit rien casser : c'est le cas Safari sur file://
webex_store = null; webex_ready = true;
check("sans stockage, aucune erreur",
      (() => { try { webex_save(); webex_restore(); webex_bar(); return "ok"; }
               catch (e) { return "exception : " + e.message; } })(), "ok");

// et une page vierge n'écrit rien plutôt qu'un objet vide
const v1 = fitb("exr-musee", [45], 0.1);
webex_store = store(); webex_list = keys([v1]); webex_ready = true;
webex_save();
check("page vierge, rien d'écrit", String(webex_store.size()), "0");

// --- l'état soumis d'une section ----------------------------------------------------------------
// Le rejeu est ORDONNÉ : check_func() lit l'étiquette du compteur, donc le compteur doit être
// rempli avant. Le compteur est rendu FIDÈLEMENT ici : tant qu'il est vide il n'a pas de <label>,
// et check_func() lève -- ce qui est exactement ce qui arrive dans un navigateur.
function soumise(exr, answers) {
  const q = field(answers, {tol: 0.1});
  const sc = section(exr, q);
  page(new El("body").add(sc));
  webex_page = webex_page_key();
  webex_list = webex_widgets();
  return { q: q, sec: sc };
}
let g = soumise("exr-soumis", [45]);
webex_store = store();
type(g.q, "45");
update_total_correct();
check_func.call(g.sec.btn);                                  // l'étudiant·e soumet
webex_ready = true;
webex_save();
check("section soumise", g.sec.classList.contains("unchecked") ? "unchecked" : "soumise", "soumise");

let h = soumise("exr-soumis", [45]);
webex_ready = false;
webex_restore();
check("... et rejouée au retour", h.sec.classList.contains("unchecked") ? "unchecked" : "soumise",
                                  "soumise");
check("... avec la réponse",      h.q.value, "45");

// une section dont la question a changé ne doit PAS revenir soumise
let k3 = soumise("exr-soumis", [46]);                        // la réponse attendue a été corrigée
webex_ready = false;
webex_restore();
check("question réécrite = section vierge",
      k3.sec.classList.contains("unchecked") ? "unchecked" : "soumise", "unchecked");

// LE CAS QUI REND L'ORDRE PORTEUR : une section soumise sans qu'aucune réponse ait été donnée --
// ce que fait quiconque clique « Soumettre » trop tôt. Rien n'est alors à réécrire, donc aucun
// gestionnaire ne rappelle le compteur, et rejouer la section avant de le remplir fait lever
// check_func() sur un compteur vide -- ce qui casse toute la fin du chargement.
let e = soumise("exr-vide", [45]);
webex_store = store(); webex_page = webex_page_key();
update_total_correct();                                      // ce que la passe de chargement fait
check_func.call(e.sec.btn);                                  // soumis, sans avoir rien tapé
webex_ready = true;
webex_save();

let e2 = soumise("exr-vide", [45]);
webex_ready = false;
check("section vide soumise, rejouée",
      (() => { try { webex_restore(); }
               catch (err) { return "lève : " + err.message; }
               return e2.sec.classList.contains("unchecked") ? "unchecked" : "soumise"; })(),
      "soumise");

// --- la barre : le bouton, et rien d'autre ------------------------------------------------------
const main = new El("main").add(section("exr-barre", field([1], {tol: 0.1})));
const body = new El("body").add(main);
main.insertBefore = function (node) { node.parentElement = this; this.kids.unshift(node); };
main.firstChild = null;
page(body);
global.document.querySelector = sel => sel === "main" ? main : null;
webex_store = store(); webex_list = webex_widgets();   /* la barre exige une question sur la page */
webex_bar();
check("la barre est posée",  String(main.kids.length), "2");
check("elle ne porte que le bouton", String(main.kids[0].kids.length), "1");
check("... avec son libellé", main.kids[0].kids[0].textContent, "⚠︎ Réinitialiser mes réponses");

// --- et ce que le bouton fait : tout défaire SANS recharger --------------------------------------
// Un `location.reload()` perdrait le mode sombre : Quarto garde ce choix dans une variable, et non
// dans localStorage, dès que la page est ouverte comme un fichier -- ce qu'une séance est toujours.
const rq  = field([7], {tol: 0.1});
const rs  = section("exr-reset", rq);
const rbar = new El("main").add(rs);
rbar.insertBefore = function (n) { n.parentElement = this; this.kids.unshift(n); };
rbar.firstChild = null;
page(new El("body").add(rbar));
global.document.querySelector = sel => sel === "main" ? rbar : null;
webex_store = store(); webex_page = webex_page_key(); webex_list = webex_widgets();
type(rq, "7");
update_total_correct();
check_func.call(rs.btn);                       // soumis, et juste : le bouton se désactive
webex_ready = true; webex_save();
check("avant la remise à zéro", String(webex_store.size()), "1");

webex_bar();
const reset = rbar.kids[0].kids[0];
reset.onclick.call(reset);                     // premier clic : le bouton s'arme
reset.onclick.call(reset);                     // second : il efface
check("la réponse est effacée",     rq.value + "|" + rq.classList.list(), "|(aucune)");
check("la section est rouverte",    rs.classList.contains("unchecked") ? "ouverte" : "soumise",
                                    "ouverte");
check("le bouton se rallume",       rs.btn.attrs.disabled ? "éteint" : "rallumé", "rallumé");
check("le champ est dégelé",        rs.btn.parentElement === rs && !rq.attrs.disabled ? "libre" : "gelé",
                                    "libre");
check("le compteur repart de zéro", label(rs), "0 / 1 correct");
check("et le stockage est vide",    String(webex_store.size()), "0");
check("le libellé revient",         reset.textContent, "⚠︎ Réinitialiser mes réponses");

// --- un tableau à plusieurs cases : chacune compte pour elle-même --------------------------------
// PANNE GARDÉE : le piège n'est pas le clic mais le COMPTAGE. Une enveloppe valant un point quel
// que soit le nombre de cases attendues, un tableau à trois bonnes cases plafonnait à « 1 / 1 » et
// disait « Bien joué ! » aux deux tiers du travail.
function cell(ok) {
  const c = new El("span", "webex-cell");
  c.dataset = { answer: ok ? "1" : "0" };
  return c;
}
const c1 = cell(true), c2 = cell(true), c3 = cell(true), c4 = cell(false);
const ctab = new El("div", "webex-clickcell").add(c1, c2, c3, c4);
const csec = section("exr-cases", ctab);
page(new El("body").add(csec));

update_total_correct();
check("trois cases à trouver",      label(csec),                        "0 / 3 correct");
clickcell_func.call(c1);
check("une trouvée sur trois",      label(csec),                        "1 / 3 correct");
clickcell_func.call(c4);
check("une fausse s'ajoute",        label(csec),                        "1 / 3 correct ; 1 incorrect");
clickcell_func.call(c4);
check("un second clic la retire",   label(csec),                        "1 / 3 correct");
check("et la case est nue",         c4.classList.list(),                "(aucune)");
clickcell_func.call(c2); clickcell_func.call(c3);
check("les trois font le compte",   label(csec),                        "3 / 3 correct");
check("une case voisine reste",     c1.classList.list(),                "webex-correct");

// une seule case attendue : c'est une question à une case à cocher, sans branche particulière
const cu1 = cell(true), cu2 = cell(false);
const usec = section("exr-une", new El("div", "webex-clickcell").add(cu1, cu2));
page(new El("body").add(usec));
update_total_correct();
clickcell_func.call(cu1);
check("une seule case à trouver",   label(usec),                        "1 / 1 correct");

// la mémoire retient LA LISTE des cases choisies, et la rejoue
const cm1 = cell(true), cm2 = cell(true), cm3 = cell(false);
const msec = section("exr-memo", new El("div", "webex-clickcell").add(cm1, cm2, cm3));
page(new El("body").add(msec));
webex_store = store(); webex_page = webex_page_key(); webex_list = webex_widgets();
clickcell_func.call(cm1); clickcell_func.call(cm3);
webex_save();

const cn1 = cell(true), cn2 = cell(true), cn3 = cell(false);
const nsec = section("exr-memo", new El("div", "webex-clickcell").add(cn1, cn2, cn3));
page(new El("body").add(nsec));
webex_list = webex_widgets(); webex_restore();
check("les deux cases reviennent",  cn1.classList.list() + "|" + cn2.classList.list() + "|" +
                                    cn3.classList.list(),
                                    "webex-correct|(aucune)|webex-incorrect");

// --- le compte des exercices terminés ------------------------------------------------------------
// PANNE GARDÉE, deux fois. (1) L'unité est l'exercice NUMÉROTÉ : le filtre Lua enveloppe le div qui
// porte l'identifiant dans une boîte anonyme, donc une boîte compte si elle contient un `exr-`, et
// un `::: encadre` de premier niveau n'en contient pas. (2) Terminé veut dire « Bien joué ! » dans
// toutes ses sections, pas « soumis » : un exercice rendu avec une faute est à refaire, pas fini.
function boxed(exr, ...secs) {
  const b = new El("div", "webex-box");
  if (exr) b.add(new El("div", "", { id: exr }));
  return b.add(...secs);
}
const soumettre = (sec, champ, valeur) => {
  type(champ, valeur); update_total_correct(); check_func.call(sec.btn);
};

const g1 = field([1], {tol: 0.1}), g2 = field([1], {tol: 0.1});
const bx1 = section("exr-p1", g1), bx2 = section("exr-p2", g2);
page(new El("body").add(boxed("exr-p1", bx1), boxed("exr-p2", bx2),
                        boxed("exr-vide", new El("p")),
                        boxed(null, section("encadre", field([1], {tol: 0.1})))));
update_total_correct();
check("rien de fait sur deux",       webex_progress().join("/"),        "0/2");
soumettre(bx1, g1, "1");
check("un exercice réussi",          webex_progress().join("/"),        "1/2");
soumettre(bx2, g2, "9");
check("« Réessayer » ne compte pas",  webex_progress().join("/"),       "1/2");
check_func.call(bx2.btn);                                   /* rouvrir la section */
soumettre(bx2, g2, "1");
check("une fois juste, il compte",   webex_progress().join("/"),        "2/2");

// une boîte à deux parties n'est finie qu'une fois les DEUX réussies
const h1 = field([1], {tol: 0.1}), h2 = field([1], {tol: 0.1});
const bq1 = section("exr-q-a", h1), bq2 = section("exr-q-b", h2);
page(new El("body").add(boxed("exr-q", bq1, bq2)));
update_total_correct();
soumettre(bq1, h1, "1");
check("une partie sur deux",         webex_progress().join("/"),        "0/1");
soumettre(bq2, h2, "1");
check("les deux parties",            webex_progress().join("/"),        "1/1");

let bad = 0;
for (const [ok, lab, got, want] of R) {
  if (ok === "✗") bad++;
  out(`${ok} ${lab.padEnd(34)} → ${got}${ok === "✗" ? `   (attendu : ${want})` : ""}`);
}
out(`\n${R.length - bad}/${R.length} vérifications passent`);
process.exit(bad ? 1 : 0);
