# PURPOSE: copy the two browser assets into the Quarto extension -- TWICE, on purpose.
# ROLE: run by hand after editing inst/reports/default/webex.css or webex.js.
#   tests/testthat/test-extension.R fails when any copy drifts, so this is never optional.
#
# WHY TWO EXTENSION DIRECTORIES, and they are the same files:
#   inst/_extensions/webexercises   what the INSTALLED PACKAGE ships, so add_to_quarto() can find
#                                   it with system.file() and copy it into a project.
#   _extensions/webexercises        what `quarto add BriceNocenti/webexercises` reads, since Quarto
#                                   looks for `_extensions/` at a repository's ROOT.
# WARNING: neither may be a symlink to the other. Quarto does not follow a symlink inside
#   `_extensions/` -- `quarto add` fails outright, and a linked FILTER is simply never found.
EXT <- c("inst/_extensions/webexercises", "_extensions/webexercises")
for (d in EXT) dir.create(d, showWarnings = FALSE, recursive = TRUE)
for (f in c("_extension.yml", "webexercises.lua", "webex.css", "webex.js")) {
  src <- if (f %in% c("webex.css", "webex.js")) file.path("inst/reports/default", f) else
    file.path(EXT[[1]], f)
  for (d in EXT) if (normalizePath(src, mustWork = FALSE) != normalizePath(file.path(d, f), mustWork = FALSE)) {
    file.copy(src, file.path(d, f), overwrite = TRUE)
    message("copied: ", src, " -> ", file.path(d, f))
  }
}
