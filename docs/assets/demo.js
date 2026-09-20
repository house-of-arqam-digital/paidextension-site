// Live licensing demo. Plays both roles of the kit in one page: the "Worker"
// (signs ES256 license keys and entitlement tokens, keeps the seat registry,
// revokes on refund) and the "extension" (verifies keys offline with only the
// public key). The keypair is generated fresh in the browser on every load, so
// nothing here is a real credential. The verification code mirrors
// extension/src/licensing/verify.ts.
(function () {
  var root = document.getElementById('demo');
  if (!root || !window.crypto || !window.crypto.subtle || !window.TextEncoder) return;

  var ISSUER = 'acme-extension';
  var MAX_SEATS = 3;
  var TRIAL_DAYS = 7;
  var ENTITLEMENT_DAYS = 3;

  var $ = function (sel) { return root.querySelector(sel); };
  var el = {
    tier: $('[data-tier]'),
    plan: $('[data-plan]'),
    seats: $('[data-seats]'),
    key: $('[data-key]'),
    log: $('[data-log]'),
    features: root.querySelectorAll('[data-feature]'),
    buttons: root.querySelectorAll('[data-action]'),
    server: $('[data-server]')
  };

  // ---- "Worker" state -----------------------------------------------------
  var keyPair = null;
  var licenses = {}; // sub -> { plan, status, installs: [] }
  var serverUp = true;

  // ---- "Extension" state --------------------------------------------------
  var installId = 'install_' + randomId(6);
  var storedKey = null;
  var storedToken = null;

  function randomId(n) {
    var bytes = new Uint8Array(n);
    window.crypto.getRandomValues(bytes);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] % 36).toString(36);
    return out;
  }

  function b64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(seg) {
    var pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
    var bin = atob(seg.replace(/-/g, '+').replace(/_/g, '/') + pad);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function encodeJson(obj) { return b64url(new TextEncoder().encode(JSON.stringify(obj))); }
  function decodeJson(seg) { return JSON.parse(new TextDecoder().decode(b64urlDecode(seg))); }
  function now() { return Math.floor(Date.now() / 1000); }

  // Worker side: sign { sub, plan, iss, iat, exp } with the private key.
  function sign(claims) {
    var header = encodeJson({ alg: 'ES256', typ: 'JWT' });
    var payload = encodeJson(claims);
    var data = new TextEncoder().encode(header + '.' + payload);
    return window.crypto.subtle
      .sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, data)
      .then(function (sig) { return header + '.' + payload + '.' + b64url(new Uint8Array(sig)); });
  }

  // Extension side: verify with the PUBLIC key only. Same failure taxonomy as
  // the kit: malformed | bad-signature | expired | wrong-issuer.
  function verify(jwt) {
    var parts = typeof jwt === 'string' ? jwt.split('.') : [];
    if (parts.length !== 3) return Promise.resolve({ ok: false, reason: 'malformed' });
    var claims;
    try { claims = decodeJson(parts[1]); } catch (_err) { return Promise.resolve({ ok: false, reason: 'malformed' }); }
    var data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    var sig;
    try { sig = b64urlDecode(parts[2]); } catch (_err) { return Promise.resolve({ ok: false, reason: 'malformed' }); }
    return window.crypto.subtle
      .verify({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.publicKey, sig, data)
      .then(function (valid) {
        if (!valid) return { ok: false, reason: 'bad-signature' };
        if (claims.iss !== ISSUER) return { ok: false, reason: 'wrong-issuer' };
        if (typeof claims.exp !== 'number' || claims.exp <= now()) return { ok: false, reason: 'expired' };
        return { ok: true, claims: claims };
      }, function () { return { ok: false, reason: 'verify-error' }; });
  }

  // ---- Worker routes --------------------------------------------------------
  function routeTrial() {
    var sub = 'trial_' + randomId(8);
    licenses[sub] = { plan: 'trial', status: 'active', installs: [] };
    return sign({ sub: sub, plan: 'trial', iss: ISSUER, iat: now(), exp: now() + TRIAL_DAYS * 86400 });
  }
  function routeWebhook(plan) {
    var sub = (plan === 'lifetime' ? 'txn_' : 'sub_') + randomId(10);
    licenses[sub] = { plan: plan, status: 'active', installs: [] };
    var days = plan === 'monthly' ? 31 : plan === 'yearly' ? 366 : 36500;
    return sign({ sub: sub, plan: plan, iss: ISSUER, iat: now(), exp: now() + days * 86400 }).then(function (key) {
      return { sub: sub, key: key };
    });
  }
  function routeActivate(key, install) {
    if (!serverUp) return Promise.reject({ error: 'network' });
    return verify(key).then(function (res) {
      if (!res.ok) return Promise.reject({ error: 'invalid_key', reason: res.reason });
      var lic = licenses[res.claims.sub];
      if (!lic || lic.status !== 'active') return Promise.reject({ error: 'subscription_inactive', status: lic ? lic.status : 'unknown' });
      if (res.claims.plan !== 'trial') {
        var known = lic.installs.indexOf(install) !== -1;
        if (!known && lic.installs.length >= MAX_SEATS) {
          return Promise.reject({ error: 'seat_limit', seats: { used: lic.installs.length, max: MAX_SEATS } });
        }
        if (!known) lic.installs.push(install);
      }
      var exp = Math.min(res.claims.exp, now() + ENTITLEMENT_DAYS * 86400);
      return sign({
        sub: res.claims.sub, plan: res.claims.plan, iss: ISSUER, iat: now(), exp: exp, typ: 'entitlement', install: install
      }).then(function (token) {
        return { token: token, seats: res.claims.plan === 'trial' ? null : { used: lic.installs.length, max: MAX_SEATS } };
      });
    });
  }
  function routeRefund(sub) {
    var lic = licenses[sub];
    if (!lic) return;
    lic.status = 'cancelled';
    lic.installs = [];
  }

  // ---- Extension UI -----------------------------------------------------------
  function log(kind, text, mono) {
    var line = document.createElement('div');
    line.className = 'demo-line ' + kind;
    var who = document.createElement('span');
    who.className = 'who';
    who.textContent = kind === 'worker' ? 'worker' : kind === 'paddle' ? 'paddle' : kind === 'error' ? 'error' : 'extension';
    var msg = document.createElement('span');
    if (mono) msg.className = 'mono';
    msg.textContent = text;
    line.appendChild(who);
    line.appendChild(msg);
    el.log.appendChild(line);
    while (el.log.childNodes.length > 9) el.log.removeChild(el.log.firstChild);
    el.log.scrollTop = el.log.scrollHeight;
  }

  function shorten(jwt) {
    if (!jwt) return '—';
    var parts = jwt.split('.');
    return parts[0].slice(0, 8) + '…' + parts[1].slice(0, 10) + '…' + parts[2].slice(-8);
  }

  var FREE = ['basicMode'];
  var PRO = ['basicMode', 'advancedMode', 'exportData', 'unlimitedItems'];

  function render(status, seats) {
    var tier = status.tier;
    el.tier.textContent = tier === 'pro' ? 'Pro' : tier === 'trial' ? 'Trial' : 'Free';
    el.tier.className = 'demo-tier ' + tier;
    el.plan.textContent = status.detail;
    el.seats.textContent = seats ? seats.used + ' of ' + seats.max + ' devices' : tier === 'trial' ? 'trial — no seat used' : '—';
    el.key.textContent = shorten(storedToken || storedKey);
    var allowed = tier === 'free' ? FREE : PRO;
    for (var i = 0; i < el.features.length; i++) {
      var f = el.features[i];
      var on = allowed.indexOf(f.getAttribute('data-feature')) !== -1;
      f.classList.toggle('on', on);
      f.setAttribute('aria-disabled', String(!on));
    }
    root.setAttribute('data-state', tier);
    for (var j = 0; j < el.buttons.length; j++) {
      var b = el.buttons[j];
      var needs = b.getAttribute('data-needs');
      b.disabled = needs === 'key' ? !storedKey : needs === 'free' ? !!storedKey : false;
    }
  }

  // getEntitlementStatus(): the token unlocks Pro; a bare purchase key only
  // does so inside the offline grace window (here: only if we hold a token).
  function refresh() {
    var source = storedToken || storedKey;
    if (!source) { render({ tier: 'free', detail: 'no license stored' }, null); return Promise.resolve(); }
    return verify(source).then(function (res) {
      if (!res.ok) {
        // Definitive failures clear the key; transient ones keep it.
        if (res.reason !== 'verify-error') { storedToken = null; storedKey = null; }
        log('error', 'verifyLicenseKey → ' + res.reason + (res.reason !== 'verify-error' ? ' — key cleared, back to Free' : ''));
        render({ tier: 'free', detail: 'verification failed: ' + res.reason }, null);
        return;
      }
      var c = res.claims;
      var days = Math.ceil((c.exp - now()) / 86400);
      var lic = licenses[c.sub];
      var seats = c.plan !== 'trial' && lic ? { used: lic.installs.length, max: MAX_SEATS } : null;
      render({
        tier: c.plan === 'trial' ? 'trial' : 'pro',
        detail: c.plan + (c.typ === 'entitlement' ? ' · entitlement renews in ' + days + 'd' : ' · key only, not activated')
      }, seats);
    });
  }

  var actions = {
    trial: function () {
      log('ext', 'POST /trial {visitorId}');
      return routeTrial().then(function (key) {
        storedKey = key; storedToken = null;
        log('worker', '200 signed trial key, exp +' + TRIAL_DAYS + 'd', true);
        return actions.activate();
      });
    },
    buy: function (btn) {
      var plan = btn.getAttribute('data-plan-id') || 'lifetime';
      log('ext', 'POST /checkout {plan: "' + plan + '"} → Paddle overlay opens');
      log('paddle', 'transaction.completed → POST /webhook (signature verified)');
      return routeWebhook(plan).then(function (res) {
        storedKey = res.key; storedToken = null;
        log('worker', 'signed ' + plan + ' key for ' + res.sub + ', emailed via Resend', true);
        log('ext', 'GET /license?txn= → key received, stored');
        return actions.activate();
      });
    },
    activate: function () {
      log('ext', 'POST /activate {key, installId: "' + installId + '"}');
      return routeActivate(storedKey, installId).then(function (res) {
        storedToken = res.token;
        log('worker', '200 entitlement token' + (res.seats ? ' · seat ' + res.seats.used + '/' + res.seats.max : ''), true);
        return refresh();
      }, function (err) {
        if (err.error === 'network') {
          log('error', 'fetch failed: Worker unreachable — keeping stored key (offline grace)');
          return refresh();
        }
        if (err.error === 'seat_limit') {
          log('error', '409 seat_limit ' + err.seats.used + '/' + err.seats.max + ' — release a device on the devices page');
          return refresh();
        }
        if (err.error === 'subscription_inactive') {
          storedToken = null; storedKey = null;
          log('error', '403 subscription_inactive (' + err.status + ') — key cleared');
          return refresh();
        }
        log('error', '400 ' + err.error + ' (' + err.reason + ')');
        return refresh();
      });
    },
    seats: function () {
      // Simulate two more installs of the same key, then a fourth that is refused.
      var subs = storedKey ? decodeJson(storedKey.split('.')[1]) : null;
      if (!subs || subs.plan === 'trial') { log('error', 'buy a plan first — trials do not use seats'); return Promise.resolve(); }
      var others = ['install_' + randomId(6), 'install_' + randomId(6), 'install_' + randomId(6)];
      var chain = Promise.resolve();
      others.forEach(function (id) {
        chain = chain.then(function () {
          log('ext', 'another browser: POST /activate {installId: "' + id + '"}');
          return routeActivate(storedKey, id).then(function (res) {
            log('worker', '200 seat ' + res.seats.used + '/' + res.seats.max);
          }, function (err) {
            log('error', '409 ' + err.error + ' ' + err.seats.used + '/' + err.seats.max + ' — extension shows "release a device"');
          });
        });
      });
      return chain.then(refresh);
    },
    tamper: function () {
      if (!storedToken) return Promise.resolve();
      var parts = storedToken.split('.');
      var payload = decodeJson(parts[1]);
      payload.plan = 'lifetime';
      payload.exp = now() + 36500 * 86400;
      storedToken = parts[0] + '.' + encodeJson(payload) + '.' + parts[2];
      log('ext', 'attacker edits token payload → plan: "lifetime", exp: +100y', true);
      return refresh();
    },
    offline: function () {
      serverUp = !serverUp;
      el.server.textContent = serverUp ? 'Worker: online' : 'Worker: down';
      el.server.classList.toggle('down', !serverUp);
      log(serverUp ? 'worker' : 'error', serverUp ? 'Worker back online' : 'Worker unreachable (simulated outage)');
      if (!serverUp) log('ext', 'alarm: renew entitlement → fetch failed; verify() still passes offline → Pro stays on');
      return refresh();
    },
    refund: function () {
      var source = storedToken || storedKey;
      if (!source) return Promise.resolve();
      var claims = decodeJson(source.split('.')[1]);
      log('paddle', 'transaction.refunded / subscription.canceled → POST /webhook');
      routeRefund(claims.sub);
      log('worker', 'status → cancelled, seats cleared for ' + claims.sub);
      log('ext', 'alarm (≤' + ENTITLEMENT_DAYS + 'd later): POST /activate {renew: true}');
      storedToken = null; // renewal time: the old token is not reused
      return actions.activate();
    },
    reset: function () {
      storedKey = null; storedToken = null; licenses = {}; serverUp = true;
      el.server.textContent = 'Worker: online';
      el.server.classList.remove('down');
      el.log.textContent = '';
      log('ext', 'fresh install ' + installId + ' — no license stored');
      return refresh();
    }
  };

  var busy = false;
  root.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-action]');
    if (!btn || btn.disabled || busy) return;
    var fn = actions[btn.getAttribute('data-action')];
    if (!fn) return;
    busy = true;
    Promise.resolve(fn(btn)).then(function () { busy = false; }, function (err) {
      busy = false;
      log('error', String(err && err.message ? err.message : err));
    });
  });

  window.crypto.subtle
    .generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    .then(function (kp) {
      keyPair = kp;
      root.classList.add('ready');
      log('worker', 'generated a fresh ES256 keypair for this page; public key embedded in the "extension"');
      return actions.reset();
    })
    .catch(function () {
      root.classList.add('unsupported');
    });
})();
