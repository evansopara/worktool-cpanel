(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    if (document.getElementById("__wc-sidebar-toggle")) return;

    var backdrop = document.createElement("div");
    backdrop.id = "__wc-sidebar-backdrop";
    document.body.appendChild(backdrop);

    var toggle = document.createElement("button");
    toggle.id = "__wc-sidebar-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Toggle menu");
    toggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>';
    document.body.appendChild(toggle);

    function close() {
      document.documentElement.classList.remove("__wc-sidebar-open");
    }
    function toggleOpen() {
      document.documentElement.classList.toggle("__wc-sidebar-open");
    }

    toggle.addEventListener("click", toggleOpen);
    backdrop.addEventListener("click", close);

    document.addEventListener("click", function (e) {
      var sidebar = document.querySelector("aside.bg-sidebar");
      if (!sidebar || !sidebar.contains(e.target)) return;
      if (e.target.closest("a")) close();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768) close();
    });
  });
})();
