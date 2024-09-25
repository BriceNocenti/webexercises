#' Create default webexercises document
#'
#' This function wraps \code{rmarkdown::html_document} to configure
#' compilation to embed the default webexercises CSS and JavaScript files in
#' the resulting HTML.
#'
#' @details Call this function as the \code{output_format} argument
#'   for the \code{\link[rmarkdown]{render}} function when compiling
#'   HTML documents from RMarkdown source.
#'
#' @param ... Additional function arguments to pass to
#'   \code{\link[rmarkdown]{html_document}}.
#' @param css Path of css file to add. 
#'
#' @return R Markdown output format to pass to 'render'.
#'
#' @seealso \code{\link[rmarkdown]{render}}, \code{\link[rmarkdown]{html_document}}
#'
#' @examples
#' # copy the webexercises 'R Markdown' template to a temporary file
#' \dontrun{
#' my_rmd <- tempfile(fileext = ".Rmd")
#' rmarkdown::draft(my_rmd, "webexercises", "webexercises")
#'
#' # compile it
#' rmarkdown::render(my_rmd, webexercises::webexercises_default())
#'
#' # view the result
#' browseURL(sub("\\.Rmd$", ".html", my_rmd))
#' }
#' @export
webexercises_default <- function(css, ...) { # includes
  
  css <- 
    if (missing(css)) {
      system.file("reports/default/webex.css", package = "webexercises")
    } else {
      c(system.file("reports/default/webex.css", package = "webexercises"), 
        css
      )
    }

  js <- system.file("reports/default/webex.js", package = "webexercises")

  setup_hide_knithook()

  # smart quotes changed in rmarkdown 2.2 / pandoc 2.0.6
  rmarkdown::pandoc_available(version = "2.0.6", error = TRUE)

  rmarkdown::html_document(css = css,
                           includes = rmarkdown::includes(after_body = js),
                           md_extensions = "-smart",
                           ...)
}


#' Create webexercises document in bookdown::html_document2 style
#'
#' This function wraps \code{bookdown::html_document2} to configure
#' compilation to embed the default webexercises CSS and JavaScript files in
#' the resulting HTML.
#'
#' @details Call this function as the \code{output_format} argument
#'   for the \code{\link[rmarkdown]{render}} function when compiling
#'   HTML documents from RMarkdown source.
#'
#' @param ... Additional function arguments to pass to
#'   \code{\link[bookdown]{html_document2}}.
#' @param css Path of css file to add. 
#'
#' @return R Markdown output format to pass to 'render'.
#'
#' @seealso \code{\link[rmarkdown]{render}}, \code{\link[bookdown]{html_document2}}
#'
#' @examples
#' # copy the webexercises 'R Markdown' template to a temporary file
#' \dontrun{
#' my_rmd <- tempfile(fileext = ".Rmd")
#' rmarkdown::draft(my_rmd, "webexercises", "webexercises")
#'
#' # compile it
#' rmarkdown::render(my_rmd, webexercises::webexercises_default2())
#'
#' # view the result
#' browseURL(sub("\\.Rmd$", ".html", my_rmd))
#' }
#' @export
webexercises_default2 <- function(css, ...) { # includes 
  
  base_css <- c(
    system.file("reports/default/webex.css", package = "webexercises"), 
    system.file("resources/gitbook/css/plugin-clipboard.css", package = "bookdown") 
  )
  css <- if (missing(css)) { base_css } else { c(base_css, css) }
  
  js <- c(system.file("reports/default/webex.js", package = "webexercises") #, 
          #system.file("resources/gitbook/js/clipboard.min.js", package = "bookdown") #,
          #system.file("resources/gitbook/js/plugin-clipboard.js", package = "bookdown") 
          #"D:/Statistiques/Formations/M1S1-Tableaux croisés équipés sur R/resources/plugin-clipboard.js"
  )
  
  
  
  setup_hide_knithook()
  
  # smart quotes changed in rmarkdown 2.2 / pandoc 2.0.6
  rmarkdown::pandoc_available(version = "2.0.6", error = TRUE)
  
  bookdown::html_document2(css = css,
                           includes = rmarkdown::includes(after_body = js),
                           md_extensions = "-smart",
                           ...)
}


setup_hide_knithook <- function() {
  knitr::knit_hooks$set(webex.hide = function(before, options, envir) {
    if (before) {
      if (is.character(options$webex.hide)) {
        hide(options$webex.hide)
      } else {
        hide()
      }
    } else {
      unhide()
    }
  })

  invisible()
}



