# PURPOSE: a widget's identifier is a counter, not a draw.
# ROLE: guards the three consequences of the `sample(LETTERS, 10)` these functions used to call.
# KEY CONSTRAINTS: the worst of the three is silent and does not touch webexercises at all -- ten
#   draws of R's GLOBAL RNG per widget shift every random draw that FOLLOWS in the document, so a
#   question written between two chunks quietly changes the table the next chunk draws.

test_that("a widget does not touch R's global RNG", {
  # The silent one. formations_stat draws a table with r2dtable() to show sampling variation; a
  # longmcq() written above it used to move that table by ten draws, with nothing to see.
  set.seed(1); reference <- runif(3)

  set.seed(1)
  invisible(longmcq(c("A", answer = "B")))
  invisible(longmcq(c(answer = "A", answer = "B", "C")))
  invisible(textbox())
  expect_identical(runif(3), reference)
})

test_that("identifiers are sequential, unique, and valid CSS identifiers", {
  ids <- function(x) regmatches(x, gregexpr("(radio|check|text)_[0-9]+", x))[[1]]

  first  <- ids(as.character(longmcq(c("A", answer = "B"))))
  second <- ids(as.character(longmcq(c("A", answer = "B"))))
  expect_length(unique(first), 1L)                       # one radiogroup, one name
  expect_false(identical(first, second))                 # never the same twice in a document

  # a checkbox question names each option on its own, as webex.js's checkboxes_func requires
  many <- ids(as.character(longmcq(c(answer = "A", answer = "B", "C"))))
  expect_length(unique(many), 3L)

  # the id lands unquoted in `input[name=...]`, so it must stay a bare CSS identifier
  expect_true(all(grepl("^[A-Za-z][A-Za-z0-9_-]*$", c(first, second, many))))
})

test_that("the counter restarts on a new document, not on a new session", {
  # Otherwise rendering a séance alone and rendering it inside a project give different pages.
  keep <- list(doc = .webex$doc, n = .webex$n)
  on.exit({ .webex$doc <- keep$doc; .webex$n <- keep$n }, add = TRUE)

  # still the same document (current_input() gives NULL here, recorded as NA): keep counting
  .webex$doc <- NA_character_
  .webex$n   <- 41L
  a <- as.character(longmcq(c("A", answer = "B")))

  # another document: start again, so a séance numbers its widgets the same way alone or in a project
  .webex$doc <- "une-autre-seance.qmd"
  b <- as.character(longmcq(c("A", answer = "B")))

  expect_match(a, "radio_42", fixed = TRUE)
  expect_match(b, "radio_1", fixed = TRUE)
})

test_that("textbox() shows its invitation, which the shadowed .onLoad used to swallow", {
  # There were two .onLoad definitions; R kept the one that collated last (zzz.R), so the option
  # set in the other was never applied and `placeholder` defaulted to NULL -- no invitation, ever.
  expect_type(getOption("webexercices_textbox_text"), "character")
  expect_match(textbox(), 'placeholder="', fixed = TRUE)
})
