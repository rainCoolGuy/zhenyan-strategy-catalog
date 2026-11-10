
/* Zhenyan catalog client decrypt (AES-GCM + PBKDF2). Session key cache avoids PBKDF2 flash. */
(function (global) {
  const META_CANDIDATES = [
    "crypto-meta.json",
    "../crypto-meta.json",
    "../../crypto-meta.json",
    "../../../crypto-meta.json",
  ];
  const SS_PW = "zhenyan_catalog_pw_v1";
  const SS_KEY = "zhenyan_catalog_key_v1";
  const SS_SALT = "zhenyan_catalog_salt_v1";

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    let s = "";
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }

  function storeGet(k) {
    try {
      return sessionStorage.getItem(k) || localStorage.getItem(k);
    } catch (_) { return null; }
  }
  function storeSet(k, v) {
    try { sessionStorage.setItem(k, v); } catch (_) {}
    try { localStorage.setItem(k, v); } catch (_) {}
  }
  function storeDel(k) {
    try { sessionStorage.removeItem(k); } catch (_) {}
    try { localStorage.removeItem(k); } catch (_) {}
  }

  async function fetchMeta() {
    let lastErr = null;
    for (const p of META_CANDIDATES) {
      try {
        const r = await fetch(p, { cache: "no-store" });
        if (r.ok) return { meta: await r.json(), base: p.replace(/crypto-meta\.json$/, "") };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("crypto-meta.json missing");
  }

  async function deriveKey(password, saltB64, iterations) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64ToBytes(saltB64), iterations, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function decryptPayload(key, payload) {
    const iv = b64ToBytes(payload.iv);
    const ct = b64ToBytes(payload.ct);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new Uint8Array(pt);
  }

  async function verifyPassword(password, meta) {
    const key = await deriveKey(password, meta.salt, meta.iterations);
    const pt = await decryptPayload(key, meta.verifier);
    const text = new TextDecoder().decode(pt);
    if (text !== meta.verifier_plain) throw new Error("bad verifier");
    return key;
  }

  async function exportKeyJwk(key) {
    return JSON.stringify(await crypto.subtle.exportKey("jwk", key));
  }

  async function importKeyJwk(jwkStr) {
    const jwk = JSON.parse(jwkStr);
    return crypto.subtle.importKey(
      "jwk", jwk, { name: "AES-GCM", length: 256 }, true, ["decrypt"]
    );
  }

  async function saveSession(password, key, saltB64) {
    storeSet(SS_PW, password);
    storeSet(SS_SALT, saltB64);
    try {
      storeSet(SS_KEY, await exportKeyJwk(key));
    } catch (_) {
      // export may fail on some browsers; password fallback still works
    }
  }

  function clearSession() {
    storeDel(SS_PW);
    storeDel(SS_KEY);
    storeDel(SS_SALT);
  }

  function loadPassword() {
    return storeGet(SS_PW);
  }

  async function loadCachedKey(meta) {
    const jwk = storeGet(SS_KEY);
    const salt = storeGet(SS_SALT);
    if (!jwk) return null;
    // Invalidate cache if salt rotated (password rebuild)
    if (salt && meta && salt !== meta.salt) {
      clearSession();
      return null;
    }
    try {
      const key = await importKeyJwk(jwk);
      // quick verify
      const pt = await decryptPayload(key, meta.verifier);
      if (new TextDecoder().decode(pt) !== meta.verifier_plain) {
        clearSession();
        return null;
      }
      return key;
    } catch (_) {
      storeDel(SS_KEY);
      return null;
    }
  }

  async function decryptFile(key, encUrl) {
    const r = await fetch(encUrl, { cache: "no-store" });
    if (!r.ok) throw new Error("missing " + encUrl);
    const payload = await r.json();
    const bytes = await decryptPayload(key, payload);
    return new TextDecoder().decode(bytes);
  }

  function rewriteDocument(html) {
    document.open();
    document.write(html);
    document.close();
  }

  function showGate() {
    document.documentElement.classList.remove("zy-autounlock");
    document.body.classList.remove("booting");
    document.body.classList.add("show-gate");
  }

  function showBoot() {
    document.body.classList.add("booting");
    document.body.classList.remove("show-gate");
  }

  async function unlockWithPassword(password, encPath) {
    const { meta } = await fetchMeta();
    const key = await verifyPassword(password, meta);
    await saveSession(password, key, meta.salt);
    const html = await decryptFile(key, encPath);
    rewriteDocument(html);
  }

  async function unlockWithKey(key, encPath, meta, password) {
    if (password) await saveSession(password, key, meta.salt);
    else {
      storeSet(SS_SALT, meta.salt);
      try { storeSet(SS_KEY, await exportKeyJwk(key)); } catch (_) {}
    }
    const html = await decryptFile(key, encPath);
    rewriteDocument(html);
  }

  async function trySession(encPath) {
    const { meta } = await fetchMeta();
    // Fast path: cached AES key (no PBKDF2)
    const cached = await loadCachedKey(meta);
    if (cached) {
      await unlockWithKey(cached, encPath, meta, loadPassword());
      return true;
    }
    // Slow path: password + PBKDF2
    const pw = loadPassword();
    if (!pw) return false;
    try {
      await unlockWithPassword(pw, encPath);
      return true;
    } catch (_) {
      clearSession();
      return false;
    }
  }

  function hasSessionHint() {
    return !!(storeGet(SS_KEY) || storeGet(SS_PW));
  }

  function bootGate(opts) {
    const encPath = opts.encPath;
    const form = document.getElementById("form");
    const err = document.getElementById("err");
    const btn = document.getElementById("btn");
    const pwInput = document.getElementById("pw");

    if (hasSessionHint()) {
      showBoot();
    } else {
      showGate();
    }

    trySession(encPath).then((ok) => {
      if (ok) return;
      showGate();
    }).catch(() => {
      showGate();
    });

    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      btn.disabled = true;
      const pw = pwInput.value;
      try {
        await unlockWithPassword(pw, encPath);
      } catch (ex) {
        err.textContent = "密码错误或无法解密，请重试。";
        btn.disabled = false;
        clearSession();
        showGate();
      }
    });
  }

  global.ZhenyanAuth = {
    bootGate,
    loadPassword,
    clearPassword: clearSession,
    clearSession,
    decryptFile,
    verifyPassword,
    fetchMeta,
    deriveKey,
  };
})(window);
