/* Homepage filter, search, and sortable columns. */
(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function applyFilter() {
    var seg = qs(".seg button.active");
    var status = seg ? (seg.getAttribute("data-filter") || "all") : "all";
    var q = ((qs("#q") && qs("#q").value) || "").trim().toLowerCase();
    var n = 0;
    qsa("[data-row]").forEach(function (el) {
      var st = el.getAttribute("data-status") || "";
      var hay = (el.getAttribute("data-search") || "").toLowerCase();
      var ok = (status === "all" || st === status) && (!q || hay.indexOf(q) !== -1);
      el.hidden = !ok;
      if (ok && el.tagName === "TR") n++;
    });
    var shown = qs("#shown-count");
    if (shown) shown.textContent = String(n);
  }

  qsa(".seg button[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      qsa(".seg button[data-filter]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      applyFilter();
    });
  });
  var input = qs("#q");
  if (input) input.addEventListener("input", applyFilter);

  var sortState = { key: null, dir: 1 };
  qsa("th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.getAttribute("data-sort");
      var type = th.getAttribute("data-sort-type") || "text";
      if (sortState.key === key) sortState.dir *= -1;
      else {
        sortState.key = key;
        sortState.dir = (key === "status" || key === "name" || key === "tf" || key === "window" || key === "hold" || key === "lev") ? 1 : -1;
      }
      qsa("th[data-sort]").forEach(function (x) {
        x.removeAttribute("aria-sort");
        x.classList.remove("sort-asc", "sort-desc");
      });
      th.setAttribute("aria-sort", sortState.dir === 1 ? "ascending" : "descending");
      th.classList.add(sortState.dir === 1 ? "sort-asc" : "sort-desc");
      var tbody = qs("#catalog-body");
      if (!tbody) return;
      var rows = qsa("tr[data-row]", tbody);
      rows.sort(function (a, b) {
        var av = a.getAttribute("data-" + key);
        var bv = b.getAttribute("data-" + key);
        if (type === "num") {
          var an = av === "" || av == null ? NaN : Number(av);
          var bn = bv === "" || bv == null ? NaN : Number(bv);
          var aMiss = !Number.isFinite(an), bMiss = !Number.isFinite(bn);
          if (aMiss && bMiss) return 0;
          if (aMiss) return 1;
          if (bMiss) return -1;
          return (an - bn) * sortState.dir;
        }
        return String(av || "").localeCompare(String(bv || ""), "zh-CN") * sortState.dir;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
      var list = qs("#card-list");
      if (list) {
        rows.forEach(function (r) {
          var id = r.getAttribute("data-id");
          var card = list.querySelector('.row-card[data-id="' + id + '"]');
          if (card) list.appendChild(card);
        });
      }
    });
  });

  applyFilter();
})();
