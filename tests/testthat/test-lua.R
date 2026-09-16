# PURPOSE: the Quarto filter turns three lowercase words and a `- [x]` list into widget markup.
#   Most of it is checked under BARE PANDOC, which is instant and needs no project; only the
#   crossref numbering needs a real Quarto render, and gets one test of its own.
# ROLE: the silent failure kept here is a token that stops being recognised. `::: solution` then
#   comes out as Quarto's own reserved proof environment -- which prints the answer IN THE OPEN --
#   and an unconverted `- [x]` renders as a TICKED checkbox, i.e. the right answer, with no message.
#   Nothing errors in either case.

lua_path <- function() {
  p <- testthat::test_path("..", "..", "inst/_extensions/webexercises/webexercises.lua")
  normalizePath(p, mustWork = FALSE)
}

# Run the filter alone. `to = "markdown"` gives an AST round-trip, which is how idempotence is
# tested; `to = "latex"` checks that the filter is a strict no-op outside html.
webex_filter <- function(md, to = "html") {
  skip_if_not(nzchar(Sys.which("pandoc")), "pandoc is not on the PATH")
  skip_if_not(file.exists(lua_path()), "source tree only")
  paste(system2("pandoc",
                c("-f", "markdown", "-t", to, paste0("--lua-filter=", shQuote(lua_path()))),
                input = md, stdout = TRUE),
        collapse = "\n")
}

# ids are deterministic by design, so they are the one thing to blur before comparing two paths
blur_ids <- function(x) gsub("(radio|check)_[A-Za-z0-9_]+", "ID", x)

test_that("`::: {#exr-}` gets a box, and a check button only when there is a widget", {
  prose <- webex_filter("::: {#exr-a}\n## titre\n\nDe la prose, et rien a repondre.\n:::\n")
  expect_match(prose, '<div class="webex-box">')
  expect_no_match(prose, "webex-check")
  # An empty checked section scores 0/0, which webex.js reads as "all correct": it would answer
  # "Bien joué !" on the first press, before the reader has done anything.

  widget <- webex_filter(paste0(
    "::: {#exr-a}\n## titre\n\nUn champ : ",
    "<input class='webex-solveme' data-answer='[\"42\"]'/>\n:::\n"))
  expect_match(widget, '<div class="webex-check webex-box">')
})

test_that("a widget put aside in an html comment is not a question", {
  # PANNE GARDÉE : knitr NE SAUTE PAS un commentaire html -- il évalue le `r fitb()` qui s'y trouve
  #   et y écrit la balise du widget. L'auteur qui met une question de côté laissait donc à sa
  #   section un bouton et un compteur pour des widgets absents de la page : total zéro, donc
  #   « Bien joué ! » dès le premier clic, sur un exercice où rien n'a été demandé.
  #   C'est l'état où était `L3S2_01 / exr-tab-multi-3`.
  mis_de_cote <- webex_filter(paste0(
    "::: {#exr-a}\n## titre\n\nUn enonce sans question.\n\n",
    "<!--\n\n<input class='webex-solveme' data-answer='[\"42\"]'/>\n\n-->\n:::\n"))
  expect_match(mis_de_cote, '<div class="webex-box">')
  expect_no_match(mis_de_cote, "webex-check")

  # et la moitié qui doit continuer de marcher : une balise ECRITE A LA MAIN, hors commentaire
  vivant <- webex_filter(paste0(
    "::: {#exr-a}\n## titre\n\nReponse : <input class='webex-solveme' data-answer='[\"42\"]'/>",
    "\n\n<!-- <select class='webex-select'></select> -->\n:::\n"))
  expect_match(vivant, '<div class="webex-check webex-box">')
})

test_that("a solution is a folded button and never Quarto's reserved proof environment", {
  html <- webex_filter(paste0(
    "::: {#exr-a}\n## titre\n\n",
    "::: solution\nLa reponse.\n:::\n\n",
    "::: correction\nUn corrige.\n:::\n\n",
    '::: {.solution bouton="Code du tableau"}\nDu code.\n:::\n:::\n'))

  # the button declares what it does: a folded solution is a clipped block, and nothing else says
  # so. `type` keeps it from submitting the <form> textbox() writes.
  btn <- '<button type="button" aria-expanded="false">'
  expect_match(html, paste0('<div class="webex-solution">\\s*', btn, 'Solution</button>'))
  expect_match(html, paste0('<div class="webex-solution webex-unlocked">\\s*', btn,
                            'Une correction possible</button>'))
  expect_match(html, paste0(btn, "Code du tableau</button>"), fixed = TRUE)
  # `solution` is a class QUARTO RESERVES: left on the div, Quarto stacks its own visible
  # "Solution." title on top of the folded one. (A hyphen is a word boundary, so the token has to
  # be pinned by its quotes -- "\\bsolution\\b" matches inside "webex-solution".)
  expect_no_match(html, 'class="solution')
  expect_no_match(html, "proof")
})

test_that("a `- [x]` list is longmcq(), character for character", {
  md <- "::: encadre\n\n- [ ] Une reponse fausse\n- [x] Une reponse juste\n\n:::\n"
  # Both sides go through pandoc: `+native_divs` re-reads longmcq()'s raw html (`&apos;` back to
  # an apostrophe, `value=\"\"` to `value`), so comparing the raw strings would compare nothing.
  html_of <- function(x) {
    x <- paste(system2("pandoc", c("-f", "html", "-t", "html"), input = x, stdout = TRUE),
               collapse = " ")
    trimws(gsub("\\s+", " ", blur_ids(x)))
  }
  by_r   <- html_of(as.character(longmcq(c("Une reponse fausse", answer = "Une reponse juste"))))
  by_lua <- html_of(sub(".*(<div[^>]*webex-radiogroup.*?</div>).*", "\\1", webex_filter(md)))
  expect_identical(by_lua, by_r)
})

test_that("two answers give one checkbox div per option, as longmcq() does", {
  html <- webex_filter("::: encadre\n\n- [x] un\n- [x] deux\n- [ ] trois\n\n:::\n")
  expect_equal(lengths(gregexpr("webex-checkbox", html))[[1]], 3L)
  expect_equal(lengths(gregexpr('value="answer"', html))[[1]], 2L)
  expect_no_match(html, "webex-radiogroup")
})

test_that("no task list survives anywhere, because a ticked box IS the answer in the open", {
  # Outside any box too: a rule that fires only in some places fails open.
  html <- webex_filter("Du texte.\n\n- [ ] faux\n- [x] juste\n")
  expect_no_match(html, "task-list")
  expect_match(html, "webex-radiogroup")

  # ... except inside a solution, where a checklist is a list and not a question.
  sol <- webex_filter("::: solution\n\n- [ ] faux\n- [x] juste\n\n:::\n")
  expect_match(sol, "task-list")
})

test_that("a list with no answer is left alone, and says so", {
  expect_match(webex_filter("::: encadre\n\n- [ ] un\n- [ ] deux\n\n:::\n"), "task-list")
})

test_that("an option keeps its markdown, which longmcq() cannot", {
  html <- webex_filter("::: encadre\n\n- [x] du `code` et du **gras**\n- [ ] rien\n\n:::\n")
  expect_match(html, "<span>du <code>code</code> et du <strong>gras</strong></span>", fixed = TRUE)
})

test_that("`::: encadre` titles its box without adding a section to the contents", {
  html <- webex_filter("::: encadre\n## Rappel : lire dans l'ordre\n\nDu texte.\n:::\n")
  expect_match(html, '<div class="webex-title">')
  expect_no_match(html, "<h2")
})

test_that("a level-6 title works like any other, and stays out of the contents", {
  html <- webex_filter("::: encadre\n###### Rappel\n\nDu texte.\n:::\n")
  expect_match(html, '<div class="webex-title">')
  expect_no_match(html, "<h6")
})

test_that("a coloured aside keeps its colour inside a box, as an inset; a part stays unframed", {
  # The colour used to be dropped in silence as soon as the aside was nested: the sheet of variables
  # inside an exercise came out as a bare div with a title no rule reached.
  html <- webex_filter(paste0(
    "::: {#exr-a}\n###### titre\n\nIntro.\n\n",
    "::: {.encadre couleur=\"terrain\"}\n###### Variables et param\u00e8tres\n\n- Base\n:::\n\n",
    "::: encadre\n###### 1. partie\n\nTexte.\n:::\n:::\n"))
  expect_match(html, '<div class="webex-inset" data-couleur="terrain">', fixed = TRUE)
  expect_equal(lengths(gregexpr("webex-inset", html))[[1]], 1L)
  expect_equal(lengths(gregexpr("webex-box", html))[[1]], 1L)
  expect_equal(lengths(gregexpr('class="webex-title"', html))[[1]], 2L)
})

test_that("a box written by hand is never framed twice", {
  # What a half-migrated file looks like, and it must render correctly throughout the migration.
  html <- webex_filter("::: {.webex-check .webex-box}\n\n::: {#exr-a}\n## titre\n:::\n\n:::\n")
  expect_equal(lengths(gregexpr("webex-box", html))[[1]], 1L)
})

test_that("the filter is idempotent, and a no-op outside html", {
  md <- "::: {#exr-a}\n## titre\n\n- [ ] faux\n- [x] juste\n\n::: solution\nLa reponse.\n:::\n:::\n"
  once  <- webex_filter(md, "markdown")
  twice <- webex_filter(once, "markdown")
  expect_identical(blur_ids(twice), blur_ids(once))

  tex <- webex_filter(md, "latex")
  expect_no_match(tex, "webex-box")
  expect_no_match(tex, "webex-solution")
})

test_that("Quarto still numbers an exercise the filter has boxed", {
  skip_if_not(nzchar(Sys.which("quarto")), "quarto not installed")
  skip_if_not(dir.exists(testthat::test_path("..", "..", "_extensions/webexercises")),
              "source tree only")
  dir <- withr::local_tempdir()
  file.copy(testthat::test_path("..", "..", "_extensions"), dir, recursive = TRUE)
  qmd <- file.path(dir, "n.qmd")
  writeLines(c("---", "title: n", "lang: fr", "filters: [webexercises]",
               "crossref:", "  chapters: true",
               "format:", "  html:", "    number-sections: true", "    embed-resources: true",
               "---", "", "# Section", "",
               "::: {#exr-un}", "## le titre", "", "Voici un enonce.", ":::"), qmd)
  suppressWarnings(system2("quarto", c("render", shQuote(qmd)), stdout = TRUE, stderr = TRUE))
  skip_if_not(file.exists(file.path(dir, "n.html")), "render failed")
  html <- paste(readLines(file.path(dir, "n.html"), warn = FALSE), collapse = "\n")

  expect_match(html, '<div class="webex-box">')
  expect_match(html, 'id="exr-un" class="theorem exercise"')
  expect_match(html, "Exercice 1.1 \\(le titre\\)")
  # The statement stays INSIDE the numbered div, on the title's own line. Hoisting it out left a
  # non-breaking space behind every title -- Quarto pads a theorem whose body it finds empty.
  expect_match(html, "\\(le titre\\)</strong></span> Voici un enonce")
  expect_no_match(html, "theorem-title[^<]*</strong></span>\\s* ")
})

test_that("a nested part is checked on its own, and never framed twice", {
  # One statement, two parts each submitted separately -- 69 blocks of the corpus are shaped this
  # way. The frame and the button are two decisions: framed only at the top, checked wherever there
  # is a question. And the outer block must NOT claim the inner's widgets, or it would put a second
  # button and a larger counter around answers already given.
  html <- webex_filter(paste0(
    "::: {#exr-a}\n## titre\n\nL'enonce.\n\n",
    "::: encadre\n\n- [ ] faux\n- [x] juste\n\n:::\n",
    ":::\n"))
  expect_equal(lengths(gregexpr("webex-box", html))[[1]], 1L)
  expect_equal(lengths(gregexpr("webex-check", html))[[1]], 1L)
  # the check landed on the inner part, so the outer is a plain frame
  expect_match(html, '<div class="webex-box">')
  expect_match(html, '<div class="webex-check">')

  # with no nested part, the exercise itself takes the button
  flat <- webex_filter("::: {#exr-a}\n## titre\n\n- [ ] faux\n- [x] juste\n:::\n")
  expect_match(flat, '<div class="webex-check webex-box">')
})
