<script>



/* update total correct if #webex-total_correct exists */
update_total_correct = function() {
  console.log("webex: update total_correct");

  var t = document.getElementsByClassName("webex-total_correct");
  for (var i = 0; i < t.length; i++) {
    p = t[i].parentElement;
    var correct = p.getElementsByClassName("webex-correct").length;
    var solvemes = p.getElementsByClassName("webex-solveme").length;
    var radiogroups = p.getElementsByClassName("webex-radiogroup").length;
    var selects = p.getElementsByClassName("webex-select").length;
    var incorrect = p.getElementsByClassName("webex-incorrect").length; 
    /* var checkboxes = p.getElementsByClassName("webex-right_answer_multi").length; */
    
    var checkboxes = p.getElementsByClassName("webex-checkbox");
    var checkboxes_answers = 0; 
      for (var j = 0; j < checkboxes.length; j++) {
     var cblabels = checkboxes[j].getElementsByTagName("label")
        for (var k = 0; k < cblabels.length; k++) { 
          if (cblabels[k].getElementsByTagName("input")[0].value == "answer") {
                checkboxes_answers = checkboxes_answers + 1 ; 
          }
        }
      }
      

    if (correct == solvemes + radiogroups + checkboxes_answers + selects && incorrect == 0) {
    
    t[i].innerHTML = "<label class = 'webex-check_all_correct'>" + " <span> " + correct + " / " + (solvemes + radiogroups + checkboxes_answers + selects) + 
    " correct </span> </label>" ;
  
  } else {
  
    if (incorrect == 0) {
     
     t[i].innerHTML = "<label class = 'webex-check_incorrect'>" + " <span> " + correct + " / " + (solvemes + radiogroups + checkboxes_answers + selects) + 
     " correct </span> </label>" ;
  
    } else {
     t[i].innerHTML = "<label class = 'webex-check_incorrect'>" + " <span> " + correct + " / " + (solvemes + radiogroups + checkboxes_answers + selects) + " correct ; " + incorrect + 
     " incorrect </span> </label>" ; 
    } 
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
  } else if (real_answers.includes(my_answer)) {
    cl.add("webex-correct");
    cl.remove("webex-incorrect");
  } else {
    cl.add("webex-incorrect");
    cl.remove("webex-correct");
  }

  // match numeric answers within a specified tolerance
  if(this.dataset.tol > 0){
    var tol = JSON.parse(this.dataset.tol);
    var matches = real_answers.map(x => Math.abs(x - my_answer) < tol)
    if (matches.reduce((a, b) => a + b, 0) > 0) {
      cl.add("webex-correct");
    } else {
      cl.remove("webex-correct");
    }
  }

  // added regex bit
  if (cl.contains("regex")){
    answer_regex = RegExp(real_answers.join("|"))
    if (answer_regex.test(my_answer)) {
      cl.add("webex-correct");
    }
  }

  update_total_correct();
}

/* function for checking select answers */
select_func = function(e) {
  console.log("webex: check select");

  var cl = this.classList

  /* add style */
  cl.remove("webex-incorrect");
  cl.remove("webex-correct");
  if (this.value == "answer") {
    cl.add("webex-correct");
  } else if (this.value != "blank") {
    cl.add("webex-incorrect");
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
  for (i = 0; i < labels.length; i++) {
    labels[i].classList.remove("webex-incorrect");
    labels[i].classList.remove("webex-correct");
  }

  /* add style */
  if (checked_button.value == "answer") {
    cl.add("webex-correct");
  } else {
    cl.add("webex-incorrect");
  }

  update_total_correct();
}



/* function for checking checkboxes answers */
checkboxes_func = function(e) {
  console.log("webex: check checkboxes");

  var current_button = document.querySelector('input[name=' + this.id + ']');
  var cl = current_button.parentElement.classList;

  /* add style when checked, remove when unchecked */
  if (current_button.checked) {
         if (current_button.value == "answer") {
      cl.add("webex-correct");
       } else {
      cl.add("webex-incorrect");
    }
    
  } else {
   cl.remove("webex-incorrect");
   cl.remove("webex-correct");
  }

  update_total_correct();
}

window.onload = function() {
  console.log("webex onload");
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

  update_total_correct();
  
  
  /* NOT WORKING Add copy to clipboard button (from gitbook) */
  // if (!ClipboardJS.isSupported())
  
  //  var copyButton = '<button type="button" class="copy-to-clipboard-button" title="Copy to clipboard" aria  -label//="Copy to clipboard"><i class="fa fa-copy"></i></button>';
  //  var clipboard;
  //
  //  $(copyButton).prependTo("div.sourceCode");
  //
  //  clipboard = new ClipboardJS(".copy-to-clipboard-button", {
  //    text: function(trigger) {
  //      return trigger.parentNode.textContent;
  //    }
  //  });
  
  
}



</script>
