# webexercises (development version)

* **a ratio is accepted as the table spells it.** Under `tol`, a leading `×` (or `*`, `x`) is
  dropped, and the three spellings of "one over m" -- `÷m`, `/m`, `1/m` -- are tried as both the
  magnitude m and the value 1/m, but only when an expected answer is itself written as an inverse:
  `1/12` stays wrong for 12, and a bare `2.41` stays wrong for an odds of `1/2.41`.

* **the nearest section decides, when one is nested in another.** `unchecked` is a class on a
  section and every rule read it BY DESCENT, so an enclosing exercise that had not been submitted
  kept greying the fields, hiding the counter and hiding the answer of an inner part that HAD been
  submitted -- its button appeared to do nothing at all. The open state now travels in inherited
  custom properties, which the nearest section sets, and no selector has to express it.
  ⚠ The value travels IN the variable and never as a guard in front of a declaration: a `var()`
  that resolves to `initial` makes the declaration invalid at computed-value time, and an invalid
  declaration does not hand the property back to the previous rule -- it is unset.
* **the check button sits after the questions it owns**, before the first thing that appears when
  it is pressed. Appended at the end of its section it landed below a nested part's own button --
  two identical buttons stacked at the bottom of an exercise -- and below the folded answer, so
  pressing it revealed the answer above it and the button dropped from under the reader's cursor.
* **the reset button undoes the answers in place** instead of reloading. A reload also lost the
  reader's light/dark choice: Quarto keeps that choice in a variable rather than in `localStorage`
  whenever the page is opened as a file, and a course page is exactly that.
* **an inline field or menu no longer carries a tick or a cross.** Its box was reserved in every
  state so the sentence would not re-flow -- which meant a visible gap that said nothing until an
  answer was given. The colour of the field is the verdict; the glyph belongs to a block QCM, where
  there is room for it.
* an option's glyph box has a fixed height and `vertical-align: middle`. An inline-block with empty
  content has no line box and so no height, and its baseline is its bottom margin edge rather than
  its text's: the box grew from nothing when the verdict arrived, which is what made the check
  button drop a few millimetres on the very click that pressed it. `text-align: center` splits the
  box's slack evenly, so the gaps on either side of the glyph are equal by construction.
* Quarto's code-copy button is left alone. `.webex-solution button` styled ANY button inside a
  worked answer, so the copy button of a code block in a `::: correction` came out as a filled
  accent-coloured slab. The rule names the toggle it means, `> button:first-child`.

* **a submitted section is frozen, all of it.** `check_func()` only ever disabled `<input>`, so an
  inline `mcq()` (a `<select>`), a `textbox()` (a `<textarea>`) and a clickable cell -- which keeps
  its tab stop, `pointer-events: none` being a mouse rule -- stayed changeable after "Show Answers":
  the verdict on screen could stop describing the page. "Try Again" gives everything back, and a
  disabled control keeps its own ink rather than being greyed out of legibility.
* **a question belongs to the nearest `.webex-check`**, and a widget inside a solution belongs to
  nobody. The counter, the freeze and the stored section signature all go through one
  `webex_owned()`; each used to search to any depth, so an exercise made of an énoncé plus two or
  three separately-submitted parts counted its children's answers, showed a total it could never
  reach, and handed back their fields on its own "Try Again".
* **the Lua filter no longer sees a widget put aside in an html comment.** knitr does not skip a
  comment: it evaluates the inline R inside it and writes the widget's markup there. A section could
  therefore get a button and a counter for widgets absent from the page -- total zero, hence
  "Well done !" on the first press, on an exercise asking nothing.
* **the four verdict colours are stated per mode**, on one OKLCH rung each: lightness fixed,
  chroma at the sRGB ceiling of the hue. `--incorrect_text` used to be lifted for a dark page by
  mixing it with white, which drops the chroma (0.211 to 0.131) and reads as a washed-out pink;
  `--incorrect` and `--correct` had no dark value at all, so a wrong field's border sat at Lc 18 on
  a dark ground. `--correct_text` was `#00D26A`, Lc 38 on white -- "Well done !" was barely legible
  in light mode.
* a chosen answer keeps the page's own ink. The verdict rules forced
  `color: var(--webex-answer-fg, black)`, and the dark block declared `--webex-answer-fg: inherit`
  -- the guaranteed-invalid value for a custom property `:root` never declares -- so every selected
  option went black on a dark page. Both the variable and the declaration are gone.
* **a verdict moves nothing.** The tick and the cross are a box that is always there and only
  changes its `content`; choosing an option used to insert two spaces before its text and grow the
  line with a taller glyph. A clickable cell's border is 3px in every state, transparent until it is
  chosen, and a chosen cell fills with a mid grey that works on either ground.
* the check button carries its all-correct state as a class, not as an inline `style.backgroundColor`
  no stylesheet could override and which kept its light-mode green after a theme switch. Its label
  takes the page's own colour, `var(--bs-body-bg)`, instead of a hard-coded white.
* **an option's verdict glyph sits inside its frame.** A label hangs its radio outside itself with
  `text-indent: -1em`, and the glyph shares that first line -- so with no left padding the tick
  straddled the green rectangle's own border, half in and half out. Radio and checkbox labels now
  carry `padding-left: 0.75em`, which puts the glyph in and leaves it room to breathe.
* **a solution's button lines up with its section's check button.** The solution carried a 30 px
  left margin and a 0.5em padding, so its button stood 40 px further right than the one below it.
  The container has no left inset at all now, and the 0.5em the text needs to stand clear of the
  dashed frame is carried by the blocks inside it -- a button is not a block of text.
* the counter emits well-formed markup: it used to open a `<span>` inside its `<label>` and close
  the two in the wrong order.
* the line saying the answers are kept is gone; the button that erases them says it well enough, and
  it is now bordered and bold at rest so it can be found.
* **`style_widgets()` is removed.** It was a second stylesheet emitter, unused in any document,
  which declared `--highlight` in `:root` -- beating the theme that owes it -- and shipped a rule
  with a literal `n` where a newline was meant. Widget colours are the custom properties at the top
  of `webex.css`, which a theme restates per mode.

* **the page now remembers.** What the reader typed and which sections they submitted go to
  `localStorage` and come back on the next visit, and a button at the top of the page erases them.
  Nothing to write in a document: the script inserts the button itself,
  and only where the browser actually stores (Safari refuses on `file://`, and there the page
  behaves exactly as before). An answer is remembered under a signature of what its QUESTION SAYS,
  never under its position -- editing a question forgets its answer, inserting one beside it moves
  nothing.
* widget identifiers are a counter rather than `sample(LETTERS, 10)`. That draw spent ten values of
  R's **global RNG** per widget, so a question written between two chunks silently shifted every
  random draw that followed it in the document; it also gave a page a new identity at each render.
  The counter restarts on a new document, so a page numbers its widgets the same way rendered alone
  or inside a project.
* `textbox()` shows its placeholder again. The package defined `.onLoad` twice -- R kept the one
  that collated last -- so the option holding the default invitation was never set.
* an answer can no longer be counted correct AND incorrect at once. A `fitb()` answer within `tol`,
  or matching a `regex`, used to keep the `webex-incorrect` class it had just been given: its
  `.webex-check` section printed "n / N correct ; 1 incorrect" and its button stayed on "Try again"
  for good. Every verdict now goes through one `set_answer_state()`.
* `fitb(tol = )` accepts a decimal comma and a trailing `%`, so the author no longer lists every
  spelling by hand. The whole string must be a number: `1/2.41` is not read as `1`.
* `fitb()` builds its class list before its attributes. `tol` combined with `ignore_case` or
  `regex` used to emit `data-tol='0.1 ignorecase'`, losing the class and the flag.
* new widget: a clickable table cell (`.webex-clickcell` wrapper, `.webex-cell` options), scored
  like a radiogroup -- one answer per wrapper.
* `textbox()` borders itself with `currentColor` and quotes its attributes, so it is visible on a
  dark page as well as a light one.
* the script binds with `addEventListener` instead of assigning `window.onload`, which any other
  script on the page could overwrite.
* `tests/testthat/test-fitb.R` was commented out in full; it now runs.

# webexercises 1.1.0

* quarto support (`create_quarto_doc()` and `add_to_quarto()`)
* fenced .webex-check sections for self-checking quizzes
* webex.hide knit hooks get set up .onLoad instead of in webex.R
* remove js dependency on jquery
* `total_correct()` deprecated
* PDF rendering is better (but webexercises is really built for HTML)

# webexercises 1.0.0

* new package name: webexercises
* updated method to remove smart quotes when rmarkdown >= 2.2
* new styles for correct and incorrect answers
* `longmcq()` function for MCQs with long answers (creates a radiobutton interface)
* `add_webex_to_bookdown()` new function to add helper functions to bookdown books

# webex 0.9.2

## Bug fixes

* (#12, @debruine) updated css to prevent a conflict with the new bookdown
* (#11, @Benjou) MCQs where correct answer contains an apostrophe now
  parsed correctly
  
## Misc

* added `regex` argument example to `fitb()` on the template
* fixed `ignore_ws` argument example in the template
* removed note about need to "Open in Browser" since RStudio now
  includes a JS-enabled browser
* Added this `NEWS.md` file to track changes to the package.

# webex 0.9.1

* On CRAN!
