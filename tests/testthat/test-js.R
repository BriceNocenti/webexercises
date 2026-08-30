# PURPOSE: the browser half of the package, exercised for real -- js/check-answers.js loads
#   webex.js in node behind a DOM stub and asserts the class each answer ends up with.
# ROLE: webex.js had no test of any kind. That is why a tolerated answer could carry
#   webex-correct AND webex-incorrect at once, jamming its section on "Try again" for good.

test_that("webex.js reaches the right verdict, and never both at once", {
  node <- Sys.which("node")
  skip_if(!nzchar(node), "node is not installed")

  js  <- testthat::test_path("js", "check-answers.js")
  src <- testthat::test_path("..", "..", "inst", "reports", "default", "webex.js")
  skip_if_not(file.exists(src), "run from the package source tree")

  out <- suppressWarnings(
    system2(node, c(shQuote(js), shQuote(normalizePath(src))), stdout = TRUE, stderr = TRUE)
  )
  status <- attr(out, "status")
  expect_true(is.null(status) || status == 0L, info = paste(out, collapse = "\n"))
  expect_match(paste(out, collapse = "\n"), "vérifications passent")
})
