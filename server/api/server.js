// Máy chủ báo cáo dùng chung: camera, kẹt xe, tai nạn do người dùng báo.
// Không cần thư viện ngoài (Node 22, node:sqlite).
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DB || 'reports.db');
db.exec(`CREATE TABLE IF NOT EXISTS rp(id INTEGER PRIMARY KEY, kind TEXT, lat REAL, lon REAL, lim INTEGER, note TEXT,
  up INTEGER DEFAULT 1, down INTEGER DEFAULT 0, ip TEXT, t INTEGER, exp INTEGER);
  CREATE INDEX IF NOT EXISTS rp_ll ON rp(lat, lon);`);
const KINDS = { camera: 0, mobile: 3*3600e3, jam: 3600e3, accident: 2*3600e3, police: 2*3600e3 }; // 0 = không hết hạn
const hits = new Map();
const limited = ip => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60e3); a.push(now); hits.set(ip, a); return a.length > 20; };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let s = ''; req.on('data', d => { s += d; if (s.length > 4096) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(s)); } catch { r(null); } }); });
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && u.pathname === '/reports') {           // ?bbox=minLon,minLat,maxLon,maxLat
    const b = (u.searchParams.get('bbox') || '').split(',').map(Number);
    if (b.length !== 4 || b.some(isNaN) || (b[2]-b[0])*(b[3]-b[1]) > 1) return send(res, 400, { error: 'bbox' });
    const rows = db.prepare(`SELECT id,kind,lat,lon,lim,note,up,down,t FROM rp WHERE lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?
      AND (exp = 0 OR exp > ?) AND down < up + 3 LIMIT 500`).all(b[0], b[2], b[1], b[3], Date.now());
    return send(res, 200, { reports: rows });
  }
  if (req.method === 'POST' && u.pathname === '/reports') {
    if (limited(ip)) return send(res, 429, { error: 'Gửi quá nhanh' });
    const j = await body(req); if (!j || !(j.kind in KINDS) || !(Math.abs(j.lat) <= 90) || !(Math.abs(j.lon) <= 180)) return send(res, 400, { error: 'Dữ liệu sai' });
    const near = db.prepare(`SELECT id FROM rp WHERE kind=? AND ABS(lat-?)<0.0004 AND ABS(lon-?)<0.0004 AND (exp=0 OR exp>?)`).get(j.kind, j.lat, j.lon, Date.now());
    if (near) { db.prepare('UPDATE rp SET up=up+1, exp=CASE WHEN exp=0 THEN 0 ELSE ? END WHERE id=?').run(Date.now() + KINDS[j.kind], near.id); return send(res, 200, { id: near.id, merged: true }); }
    const r = db.prepare('INSERT INTO rp(kind,lat,lon,lim,note,ip,t,exp) VALUES(?,?,?,?,?,?,?,?)')
      .run(j.kind, j.lat, j.lon, j.limit | 0 || null, String(j.note || '').slice(0, 120), ip, Date.now(), KINDS[j.kind] ? Date.now() + KINDS[j.kind] : 0);
    return send(res, 200, { id: Number(r.lastInsertRowid) });
  }
  const m = u.pathname.match(/^\/reports\/(\d+)\/(up|down)$/);
  if (req.method === 'POST' && m) { if (limited(ip)) return send(res, 429, {}); db.prepare(`UPDATE rp SET ${m[2]}=${m[2]}+1 WHERE id=?`).run(+m[1]); return send(res, 200, { ok: true }); }
  send(res, 404, { error: 'Không có' });
}).listen(+process.env.PORT || 8080, () => console.log('API báo cáo đang chạy'));
