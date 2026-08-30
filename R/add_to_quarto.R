#' Add webexercises to a Quarto project
#'
#' Installs the Quarto extension into `quarto_dir/_extensions/` and adds `filters: [webexercises]`
#' to its `_quarto.yml`. That one line is the whole of the wiring: the filter puts `webex.css` and
#' `webex.js` on every HTML page as an HTML dependency, so nothing has to name a path, and the same
#' setup is correct for a document, a book and a website alike.
#'
#' @param quarto_dir The base directory of your Quarto project.
#' @param demo Also copy `webexercises.qmd`, a page showing every widget.
#'
#' @return No return value, called for side effects.
#' @export
add_to_quarto <- function(quarto_dir = ".", demo = FALSE) {
  if (quarto_dir == "") quarto_dir <- "."
  src <- system.file("_extensions/webexercises", package = "webexercises")
  if (!nzchar(src))
    stop("webexercises: the Quarto extension is missing from the installed package.", call. = FALSE)

  dest <- file.path(quarto_dir, "_extensions", "webexercises")
  dir.create(dest, showWarnings = FALSE, recursive = TRUE)
  file.copy(list.files(src, full.names = TRUE), dest, overwrite = TRUE)
  message("extension installed: ", dest)

  quarto_file <- file.path(quarto_dir, "_quarto.yml")
  yml <- if (file.exists(quarto_file)) yaml::read_yaml(quarto_file) else list()
  # as.list() is load-bearing: a length-1 character vector writes as `filters: webexercises`, and
  # Quarto's schema wants a sequence there -- it refuses the project outright, naming `filters`.
  yml$filters <- as.list(union(unlist(yml$filters), "webexercises"))
  yaml::write_yaml(yml, quarto_file, handlers = list(
    logical = function(x) structure(ifelse(x, "true", "false"), class = "verbatim")))
  message(quarto_file, ": filters: [webexercises]")

  if (demo) {
    file.copy(system.file("reports/default/webexercises.qmd", package = "webexercises"),
              quarto_dir, overwrite = TRUE)
    message("demo copied: ", file.path(quarto_dir, "webexercises.qmd"))
  }

  rprofile <- file.path(quarto_dir, ".Rprofile")
  load_txt <- "# load webexercises before each chapter
# needs to check namespace to not bork github actions
if (requireNamespace('webexercises', quietly = TRUE)) library(webexercises)"
  if (!file.exists(rprofile) || !any(grepl("webexercises", readLines(rprofile, warn = FALSE))))
    write(load_txt, rprofile, append = TRUE)

  invisible(NULL)
}
