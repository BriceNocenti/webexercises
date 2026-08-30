/* PURPOSE: bind the webexercises widgets -- fill-in-the-blank, select, radio, checkbox, clickable
 *   table cell, the hidden-solution toggle and the check/try-again cycle -- to the markup the R
 *   functions write.
 * KEY CONSTRAINTS: two invariants, each stated where it is enforced --
 *   - a widget wears webex-correct OR webex-incorrect, never both (see set_answer_state);
 *   - a widget type counts in the score only if it has a term in `total` (see update_total_correct).
 * ROLE: shipped three ways from this one file: as an HTML DEPENDENCY by the Quarto extension
 *   (_extensions/webexercises), and as an `after_body` include by webexercises_default() and
 *   webexercises_default2(), which wrap it in <script> at render time.
 * WARNING: PLAIN JAVASCRIPT, no <script> wrapper. The wrapper used to be part of the file because
 *   rmarkdown's `after_body` takes raw HTML; an HTML dependency takes a script FILE, and a wrapped
 *   one would be a syntax error on the first line. R/webexercises_default.R adds it back. */

/* update total correct if #webex-total_correct exists
 * WARNING: `total` below is THE coupling point of this file. A widget type missing from that sum
 * never enters the score, so its section can never reach "all correct": its button never turns
 * into "Well done !" and stays on "Try again" whatever the reader does. Adding a widget means
 * adding its term there -- one line, and there is no other place to touch. The shapes differ on
 * purpose: a field, a select, a radiogroup and a clickable table each count ONE (the container is
 * the question), while a checkbox question counts one per EXPECTED answer. */
update_total_correct = function() {
  console.log("webex: update total_correct");

  var t = document.getElementsByClassName("webex-total_correct");
  for (var i = 0; i < t.length; i++) {
    var p = t[i].parentElement;
    var correct     = p.getElementsByClassName("webex-correct").length;
    var incorrect   = p.getElementsByClassName("webex-incorrect").length;
    var solvemes    = p.getElementsByClassName("webex-solveme").length;
    var radiogroups = p.getElementsByClassName("webex-radiogroup").length;
    var selects     = p.getElementsByClassName("webex-select").length;
    var clickcells  = p.getElementsByClassName("webex-clickcell").length;

    var checkboxes = p.getElementsByClassName("webex-checkbox");
    var checkboxes_answers = 0;
    for (var j = 0; j < checkboxes.length; j++) {
      var cblabels = checkboxes[j].getElementsByTagName("label");
      for (var k = 0; k < cblabels.length; k++) {
        if (cblabels[k].getElementsByTagName("input")[0].value == "answer") {
          checkboxes_answers = checkboxes_answers + 1;
        }
      }
    }

    var total = solvemes + radiogroups + selects + clickcells + checkboxes_answers;
    var score = " <span> " + correct + " / " + total + " correct";

    if (correct == total && incorrect == 0) {
      t[i].innerHTML = "<label class = 'webex-check_all_correct'>" + score + " </span> </label>";
    } else if (incorrect == 0) {
      t[i].innerHTML = "<label class = 'webex-check_incorrect'>" + score + " </span> </label>";
    } else {
      t[i].innerHTML = "<label class = 'webex-check_incorrect'>" + score + " ; " + incorrect +
        " incorrect </span> </label>";
    }
  }
}

/* webex-solution button toggling function */
b_func = function() {
  console.log("webex: toggle hide");

  var cl = this.parentElement.classList;
  if (cl.contains('open')) {
    cl.remove("open");
  } else {
    cl.add("open");
  }
}

/* check answers */
check_func = function() {
  console.log("webex: check answers");

    var sh_answers = window.getComputedStyle(document.documentElement).getPropertyValue('--show_answers').replace(/"/g, '');

    var try_again = window.getComputedStyle(document.documentElement).getPropertyValue('--try_again').replace(/"/g, '');
    
    var wldone = window.getComputedStyle(document.documentElement).getPropertyValue('--welldone').replace(/"/g, '');

    var correct_text_color = window.getComputedStyle(document.documentElement).getPropertyValue('--correct_text').replace(/"/g, '');

  var cl = this.parentElement.classList;
  var all_correct = this.nextSibling.getElementsByTagName("label")[0].classList;
  
  if (cl.contains('unchecked')) {
    cl.remove("unchecked");
    
    if ( all_correct.contains('webex-check_all_correct') ) {
      this.innerHTML = wldone; 
      this.style.backgroundColor = correct_text_color;
      this.setAttribute("disabled", true);
    
    } else {
      this.innerHTML = try_again ; 
      this.style.backgroundColor = "" ; 
    }
    
    /* Disable buttons when answers are submitted */ 
     inp = this.parentElement.getElementsByTagName("input")
      for (var i = 0; i < inp.length; i++) { 
      inp[i].setAttribute("disabled", true);
      }


  } else {
    cl.add("unchecked");
    this.innerHTML = sh_answers ;
    
    /* Reenable buttons when Try again is pushed.*/
    inp = this.parentElement.getElementsByTagName("input")
      for (var i = 0; i < inp.length; i++) { 
      inp[i].removeAttribute("disabled");
      }
  }
  
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

/* The number a reader typed, or NaN when what they typed is not one. The WHOLE string has to be a
 * number: a leading-digits parse reads "1/2.41" as 1 and would accept it for any answer near 1,
 * and that spelling is exactly what a table of odds below 1 displays. A decimal COMMA counts as a
 * decimal point -- it is what a French keyboard types -- and a trailing % is dropped. */
function webex_number(x) {
  var s = String(x).trim().replace(/\s/g, "").replace(",", ".").replace(/%$/, "");
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
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
    my_answer = my_answer.replace(/ /g, "")
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
    var mine = webex_number(my_answer);
    correct = !isNaN(mine) && real_answers.some(function(x) {
      var theirs = webex_number(x);
      return !isNaN(theirs) && Math.abs(theirs - mine) < tol;
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
 * The QUESTION is the wrapper (.webex-clickcell), one per table, the way a radiogroup is one per
 * question; the cells inside it are its options, and only one of them may carry a verdict. */
clickcell_func = function() {
  console.log("webex: check clickcell");

  var group = this.closest(".webex-clickcell");
  if (group === null) return;

  var cells = group.getElementsByClassName("webex-cell");
  for (var i = 0; i < cells.length; i++) {
    cells[i].classList.remove("webex-incorrect");
    cells[i].classList.remove("webex-correct");
  }

  set_answer_state(this.classList, this.dataset.answer === "1");

  update_total_correct();
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
    btn.innerHTML = sh_answers ;
    btn.classList.add("webex-check-button");
    btn.onclick = check_func;
    check_sections[i].appendChild(btn);

    let spn = document.createElement("span");
    spn.classList.add("webex-total_correct");
    check_sections[i].appendChild(spn);
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
      real_answer = real_answer.replace(/ /g, "");
    }
    solveme[i].dataset.answer = real_answer;

    /* attach checking function */
    solveme[i].onkeyup = solveme_func;
    solveme[i].onchange = solveme_func;

    solveme[i].insertAdjacentHTML("afterend", " <span class='webex-icon'></span>")
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
    selects[i].insertAdjacentHTML("afterend", " <span class='webex-icon'></span>")
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

  update_total_correct();
});
