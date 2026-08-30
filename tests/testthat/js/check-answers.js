/* PURPOSE: run the real webex.js against a DOM stub, and assert the verdict it reaches.
 * ROLE: the package had no javascript test at all, which is why two faults lived in
 *   solveme_func unseen -- a tolerated answer used to come out carrying webex-correct AND
 *   webex-incorrect, and its section could then never reach "all correct".
 * Usage: node check-answers.js <path to webex.js>   -- exits non-zero on the first failure.
 * Driven by tests/testthat/test-js.R, which skips when node is not installed. */
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");

// --- DOM minimal : juste ce que solveme_func et update_total_correct touchent -------------------
class CL {
  constructor(){ this.s = new Set(); }
  add(c){ this.s.add(c); } remove(c){ this.s.delete(c); }
  contains(c){ return this.s.has(c); }
  toggle(c, on){ on ? this.s.add(c) : this.s.delete(c); }
  list(){ const v = [...this.s].filter(c => c === "webex-correct" || c === "webex-incorrect");
          return v.sort().join(" ") || "(aucune)"; }
}
const out = console.error.bind(console);
global.console = { log(){} };
global.window = { addEventListener(){} };
global.document = { getElementsByClassName: () => [] };
eval(src);

function field(answers, {tol, ignorecase, regex} = {}) {
  const cl = new CL(); cl.add("webex-solveme"); cl.add("nospaces");
  if (ignorecase) cl.add("ignorecase");
  if (regex) cl.add("regex");
  // ce que window.onload fait au chargement : la normalisation porte sur la chaîne JSON entière
  let json = JSON.stringify(answers.map(String));
  if (ignorecase) json = json.toLowerCase();
  json = json.replace(/ /g, "");
  return { classList: cl, value: "", dataset: { answer: json, tol: tol } };
}
function type(f, v){ f.value = v; solveme_func.call(f); return f.classList.list(); }

const R = [];
const check = (label, got, want) => R.push([got === want ? "✓" : "✗", label, got, want]);

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

// regex, et le mélange tol + ignorecase que le HTML cassait
f = field(["\\d{1,4}"], {regex: true});
check("regex <- '42'",         type(f, "42"),   "webex-correct");
check("regex <- 'abc'",        type(f, "abc"),  "webex-incorrect");
f = field(["Oui"], {ignorecase: true, tol: 0.5});
check("ignorecase <- 'oui'",   type(f, "oui"),  "webex-correct");

// --- le compteur d'une section ------------------------------------------------------------------
function section(fields) {
  const byClass = c => fields.filter(x => x.classList.contains(c));
  const span = { innerHTML: "" };
  span.parentElement = { getElementsByClassName: c => c === "webex-checkbox" ? [] : byClass(c) };
  global.document.getElementsByClassName = c => c === "webex-total_correct" ? [span] : [];
  update_total_correct();
  return span.innerHTML.replace(/<[^>]*>/g, "").trim().replace(/\s+/g, " ");
}
const a = field([5.2], {tol: 0.1}), b = field([3], {tol: 0.1});
type(a, "5.20"); type(b, "3");
check("compteur, 2 justes", section([a, b]), "2 / 2 correct");
check("classe finale",      section([a, b]).includes("2 / 2") ? "ok" : "ko", "ok");
type(b, "99");
check("compteur, 1 faux",   section([a, b]), "1 / 2 correct ; 1 incorrect");

let bad = 0;
for (const [ok, label, got, want] of R) {
  if (ok === "✗") bad++;
  out(`${ok} ${label.padEnd(28)} → ${got}${ok === "✗" ? `   (attendu : ${want})` : ""}`);
}
out(`\n${R.length - bad}/${R.length} vérifications passent`);
process.exit(bad ? 1 : 0);
