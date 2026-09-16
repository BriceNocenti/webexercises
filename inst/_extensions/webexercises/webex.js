/* PURPOSE: bind the webexercises widgets -- fill-in-the-blank, select, radio, checkbox, clickable
 *   table cell, the hidden-solution toggle and the check/try-again cycle -- to the markup the R
 *   functions write.
 *   It also REMEMBERS: what the reader typed and which sections they submitted go to localStorage,
 *   and come back on the next visit (see the last section, "remembering the answers").
 * KEY CONSTRAINTS: four invariants, each stated where it is enforced --
 *   - a widget wears webex-correct OR webex-incorrect, never both (see set_answer_state);
 *   - a question belongs to the NEAREST enclosing .webex-check, and a widget inside a solution is
 *     no one's question (see webex_owned, which the counter, the freeze and the store all use);
 *   - a widget type counts in the score only if it has a term in `total` (see update_total_correct);
 *   - an answer is remembered under what its question SAYS, never under its position (webex_widgets).
 * ROLE: shipped three ways from this one file: as an HTML DEPENDENCY by the Quarto extension
 *   (_extensions/webexercises), and as an `after_body` include by webexercises_default() and
 *   webexercises_default2(), which wrap it in <script> at render time.
 * WARNING: PLAIN JAVASCRIPT, no <script> wrapper. The wrapper used to be part of the file because
 *   rmarkdown's `after_body` takes raw HTML; an HTML dependency takes a script FILE, and a wrapped
 *   one would be a syntax error on the first line. R/webexercises_default.R adds it back. */

/* WHAT A SECTION OWNS -- the one rule three different jobs need, so it is written once.
 *
 * A question belongs to the NEAREST enclosing `.webex-check`, and nothing living inside a
 * `.webex-solution` is a question at all. Both halves guard a silent wrong answer:
 *   - the courses write an exercise as an enclosing block with two or three parts submitted one
 *     after the other, so an outer section that also has a question of its own was counting its
 *     children's widgets as well -- "0 / 2 correct" on an énoncé that asks nothing, a button that
 *     can never be satisfied, and, on "Réessayer", every field of an already-submitted child part
 *     handed back to the reader;
 *   - a widget shown inside a worked answer is an illustration, and counting it would put a score
 *     out of reach.
 * `getElementsByClassName` descends to any depth, which is why neither held before.               */
function webex_owned(section, sel) {
  var all = section.querySelectorAll(sel), out = [], i;
  for (i = 0; i < all.length; i++) {
    if (all[i].closest(".webex-check") !== section) continue;
    if (all[i].closest(".webex-solution") !== null)  continue;
    out.push(all[i]);
  }
  return out;
}

/* update total correct if #webex-total_correct exists
 * WARNING: `total` below is THE coupling point of this file. A widget type missing from that sum
 * never enters the score, so its section can never reach "all correct": its button never turns
 * into "Well done !" and stays on "Try again" whatever the reader does. Adding a widget means
 * adding its term there -- one line, and there is no other place to touch. The shapes differ on
 * purpose: a field, a select, a radiogroup and a clickable table each count ONE (the container is
 * the question), while a checkbox question and a clickable table count one per EXPECTED answer.
 * ⚠ A clickable table used to count ONE whatever it asked: a table with three right cells
 * capped at "1 / 1" and said "Well done !" two thirds of the way through.                    */
update_total_correct = function() {
  console.log("webex: update total_correct");

  var t = document.getElementsByClassName("webex-total_correct");
  for (var i = 0; i < t.length; i++) {
    /* NOT `parentElement`: the counter is placed among the questions it counts, so its parent may
     * be any block of the exercise. Its SECTION is the nearest enclosing one, always. */
    var p = t[i].closest(".webex-check");
    var own = function (sel) { return webex_owned(p, sel).length; };

    var correct     = own(".webex-correct");
    var incorrect   = own(".webex-incorrect");
    var solvemes    = own(".webex-solveme");
    var radiogroups = own(".webex-radiogroup");
    var selects     = own(".webex-select");
    /* one per cell to find -- and `dataset` rather than an attribute selector, which the
       DOM the js test harness stands up does not resolve */
    var groups = webex_owned(p, ".webex-clickcell"), clickcells = 0, g, n, cells;
    for (g = 0; g < groups.length; g++) {
      cells = groups[g].getElementsByClassName("webex-cell");
      n = 0;
      for (var m = 0; m < cells.length; m++) if (cells[m].dataset.answer === "1") n++;
      clickcells += n > 0 ? n : 1;
    }

    var checkboxes = webex_owned(p, ".webex-checkbox");
    var checkboxes_answers = 0;
    for (var j = 0; j < checkboxes.length; j++) {
      var cbinputs = checkboxes[j].querySelectorAll("label input");
      for (var k = 0; k < cbinputs.length; k++) {
        if (cbinputs[k].value == "answer") {
          checkboxes_answers = checkboxes_answers + 1;
        }
      }
    }

    var total = solvemes + radiogroups + selects + clickcells + checkboxes_answers;
    var score = correct + " / " + total + " correct";

    if (correct == total && incorrect == 0) {
      t[i].innerHTML = "<label class='webex-check_all_correct'>" + score + "</label>";
    } else if (incorrect == 0) {
      t[i].innerHTML = "<label class='webex-check_incorrect'>" + score + "</label>";
    } else {
      t[i].innerHTML = "<label class='webex-check_incorrect'>" + score + " ; " + incorrect +
        " incorrect</label>";
    }
  }

  /* Every verdict handler ends here, so this one line is the whole of the saving: a widget type
   * added to `total` above is remembered too, with nothing else to touch. It is inert until the
   * restore has run (webex_ready), or the setup pass would store a page full of blanks. */
  webex_save();
  webex_progress_render();
}

/* webex-solution button toggling function
 * The button says whether it is open, because nothing else does: a folded solution is a block
 * clipped by `height` and `overflow`, which no assistive technology can see as folded. The text
 * stays in the document on purpose -- Ctrl+F still finds a correction, and nobody here is
 * graded. */
b_func = function() {
  console.log("webex: toggle hide");

  var open = this.parentElement.classList.toggle("open");
  this.setAttribute("aria-expanded", open ? "true" : "false");
}

/* WHERE THE BUTTON GOES: right after the questions it owns, that is, BEFORE the first thing that
 * appears when it is pressed -- a folded answer, or a part that is submitted on its own.
 * Appending it at the very end of the section put it under both: an exercise made of a table plus
 * a boxed question showed two identical buttons stacked at the bottom, the table's one furthest
 * from the table, and pressing a button revealed the answer ABOVE it, so the button dropped away
 * from under the reader's own cursor. A `::: correction` is skipped -- it is open already, so
 * nothing about it moves.
 * WARNING: the button may therefore land anywhere inside the section, which is why nothing reads
 * its `parentElement` to find the section. `closest(".webex-check")` is what does.              */
function webex_place(section, btn, spn) {
  var mark = section.querySelector(".webex-check, .webex-solution:not(.webex-unlocked)");
  var host = mark ? mark.parentElement : section;
  host.insertBefore(btn, mark || null);
  host.insertBefore(spn, mark || null);
}

/* Submitting a section, and taking it back.
 *
 * WARNING: everything the reader answered with is frozen, not only the `<input>`s. An inline
 * `mcq()` is a `<select>`, a written answer is a `<textarea>`, and a clickable cell is a `<span>`
 * with a tab stop of its own -- all three stayed changeable after "Soumettre", so the verdict on
 * screen could stop describing what was on the page. `webex_owned` keeps the freeze to THIS
 * section: a part submitted on its own must not be handed back by its parent's "Réessayer".      */
check_func = function() {
  console.log("webex: check answers");

  var css = window.getComputedStyle(document.documentElement);
  var str = function (n) { return css.getPropertyValue(n).replace(/"/g, ''); };
  var sh_answers = str('--show_answers'), try_again = str('--try_again'), wldone = str('--welldone');

  var section = this.closest(".webex-check");
  var cl = section.classList;
  var label = this.nextSibling.getElementsByTagName("label")[0];
  var all_correct = label.classList;
  var say = webex_owned(section, ".webex-say")[0];
  var fields = webex_owned(section, "input, select, textarea");
  var cells  = webex_owned(section, ".webex-cell");
  var i;

  if (cl.contains('unchecked')) {
    cl.remove("unchecked");

    if ( all_correct.contains('webex-check_all_correct') ) {
      this.innerHTML = wldone;
      this.classList.add("webex-done");
      this.setAttribute("disabled", true);

    } else {
      this.innerHTML = try_again;
      this.classList.remove("webex-done");
    }

    for (i = 0; i < fields.length; i++) fields[i].setAttribute("disabled", true);
    for (i = 0; i < cells.length;  i++) {
      cells[i].setAttribute("tabindex", "-1");
      cells[i].setAttribute("aria-disabled", "true");
    }

  } else {
    cl.add("unchecked");
    this.innerHTML = sh_answers;
    this.classList.remove("webex-done");

    for (i = 0; i < fields.length; i++) fields[i].removeAttribute("disabled");
    for (i = 0; i < cells.length;  i++) {
      cells[i].setAttribute("tabindex", "0");
      cells[i].removeAttribute("aria-disabled");
    }
  }

  /* the score first, then what the button now says -- the two things the eye reads at a glance
   * and an ear was told nothing about */
  if (say) say.textContent = cl.contains("unchecked") ? this.textContent
                                                      : label.textContent + " — " + this.textContent;

  webex_save();      /* submitting is the one state change that never reaches the counter */
  webex_progress_render();
}




/* WARNING: `webex-correct` and `webex-incorrect` are EXCLUSIVE, and no verdict may leave a widget
 * wearing both -- update_total_correct() counts the two classes separately, so an answer carrying
 * both scores as correct AND incorrect at once: its section prints "5 / 6 correct ; 1 incorrect"
 * and its button stays on "Try again" for good, whatever the reader types. The tolerance and the
 * regex branches used to do exactly that, adding one class without taking the other back off.
 * Every verdict in this file now goes through this one function. */
function set_answer_state(cl, correct) {
  cl.toggle("webex-correct", correct);
  cl.toggle("webex-incorrect", !correct);
}

/* The number a reader typed, or NaN when what they typed is not one. The WHOLE string has to be
 * read: a leading-digits parse takes "1/2.41" for 1 and would accept it for any answer near 1.
 * A decimal COMMA counts as a decimal point -- it is what a French keyboard types -- and a
 * trailing % is dropped.
 * "1/2.41" IS a number, and it is read as one. That spelling is what a table of odds below 1
 * displays -- tabxplor prints the magnitude, not the value -- so a reader copying the cell, and a
 * reader dividing it out, must be judged against the same quantity. The anchors are what makes
 * this safe: the fraction is matched whole, so "1" is still 1 and stays wrong for "1/2.41". */
/* `nospaces` drops EVERY kind of space, not the ASCII one. A reader who copies a figure out of the
 * table rather than retyping it brings the separator with it, and that separator is never U+0020:
 * tabxplor pads its thousands with U+2007 (FIGURE SPACE) on the html path, writes U+00A0 inside
 * labels and U+202F elsewhere. `/ /g` left all three standing, so "739 000" was right when typed
 * and wrong when pasted -- silently, since without `data-tol` the check is a string equality.
 * `\s` covers U+0020, U+00A0, U+2000-U+200A (U+2007 among them), U+202F, U+205F and U+FEFF, which
 * is what webex_number() below has always used. */
var WEBEX_WS = /\s/g;

var WEBEX_NUM = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)";
var WEBEX_PLAIN = new RegExp("^" + WEBEX_NUM + "$");
var WEBEX_FRAC  = new RegExp("^(" + WEBEX_NUM + ")/(" + WEBEX_NUM + ")$");

function webex_clean(x) {
  return String(x).trim().replace(/\s/g, "").replace(",", ".").replace(/%$/, "");
}

/* A leading "×" (or "*", "x") is dropped: a ratio cell prints "×2.14", and a reader copying that
 * spelling must be judged on the number, as fitb_cell() on the R side already reads it. Only
 * reached under `tol`, so a non-numeric field keeps its string check. "÷" is NOT dropped here:
 * see webex_inverse(). */
function webex_number(x) {
  var s = webex_clean(x).replace(/^[×*xX]/, "");
  if (WEBEX_PLAIN.test(s)) return parseFloat(s);
  var f = WEBEX_FRAC.exec(s);
  if (f) {
    var den = parseFloat(f[2]);
    return den === 0 ? NaN : parseFloat(f[1]) / den;
  }
  return NaN;
}

/* The three spellings of "one over m" -- "÷m", "/m", "1/m" -- read as the magnitude m (NaN if the
 * spelling is not one of them). They mean the same quantity but NOT the same number to compare:
 *   * a ratio cell prints "÷1.87" and fitb_cell() expects the MAGNITUDE 1.87 ("1.87 fois moins");
 *   * an odds cell prints "1/2.41" and expects the VALUE 0.415 (see WEBEX_FRAC above).
 * WARNING: so an inverse spelling typed by the reader is tried as BOTH m and 1/m, but only when an
 *   expected answer is itself written as an inverse. Otherwise "1/12" would pass for 12. And an
 *   expected "1/m" keeps its value only: a bare "2.41" must stay wrong for an odds of "1/2.41". */
var WEBEX_INV = new RegExp("^(?:÷|1?/)(" + WEBEX_NUM + ")$");

function webex_inverse(x) {
  var f = WEBEX_INV.exec(webex_clean(x));
  var m = f ? parseFloat(f[1]) : NaN;
  return m > 0 ? m : NaN;
}

function webex_candidates(x, reader, inverse_ok) {
  var out = [webex_number(x)];
  var m = webex_inverse(x);
  if (!isNaN(m) && (reader ? inverse_ok : /^[÷\/]/.test(webex_clean(x)))) out.push(m, 1 / m);
  return out.filter(function(v) { return !isNaN(v); });
}

/* function for checking solveme answers */
solveme_func = function(e) {
  console.log("webex: check solveme");

  var real_answers = JSON.parse(this.dataset.answer);
  var my_answer = this.value;
  var cl = this.classList;
  if (cl.contains("ignorecase")) {
    my_answer = my_answer.toLowerCase();
  }
  if (cl.contains("nospaces")) {
    my_answer = my_answer.replace(WEBEX_WS, "")
  }

  if (my_answer == "") {
    cl.remove("webex-correct");
    cl.remove("webex-incorrect");
    update_total_correct();
    return;
  }

  var correct = real_answers.includes(my_answer);

  /* within `tol`, a number is right whatever its spelling: "5.20" and "5,2" for "5.2" */
  var tol = webex_number(this.dataset.tol);
  if (!correct && tol > 0) {
    var inverse_ok = real_answers.some(function(x) { return !isNaN(webex_inverse(x)); });
    var mine = webex_candidates(my_answer, true, inverse_ok);
    correct = real_answers.some(function(x) {
      return webex_candidates(x, false).some(function(theirs) {
        return mine.some(function(v) { return Math.abs(theirs - v) < tol; });
      });
    });
  }

  if (!correct && cl.contains("regex")) {
    correct = new RegExp(real_answers.join("|")).test(my_answer);
  }

  set_answer_state(cl, correct);
  update_total_correct();
}

/* function for checking select answers */
select_func = function(e) {
  console.log("webex: check select");

  var cl = this.classList;

  if (this.value == "blank") {
    cl.remove("webex-correct");
    cl.remove("webex-incorrect");
  } else {
    set_answer_state(cl, this.value == "answer");
  }

  update_total_correct();
}

/* function for checking radiogroups answers */
radiogroups_func = function(e) {
  console.log("webex: check radiogroups");

  var checked_button = document.querySelector('input[name=' + this.id + ']:checked');
  var cl = checked_button.parentElement.classList;
  var labels = checked_button.parentElement.parentElement.children;

  /* get rid of styles */
  for (var i = 0; i < labels.length; i++) {
    labels[i].classList.remove("webex-incorrect");
    labels[i].classList.remove("webex-correct");
  }

  set_answer_state(cl, checked_button.value == "answer");

  update_total_correct();
}

/* function for checking checkboxes answers */
checkboxes_func = function(e) {
  console.log("webex: check checkboxes");

  var current_button = document.querySelector('input[name=' + this.id + ']');
  var cl = current_button.parentElement.classList;

  /* add style when checked, remove when unchecked */
  if (current_button.checked) {
    set_answer_state(cl, current_button.value == "answer");
  } else {
    cl.remove("webex-incorrect");
    cl.remove("webex-correct");
  }

  update_total_correct();
}

/* function for checking a clicked table cell
 * The QUESTION is the wrapper (.webex-clickcell), one per table, the way a checkbox question is
 * one per question; the cells inside it are its options, and any number of them may be chosen.
 * A second click on a chosen cell takes the choice back -- which is the only way to change one's
 * mind now that clicking elsewhere no longer clears the rest. A table with ONE right cell needs
 * no branch of its own: it is exactly a question with one box to tick. */
clickcell_func = function() {
  console.log("webex: check clickcell");

  /* `pointer-events: none` stops the mouse once the section is submitted, and stops nothing else:
   * the cell keeps its tab stop and its Enter key. The freeze has to be stated here too. */
  var sec = this.closest(".webex-check");
  if (sec !== null && !sec.classList.contains("unchecked")) return;

  if (this.closest(".webex-clickcell") === null) return;

  var cl = this.classList;
  if (cl.contains("webex-correct") || cl.contains("webex-incorrect")) {
    cl.remove("webex-correct");
    cl.remove("webex-incorrect");
  } else {
    set_answer_state(cl, this.dataset.answer === "1");
  }

  update_total_correct();
}

/* === SECTION: remembering the answers ==============================================
 *
 * The page keeps what the reader typed, and which sections they submitted, in localStorage.
 * Nothing leaves the browser: there is no server, and no answer is sent anywhere.
 *
 * WARNING: a séance is one .html opened offline, so `file://` is the REAL case, and there the
 *   requirement is undefined: Chrome, Edge and Firefox store (Firefox keys one area per
 *   DIRECTORY, i.e. per student project), Safari refuses. webex_storage() therefore PROBES
 *   rather than assumes, and when it comes back null every function below is a no-op -- the page
 *   behaves exactly as it did before any of this existed, and the bar does not appear.
 *
 * WARNING: a widget is remembered under what its QUESTION SAYS, never under its position or its
 *   id. An id counts positions, so inserting a question in the middle of an exercise shifts every
 *   one after it, and a stored answer would come back ON THE WRONG QUESTION with no message. A
 *   content signature fails the safe way round instead: edit a question and its own answer is
 *   dropped, insert one beside it and nothing else moves. */

var webex_store = null;    /* the Storage, or null -- probed once, at load */
var webex_page  = "";      /* which page these answers belong to */
var webex_list  = null;    /* the widgets, collected once: the DOM does not change after load */
var webex_ready = false;   /* until the restore is done, saving would store a page full of blanks */

function webex_storage() {
  try {
    var s = window.localStorage, k = "webex.probe";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch (e) {
    return null;
  }
}

/* FNV-1a, 32 bits, base 36. Not a checksum for safety -- just a short, stable name for a string. */
function webex_hash(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

/* The page. `document.title` is written by the author, distinct from one séance to the next, and
 * survives the reader MOVING the file -- which they do, since they unzip the project where they
 * like. location.pathname would not. It matters because Firefox shares one storage area between
 * every file:// page of a directory, that is, between the séances of one student project. */
function webex_page_key() {
  var t = (document.title || "").trim();
  if (!t) t = (location.pathname || "").split("/").pop();
  return "webex.v1." + webex_hash(t);
}

/* The exercise a widget belongs to. Measured on the rendered corpus: all 33 checked sections sit
 * under an `#exr-`, which is authored and unique per document. The two fallbacks are a net. */
function webex_scope(el) {
  var ex = el.closest("[id^='exr-']");
  if (ex) return ex.id;
  var box = el.closest(".webex-box");
  if (box) {
    var all = document.getElementsByClassName("webex-box");
    for (var i = 0; i < all.length; i++) if (all[i] === box) return "box" + i;
  }
  return "page";
}

/* Every widget of the page, in document order, each carrying the key it is remembered under and
 * the two operations the store needs. `read` answers null when the question is UNANSWERED, which
 * is the one thing never written down. `write` goes back through the widget's own handler, so the
 * verdict, the icon and the counter come out right with no logic duplicated here. */
function webex_widgets() {
  var out = [], seen = {}, i;

  function add(el, kind, sig, read, write) {
    var base = webex_scope(el) + "|" + kind + "|" + webex_hash(sig);
    seen[base] = (seen[base] || 0) + 1;          /* two identical questions in one exercise */
    out.push({ el: el, key: base + "|" + seen[base], read: read, write: write });
  }

  var fields = document.getElementsByClassName("webex-solveme");
  for (i = 0; i < fields.length; i++) (function (el) {
    add(el, "fitb", el.dataset.answer + "|" + (el.dataset.tol || ""),
        function () { return el.value === "" ? null : el.value; },
        function (v) { el.value = v; solveme_func.call(el); });
  })(fields[i]);

  var selects = document.getElementsByClassName("webex-select");
  for (i = 0; i < selects.length; i++) (function (el) {
    add(el, "select", el.textContent,
        function () { return el.selectedIndex > 0 ? el.selectedIndex : null; },
        function (v) {
          if (v > 0 && v < el.options.length) { el.selectedIndex = v; select_func.call(el); }
        });
  })(selects[i]);

  var radios = document.getElementsByClassName("webex-radiogroup");
  for (i = 0; i < radios.length; i++) (function (el) {
    var ins = el.getElementsByTagName("input");
    add(el, "radio", el.textContent,
        function () {
          for (var j = 0; j < ins.length; j++) if (ins[j].checked) return j;
          return null;
        },
        function (v) {
          if (v >= 0 && v < ins.length) { ins[v].checked = true; radiogroups_func.call(el); }
        });
  })(radios[i]);

  var boxes = document.getElementsByClassName("webex-checkbox");
  for (i = 0; i < boxes.length; i++) (function (el) {
    var inp = el.getElementsByTagName("input")[0];
    add(el, "check", el.textContent,
        function () { return inp && inp.checked ? true : null; },
        function (v) { if (v && inp) { inp.checked = true; checkboxes_func.call(el); } });
  })(boxes[i]);

  var groups = document.getElementsByClassName("webex-clickcell");
  for (i = 0; i < groups.length; i++) (function (el) {
    var cells = el.getElementsByClassName("webex-cell");
    add(el, "cell", el.textContent,
        function () {
          var picked = [], j;
          for (j = 0; j < cells.length; j++)
            if (cells[j].classList.contains("webex-correct") ||
                cells[j].classList.contains("webex-incorrect")) picked.push(j);
          return picked.length ? picked : null;
        },
        function (v) {
          for (var j = 0; j < v.length; j++)
            if (v[j] >= 0 && v[j] < cells.length) clickcell_func.call(cells[v[j]]);
        });
  })(groups[i]);

  /* A textarea says nothing about itself -- no answer, no options -- so its rank inside its
   * exercise is the whole of its identity. Inserting one before another therefore forgets the
   * second rather than mixing the two up, which is the safe way round. */
  var texts = document.getElementsByTagName("textarea");
  for (i = 0; i < texts.length; i++) (function (el) {
    add(el, "text", "",
        function () { return el.value === "" ? null : el.value; },
        function (v) { el.value = v; });
  })(texts[i]);

  return out;
}

/* A section is identified by the questions it holds, so it forgets it was submitted exactly when
 * they change -- which is what keeps a stale "Bien joué !" off an exercise that has been rewritten. */
function webex_sections(list) {
  var out = [], secs = document.getElementsByClassName("webex-check");
  for (var i = 0; i < secs.length; i++) {
    var keys = [];
    for (var j = 0; j < list.length; j++)                      /* the same ownership rule */
      if (list[j].el.closest(".webex-check") === secs[i] &&
          list[j].el.closest(".webex-solution") === null) keys.push(list[j].key);
    out.push({ el: secs[i],
               key: webex_hash(keys.sort().join("\n")),
               button: webex_owned(secs[i], ".webex-check-button")[0] });
  }
  return out;
}

/* Rebuilt from the live DOM every time, so a key left behind by an older version of the page stops
 * being written and disappears on its own -- there is nothing to migrate and nothing to prune. */
function webex_save() {
  if (!webex_ready || !webex_store || !webex_list) return;

  var blob = { a: {}, s: [] }, i, v;
  for (i = 0; i < webex_list.length; i++) {
    v = webex_list[i].read();
    if (v !== null) blob.a[webex_list[i].key] = v;
  }
  var secs = webex_sections(webex_list);
  for (i = 0; i < secs.length; i++)
    if (!secs[i].el.classList.contains("unchecked")) blob.s.push(secs[i].key);

  try {
    if (blob.s.length === 0 && Object.keys(blob.a).length === 0) webex_store.removeItem(webex_page);
    else webex_store.setItem(webex_page, JSON.stringify(blob));
  } catch (e) {
    webex_store = null;              /* full, or refused mid-session: stop trying, break nothing */
  }
}

function webex_restore() {
  if (!webex_store || !webex_list) return;

  var raw, blob, i;
  try { raw = webex_store.getItem(webex_page); } catch (e) { return; }
  if (!raw) return;
  try { blob = JSON.parse(raw); } catch (e) { return; }
  if (!blob || !blob.a) return;

  for (i = 0; i < webex_list.length; i++)
    if (Object.prototype.hasOwnProperty.call(blob.a, webex_list[i].key))
      webex_list[i].write(blob.a[webex_list[i].key]);

  /* WARNING: the order is load-bearing. check_func() reads the counter's label off the span next
   * to the button, so the counter has to be filled BEFORE a submitted section is replayed. */
  update_total_correct();

  var want = blob.s || [], secs = webex_sections(webex_list);
  for (i = 0; i < secs.length; i++)
    if (want.indexOf(secs[i].key) !== -1 && secs[i].button &&
        secs[i].el.classList.contains("unchecked")) check_func.call(secs[i].button);
}

/* Back to a blank page, IN PLACE. The button used to erase the store and reload, which is one line
 * and undoes everything -- but a reload also loses the reader's light/dark choice: Quarto keeps
 * that choice in a variable rather than in localStorage whenever the page is opened as a file
 * (see quarto-html-before-body.ejs), and a séance IS a local file. So the undo is written out,
 * generically: no widget type has a line of its own here, because clearing one is the same three
 * operations wherever it is met -- blank the control, drop the verdict, reopen its section. */
function webex_clear() {
  var i, els;

  els = document.querySelectorAll(".webex-solveme, textarea");
  for (i = 0; i < els.length; i++) els[i].value = "";

  els = document.querySelectorAll(".webex-radiogroup input, .webex-checkbox input");
  for (i = 0; i < els.length; i++) els[i].checked = false;

  els = document.getElementsByClassName("webex-select");
  for (i = 0; i < els.length; i++) els[i].selectedIndex = 0;

  els = document.querySelectorAll(".webex-correct, .webex-incorrect");
  for (i = 0; i < els.length; i++) {
    els[i].classList.remove("webex-correct");
    els[i].classList.remove("webex-incorrect");
  }

  /* Every submitted section goes back to open, through its own button -- so the fields it froze
   * are unfrozen by the one function that knows which fields those are. `disabled` has to come
   * off first: an all-correct button is switched off, and that is what the reset is FOR. */
  var secs = document.getElementsByClassName("webex-check");
  for (i = 0; i < secs.length; i++) {
    var btn = webex_owned(secs[i], ".webex-check-button")[0];
    if (!btn) continue;
    btn.removeAttribute("disabled");
    if (!secs[i].classList.contains("unchecked")) check_func.call(btn);
  }

  update_total_correct();
}

/* === SECTION: how far through the page one is =======================================
 * Nielsen's first heuristic, and the one place a session of two thousand lines was plainly poorer
 * than what these readers meet everywhere else: the page already KNOWS what has been answered --
 * that is what the memory above restores -- and never said it out loud.
 * ⚠ The unit is the NUMBERED EXERCISE, not the box and not the question. A `::: {#exr-}` becomes a
 *   `.webex-box` WRAPPING the div that carries the identifier, so a numbered exercise is a box
 *   whose own child holds an `exr-` id; a top-level `::: encadre` is a box without one, and is not
 *   counted. (Measured on the rendered corpus: 32 boxes carry questions, all of them numbered.)
 * ⚠ Done means EVERY section of the exercise reached "Well done !", not merely that every section
 *   was submitted: an exercise handed in with a wrong answer is not finished, it is to be retried.
 *   That verdict is `webex-done` on the section's button -- see the WARNING in webex.css.
 * WARNING: no percentage, no colour of the verdict palette, no wording that praises. A count of
 * what is done is a state; a score of the page would be a mark, and this file does not mark.   */
function webex_progress() {
  var box = document.getElementsByClassName("webex-box"), done = 0, total = 0, i, j;
  for (i = 0; i < box.length; i++) {
    if (!webex_numbered(box[i])) continue;

    var secs = [].slice.call(box[i].getElementsByClassName("webex-check"));
    if (box[i].classList.contains("webex-check")) secs.unshift(box[i]);
    if (!secs.length) continue;
    total++;

    for (j = 0; j < secs.length && webex_won(secs[j]); j++);
    if (j === secs.length) done++;
  }
  return [done, total];
}

/* The identifier lives INSIDE the box, never on it: the Lua filter builds the box with an empty
   Attr and nests the authored div in it. Same selector as webex_scope() -- one spelling of "this is
   a numbered exercise" for the whole file. */
function webex_numbered(box) {
  return box.querySelectorAll("[id^='exr-']").length > 0;
}

/* One section, submitted and wholly right. `webex_owned` because a parent must read ITS OWN button
   and not the first one a nested part happens to put in front of it. */
function webex_won(sec) {
  if (sec.classList.contains("unchecked")) return false;
  var btn = webex_owned(sec, ".webex-check-button")[0];
  return !!btn && btn.classList.contains("webex-done");
}

function webex_progress_render() {
  var n = webex_progress();
  if (n[1] === 0) return;

  var el = document.getElementsByClassName("webex-progress")[0];
  if (!el) {
    var host = document.getElementById("quarto-margin-sidebar") ||
               document.getElementsByClassName("webex-reset-bar")[0];
    if (!host) return;                       /* nowhere yet: the next verdict will place it */
    el = document.createElement("div");
    el.className = "webex-progress";
    host.appendChild(el);
  }
  var css = window.getComputedStyle(document.documentElement);
  el.textContent = css.getPropertyValue("--webex-progress").replace(/"/g, '').trim() + " " +
                   n[0] + "/" + n[1];
}

/* The one visible sign that the page remembers: the way back to a blank page. Written by the script
 * and not by the author, so a séance carries it without a word of markdown -- and does NOT carry it
 * where the storage does not work, which is the whole of the promise. There is no sentence beside
 * it: a button offering to erase your answers has already said that they are kept. Its two labels
 * are CSS content, like every other string in this file, so `lang:` translates them. */
function webex_bar() {
  if (!webex_store || !webex_list || webex_list.length === 0) return;

  var css  = window.getComputedStyle(document.documentElement);
  var prop = function (n) { return css.getPropertyValue(n).replace(/"/g, "").trim(); };
  var label = prop("--webex-reset"), armed = prop("--webex-reset-confirm");

  var bar = document.createElement("div");
  bar.className = "webex-reset-bar";

  var btn = document.createElement("button");
  btn.className = "webex-reset-button";
  btn.type = "button";
  btn.textContent = label;

  /* Two steps rather than a confirm() dialog: the button asks in its own label, and disarms as
   * soon as it loses focus, so a stray click cannot erase a fortnight of work. */
  btn.onclick = function () {
    if (this.dataset.armed !== "1") {
      this.dataset.armed = "1";
      this.textContent = armed;
      return;
    }
    try { webex_store.removeItem(webex_page); } catch (e) {}
    webex_clear();
    this.dataset.armed = "";
    this.textContent = label;
  };
  btn.onblur = function () {
    this.dataset.armed = "";
    this.textContent = label;
  };

  bar.appendChild(btn);

  var host  = document.querySelector("main") || document.body;
  var title = host.querySelector("#title-block-header");
  if (title && title.parentNode === host) host.insertBefore(bar, title.nextSibling);
  else host.insertBefore(bar, host.firstChild);
}

window.addEventListener("load", function() {
  console.log("webex onload");
  
  
 /* RStudio viewer pane open URLs with ?viewer_pane = 1 : use it in css ?
  var URLparams = new URLSearchParams(window.location.search);
  const viewer_pane = URLparams.get(`viewer_pane`);
  if (viewer_pane = "1") {
      document.style.setProperty('--TOC_width', "20%");
  } else {
      document.style.setProperty('--TOC_width', 0);
  }
  */

  
  /* Quarto PREPENDS an exercise's name into the first paragraph of its body -- and when the body
   * opens with anything else (a part, a comment, a chunk) it INVENTS that paragraph, holding only
   * the name and a non-breaking space. Under the title band that space is an empty line and a
   * paragraph margin: a hole between the band and the statement. No selector can see a text node,
   * so the paragraph is marked here and the space removed. */
  document.querySelectorAll(".exercise > p:first-child > .theorem-title").forEach(function(t) {
    var p = t.parentNode;
    if (p.children.length !== 1) return;
    var others = Array.prototype.filter.call(p.childNodes, function(n) { return n !== t; });
    if (!others.every(function(n) { return n.nodeType === 3 && /^[\s\u00a0]*$/.test(n.nodeValue); })) return;
    others.forEach(function(n) { p.removeChild(n); });
    p.classList.add("webex-title-only");
  });

  /* set up solution buttons */
  var buttons = document.getElementsByTagName("button");

  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].parentElement.classList.contains('webex-solution')) {
      buttons[i].onclick = b_func;
    }
  }

  var check_sections = document.getElementsByClassName("webex-check");
  console.log("check:", check_sections.length);
  
  var sh_answers = window.getComputedStyle(document.documentElement).getPropertyValue('--show_answers').replace(/"/g, '');


  for (var i = 0; i < check_sections.length; i++) {
    check_sections[i].classList.add("unchecked");

    let btn = document.createElement("button");
    btn.type = "button";        /* textbox() writes a <form>, where a typeless button submits */
    btn.innerHTML = sh_answers ;
    btn.classList.add("webex-check-button");
    btn.onclick = check_func;

    let spn = document.createElement("span");
    spn.classList.add("webex-total_correct");

    webex_place(check_sections[i], btn, spn);

    /* The live region is created NOW and filled later. A region born and filled in the same
     * tick is announced by no screen reader reliably; one that has been in the page all along
     * is read the moment its text changes. */
    let say = document.createElement("p");
    say.classList.add("webex-say");
    say.setAttribute("role", "status");
    check_sections[i].appendChild(say);
  }

  /* set up webex-solveme inputs */
  var solveme = document.getElementsByClassName("webex-solveme");

  for (var i = 0; i < solveme.length; i++) {
    /* make sure input boxes don't auto-anything */
    solveme[i].setAttribute("autocomplete","off");
    solveme[i].setAttribute("autocorrect", "off");
    solveme[i].setAttribute("autocapitalize", "off");
    solveme[i].setAttribute("spellcheck", "false");
    solveme[i].value = "";

    /* adjust answer for ignorecase or nospaces */
    var cl = solveme[i].classList;
    var real_answer = solveme[i].dataset.answer;
    if (cl.contains("ignorecase")) {
      real_answer = real_answer.toLowerCase();
    }
    if (cl.contains("nospaces")) {
      real_answer = real_answer.replace(WEBEX_WS, "");
    }
    solveme[i].dataset.answer = real_answer;

    /* attach checking function */
    solveme[i].onkeyup = solveme_func;
    solveme[i].onchange = solveme_func;
  }

  /* set up radiogroups */
  var radiogroups = document.getElementsByClassName("webex-radiogroup");
  for (var i = 0; i < radiogroups.length; i++) {
    radiogroups[i].onchange = radiogroups_func;
  }

  /* set up checkboxes */
  var checkboxes = document.getElementsByClassName("webex-checkbox");
  
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].onchange = checkboxes_func;
  }



  /* set up selects */
  var selects = document.getElementsByClassName("webex-select");
  for (var i = 0; i < selects.length; i++) {
    selects[i].onchange = select_func;
  }

  /* set up clickable table cells */
  var clickcells = document.getElementsByClassName("webex-cell");
  for (var i = 0; i < clickcells.length; i++) {
    clickcells[i].onclick = clickcell_func;
    /* a span is not a control: the role, the tab stop and the two keys have to be given to it */
    clickcells[i].setAttribute("role", "button");
    clickcells[i].setAttribute("tabindex", "0");
    clickcells[i].onkeydown = function(e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); }
    };
  }

  /* Everything is wired: collect the widgets once, put back what was answered and what was
   * submitted, and only then allow saving. */
  webex_store = webex_storage();
  webex_page  = webex_page_key();
  webex_list  = webex_widgets();
  webex_restore();
  webex_bar();
  webex_ready = true;

  update_total_correct();
});
