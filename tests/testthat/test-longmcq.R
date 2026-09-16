test_that("no answer", {
  expect_error(longmcq(c("A", "B")))
})

test_that("apostrophe works", {
  html <- longmcq(c(answer="will", "won't", "might"))
  expect_equal(grep("<span>won&apos;t</span>", html, fixed = TRUE), 1L)
})

test_that("an option holding & or < survives as text", {
  # For years only the apostrophe was escaped, so an option like "R & Python" or "moins de < 5 %"
  # reached the page as broken markup -- and the reader saw the tag, not the text.
  html <- as.character(longmcq(c("R & Python", answer = "moins de < 5 %")))
  expect_match(html, "R &amp; Python", fixed = TRUE)
  expect_match(html, "moins de &lt; 5 %", fixed = TRUE)
  expect_false(grepl("&amp;amp;", html, fixed = TRUE))   # never escaped twice
})
