'use strict';
// Parolni tiklash (administrator uchun). Server to'xtatilgan holatda ishlating:
//   DATA_DIR=/var/lib/zemstark node reset-password.js <email yoki login>
// Serverda buni deploy/reset-password.sh avtomatik bajaradi.
// Turso (STORE=libsql) bilan: STORE=libsql LIBSQL_URL=... LIBSQL_TOKEN=... node reset-password.js <email>
// (bepul hostingda serverni qayta ishga tushiring — Render: Manual Deploy → Restart).
const crypto = require('crypto');
const { openStore } = require('./store');
const { emptyDb } = require('./core');
const id = String(process.argv[2] || '').trim().toLowerCase();
if (!id) { console.error('Ishlatish: node reset-password.js <email yoki login>'); process.exit(1); }
(async () => {
const store = await openStore(process.env.DATA_DIR || __dirname, emptyDb);
const u = store.db.users.find(x => x.email === id || x.login === id);
if (!u) { console.error('Bunday foydalanuvchi topilmadi: ' + id); await store.close(); process.exit(2); }
const CH = 'abcdefghjkmnpqrstuvwxyz23456789';
const pw = Array.from({ length: 10 }, () => CH[crypto.randomInt(CH.length)]).join('');
const s = crypto.randomBytes(16).toString('hex');
u.pw = s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); u.mustChange = true; u.pwAt = Date.now();
for (const [k, v] of Object.entries(store.db.sessions)) if (v.uid === u.id) delete store.db.sessions[k];
await store.close();
console.log(`${u.name} (${u.role === 'teacher' ? 'o‘qituvchi' : 'o‘quvchi'}) uchun vaqtinchalik parol: ${pw}\nBirinchi kirishda yangi parol so‘raladi.`);
})().catch(e => { console.error(e.message); process.exit(1); });
