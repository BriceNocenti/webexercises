#' Create a Quarto document with webexercises
#'
#' Makes a directory, puts a demo `.qmd` in it, installs the Quarto extension and writes the one
#' line of `_quarto.yml` that turns it on.
#'
#' @param name Name of the new document (and of the directory it goes in).
#' @param open Whether to open the document in RStudio / Positron.
#'
#' @return The file path to the document, invisibly.
#' @export
create_quarto_doc <- function(name = "Untitled", open = interactive()) {
  if (!file.exists(name)) dir.create(name, FALSE, TRUE)
  path     <- normalizePath(name)
  filepath <- file.path(path, paste0(basename(name), ".qmd"))

  file.copy(system.file("reports/default/index.qmd", package = "webexercises"), filepath)
  add_to_quarto(path)

  if (open) rstudioapi::documentOpen(filepath)
  invisible(filepath)
}
