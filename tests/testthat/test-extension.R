# PURPOSE: the Quarto extension carries COPIES of the two browser assets -- an extension must be
#   self-contained, and Quarto resolves a file only inside the extension's own directory.
#   Nothing but dev/sync_extension.R may write them, and this is what says so.
test_that("both extension copies are the package's own assets, byte for byte", {
  # inst/_extensions is what the INSTALLED package ships (add_to_quarto() reads it with
  # system.file()); _extensions at the root is what `quarto add <repo>` reads. Neither may be a
  # symlink to the other -- Quarto does not follow one inside _extensions, and a linked filter is
  # found by nothing and reported by no one.
  skip_if_not(dir.exists("../../inst/_extensions"), "source tree only")
  for (d in c("inst/_extensions/webexercises", "_extensions/webexercises")) {
    expect_equal(Sys.readlink(file.path("../..", d)), "", info = d)
    for (f in c("webex.css", "webex.js", "_extension.yml", "webexercises.lua")) {
      src <- if (f %in% c("webex.css", "webex.js")) file.path("../..", "inst/reports/default", f)
             else file.path("../..", "inst/_extensions/webexercises", f)
      expect_identical(readLines(src, warn = FALSE),
                       readLines(file.path("../..", d, f), warn = FALSE),
                       info = paste(d, f, "- run Rscript dev/sync_extension.R"))
    }
  }
})

test_that("webex.js is plain javascript, so an html dependency can take it", {
  js <- trimws(readLines(system.file("reports/default/webex.js", package = "webexercises"),
                         warn = FALSE))
  expect_false(any(js %in% c("<script>", "</script>")),
               info = "the <script> wrapper is added by webex_after_body(), not stored in the file")
})

test_that("--highlight is read with a fallback and never declared", {
  css <- paste(readLines(system.file("reports/default/webex.css", package = "webexercises"),
                         warn = FALSE), collapse = "\n")
  # Declaring it in :root would beat a theme's own declaration on source order.
  expect_false(grepl("--highlight:", css, fixed = TRUE))
  expect_true(grepl("var(--highlight, #467AAC)", css, fixed = TRUE))
})

test_that("no colour literal is left where a dark page needs a variable", {
  css <- paste(readLines(system.file("reports/default/webex.css", package = "webexercises"),
                         warn = FALSE), collapse = "\n")
  css <- gsub("/\\*.*?\\*/", "", css)                 # commented-out experiments do not ship
  expect_false(grepl("background-color:\\s*white", css))
  expect_false(grepl("[^-]color:\\s*black", css))
})
