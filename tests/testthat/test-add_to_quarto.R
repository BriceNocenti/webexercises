# add_to_quarto() installs the Quarto EXTENSION and turns it on with one line of _quarto.yml.
# What it used to do -- copy webex.css / webex.js into the project and name their paths under
# `format: html:` -- could only ever be right for one project shape: a book resolves a relative
# `css:` from its own root, a nested project from another, and `embed-resources: true` from a third.
# An HTML dependency has no path to get wrong.
tmpdir <- tempdir()
setwd(tmpdir)

test_that("it installs the extension and names the filter", {
  dir.create("quarto_test")
  on.exit(unlink("quarto_test", recursive = TRUE))
  write("project:\n  title: quarto_test\n", "quarto_test/_quarto.yml")

  add_to_quarto("quarto_test")

  for (f in c("_extension.yml", "webexercises.lua", "webex.css", "webex.js"))
    expect_true(file.exists(file.path("quarto_test", "_extensions", "webexercises", f)), info = f)
  expect_true(file.exists(file.path("quarto_test", ".Rprofile")))

  yml <- yaml::read_yaml(file.path("quarto_test", "_quarto.yml"))
  expect_equal(unlist(yml$filters), "webexercises")
  expect_null(yml$format)                 # nothing is written under format: any more
})

test_that("the demo page is opt-in", {
  dir.create("quarto_test")
  on.exit(unlink("quarto_test", recursive = TRUE))
  write("project:\n  title: quarto_test\n", "quarto_test/_quarto.yml")

  add_to_quarto("quarto_test")
  expect_false(file.exists(file.path("quarto_test", "webexercises.qmd")))

  add_to_quarto("quarto_test", demo = TRUE)
  expect_true(file.exists(file.path("quarto_test", "webexercises.qmd")))
})

test_that("it leaves the rest of _quarto.yml alone, booleans included", {
  dir.create("quarto_test")
  on.exit(unlink("quarto_test", recursive = TRUE))
  write("project:\n  title: quarto_test\n\nexecute:\n  freeze: false",
        "quarto_test/_quarto.yml")

  add_to_quarto(quarto_dir = "quarto_test")

  txt <- readLines("quarto_test/_quarto.yml")
  expect_true(any(grepl("  freeze: false", txt)))    # not "no", which yaml::write_yaml would give
})

test_that("calling it twice adds the filter once", {
  dir.create("quarto_test")
  on.exit(unlink("quarto_test", recursive = TRUE))
  write("project:\n  title: quarto_test\n", "quarto_test/_quarto.yml")

  add_to_quarto("quarto_test"); add_to_quarto("quarto_test")
  expect_equal(unlist(yaml::read_yaml(file.path("quarto_test", "_quarto.yml"))$filters), "webexercises")
  expect_equal(sum(grepl("library(webexercises)", fixed = TRUE,
                         readLines(file.path("quarto_test", ".Rprofile"), warn = FALSE))), 1L)
})
