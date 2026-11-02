// GRAVEHUSH — online co-op over PeerJS (WebRTC, peer to peer; works on GitHub Pages)
'use strict';

// Local test transport (open the game with ?localnet in two tabs of the same browser)
GH.FakePeer = function (id) {
  const self = this;
  self.id = id || ('fp' + Math.random().toString(36).slice(2, 9));
  const bc = new BroadcastChannel('gravehush-net');
  const handlers = {}; const conns = {};
  self.on = (ev, fn) => { handlers[ev] = fn; };
  const emit = (ev, a) => handlers[ev] && handlers[ev](a);
  function Conn(peer) {
    const c = this, h = {};
    c.peer = peer; c.open = false;
    c.on = (ev, fn) => { h[ev] = fn; };
    c._emit = (ev, a) => h[ev] && h[ev](a);
    c.send = (data) => bc.postMessage({ to: peer, from: self.id, type: 'data', data });
    c.close = () => { bc.postMessage({ to: peer, from: self.id, type: 'close' }); c._emit('close'); delete conns[peer]; };
  }
  bc.onmessage = (e) => {
    const m = e.data; if (m.to !== self.id) return;
    if (m.type === 'connect') { const c = new Conn(m.from); conns[m.from] = c; emit('connection', c); c.open = true; bc.postMessage({ to: m.from, from: self.id, type: 'accept' }); setTimeout(() => c._emit('open'), 0); }
    else if (m.type === 'accept') { const c = conns[m.from]; if (c) { c.open = true; c._emit('open'); } }
    else if (m.type === 'data') { const c = conns[m.from]; if (c) c._emit('data', m.data); }
    else if (m.type === 'close') { const c = conns[m.from]; if (c) { c._emit('close'); delete conns[m.from]; } }
  };
  self.connect = (peer) => { const c = new Conn(peer); conns[peer] = c; bc.postMessage({ to: peer, from: self.id, type: 'connect' }); return c; };
  self.call = () => null;
  self.destroy = () => { for (const k in conns) conns[k].close(); bc.close(); };
  setTimeout(() => emit('open', self.id), 50);
};

GH.Net = function () {
  const N = this;
  N.role = null; N.peer = null; N.conns = {}; N.conn = null; N.calls = {};
  N.onMsg = () => { }; N.onLeave = () => { }; N.onStream = () => { };
  const PREFIX = 'gravehush-v1-';
  const Peer = () => location.search.includes('localnet') ? GH.FakePeer : window.Peer;

  N.host = function (code, cb) {
    N.close();
    if (!Peer()) { cb('nopeer'); return; }
    N.role = 'host';
    const P = Peer();
    N.peer = new P(PREFIX + code.toLowerCase());
    let done = false;
    N.peer.on('open', (id) => { N.myPeer = id; if (!done) { done = true; cb(null); } });
    N.peer.on('error', (e) => { if (!done) { done = true; cb(e && e.type || 'error'); } });
    N.peer.on('connection', (conn) => {
      conn.on('data', (d) => {
        if (d && d.t === 'hello' && !conn.pid) { N.onMsg(null, d, conn); return; }
        if (conn.pid) N.onMsg(conn.pid, d);
      });
      conn.on('close', () => { if (conn.pid) { delete N.conns[conn.pid]; N.onLeave(conn.pid); } });
    });
    N.peer.on('call', N.answer);
  };
  N.accept = function (conn, pid) { conn.pid = pid; N.conns[pid] = conn; };

  N.join = function (code, cb) {
    N.close();
    if (!Peer()) { cb('nopeer'); return; }
    N.role = 'client';
    const P = Peer();
    N.peer = new P();
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; cb('timeout'); } }, 15000);
    N.peer.on('open', (id) => {
      N.myPeer = id;
      const conn = N.peer.connect(PREFIX + code.toLowerCase(), { reliable: true });
      N.conn = conn;
      conn.on('open', () => { if (!done) { done = true; clearTimeout(to); cb(null); } });
      conn.on('data', (d) => N.onMsg('h', d));
      conn.on('close', () => N.onLeave('h'));
    });
    N.peer.on('error', (e) => { if (!done) { done = true; clearTimeout(to); cb(e && e.type || 'error'); } });
    N.peer.on('call', N.answer);
  };

  N.send = function (m) { if (N.conn && N.conn.open !== false) try { N.conn.send(m); } catch (e) { } };
  N.sendTo = function (pid, m) { const c = N.conns[pid]; if (c) try { c.send(m); } catch (e) { } };
  N.broadcast = function (m) { for (const pid in N.conns) N.sendTo(pid, m); };

  // ---------- voice: every player with a mic calls every other player (one-way streams) ----------
  N.answer = function (call) {
    try { call.answer(); } catch (e) { return; }
    const pid = call.metadata && call.metadata.pid;
    call.on('stream', (s) => N.onStream(pid, s));
  };
  N.callAll = function (roster, myPid, stream) {
    if (!stream || !N.peer || !N.peer.call) return;
    for (const r of roster) {
      if (r.id === myPid || !r.peer || N.calls[r.peer]) continue;
      try { const c = N.peer.call(r.peer, stream, { metadata: { pid: myPid } }); if (c) N.calls[r.peer] = c; } catch (e) { }
    }
  };

  N.close = function () {
    try { if (N.peer) N.peer.destroy(); } catch (e) { }
    N.peer = null; N.conns = {}; N.conn = null; N.calls = {}; N.role = null;
  };
};
