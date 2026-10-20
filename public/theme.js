/* Dark mode toggle. The initial class is set by an inline script in <head>
   (before first paint); this file adds the button and keeps the class in
   sync. A saved choice wins; otherwise the OS setting is followed. */
(function () {
  var KEY = "theme";
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  var SUN =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
  var MOON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>';

  // Used when localStorage is unavailable (private mode, blocked storage).
  var fallback = null;

  function saved() {
    try {
      return localStorage.getItem(KEY) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function wantsDark() {
    var t = saved();
    return t ? t === "dark" : media.matches;
  }

  var button;

  function apply() {
    var dark = wantsDark();
    if (root.classList.contains("dark") !== dark) root.classList.toggle("dark", dark);
    if (button) {
      button.innerHTML = dark ? SUN : MOON;
      var label = dark ? "Switch to light mode" : "Switch to dark mode";
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }

  apply();

  // React may rewrite <html class> on re-render; put "dark" back if it does.
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["class"] });

  if (media.addEventListener) media.addEventListener("change", apply);
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) apply();
  });

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    if (document.getElementById("__wc-theme-toggle")) return;
    button = document.createElement("button");
    button.id = "__wc-theme-toggle";
    button.type = "button";
    button.addEventListener("click", function () {
      fallback = wantsDark() ? "light" : "dark";
      try {
        localStorage.setItem(KEY, fallback);
      } catch (e) {}
      apply();
    });
    document.body.appendChild(button);
    apply();
  });
})();
