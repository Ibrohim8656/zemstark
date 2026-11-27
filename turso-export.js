'use strict';
// Turso (bepul hosting) dagi ma'lumotlarni VPS'dagi mahalliy bazaga ko'chirish.
// VPS'da, Zemstark o'rnatilgandan keyin, server to'xtatilgan holatda:
//   LIBSQL_URL=libsql://... LIBSQL_TOKEN=... DATA_DIR=/var/lib/zemstark node turso-export.js
// Serverda buni deploy/turso-import.sh avtomatik bajaradi.
const fs = require('fs'), path = require('path');
const { openStore, libsqlClient } = require('./store');
const { emptyDb } = require('./core');
(async () => {
  const c = libsqlClient(process.env.LIBSQL_URL, process.env.LIBSQL_TOKEN);
  const DATA = process.env.DATA_DIR || __dirname, UP = path.join(DATA, 'uploads');
  fs.mkdirSync(UP, { recursive: true });
  delete process.env.STORE;
  const local = await openStore(DATA, emptyDb);
  const db = local.db, keys = { users: 1, classes: 1, members: 1, works: 1, subs: 1, posts: 1, starts: 1, vocab: 1 };
  if (db.users.length) { console.error('Mahalliy bazada allaqachon ma’lumot bor — ustiga yozilmaydi. Bo‘sh DATA_DIR bilan ishlating.'); process.exit(2); }
  let last = ['', ''], n = 0;
  for (;;) {
    const [rows] = await c.run([['SELECT coll, id, data FROM docs WHERE (coll, id) > (?, ?) ORDER BY coll, id LIMIT 2000', last]]);
    for (const r of rows) { const v = JSON.parse(r.data); if (keys[r.coll]) db[r.coll].push(v); else if (['files', 'sessions', 'meta'].includes(r.coll)) db[r.coll][r.id] = v; n++; }
    if (rows.length < 2000) break; last = [rows[rows.length - 1].coll, rows[rows.length - 1].id];
  }
  let f = 0;
  for (const fid of Object.keys(db.files)) {
    const parts = [];
    for (let i = 0; ; i += 8) { const [rows] = await c.run([['SELECT data FROM blobs WHERE fid = ? AND idx >= ? ORDER BY idx LIMIT 8', [fid, i]]]); parts.push(...rows.map(r => r.data)); if (rows.length < 8) break; }
    if (parts.length) { fs.writeFileSync(path.join(UP, fid), Buffer.concat(parts)); f++; }
  }
  local.close();
  console.log(`Ko‘chirildi: ${n} ta yozuv, ${f} ta fayl. Foydalanuvchilar: ${db.users.length}, sinflar: ${db.classes.length}, vazifalar: ${db.works.length}.`);
})().catch(e => { console.error('Xato:', e.message); process.exit(1); });
