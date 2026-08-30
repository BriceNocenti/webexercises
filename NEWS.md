# webexercises (development version)

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
