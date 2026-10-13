
/* Zhenyan catalog client decrypt (AES-GCM + PBKDF2). */
(function (global) {
  const META_CANDIDATES = [
    "crypto-meta.json",
    "../crypto-meta.json",
    "../../crypto-meta.json",
    "../../../crypto-meta.json",
  ];
  const SS_KEY = "zhenyan_catalog_pw_v1";

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
      false,
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

  async function decryptFile(key, encUrl) {
    const r = await fetch(encUrl, { cache: "no-store" });
    if (!r.ok) throw new Error("missing " + encUrl);
    const payload = await r.json();
    const bytes = await decryptPayload(key, payload);
    return new TextDecoder().decode(bytes);
  }

  function savePassword(pw) {
    try { sessionStorage.setItem(SS_KEY, pw); } catch (_) {}
  }
  function loadPassword() {
    try { return sessionStorage.getItem(SS_KEY); } catch (_) { return null; }
  }
  function clearPassword() {
    try { sessionStorage.removeItem(SS_KEY); } catch (_) {}
  }

  function rewriteDocument(html) {
    // Replace full document so linked relative assets/scripts in decrypted HTML work.
    document.open();
    document.write(html);
    document.close();
  }

  async function unlockWithPassword(password, encPath) {
    const { meta } = await fetchMeta();
    const key = await verifyPassword(password, meta);
    savePassword(password);
    const html = await decryptFile(key, encPath);
    rewriteDocument(html);
  }

  async function trySession(encPath) {
    const pw = loadPassword();
    if (!pw) return false;
    try {
      await unlockWithPassword(pw, encPath);
      return true;
    } catch (_) {
      clearPassword();
      return false;
    }
  }

  function bootGate(opts) {
    const encPath = opts.encPath;
    const form = document.getElementById("form");
    const err = document.getElementById("err");
    const btn = document.getElementById("btn");
    const pwInput = document.getElementById("pw");

    trySession(encPath).then((ok) => {
      if (ok) return;
      // stay on gate
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
        clearPassword();
      }
    });
  }

  // Helper for status page JS that needs decrypted JSON after unlock —
  // not used when full HTML is rewritten from ciphertext.
  global.ZhenyanAuth = {
    bootGate,
    loadPassword,
    clearPassword,
    decryptFile,
    verifyPassword,
    fetchMeta,
    deriveKey,
  };
})(window);
