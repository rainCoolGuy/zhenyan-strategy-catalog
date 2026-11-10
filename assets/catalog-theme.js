/* Shared theme toggle: localStorage.theme = "dark"|"light"; dark => <html data-theme="dark">. */
(function (global) {
  var THEME_KEY = "theme";

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function themeLabel(dark) {
    return dark ? "切换到浅色模式" : "切换到深色模式";
  }
  function syncToggleButtons() {
    var dark = isDark();
    var nodes = document.querySelectorAll(".theme-toggle");
    for (var i = 0; i < nodes.length; i++) {
      var btn = nodes[i];
      btn.classList.toggle("is-dark", dark);
      btn.classList.toggle("is-light", !dark);
      var label = themeLabel(dark);
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
      var opts = btn.querySelectorAll(".theme-toggle-option");
      for (var j = 0; j < opts.length; j++) {
        var opt = opts[j];
        var isDarkOpt = opt.getAttribute("data-theme-opt") === "dark";
        opt.classList.toggle("is-active", isDarkOpt ? dark : !dark);
        opt.setAttribute("aria-hidden", isDarkOpt ? (dark ? "false" : "true") : (dark ? "true" : "false"));
      }
    }
  }
  function applyTheme(dark, opts) {
    opts = opts || {};
    var d = document.documentElement;
    d.classList.remove("theme-ready");
    if (dark) {
      d.setAttribute("data-theme", "dark");
      try { localStorage.setItem(THEME_KEY, "dark"); } catch (e) {}
    } else {
      d.removeAttribute("data-theme");
      try { localStorage.setItem(THEME_KEY, "light"); } catch (e) {}
    }
    syncToggleButtons();
    try {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          d.classList.add("theme-ready");
        });
      });
    } catch (e2) {
      d.classList.add("theme-ready");
    }
    if (!opts.silent) {
      try {
        global.dispatchEvent(new CustomEvent("zy-theme-change", { detail: { dark: !!dark } }));
      } catch (e3) {}
    }
    return !!dark;
  }
  function toggleTheme() {
    return applyTheme(!isDark());
  }
  function bind() {
    var nodes = document.querySelectorAll(".theme-toggle");
    for (var i = 0; i < nodes.length; i++) {
      var btn = nodes[i];
      if (btn.__zyBound) continue;
      btn.__zyBound = true;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        toggleTheme();
      });
    }
    syncToggleButtons();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
  window.addEventListener("storage", function (ev) {
    if (ev && ev.key === THEME_KEY) {
      applyTheme(ev.newValue === "dark", { silent: false });
    }
  });
  global.ZhenyanTheme = {
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    isDark: isDark,
    bind: bind,
    syncToggleButtons: syncToggleButtons,
  };
})(window);
