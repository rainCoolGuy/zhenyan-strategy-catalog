/* Homepage market switch, status filter, search, and sortable columns.
   Markets are mutually exclusive: no 全部-market tab and no mixed table. */
(function () {
  var MARKETS = ["A股", "美股", "加密"];
  var DEFAULT_MARKET = "加密";
  var MARKET_KEY = "zhenyan-catalog-market";

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function marketFromLocation() {
    try {
      var sp = new URLSearchParams(location.search);
      var q = sp.get("market");
      if (MARKETS.indexOf(q) >= 0) return q;
      var raw = (location.hash || "").replace(/^#/, "");
      var hm = /(?:^|&)market=([^&]+)/.exec(raw);
      if (hm) {
        var v = decodeURIComponent(hm[1]);
        if (MARKETS.indexOf(v) >= 0) return v;
      }
    } catch (e) {}
    return null;
  }

  function readStoredMarket() {
    try {
      var s = localStorage.getItem(MARKET_KEY);
      if (MARKETS.indexOf(s) >= 0) return s;
    } catch (e) {}
    return null;
  }

  function storeMarket(market) {
    try { localStorage.setItem(MARKET_KEY, market); } catch (e) {}
  }

  function currentMarket() {
    var btn = qs("#market-seg button.active");
    var m = btn ? btn.getAttribute("data-market") : "";
    return MARKETS.indexOf(m) >= 0 ? m : DEFAULT_MARKET;
  }

  function syncMarketUrl(market, push) {
    try {
      var url = new URL(location.href);
      url.searchParams.set("market", market);
      if (url.hash && /(?:^#|&)market=/.test(url.hash)) {
        var raw = url.hash.replace(/^#/, "");
        raw = raw.replace(/(?:^|&)market=[^&]*/g, "").replace(/^&/, "");
        url.hash = raw ? "#" + raw : "";
      }
      var next = url.pathname + url.search + url.hash;
      var cur = location.pathname + location.search + location.hash;
      if (next === cur) return;
      if (push) history.pushState({ market: market }, "", next);
      else history.replaceState({ market: market }, "", next);
    } catch (e) {}
  }

  function setMarketButtons(market) {
    qsa("#market-seg button[data-market]").forEach(function (b) {
      if (b.getAttribute("data-market") === market) b.classList.add("active");
      else b.classList.remove("active");
    });
    try { document.documentElement.setAttribute("data-market", market); } catch (e) {}
  }

  function applyFilter() {
    var market = currentMarket();
    var statusBtn = qs('.seg:not(#market-seg) button.active') || qs(".seg button[data-filter].active");
    var status = statusBtn ? (statusBtn.getAttribute("data-filter") || "all") : "all";
    var q = ((qs("#q") && qs("#q").value) || "").trim().toLowerCase();
    var n = 0;
    var totals = { total: 0, "可实盘": 0, "盈利未过门旁标": 0, "观察": 0, "淘汰": 0 };
    qsa("[data-row]").forEach(function (el) {
      var mk = el.getAttribute("data-market") || "";
      var st = el.getAttribute("data-status") || "";
      var hay = (el.getAttribute("data-search") || "").toLowerCase();
      var inMarket = mk === market;
      if (inMarket && el.tagName === "TR") {
        totals.total += 1;
        if (Object.prototype.hasOwnProperty.call(totals, st)) totals[st] += 1;
      }
      var ok = inMarket && (status === "all" || st === status) && (!q || hay.indexOf(q) !== -1);
      el.hidden = !ok;
      if (ok && el.tagName === "TR") n++;
    });
    var shown = qs("#shown-count");
    if (shown) shown.textContent = String(n);
    var map = {
      "metric-total": totals.total,
      "metric-lock": totals["可实盘"],
      "metric-side": totals["盈利未过门旁标"],
      "metric-cand": totals["观察"],
      "metric-soft": totals["淘汰"]
    };
    Object.keys(map).forEach(function (id) {
      var el = qs("#" + id);
      if (el) el.textContent = String(map[id]);
    });
  }

  function activateMarket(market, push) {
    if (MARKETS.indexOf(market) < 0) market = DEFAULT_MARKET;
    setMarketButtons(market);
    storeMarket(market);
    syncMarketUrl(market, push);
    applyFilter();
  }

  var initial = marketFromLocation() || readStoredMarket() || DEFAULT_MARKET;
  activateMarket(initial, false);

  qsa("#market-seg button[data-market]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activateMarket(btn.getAttribute("data-market"), true);
    });
  });

  qsa(".seg button[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      qsa(".seg button[data-filter]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      applyFilter();
    });
  });
  var input = qs("#q");
  if (input) input.addEventListener("input", applyFilter);

  window.addEventListener("popstate", function () {
    var m = marketFromLocation() || readStoredMarket() || DEFAULT_MARKET;
    setMarketButtons(m);
    storeMarket(m);
    applyFilter();
  });

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
})();
