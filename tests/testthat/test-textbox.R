# PURPOSE: the textarea markup -- well-formed attributes, and the invitation as a placeholder.
# ROLE: formations_stat kept a private copy of this function for years, for one default; the copy
#   is gone, so what it fixed has to be held here.

test_that("every attribute is quoted and the box borders itself with currentColor", {
  html <- textbox(rows = 3, cols = 40, placeholder = "")
  expect_match(html, ' cols="40"', fixed = TRUE)
  expect_match(html, ' rows="3"', fixed = TRUE)
  expect_match(html, ' name="text_[A-Z]{10}"')
  expect_match(html, "border: 2px solid currentColor;", fixed = TRUE)
  # no stray quote: every `="` opened is closed before the next attribute
  expect_length(gregexpr('"', html)[[1]], 8L)
})

test_that("the invitation is a placeholder, never content", {
  html <- textbox(2, placeholder = "Réponse libre")
  expect_match(html, ' placeholder="Réponse libre"', fixed = TRUE)
  expect_match(html, "></textarea>", fixed = TRUE)          # the box itself is empty

  # `text` still prefills, for the caller who wants it
  expect_match(textbox(2, text = "abc", placeholder = ""), ">abc</textarea>", fixed = TRUE)

  # no placeholder asked, none written
  expect_false(grepl("placeholder", textbox(2, placeholder = ""), fixed = TRUE))
  expect_false(grepl("placeholder", textbox(2, placeholder = NULL), fixed = TRUE))
})

test_that("a placeholder carrying a quote cannot break out of its attribute", {
  html <- textbox(2, placeholder = 'a "b" c')
  expect_false(grepl('placeholder="a "b" c"', html, fixed = TRUE))
  expect_match(html, "&quot;", fixed = TRUE)
})
