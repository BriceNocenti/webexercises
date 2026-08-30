# PURPOSE: the HTML fitb() writes -- the one string the browser reads, attribute by attribute.
# ROLE: the file was commented out in full, which is why two faults lived in it unseen: `data-tol`
#   opened inside the class attribute, and no test at all on the combinations.
# KEY CONSTRAINTS:
#   - fitb() returns an htmltools::HTML object, so compare as.character(), never the object: that
#     class mismatch is what got the file commented out rather than fixed.

test_that("errors", {
  expect_error(fitb())
  expect_error(fitb(TRUE))  # a vector, but neither character nor numeric
})

test_that("defaults", {
  # character answer
  expect_equal(
    as.character(fitb("x")),
    "<input class='webex-solveme nospaces' size='1' data-answer='[\"x\"]'/>"
  )

  # vector answers
  expect_equal(
    as.character(fitb(c("x", "y"))),
    "<input class='webex-solveme nospaces' size='1' data-answer='[\"x\",\"y\"]'/>"
  )

  # custom width
  expect_equal(
    as.character(fitb("x", width = 5)),
    "<input class='webex-solveme nospaces' size='5' data-answer='[\"x\"]'/>"
  )

  # numeric NULL with leading zeroes
  expect_equal(
    as.character(fitb(0.5)),
    "<input class='webex-solveme nospaces' size='3' data-answer='[\"0.5\",\".5\"]'/>"
  )

  # numeric FALSE with leading zeroes
  expect_equal(
    as.character(fitb(0.5, num = FALSE)),
    "<input class='webex-solveme nospaces' size='3' data-answer='[\"0.5\"]'/>"
  )

  # numeric TRUE with leading zeroes
  expect_equal(
    as.character(fitb(0.5, num = TRUE)),
    "<input class='webex-solveme nospaces' size='3' data-answer='[\"0.5\",\".5\"]'/>"
  )

  # tolerance
  expect_equal(
    as.character(fitb(0.5, tol = 0.1)),
    "<input class='webex-solveme nospaces' data-tol='0.1' size='3' data-answer='[\"0.5\",\".5\"]'/>"
  )

  # ignore_case = TRUE
  expect_equal(
    as.character(fitb("x X", ignore_case = TRUE)),
    "<input class='webex-solveme nospaces ignorecase' size='3' data-answer='[\"x X\"]'/>"
  )

  # ignore_case = FALSE
  expect_equal(
    as.character(fitb("x X", ignore_case = FALSE)),
    "<input class='webex-solveme nospaces' size='3' data-answer='[\"x X\"]'/>"
  )

  # ignore_ws = FALSE
  expect_equal(
    as.character(fitb("x y", ignore_ws = FALSE)),
    "<input class='webex-solveme' size='3' data-answer='[\"x y\"]'/>"
  )

  # regex = TRUE
  expect_equal(
    as.character(fitb("\\d{1,4}", 4, regex = TRUE)),
    "<input class='webex-solveme nospaces regex' size='4' data-answer='[\"\\\\d{1,4}\"]'/>"
  )
})

# `tol` used to be written by opening data-tol in the middle of the class attribute, so anything
# after it landed inside data-tol and its class was lost. Both flags have to survive the pairing.
test_that("tol keeps its own attribute and leaves the class list alone", {
  expect_equal(
    as.character(fitb(0.5, tol = 0.1, ignore_case = TRUE)),
    "<input class='webex-solveme nospaces ignorecase' data-tol='0.1' size='3' data-answer='[\"0.5\",\".5\"]'/>"
  )
  expect_equal(
    as.character(fitb("x", tol = 0.1, regex = TRUE, width = 1)),
    "<input class='webex-solveme nospaces regex' data-tol='0.1' size='1' data-answer='[\"x\"]'/>"
  )
  # one class attribute, one data-tol, and nothing of one inside the other
  html <- as.character(fitb(0.5, tol = 0.1, ignore_case = TRUE, regex = TRUE))
  expect_length(gregexpr("class=", html, fixed = TRUE)[[1]], 1L)
  expect_false(grepl("data-tol='[^']*[a-z]", html))
})
