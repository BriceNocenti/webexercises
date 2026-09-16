
# A widget's identifier: `radio_1`, `check_2`, `text_3`, in order of creation.
#
# DESIGN: a counter, not `sample(LETTERS, 10)`. Three reasons, in order of severity. sample() spends
#   ten values of R's GLOBAL RNG per widget, so a question written between two chunks shifts every
#   draw that follows -- `random_table_from_tab()` and any set.seed() among them, silently. A fresh
#   identity at every render also makes a page non-reproducible, and it is what made remembering an
#   answer impossible.
# WARNING: the counter resets when the file being knitted changes, so identifiers are per DOCUMENT
#   and do not depend on how many documents one R session has already rendered. Without that,
#   rendering a séance alone and rendering it inside a project give different pages.
# WARNING: the identifier lands in `document.querySelector('input[name=' + id + ']')` UNQUOTED
#   (webex.js), so it must stay a valid CSS identifier: a letter, then letters, digits, - and _.
#   It is NOT the key webex.js remembers an answer under -- that one is derived from what the
#   question says, precisely so that inserting a question does not shift the answers after it.
.webex <- new.env(parent = emptyenv())
.webex$n <- 0L
.webex$doc <- NA_character_

webex_id <- function(prefix) {
  doc <- tryCatch(knitr::current_input(), error = function(e) NULL)
  doc <- if (is.null(doc)) NA_character_ else as.character(doc)
  if (!identical(doc, .webex$doc)) {
    .webex$doc <- doc
    .webex$n   <- 0L
  }
  .webex$n <- .webex$n + 1L
  paste0(prefix, "_", .webex$n)
}






#' Create a fill-in-the-blank question
#'
#' @param answer The correct answer (can be a vector if there is more
#'   than one correct answer).
#' @param width Width of the input box in characters. Defaults to the
#'   length of the longest answer.
#' @param num Whether the input is numeric, in which case allow for
#'   leading zeroes to be omitted. Determined from the answer data
#'   type if not specified.
#' @param tol The tolerance within which numeric answers will be
#'   accepted; i.e. if \code{abs(response - true.answer) < tol}, the
#'   answer is correct (implies \code{num=TRUE}).
#' @param ignore_case Whether to ignore case (capitalization).
#' @param ignore_ws Whether to ignore whitespace.
#' @param regex Whether to use regex to match answers (concatenates
#'   all answers with `|` before matching).
#' @details Writes html code that creates an input box widget. Call
#'   this function inline in an RMarkdown document. See the Web
#'   Exercises RMarkdown template for examples of its use in
#'   RMarkdown.
#'
#' @return A character string with HTML code to generate an input box.
#'
#' @examples
#' # What is 2 + 2?
#' fitb(4, num = TRUE)
#'
#' # What was the name of the Beatles drummer?
#' fitb(c("Ringo", "Ringo Starr"), ignore_case = TRUE)
#'
#' # What is pi to three decimal places?
#' fitb(pi, num = TRUE, tol = .001)
#' @export
fitb <- function(answer,
                 width = calculated_width,
                 num = NULL,
                 ignore_case = FALSE,
                 tol = NULL,
                 ignore_ws = TRUE,
                 regex = FALSE) {
  # make sure answer is a numeric or character vector
  answer <- unlist(answer)
  if (!is.vector(answer) ||
      (!is.numeric(answer) && !is.character(answer))) {
    stop("The answer must be a vector of characters or numbers.")
  }

  # set numeric based on data type if num is NULL
  if (is.null(num)) num <- is.numeric(answer)

  # if tol is set, assume numeric
  if (!is.null(tol)) num <- TRUE

  # add zero-stripped versions if numeric
  if (num) {
    answer2 <- strip_lzero(answer)
    answer <- union(answer, answer2)
  }

  # if width not set, calculate it from max length answer, up to limit of 100
  calculated_width <- min(100, max(nchar(answer)))

  answers <- jsonlite::toJSON(as.character(answer))
  answers <- gsub("\'", "&apos;", answers, fixed = TRUE)

  # html format
  # WARNING: build the class list FIRST, then the attributes. `data-tol` used to be opened in the
  # middle of the class attribute, so `tol` with `ignore_case` or `regex` emitted
  # `data-tol='0.1 ignorecase'` -- the class silently lost, the flag never read.
  classes <- paste0("webex-solveme",
                    if (ignore_ws) " nospaces" else "",
                    if (ignore_case) " ignorecase" else "",
                    if (regex) " regex" else "")

  html <- paste0("<input class='", classes, "'",
                 if (!is.null(tol)) paste0(" data-tol='", tol, "'") else "",
                 " size='", width,
                 "' data-answer='", answers, "'/>") |>
    htmltools::HTML()

  # pdf / other format
  pdf <- paste(rep("_", width), collapse = "")

  # check type of knitting
  out_fmt <- knitr::opts_knit$get("out.format")
  pandoc_to <- knitr::opts_knit$get("rmarkdown.pandoc.to")
  if((is.null(out_fmt) & is.null(pandoc_to)) || # with ifelse(), html lose "html" class
           isTRUE(out_fmt == "html") ||
           isTRUE(pandoc_to == "html")) {
    html
    
  } else {
    pdf
  }
}

#' Create a multiple-choice question
#'
#' @param opts Vector of alternatives. The correct answer is the
#'   element(s) of this vector named 'answer'.
#' @details Writes html code that creates an option box widget, with one or
#'   more correct answers. Call this function inline in an RMarkdown document.
#'   See the Web Exercises RMarkdown template for further examples.
#'
#' @return A character string with HTML code to generate a pull-down
#'   menu.
#'
#' @examples
#' # How many planets orbit closer to the sun than the Earth?
#' mcq(c(1, answer = 2, 3))
#'
#' # Which actor played Luke Skywalker in the movie Star Wars?
#' mcq(c("Alec Guinness", answer = "Mark Hamill", "Harrison Ford"))
#' @export
mcq <- function(opts) {
  ix <- which(names(opts) == "answer")
  if (length(ix) == 0) {
    stop("MCQ has no correct answer")
  }

  # html format
  options <- sprintf("<option value='%s'>%s</option>", names(opts), opts)
  html <- sprintf("<select class='webex-select'><option value='blank'></option>%s</select>",
          paste(options, collapse = "")) |> 
    htmltools::HTML()

  # pdf / other format
  pdf_opts <- sprintf("* (%s) %s  ", LETTERS[seq_along(opts)], opts)
  pdf <- paste0("\n\n", paste(pdf_opts, collapse = "\n"), "\n\n")

  # check type of knitting
  out_fmt <- knitr::opts_knit$get("out.format")
  pandoc_to <- knitr::opts_knit$get("rmarkdown.pandoc.to")
  if ((is.null(out_fmt) & is.null(pandoc_to)) || # with ifelse(), html lose "html" class
           isTRUE(out_fmt == "html") ||
           isTRUE(pandoc_to == "html")) {
    html
    
  } else {
    pdf
  }
}

#' Create a true-or-false question
#'
#' @param answer Logical value TRUE or FALSE, corresponding to the correct answer.
#' @details Writes html code that creates an option box widget with TRUE or FALSE as alternatives. Call this function inline in an RMarkdown document. See the Web Exercises RMarkdown template for further examples.
#'
#' @return A character string with HTML code to generate a pull-down
#'   menu with elements TRUE and FALSE.
#'
#' @examples
#' # True or False? 2 + 2 = 4
#' torf(TRUE)
#'
#' # True or False? The month of April has 31 days.
#' torf(FALSE)
#' @export
torf <- function(answer) {
  opts <- c("TRUE", "FALSE")
  if (answer)
    names(opts) <- c("answer", "")
  else
    names(opts) <- c("", "answer")

  # check type of knitting
  out_fmt <- knitr::opts_knit$get("out.format")
  pandoc_to <- knitr::opts_knit$get("rmarkdown.pandoc.to")
  if ((is.null(out_fmt) & is.null(pandoc_to)) ||
           isTRUE(out_fmt == "html") ||
           isTRUE(pandoc_to == "html")) {
    mcq(opts)
  } else{
    "TRUE / FALSE"
  }

}


#' Longer MCQs with Radio Buttons and Checkboxes
#'
#' @param opts Vector of alternatives. The correct answer is the
#'   element(s) of this vector named 'answer'.
#' @details Writes html code that creates a radio button widget, with a
#'   single correct answer. This is more suitable for longer answers. Call this function inline in an RMarkdown
#'   document. See the Web Exercises RMarkdown template for further
#'   examples.
#'
#' @return A character string containing HTML code to create a set of
#'   radio buttons (if there is only one answer) or a set of 
#'   checkboxes (if there is two answers or more).
#' 
#' @examples
#' # What is a p-value?
#' opts <- c(
#'   "the probability that the null hypothesis is true",
#'   answer = paste("the probability of the observed, or more extreme, data",
#'                  "under the assumption that the null-hypothesis is true"),
#'   "the probability of making an error in your conclusion"
#' )
#'
#' longmcq(opts)
#'
#' @export
longmcq <- function (opts) {
    ix <- which(names(opts) == "answer")
    # WARNING: `&` FIRST, or the entities written just below are escaped a second time and the
    # reader sees "&amp;lt;". Only the apostrophe was escaped here for years, so an option holding
    # a `<` or a `&` -- "moins de 5 %", "R & Python" -- reached the page as broken markup. The Lua
    # filter that renders a `- [x]` list escapes the same three, so the two paths agree.
    opts2 <- gsub("&", "&amp;", opts, fixed = TRUE)
    opts2 <- gsub("<", "&lt;", opts2, fixed = TRUE)
    opts2 <- gsub(">", "&gt;", opts2, fixed = TRUE)
    opts2 <- gsub("'", "&apos;", opts2, fixed = TRUE)
    
   if (length(ix) == 0) {
        stop("The question has no correct answer")
    
    } else if (length(ix) == 1) {
    qname <- webex_id("radio")
    options <- sprintf("<label><input type=\"radio\" autocomplete=\"off\" name=\"%s\" value=\"%s\"></input> <span>%s</span></label>", 
        qname, names(opts), opts2)
    html <- paste0("<div class='webex-radiogroup' id='", qname, 
        "'>", paste(options, collapse = ""), "</div>\n") |> 
      htmltools::HTML()
    
    } else { #length >= 2
    qname <- lapply(opts2, function(element) webex_id("check"))
    options <- sprintf("<div class='webex-checkbox' id =\"%s\"><label><input type=\"checkbox\" name=\"%s\" value=\"%s\"> </input><span>%s</span></label> </div>\n", 
       qname, qname, names(opts), opts2)
    html <- paste0(options, collapse = "") |> htmltools::HTML()
    }


  # pdf / other format
  pdf_opts <- sprintf("* (%s) %s  ", LETTERS[seq_along(opts2)], opts2)
  pdf <- paste0("\n\n", paste(pdf_opts, collapse = "\n"), "\n\n")

  # check type of knitting
  out_fmt <- knitr::opts_knit$get("out.format")
  pandoc_to <- knitr::opts_knit$get("rmarkdown.pandoc.to")
  if ( (is.null(out_fmt) & is.null(pandoc_to)) || # with ifelse(), html lose "html" class
           isTRUE(out_fmt == "html") ||
           isTRUE(pandoc_to == "html")) {
    html
    
  } else {
    pdf
  }

}


#' Create button revealing hidden content
#'
#' @param button_text Text to appear on the button that reveals the hidden content.
#' @seealso \code{unhide}
#'
#' @details Writes HTML to create a content that is revealed by a
#'   button press. Call this function inline in an RMarkdown
#'   document. Any content appearing after this call up to an inline
#'   call to \code{unhide()} will only be revealed when the user
#'   clicks the button. See the Web Exercises RMarkdown Template for
#'   examples.
#'
#' @return A character string containing HTML code to create a button
#'   that reveals hidden content.
#'
#' @examples
#' # default behavior is to generate a button that says "Solution"
#' hide()
#'
#' # or the button can display custom text
#' hide("Click here for a hint")
#' @export
hide <- function(button_text = "Solution") {
  rmd <- !is.null(getOption("knitr.in.progress"))

  if (rmd) {
    # WARNING: this HTML must match make_solution() in webexercises.lua, word for word --
    # `type` because a solution may sit in the <form> textbox() writes, and `aria-expanded`
    # because a folded solution is a clipped block that nothing else declares as folded.
    paste0("\n<div class='webex-solution'><button type=\"button\" aria-expanded=\"false\">",
           button_text, "</button>\n")
  } else {
    paste0("\n::: {.callout-note collapse='true'}\n## ", button_text, "\n\n")
  }

}

#' End hidden HTML content
#'
#' @seealso \code{hide}
#'
#' @details Call this function inline in an RMarkdown document to mark
#'   the end of hidden content (see the Web Exercises RMarkdown
#'   Template for examples).
#'
#' @return A character string containing HTML code marking the end of
#'   hiddent content.
#'
#' @examples
#' # just produce the closing </div>
#' unhide()
#' @export
unhide <- function() {
  rmd <- !is.null(getOption("knitr.in.progress"))

  if (rmd) {
    "\n</div>\n"
  } else {
    "\n:::\n\n"
  }
}

#' Display total correct
#'
#' @param elem The html element to display (e.g., div, h3, p, span)
#' @param args Optional arguments for css classes or styles
#'
#' @return A string with the html for displaying a total correct element.
#'
#' @export
#' @keywords internal

total_correct <- function(elem = "span", args = "") {
  .Deprecated(".webex-check sections",
              package = "webexercises",
              old = "total_correct",
              msg = "The function webexercises::total_correct() is deprecated. Use sections with the class 'webex-check' to set up self-checking mini-quizzes with total correct.")
  #sprintf("<%s %s class=\"webex-total_correct\"></%s>\n\n",
  #            elem, args, elem)
}

#' Round up from .5
#'
#' @param x A vector of numeric values.
#'
#' @param digits Integer indicating the number of decimal places (`round`) or significant digits (`signif`) to be used.
#'
#' @details Implements rounding using the "round up from .5" rule,
#'   which is more conventional than the "round to even" rule
#'   implemented by R's built-in \code{\link{round}} function. This
#'   implementation was taken from
#'   \url{https://stackoverflow.com/a/12688836}.
#'
#' @return A vector of rounded numeric values.
#'
#' @examples
#' round2(c(2, 2.5))
#'
#' # compare to:
#' round(c(2, 2.5))
#' @export
round2 <- function(x, digits = 0) {

  posneg = sign(x)
  z = abs(x)*10^digits
  z = z + 0.5
  z = trunc(z)
  z = z/10^digits
  z*posneg
}

#' Strip leading zero from numeric string
#'
#' @param x A numeric string (or number that can be converted to a string).
#'
#' @return A string with leading zero removed.
#'
#' @examples
#' strip_lzero("0.05")
#' @export
strip_lzero <- function(x) {
  sub("^([+-]*)0\\.", "\\1.", x)
}

#' Escape a string for regex
#'
#' @param string A string to escape.
#'
#' @return A string with escaped characters.
#' @export
#'
#' @examples
#' escape_regex("library(tidyverse)")
escape_regex <- function(string) {
  gsub("([.|()\\^{}+$*?]|\\[|\\])", "\\\\\\1", string)
}






#' Add a textbox
#'
#' @param rows Number of rows.
#' @param cols Height or columns.
#' @param border_size Size of the border.
#' @param border_color Color of the border. Defaults to `currentColor`, the colour of the
#'   surrounding text, so the box stays visible on a light page and on a dark one.
#' @param text Prefilled text, which the reader has to delete before writing. Empty by default.
#' @param placeholder Greyed invitation shown while the box is empty, and gone at the first
#'   keystroke. Defaults to `getOption("webexercices_textbox_text")`; `""` for none.
#'
#' @return Html text.
#' @export
textbox <- function(rows = 10, cols = 100,
                    border_size = 2,  border_color = "currentColor",
                    text = "",
                    placeholder = getOption("webexercices_textbox_text")
) {
  # DESIGN: the invitation is a `placeholder` ATTRIBUTE, not content. As content it had to be
  # deleted before writing, so callers switched it off with `text = ""` -- which amounts to having
  # no invitation at all. As an attribute it shows greyed and goes at the first keystroke.
  # WARNING: `currentColor` and not a hex. The box has to be visible on a light page AND on a dark
  # one, and the one colour that is right in both is the colour of the text around it.
  ph <- if (length(placeholder) == 1L && !is.na(placeholder)) as.character(placeholder) else ""

  attrs <- paste0(
    ' name="', webex_id("text"), '"',
    ' cols="', cols, '"',
    ' rows="', rows, '"',
    if (nzchar(ph)) paste0(' placeholder="', htmltools::htmlEscape(ph, attribute = TRUE), '"'),
    ' style="border: ', border_size, 'px solid ', border_color, ';"'
  )

  paste0("<form> <textarea", attrs, ">", text, "</textarea>\n<br />\n</form>")
}





