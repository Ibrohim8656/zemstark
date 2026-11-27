'use strict';
/* Zemstark ma'lumotlar ombori.
   - Node.js'da o'rnatilgan SQLite (node:sqlite) mavjud bo'lsa: data.sqlite, faqat o'zgargan yozuvlar yoziladi.
   - Aks holda (eski Node yoki STORE=json): data.json.
   - Har kuni avtomatik zaxira nusxa: backups/ papkasi, oxirgi KEEP_BACKUPS (standart 14) tasi saqlanadi.
   - STORE=libsql: masofaviy Turso (libSQL) bazasi, HTTP orqali. Bepul hostinglar uchun (Render va h.k.),
     ularda disk har qayta ishga tushganda o'chib ketadi. Yuklangan fayllar ham shu bazada bo'laklab saqlanadi. */
const fs = require('fs'), path = require('path');

const COLL = {
  users: x => x.id, classes: x => x.id, members: x => x.cid + ':' + x.uid, works: x => x.id, subs: x => x.id,
  posts: x => x.id, starts: x => x.wid + ':' + x.uid, vocab: x => x.wid + ':' + x.uid
};
const OBJ = ['files', 'sessions', 'meta'];

function loadSqlite() {
  if (process.env.STORE === 'json') return null;
  const orig = process.emitWarning;
  process.emitWarning = function (w, ...a) { if (String(w && w.message || w).includes('SQLite')) return; return orig.call(process, w, ...a); };
  try { return require('node:sqlite'); } catch (e) { return null; }
}

// ---------- Turso / libSQL (HTTP) ----------
function libsqlClient(url, token) {
  const base = String(url || '').trim().replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base) || !token) throw new Error('STORE=libsql uchun LIBSQL_URL va LIBSQL_TOKEN kerak');
  const arg = v => v == null ? { type: 'null' } : Buffer.isBuffer(v) ? { type: 'blob', base64: v.toString('base64') } : typeof v === 'number' ? { type: 'integer', value: String(Math.trunc(v)) } : { type: 'text', value: String(v) };
  async function run(stmts, tries = 3) {
    for (let a = 1; ; a++) {
      try {
        const r = await fetch(base + '/v2/pipeline', { method: 'POST', signal: AbortSignal.timeout(90000),
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
          body: JSON.stringify({ requests: [...stmts.map(x => ({ type: 'execute', stmt: { sql: x[0], args: (x[1] || []).map(arg) } })), { type: 'close' }] }) });
        const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
        if (!r.ok || !j || !Array.isArray(j.results)) { const e = new Error('Turso ' + r.status + ': ' + String((j && (j.error || j.message)) || t).slice(0, 200)); e.fatal = r.status === 401 || r.status === 403 || r.status === 404; throw e; }
        return j.results.slice(0, stmts.length).map(x => {
          if (x.type !== 'ok') throw Object.assign(new Error('Turso: ' + ((x.error && x.error.message) || 'xato')), { fatal: true });
          const res = x.response.result || {}, cols = (res.cols || []).map(c => c.name);
          return (res.rows || []).map(row => Object.fromEntries(row.map((c, i) => [cols[i], c.type === 'blob' ? Buffer.from(c.base64 || '', 'base64') : c.type === 'integer' ? Number(c.value) : c.value ?? null])));
        });
      } catch (e) {
        if (e.fatal || a >= tries) throw e;
        await new Promise(ok => setTimeout(ok, 1000 * a));
      }
    }
  }
  return { run };
}
async function openLibsql(emptyDb) {
  const c = libsqlClient(process.env.LIBSQL_URL, process.env.LIBSQL_TOKEN);
  await c.run([
    ['CREATE TABLE IF NOT EXISTS docs(coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(coll, id)) WITHOUT ROWID'],
    ['CREATE TABLE IF NOT EXISTS blobs(fid TEXT NOT NULL, idx INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY(fid, idx)) WITHOUT ROWID'],
    ['CREATE TABLE IF NOT EXISTS snapshots(day TEXT PRIMARY KEY, data TEXT NOT NULL)']]);
  const db = emptyDb(), cache = new Map();
  // sahifalab o'qish (katta javoblardan saqlanish uchun)
  let last = ['', ''];
  for (;;) {
    const [rows] = await c.run([['SELECT coll, id, data FROM docs WHERE (coll, id) > (?, ?) ORDER BY coll, id LIMIT 2000', last]]);
    for (const r of rows) {
      let v; try { v = JSON.parse(r.data); } catch (e) { console.error('Buzilgan yozuv o‘tkazib yuborildi:', r.coll, r.id); continue; }
      if (COLL[r.coll]) db[r.coll].push(v); else if (OBJ.includes(r.coll)) db[r.coll][r.id] = v; else continue;
      cache.set(r.coll + '\u0000' + r.id, r.data);
    }
    if (rows.length < 2000) break;
    last = [rows[rows.length - 1].coll, rows[rows.length - 1].id];
  }
  let busy = null, again = false;
  async function flushOnce() {
    const ops = [], next = new Map(), seen = new Set();
    const put = (coll, id, v) => { const k = coll + '\u0000' + id, j = JSON.stringify(v); seen.add(k); if (cache.get(k) !== j) { ops.push(['INSERT INTO docs(coll, id, data) VALUES(?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data', [coll, id, j]]); next.set(k, j); } };
    for (const [coll, key] of Object.entries(COLL)) for (const x of db[coll] || []) put(coll, String(key(x)), x);
    for (const coll of OBJ) for (const [id, v] of Object.entries(db[coll] || {})) put(coll, id, v);
    for (const k of cache.keys()) if (!seen.has(k)) { const [cl, id] = k.split('\u0000'); ops.push(['DELETE FROM docs WHERE coll = ? AND id = ?', [cl, id]]); next.set(k, null); }
    if (!ops.length) return 0;
    for (let i = 0; i < ops.length; i += 300) await c.run([['BEGIN'], ...ops.slice(i, i + 300), ['COMMIT']]);
    for (const [k, v] of next) if (v === null) cache.delete(k); else cache.set(k, v);
    return ops.length;
  }
  const flush = () => {
    if (busy) { again = true; return busy; }
    busy = (async () => { try { do { again = false; await flushOnce(); } while (again); } finally { busy = null; } })();
    return busy;
  };
  const CH = 512 * 1024;
  const files = {
    async put(fid, buf) { const ops = []; for (let i = 0, n = 0; i < buf.length; i += CH, n++) ops.push(['INSERT OR REPLACE INTO blobs(fid, idx, data) VALUES(?, ?, ?)', [fid, n, buf.subarray(i, i + CH)]]); for (let i = 0; i < ops.length; i += 6) await c.run(ops.slice(i, i + 6)); },
    async get(fid) { const parts = []; for (let n = 0; ; n += 8) { const [rows] = await c.run([['SELECT idx, data FROM blobs WHERE fid = ? AND idx >= ? ORDER BY idx LIMIT 8', [fid, n]]]); parts.push(...rows.map(r => r.data)); if (rows.length < 8) break; } return parts.length ? Buffer.concat(parts) : null; }
  };
  const backupNow = async () => {
    const day = new Date().toISOString().slice(0, 10);
    const [have] = await c.run([['SELECT day FROM snapshots WHERE day = ?', [day]]]); if (have.length) return null;
    const { sessions, ...rest } = db;
    const keep = Math.max(1, +process.env.KEEP_BACKUPS || 7);
    await c.run([['INSERT INTO snapshots(day, data) VALUES(?, ?)', [day, JSON.stringify(rest)]], ['DELETE FROM snapshots WHERE day NOT IN (SELECT day FROM snapshots ORDER BY day DESC LIMIT ?)', [keep]]]);
    return 'Turso snapshots/' + day;
  };
  let timer = null;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => { timer = null; flush().catch(e => { console.error('Saqlashda xato (Turso):', e.message); setTimeout(save, 5000); }); }, 400); };
  const close = async () => { clearTimeout(timer); try { await flush(); } catch (e) { console.error('Saqlashda xato (Turso):', e.message); } };
  return { db, flush, save, close, backupNow, backups: () => [], files, kind: 'libsql', ext: '', file: String(process.env.LIBSQL_URL).replace(/\?.*$/, '') };
}

function openStore(dir, emptyDb) {
  if (process.env.STORE === 'libsql') return openLibsql(emptyDb);
  fs.mkdirSync(dir, { recursive: true });
  const JSONF = path.join(dir, 'data.json'), SQLF = path.join(dir, 'data.sqlite'), BK = path.join(dir, 'backups');
  const sqlite = loadSqlite();
  const readJsonFile = () => {
    try { return Object.assign(emptyDb(), JSON.parse(fs.readFileSync(JSONF, 'utf8'))); }
    catch (e) { if (e.code === 'ENOENT') return null; console.error('data.json o‘qilmadi — fayl buzilgan bo‘lishi mumkin. Server to‘xtatildi, hech narsa o‘zgartirilmadi:', e.message); process.exit(1); }
  };
  let st;
  if (sqlite) {
    const d = new sqlite.DatabaseSync(SQLF);
    d.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; CREATE TABLE IF NOT EXISTS docs(coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(coll, id)) WITHOUT ROWID;');
    const rows = d.prepare('SELECT coll, id, data FROM docs').all();
    const cache = new Map(); let db = emptyDb(), migrated = false;
    if (rows.length) {
      for (const r of rows) {
        let v; try { v = JSON.parse(r.data); } catch (e) { console.error('Buzilgan yozuv o‘tkazib yuborildi:', r.coll, r.id); continue; }
        if (COLL[r.coll]) db[r.coll].push(v); else if (OBJ.includes(r.coll)) db[r.coll][r.id] = v; else db[r.coll] = v;
        cache.set(r.coll + '\u0000' + r.id, r.data);
      }
    } else { const j = readJsonFile(); if (j) { db = j; migrated = true; } }
    const up = d.prepare('INSERT INTO docs(coll, id, data) VALUES(?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data');
    const del = d.prepare('DELETE FROM docs WHERE coll = ? AND id = ?');
    const flush = () => {
      const seen = new Set(); let changes = 0;
      d.exec('BEGIN');
      try {
        const put = (coll, id, v) => { const k = coll + '\u0000' + id, j = JSON.stringify(v); seen.add(k); if (cache.get(k) !== j) { up.run(coll, id, j); cache.set(k, j); changes++; } };
        for (const [coll, key] of Object.entries(COLL)) for (const x of db[coll] || []) put(coll, String(key(x)), x);
        for (const coll of OBJ) for (const [id, v] of Object.entries(db[coll] || {})) put(coll, id, v);
        for (const k of [...cache.keys()]) if (!seen.has(k)) { const [c, id] = k.split('\u0000'); del.run(c, id); cache.delete(k); changes++; }
        d.exec('COMMIT');
      } catch (e) { d.exec('ROLLBACK'); throw e; }
      return changes;
    };
    const backup = file => { fs.rmSync(file, { force: true }); d.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); };
    st = { db, flush, backup, kind: 'sqlite', ext: '.sqlite', file: SQLF };
    if (migrated) { flush(); fs.renameSync(JSONF, JSONF + '.migrated'); console.log('data.json SQLite bazasiga ko‘chirildi (eski fayl: data.json.migrated)'); }
  } else {
    const db = readJsonFile() || emptyDb();
    const flush = () => { fs.writeFileSync(JSONF + '.tmp', JSON.stringify(db)); fs.renameSync(JSONF + '.tmp', JSONF); return 1; };
    const backup = file => { if (fs.existsSync(JSONF)) fs.copyFileSync(JSONF, file); };
    st = { db, flush, backup, kind: 'json', ext: '.json', file: JSONF };
  }
  // kechiktirilgan yozish
  let timer = null;
  st.save = () => { clearTimeout(timer); timer = setTimeout(() => { timer = null; try { st.flush(); } catch (e) { console.error('Saqlashda xato:', e); } }, 250); };
  st.close = () => { clearTimeout(timer); try { st.flush(); } catch (e) { console.error('Saqlashda xato:', e); } };
  // kunlik zaxira
  const keep = Math.max(1, +process.env.KEEP_BACKUPS || 14);
  st.backupNow = () => {
    fs.mkdirSync(BK, { recursive: true });
    const day = new Date().toISOString().slice(0, 10), f = path.join(BK, `zemstark-${day}${st.ext}`);
    if (fs.existsSync(f)) return null;
    st.close(); st.backup(f);
    const old = fs.readdirSync(BK).filter(x => /^zemstark-\d{4}-\d{2}-\d{2}\.(sqlite|json)$/.test(x)).sort();
    old.slice(0, Math.max(0, old.length - keep)).forEach(x => fs.rmSync(path.join(BK, x), { force: true }));
    return f;
  };
  st.backups = () => { try { return fs.readdirSync(BK).filter(x => x.startsWith('zemstark-')).sort().reverse(); } catch (e) { return []; } };
  return st;
}
module.exports = { openStore, libsqlClient };
