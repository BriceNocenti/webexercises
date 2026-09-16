.onLoad <- function(libname, pkgname) {
  # sets up webex.hide chunk option
  setup_hide_knithook()

  # WARNING: this is the ONLY .onLoad in the package. There used to be a second one at the top of
  # R/webexercises_fns.R, and R kept whichever collated LAST -- this one. The option below lived in
  # that shadowed copy, so it was never set: textbox()'s `placeholder` default read NULL and no
  # invitation was ever shown, which test-textbox.R could not catch because "no option" and
  # "placeholder = NULL" produce the same html.
  options("webexercices_textbox_text" = "Answer")

  invisible()
}
