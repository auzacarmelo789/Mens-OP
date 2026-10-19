/* Live sync for the Pickleball queue.
   Default: the free public relay ntfy.sh (no account, no setup).
   Optional: your own Firebase Realtime Database (set firebaseUrl in config.js).
   The editor pushes a scoreboard snapshot; every viewer subscribes to it. */
(function () {
  var C = window.PBQ_CONFIG || {};
  var fb = String(C.firebaseUrl || '').trim().replace(/\/+$/, '');
  var nt = String(C.ntfyUrl || 'https://ntfy.sh').trim().replace(/\/+$/, '');
  var pollMs = C.pollMs || 20000;
  var MAX = 3800; // ntfy messages must stay under 4096 bytes
  var lastSig = '';

  // ---------- helpers ----------
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
  function unb64(t) { var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function gz(str) {
    var cs = new CompressionStream('gzip'), w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(str)); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function gunz(bytes) {
    var ds = new DecompressionStream('gzip'), w = ds.writable.getWriter();
    w.write(bytes); w.close();
    return new Response(ds.readable).arrayBuffer().then(function (b) { return new TextDecoder().decode(b); });
  }
  // snapshot JSON string -> short text message (compressed, trimmed if still too large)
  function encode(json) {
    var step = function (obj) {
      var s = JSON.stringify(obj);
      var p = typeof CompressionStream !== 'undefined'
        ? gz(s).then(function (b) { return 'z:' + b64(b); })
        : Promise.resolve('j:' + s);
      return p.then(function (m) {
        if (m.length <= MAX) return m;
        if (obj.games && obj.games.length > 6) { obj.games = obj.games.slice(-Math.floor(obj.games.length * 0.6)); return step(obj); }
        return m;
      });
    };
    return step(JSON.parse(json));
  }
  function decode(msg) {
    if (typeof msg !== 'string') return Promise.resolve(null);
    if (msg.indexOf('j:') === 0) return Promise.resolve(msg.slice(2));
    if (msg.indexOf('z:') === 0) return gunz(unb64(msg.slice(2)));
    return Promise.resolve(null);
  }

  // ---------- Firebase (optional) ----------
  var fbUrl = function (room) { return fb + '/pbq/' + encodeURIComponent(room) + '.json'; };
  function fbPush(room, data) {
    return fetch(fbUrl(room), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
  }
  function fbListen(room, cb, st) {
    var es = null;
    var get = function () {
      return fetch(fbUrl(room), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { if (typeof d === 'string') cb(d); st(true); })
        .catch(function () { st(false); });
    };
    try {
      es = new EventSource(fbUrl(room));
      es.addEventListener('put', function (e) {
        try {
          var m = JSON.parse(e.data);
          if (m && m.path === '/' && typeof m.data === 'string') cb(m.data); else if (m && m.path !== '/') get();
          st(true);
        } catch (x) {}
      });
      es.addEventListener('patch', get);
      es.onopen = function () { st(true); };
      es.onerror = function () { st(false); };
    } catch (e) {}
    get();
    var t = setInterval(get, 15000);
    return function () { if (es) es.close(); clearInterval(t); };
  }

  // ---------- ntfy.sh (default) ----------
  var topic = function (room) { return nt + '/pbq-' + encodeURIComponent(room); };
  function ntPush(room, data, force) {
    var sig = data.replace(/^\{"u":\d+,/, '{'); // ignore the timestamp when checking for changes
    if (!force && sig === lastSig) return Promise.resolve();
    return encode(data).then(function (m) {
      return fetch(topic(room), { method: 'POST', body: m }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        lastSig = sig;
      });
    });
  }
  function ntListen(room, cb, st) {
    var es = null, seen = '', open = false, tp = topic(room);
    var got = function (raw) {
      decode(raw).then(function (s) { if (s && s !== seen) { seen = s; cb(s); } }).catch(function () {});
    };
    var line = function (o) { if (o && o.event === 'message' && typeof o.message === 'string') got(o.message); };
    var poll = function () {
      return fetch(tp + '/json?poll=1&since=latest', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (t) {
          t.split('\n').forEach(function (l) { if (l.trim()) { try { line(JSON.parse(l)); } catch (e) {} } });
          st(true);
        })
        .catch(function () { st(false); });
    };
    try {
      es = new EventSource(tp + '/sse?since=latest');
      es.onmessage = function (e) { try { line(JSON.parse(e.data)); open = true; st(true); } catch (x) {} };
      es.onopen = function () { open = true; st(true); };
      es.onerror = function () { open = false; st(false); };
    } catch (e) {}
    poll();
    // polling is only a fallback while the live stream is not connected
    var t = setInterval(function () { if (!open) poll(); }, pollMs);
    return function () { if (es) es.close(); clearInterval(t); };
  }

  window.PBQSync = {
    enabled: C.liveSync !== false,
    provider: fb ? 'firebase' : 'ntfy',
    // data: snapshot as a JSON string; force=true sends even when nothing changed
    push: function (room, data, force) { return fb ? fbPush(room, data) : ntPush(room, data, force); },
    // cb(jsonString) on every update, st(true|false) on connection state; returns a stop function
    listen: function (room, cb, st) { st = st || function () {}; return fb ? fbListen(room, cb, st) : ntListen(room, cb, st); },
    _encode: encode, _decode: decode
  };
})();
