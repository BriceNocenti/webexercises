--[[ PURPOSE: put webexercises' stylesheet and script on the page, once, wherever the page is.
     ROLE: the whole of the Quarto extension. There is no shortcode and no markup rewriting: the
       widgets are written by the R functions (fitb(), mcq(), longmcq(), hide()/unhide()), which
       emit their HTML through knitr exactly as they do under rmarkdown.

     WHY A DEPENDENCY RATHER THAN `css:` + `include-after-body:`. quarto.doc.add_html_dependency()
     copies the files itself and writes the paths, so the same one line is correct for a standalone
     document, a chapter of a book and a page of a website -- and correct under
     `embed-resources: true`, where a hand-written relative path would not be. It also cannot be
     included twice.

     WARNING: html only. Handing an HTML dependency to the latex or docx writer is an error rather
     than a no-op, and a .qmd rendered to several formats would otherwise fail on the second. ]]

local added = false

function Meta(meta)
  if added or not quarto.doc.is_format("html:js") then return nil end
  added = true
  quarto.doc.add_html_dependency({
    name = "webexercises",
    version = "1.1.0",
    stylesheets = { "webex.css" },
    scripts = { "webex.js" },
  })
  return nil
end
