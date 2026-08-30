tmpdir <- tempdir()
setwd(tmpdir)

test_that("a new document carries the extension, not a pair of copied assets", {
  path <- create_quarto_doc(open = FALSE)
  on.exit(unlink("Untitled", recursive = TRUE))

  expect_true(file.exists(path))
  expect_equal(basename(path), "Untitled.qmd")
  expect_true(file.exists(file.path(dirname(path), "_extensions", "webexercises", "webex.js")))
  expect_equal(unlist(yaml::read_yaml(file.path(dirname(path), "_quarto.yml"))$filters), "webexercises")
})

test_that("it renders, and the assets arrive as one dependency", {
  skip_on_cran()
  skip_if_not(nzchar(Sys.which("quarto")), "quarto is not on the PATH")
  path <- create_quarto_doc("MyDoc", open = FALSE)
  on.exit(unlink("MyDoc", recursive = TRUE))

  quarto::quarto_render(path, quiet = TRUE)
  html <- sub("[.]qmd$", ".html", path)
  expect_true(file.exists(html))
  txt <- paste(readLines(html, warn = FALSE), collapse = "\n")
  expect_true(grepl("webex-solveme", txt, fixed = TRUE))        # a widget reached the page
  # ... and so did its assets. The demo is `embed-resources: true`, so they are INLINE and the
  # dependency's folder name never appears -- these two strings are what actually has to be there.
  expect_true(grepl("update_total_correct", txt, fixed = TRUE))  # webex.js
  expect_true(grepl("--incorrect_alpha", txt, fixed = TRUE))     # webex.css
})
