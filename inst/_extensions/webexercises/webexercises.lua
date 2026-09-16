--[[ PURPOSE: put the stylesheet and the script on the page, and give an exercise its box, its
     check button and its foldable solution from three lowercase words -- `::: {#exr-slug}`,
     `::: solution`, `::: correction` -- plus a `- [x]` list for a multiple-choice question. A
     course writes markdown and nothing else.
     ROLE: the whole of the Quarto extension. The INLINE widgets stay in R (`r fitb(…)`,
       `r mcq(…)`): their answers are derived from the rendered table, and a Lua filter cannot
       evaluate R.

     WARNING: `at: pre-ast` in _extension.yml is LOAD-BEARING, not a preference. Quarto's normalize
       pass turns `#exr-` and `.solution` divs into custom AST nodes -- a Theorem, a Proof -- and it
       runs before every other entry point. From `post-ast` on, a Div handler never sees them:
       measured, `#exr-` came out as Quarto's "theorem exercise" untouched and `::: solution` as its
       "proof solution", which prints the answer IN THE OPEN. Moving this filter one entry point
       later reveals every solution in the corpus, silently.

     WARNING: `solution` is a class QUARTO RESERVES (proof_types, beside `proof` and `remark`).
       The rewritten div must therefore DROP it rather than merely add `webex-solution`, or Quarto
       stacks its own "Solution." title on top.

     DESIGN: the filter WRAPS and CLASSIFIES, and never moves a block. An earlier version hoisted
       everything but the heading out of the `#exr-` div, to satisfy a `.webex-box > .webex-solution`
       child selector. It cost an `&nbsp;` after all 81 exercise titles -- Quarto pads a theorem
       whose body it finds empty -- and still broke on a solution nested in a `layout-ncol`. The
       stylesheet now matches by descent, so there is nothing to move.

     WARNING: a task list is converted EVERYWHERE except inside a solution, not only inside an
       exercise. An unconverted `- [x]` renders as a TICKED checkbox: the right answer, in the
       open, with no message. A rule that only fires in some places fails open.

     WARNING: html only. Handing an HTML dependency to the latex or docx writer is an error rather
       than a no-op. Outside html the tokens are left alone on purpose -- Quarto's own Proof
       rendering is a decent latex fallback for `::: solution`. ]]

-- === SECTION: what the browser half expects =========================================

-- The five classes webex.js binds, i.e. the five terms of update_total_correct()'s `total`
-- (webex.js:45). A block carrying none of them must NOT become a checked section: an empty one
-- scores 0/0, which the script reads as "all correct" and answers "Bien joué !" on the first press.
local WIDGET = {
  "webex-solveme", "webex-select", "webex-radiogroup", "webex-checkbox", "webex-clickcell",
}

-- token written -> { button label, stays openable inside a checked section }
local SOLUTION = {
  solution   = { "Solution",                false },
  correction = { "Une correction possible", true  },
}

-- what pandoc makes of `- [x]` and `- [ ]`, first in the item
local CHECKED, UNCHECKED = utf8.char(0x2612), utf8.char(0x2610)

-- WARNING: these two templates ARE longmcq()'s, character for character, `</input>` included.
-- Diverging is not cosmetic: a chunk migrated to a `- [x]` list must not move a single pixel, and
-- tests/testthat/test-lua.R renders a question both ways and compares.
local RADIO = '<label><input type="radio" autocomplete="off" name="%s" value="%s"></input> <span>%s</span></label>'
local CHECK = '<div class=\'webex-checkbox\' id ="%s"><label><input type="checkbox" name="%s" value="%s"> </input><span>%s</span></label> </div>\n'

-- === SECTION: helpers ===============================================================

local function is_html()
  if quarto and quarto.doc and quarto.doc.is_format then
    return quarto.doc.is_format("html:js")
  end
  return FORMAT ~= nil and FORMAT:match("^html") ~= nil     -- bare pandoc, for the tests
end

local function warn(msg)
  if quarto and quarto.log and quarto.log.warning then quarto.log.warning("webexercises: " .. msg)
  else io.stderr:write("[webexercises] " .. msg .. "\n") end
end

local function has_class(el, name)
  return el.attr ~= nil and el.attr.classes:includes(name)
end

local function escape_html(s)
  return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

-- WARNING: the id lands in `document.querySelector('input[name=' + id + ']')` (webex.js) UNQUOTED,
-- so it must be a valid CSS identifier: letter first, then letters, digits, - and _.
-- DESIGN: deterministic, and derived from the exercise it sits in. longmcq()'s
-- `sample(LETTERS, 10)` spends ten values of R's global RNG per question -- shifting any set.seed()
-- that follows -- and hands a widget a new identity at every render, which is precisely what makes
-- remembering an answer impossible.
local counter = 0
local function widget_id(prefix, exr)
  counter = counter + 1
  local base = (exr or ""):gsub("^exr%-", ""):gsub("[^%w]+", "_"):gsub("^_+", "")
  if base == "" then base = "q" end
  return string.format("%s_%s_%d", prefix, base, counter)
end

-- === SECTION: the block QCM, written as a markdown task list ========================

-- DESIGN: the option is RENDERED, not flattened. longmcq() receives R strings and drops them into
-- a <span> as raw text, which is why the skill forbids markdown in an option; here the option is
-- markdown that pandoc has already parsed, so `code`, bold and a link survive, and an option like
-- `pct = "row"` finally looks like the code it is. On a plain-text option the two paths agree
-- character for character, which is the case every migrated chunk falls into.
local function option_text(inlines)
  return (pandoc.write(pandoc.Pandoc({ pandoc.Plain(inlines) }), "html"):gsub("%s+$", ""))
end

-- nil unless EVERY item is one paragraph opening on a checkbox glyph
local function read_task_list(bl)
  if bl.t ~= "BulletList" then return nil end
  local opts, answers = {}, 0
  for _, item in ipairs(bl.content) do
    if #item ~= 1 then return nil end
    local blk = item[1]
    if blk.t ~= "Plain" and blk.t ~= "Para" then return nil end
    local ins = blk.content
    if ins[1] == nil or ins[1].t ~= "Str" then return nil end
    local mark = ins[1].text
    if mark ~= CHECKED and mark ~= UNCHECKED then return nil end
    local rest = pandoc.List({})
    for i = 2, #ins do rest:insert(ins[i]) end
    while rest[1] and rest[1].t == "Space" do rest:remove(1) end
    if mark == CHECKED then answers = answers + 1 end
    opts[#opts + 1] = { text = option_text(rest), answer = (mark == CHECKED) }
  end
  if #opts == 0 then return nil end
  return opts, answers
end

local function qcm(bl, exr)
  local opts, answers = read_task_list(bl)
  if not opts then return nil end
  if answers == 0 then
    warn("une liste de cases sans aucune bonne reponse : laissee telle quelle")
    return nil
  end

  local out = {}
  if answers == 1 then
    local qname = widget_id("radio", exr)
    for _, o in ipairs(opts) do
      out[#out + 1] = RADIO:format(qname, o.answer and "answer" or "", o.text)
    end
    return pandoc.RawBlock("html",
      "<div class='webex-radiogroup' id='" .. qname .. "'>" .. table.concat(out) .. "</div>\n")
  end

  for _, o in ipairs(opts) do
    local cname = widget_id("check", exr)
    out[#out + 1] = CHECK:format(cname, cname, o.answer and "answer" or "", o.text)
  end
  return pandoc.RawBlock("html", table.concat(out))
end

-- === SECTION: is there anything to answer in there? =================================

-- Which widgets are THIS block's to count. Two kinds are not:
--   * those in a solution -- a solution is revealed, never answered;
--   * those in a nested section that already carries the button, which is a real shape of the
--     corpus: one statement, then two or three parts each submitted on its own. An outer section
--     that swallowed them would put a second button, and a second and larger counter, around
--     questions the reader has already answered.
-- Dropping them from a COPY is what lets the scan below use pandoc's own walk, which cannot be
-- pruned: it visits children before their parent.
local function unclaimed(blocks)
  local out = pandoc.List({})
  for _, b in ipairs(blocks) do
    if b.t == "Div" and (has_class(b, "webex-solution") or has_class(b, "webex-check")) then
      -- dropped
    elseif b.t == "Div" then out:insert(pandoc.Div(unclaimed(b.content), b.attr))
    else out:insert(b) end
  end
  return out
end

local function has_widget(blocks)
  local found = false
  local function look(n)
    if n.attr then
      for _, w in ipairs(WIDGET) do if n.attr.classes:includes(w) then found = true end end
    end
    if (n.t == "RawBlock" or n.t == "RawInline") and n.format:match("html") then
      -- the format guard matters: the skill's own templates NAME these classes in prose.
      -- WARNING: an html COMMENT is stripped first, and it has to be. knitr does not skip a
      -- comment -- it evaluates the inline R inside it and writes the widget's html there -- so a
      -- question the author put aside months ago still reads as a question here. The section then
      -- gets a button and a counter for widgets that are not on the page, so its total is zero and
      -- "Bien joué !" arrives before anything has been answered.
      local txt = n.text:gsub("<!%-%-.-%-%->", "")
      for _, w in ipairs(WIDGET) do if txt:find(w, 1, true) then found = true end end
    end
  end
  local probe = pandoc.Div(unclaimed(blocks))
  probe:walk({ Div = look, Span = look, RawBlock = look, RawInline = look })
  return found
end

-- === SECTION: the tokens ============================================================

local function solution_kind(div)
  for name, _ in pairs(SOLUTION) do if has_class(div, name) then return name end end
  return nil
end

local function make_solution(div, kind)
  local label = div.attributes["bouton"] or div.attributes["button"] or SOLUTION[kind][1]

  local classes = pandoc.List({ "webex-solution" })
  if SOLUTION[kind][2] then classes:insert("webex-unlocked") end
  for _, c in ipairs(div.attr.classes) do                       -- keep everything but the token
    if SOLUTION[c] == nil then classes:insert(c) end
  end
  local attrs = {}
  for k, v in pairs(div.attributes) do
    if k ~= "bouton" and k ~= "button" then attrs[k] = v end
  end

  local content = pandoc.List({ pandoc.RawBlock("html",
    -- `type`: a solution may sit inside the <form> textbox() writes, where a typeless button
    -- submits. `aria-expanded`: a folded solution is a clipped block, which nothing else
    -- declares as folded; webex.js keeps the attribute in step. Must match hide() in R/.
    '<button type="button" aria-expanded="false">' .. escape_html(label) .. "</button>") })
  content:extend(div.content)
  return pandoc.Div(content, pandoc.Attr(div.identifier, classes, attrs))
end

local function is_exercise(div)
  return div.identifier:match("^exr%-") ~= nil
      or has_class(div, "exercice") or has_class(div, "exercise")
      or has_class(div, "encadre")
end

-- === SECTION: the walk ==============================================================
--
-- DESIGN: one `Pandoc` handler and an explicit recursion, not a `Div` handler. Pandoc walks divs
-- bottom-up, so a Div handler cannot know its ancestors -- and this filter needs exactly that: a
-- `{#exr-}` still sitting inside a hand-written `::: {.webex-check .webex-box}` must be classified,
-- never boxed a second time. Half-migrated files therefore render correctly throughout the
-- migration. It also makes the filter idempotent by construction: it never revisits its own output.

local process

local function exercise_div(div, ctx)
  local exr = div.identifier ~= "" and div.identifier or ctx.exr
  if ctx.exr and div.identifier ~= "" then
    warn("exercice imbrique dans un exercice (" .. div.identifier .. ")")
  end
  div.content = process(div.content, { boxed = true, exr = exr })

  -- an aside's title is NOT a heading: `###### titre` inside a plain div becomes a real numbered
  -- section. Inside a `#exr-` div Quarto eats it into the theorem's name, so only the unnumbered
  -- form needs converting -- which is what colorize() faked by hand.
  -- DESIGN: any level is accepted; the courses write `######` so the editor's outline lists only
  -- the real sections. A `######` that is NOT the first block stays a heading, h6 and numbered.
  if div.identifier == "" and div.content[1] and div.content[1].t == "Header" then
    local h = div.content:remove(1)
    div.content:insert(1, pandoc.Div({ pandoc.Plain(h.content) }, pandoc.Attr("", { "webex-title" })))
  end

  div.attr.classes = div.attr.classes:filter(function(c)
    return c ~= "exercice" and c ~= "exercise" and c ~= "encadre"
  end)

  -- DESIGN: `::: {.encadre couleur="concept"}` gives the box the colour of an annotation: its
  -- border and its title band. The attribute is lifted onto the frame as `data-couleur`, because a
  -- class on the inner div would need `:has()` to reach the frame -- and because an annotation class
  -- (`.concept`) put on the box would also colour its TEXT. The palette that answers the name lives
  -- in txtheme; this filter only carries the word across.
  local couleur = div.attributes["couleur"]
  if couleur then div.attributes["couleur"] = nil end
  -- DESIGN: the frame and the button are two decisions, not one. A block is CHECKED wherever it
  -- holds a question of its own, which is what lets one statement carry two or three parts the
  -- reader submits separately (69 blocks of the corpus). It is FRAMED at the top level, and inside
  -- a box only when it names a colour: a coloured aside nested in an exercise (the sheet of
  -- variables that precedes a table) is a different KIND of content, drawn as an inset whose
  -- margins keep its border off the parent's. An uncoloured nested block is a part, never framed.
  local check = has_widget(div.content) and div.attributes["verification"] ~= "non"

  if ctx.boxed then
    if check then div.attr.classes:insert(1, "webex-check") end
    if couleur then
      div.attr.classes:insert(#div.attr.classes + 1, "webex-inset")
      div.attributes["data-couleur"] = couleur
    end
    return div
  end

  local classes = pandoc.List({ "webex-box" })
  if check then classes:insert(1, "webex-check") end
  local box_attrs = couleur and { { "data-couleur", couleur } } or {}
  -- An unnumbered box has nothing left to carry once its token class is gone: nesting an anonymous
  -- div inside the box would put a second, styleless wrapper between the box and every child --
  -- and `.webex-box > *`, which now writes the vertical rhythm, would reach none of them.
  local bare = true                     -- `next()` refuses an AttributeList; pairs() is the way in
  for _ in pairs(div.attributes) do bare = false end
  if div.identifier == "" and #div.attr.classes == 0 and bare then
    return pandoc.Div(div.content, pandoc.Attr("", classes, box_attrs))
  end
  return pandoc.Div({ div }, pandoc.Attr("", classes, box_attrs))
end

process = function(blocks, ctx)
  local out = pandoc.List({})
  for _, b in ipairs(blocks) do
    -- WARNING: inside a solution a check list is a LIST, not a question -- a worked answer may
    -- perfectly well tick off the steps it took. Everywhere else it is converted, including in
    -- plain prose: an unconverted `- [x]` renders as a ticked checkbox, which is the answer.
    if b.t == "BulletList" then
      out:insert((not ctx.in_solution and qcm(b, ctx.exr)) or b)

    elseif b.t ~= "Div" then
      out:insert(ctx.in_solution and b
                 or b:walk({ BulletList = function(l) return qcm(l, ctx.exr) end }))

    elseif has_class(b, "webex-solution") then
      out:insert(b)                                      -- ours already

    elseif solution_kind(b) then
      local kind = solution_kind(b)
      b.content = process(b.content, { boxed = ctx.boxed, exr = ctx.exr, in_solution = true })
      out:insert(make_solution(b, kind))

    elseif has_class(b, "webex-box") or has_class(b, "webex-check") then
      -- a box written by hand, from before the migration: recurse, never frame again
      b.content = process(b.content, { boxed = true, exr = ctx.exr })
      out:insert(b)

    elseif is_exercise(b) then
      out:insert(exercise_div(b, ctx))

    else
      b.content = process(b.content, ctx)
      out:insert(b)
    end
  end
  return out
end

return {
  Pandoc = function(doc)
    if not is_html() then return nil end
    if quarto and quarto.doc and quarto.doc.add_html_dependency then
      quarto.doc.add_html_dependency({
        name = "webexercises",
        version = "1.2.0",
        stylesheets = { "webex.css" },
        scripts = { "webex.js" },
      })
    end
    counter = 0
    doc.blocks = process(doc.blocks, { boxed = false, exr = nil })
    return doc
  end,
}
