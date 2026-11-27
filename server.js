'use strict';
// Zemstark server — qo'shimcha kutubxonasiz (Node.js >= 18)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { createCore, emptyDb, HttpErr, bad, str, aiPrompt, aiNormalize } = require('./core');
const { openStore } = require('./store');
const { createTelegram } = require('./telegram');
const ZemImport = require('./public/qimport.js');

const PORT = +process.env.PORT || 3000, HOST = process.env.HOST || '0.0.0.0';
const BASE = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GID = process.env.GOOGLE_CLIENT_ID, GSEC = process.env.GOOGLE_CLIENT_SECRET;
const TCODE = process.env.TEACHER_CODE || '';
const DATA = process.env.DATA_DIR || __dirname;
const UP = path.join(DATA, 'uploads');
const MAXUP = 60 * 1024 * 1024, SESSION_MS = 14 * 864e5;
// AI: Groq (bepul), Google Gemini (bepul limit bilan), Anthropic yoki boshqa OpenAI-mos xizmat.
// Kalit turi uning boshlanishidan aniqlanadi: gsk_ — Groq, AIza — Gemini, sk-ant- — Anthropic.
const AI = (() => {
  const E = process.env, key = E.AI_KEY || E.GROQ_API_KEY || E.GEMINI_API_KEY || E.ANTHROPIC_API_KEY || '';
  if (!key) return null;
  const kind = E.AI_PROVIDER || (/^gsk_/.test(key) || (!E.AI_KEY && E.GROQ_API_KEY) ? 'groq' : /^AIza/.test(key) || (!E.AI_KEY && !E.GROQ_API_KEY && E.GEMINI_API_KEY) ? 'gemini'
    : /^sk-ant-/.test(key) || (!E.AI_KEY && E.ANTHROPIC_API_KEY) ? 'anthropic' : 'openai');
  const D = { groq: ['https://api.groq.com/openai/v1/chat/completions', 'openai/gpt-oss-120b'], gemini: ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-2.5-flash'],
    anthropic: ['https://api.anthropic.com/v1/messages', 'claude-sonnet-5-5'], openai: ['https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'] }[kind] || ['', ''];
  return { key, kind, url: E.AI_URL || D[0], model: E.AI_MODEL || D[1] };
})();
const AI_OFF = 'AI yordamchi sozlanmagan: serverga AI kalitini kiriting (masalan, bepul Groq kaliti — README, 9-bo‘lim)';
async function aiText(prompt, maxTokens, timeoutMs) {
  if (!AI) bad(400, AI_OFF);
  const anth = AI.kind === 'anthropic';
  const r = await fetch(AI.url, { method: 'POST', signal: AbortSignal.timeout(timeoutMs || 120000),
    headers: anth ? { 'content-type': 'application/json', 'x-api-key': AI.key, 'anthropic-version': '2023-06-01' } : { 'content-type': 'application/json', authorization: 'Bearer ' + AI.key },
    body: JSON.stringify(anth ? { model: AI.model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }
      : { model: AI.model, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: 'user', content: prompt }] }) }).catch(() => bad(502, 'AI xizmatiga ulanib bo‘lmadi'));
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) bad(429, 'AI so‘rovlari ko‘payib ketdi, birozdan keyin urinib ko‘ring');
  if (!r.ok) { const e = Array.isArray(j) ? j[0] && j[0].error : j.error; bad(502, 'AI xatosi: ' + ((e && (e.message || e)) || r.status)); }
  const t = anth ? (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('') : ((j.choices || [])[0] || {}).message?.content || '';
  if (!t) bad(502, 'AI javob bermadi');
  return t;
}
const TGTOKEN = process.env.TELEGRAM_BOT_TOKEN || '', TGAPI = process.env.TELEGRAM_API || '';
const CAMERA = !/^(off|0|false|no)$/i.test(process.env.PROCTOR_CAMERA || '');
fs.mkdirSync(UP, { recursive: true });

(async () => {
const store = await openStore(DATA, emptyDb);
const db = store.db, save = store.save;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { Promise.resolve(store.close()).finally(() => process.exit(0)); });
// masofaviy baza (Turso) bo'lsa, yuklangan fayllar u yerda ham saqlanadi; mahalliy disk — kesh
const remote = store.files || null;
const pushFile = (fid, fp) => remote ? remote.put(fid, fs.readFileSync(fp)) : Promise.resolve();

const hash = (p, s = crypto.randomBytes(16).toString('hex')) => s + ':' + crypto.scryptSync(p, s, 32).toString('hex');
const check = (p, h) => { try { const [s, x] = String(h).split(':'); if (!s || !x) return false; const A = Buffer.from(x, 'hex'), B = Buffer.from(hash(p, s).split(':')[1], 'hex'); return A.length === B.length && crypto.timingSafeEqual(A, B); } catch (e) { return false; } };
const PWCH = 'abcdefghjkmnpqrstuvwxyz23456789';
const tempPw = () => Array.from({ length: 8 }, () => PWCH[crypto.randomInt(PWCH.length)]).join('');
let curSid = null; // joriy so'rov sessiyasi (core.route sinxron chaqiriladi)
function dropSessions(uid, keepCurrent) {
  for (const [k, v] of Object.entries(db.sessions)) if (v.uid === uid && !(keepCurrent && k === curSid)) { delete db.sessions[k]; delete gtok[k]; }
}

function saveSnap(img, uid) {
  try {
    const buf = Buffer.from(String(img).split(',')[1] || '', 'base64'); if (!buf.length || buf.length > 60000) return null;
    const fid = crypto.randomBytes(10).toString('hex'); fs.writeFileSync(path.join(UP, fid), buf);
    if (remote) remote.put(fid, buf).catch(e => console.error('Surat bazaga yozilmadi:', e.message));
    db.files[fid] = { uid, name: 'kamera.jpg', type: 'image/jpeg', size: buf.length, at: Date.now(), snap: true }; return fid;
  } catch (e) { return null; }
}
const core = createCore(db, { id: () => crypto.randomBytes(5).toString('hex'), now: Date.now, save, saveSnap, hash, check, tempPw, dropSessions,
  fileOk: (fid, uid) => !!db.files[fid] && (!uid || db.files[fid].uid === uid) });
// muddati o'tgan sessiyalarni tozalash
const cleanSessions = () => { const now = Date.now(); let n = 0; for (const [k, v] of Object.entries(db.sessions)) if (now - v.at > SESSION_MS) { delete db.sessions[k]; n++; } if (n) save(); };
cleanSessions(); setInterval(cleanSessions, 3600e3).unref();
save();
const tg = createTelegram({ token: TGTOKEN, api: TGAPI, db, save, base: BASE, tz: process.env.TZ_NAME });
if (tg) tg.start();
// kunlik zaxira: ishga tushgandan 1 daqiqa o'tib va har 6 soatda tekshiriladi (kuniga bitta nusxa)
const doBackup = () => Promise.resolve().then(() => store.backupNow()).then(f => { if (f) console.log('Zaxira nusxa olindi:', f); }).catch(e => console.error('Zaxira nusxa olinmadi:', e.message));
setTimeout(doBackup, 60000).unref(); setInterval(doBackup, 6 * 3600e3).unref();

const fails = {}, gtok = {};

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
const cookie = t => `sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${BASE.startsWith('https') ? '; Secure' : ''}`;
function startSession(res, uid) {
  const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = { uid, at: Date.now() }; curSid = t;
  res.setHeader('Set-Cookie', cookie(t)); save();
}
const ipOf = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
function limit(key, max) {
  const f = fails[key] || (fails[key] = { n: 0, t: Date.now() });
  if (Date.now() - f.t > 6e5) { f.n = 0; f.t = Date.now(); }
  if (f.n >= max) bad(429, 'Juda ko‘p urinish. 10 daqiqadan keyin qayta urinib ko‘ring');
  return f;
}
function readJson(req) {
  return new Promise((ok, no) => {
    let n = 0; const ch = [];
    req.on('data', c => { n += c.length; if (n > 15e6) { no(new HttpErr(413, 'So‘rov hajmi juda katta')); req.destroy(); } else ch.push(c); });
    req.on('end', () => { if (!ch.length) return ok({}); try { ok(JSON.parse(Buffer.concat(ch))); } catch { no(new HttpErr(400, 'JSON noto‘g‘ri')); } });
    req.on('error', no);
  });
}

const OKTYPE = /^(audio\/[\w.+-]+|image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.[\w.]+|application\/vnd\.ms-(excel|powerpoint)|text\/plain)$/;
async function upload(req, u, q) {
  if (!u) bad(401, 'Tizimga kiring');
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!OKTYPE.test(type)) bad(415, 'Bu turdagi faylni yuklab bo‘lmaydi (PDF, Word, rasm, audio yoki video bo‘lsin)');
  const fid = crypto.randomBytes(10).toString('hex'), fp = path.join(UP, fid);
  let size = 0;
  await new Promise((ok, no) => {
    const out = fs.createWriteStream(fp); let dead = false;
    const fail = e => { if (dead) return; dead = true; out.destroy(); fs.rm(fp, { force: true }, () => {}); no(e); };
    req.on('data', c => { if (dead) return; size += c.length; if (size > MAXUP) { fail(new HttpErr(413, 'Fayl hajmi 60 MB dan oshmasin')); req.resume(); return; } if (!out.write(c)) { req.pause(); out.once('drain', () => req.resume()); } });
    req.on('end', () => { if (!dead) out.end(); });
    req.on('error', fail); out.on('error', fail); out.on('finish', () => { if (!dead) ok(); });
  });
  if (!size) { fs.rmSync(fp, { force: true }); bad(400, 'Fayl bo‘sh'); }
  try { await pushFile(fid, fp); } catch (e) { fs.rmSync(fp, { force: true }); console.error('Fayl bazaga yozilmadi:', e.message); bad(502, 'Faylni saqlab bo‘lmadi, qaytadan urinib ko‘ring'); }
  const name = str(q.get('name'), 150) || 'fayl';
  db.files[fid] = { uid: u.id, name, type, size, at: Date.now() }; save();
  return { fid, name, type, size };
}
async function sendFile(req, res, u, fid) {
  if (!u) { res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Tizimga kiring'); }
  const f = db.files[fid], fp = path.join(UP, fid);
  let st; try { st = fs.statSync(fp); } catch { st = null; }
  if (f && !st && remote) { // disk tozalangan bo'lsa, bazadan qayta tiklanadi
    try { const buf = await remote.get(fid); if (buf) { fs.writeFileSync(fp + '.tmp', buf); fs.renameSync(fp + '.tmp', fp); st = fs.statSync(fp); } } catch (e) { console.error('Fayl bazadan o‘qilmadi:', e.message); }
  }
  if (!f || !st) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Fayl topilmadi'); }
  if (f.snap && u.role !== 'teacher' && u.id !== f.uid) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Ruxsat yo‘q'); }
  const inline = /^(audio|image|video)\/|^application\/pdf$/.test(f.type);
  const h = { 'Content-Type': f.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}` };
  const size = st.size, r = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (r && (r[1] !== '' || r[2] !== '')) {
    const s = r[1] === '' ? Math.max(0, size - Number(r[2])) : Number(r[1]);
    const e = r[1] === '' || r[2] === '' ? size - 1 : Math.min(Number(r[2]), size - 1);
    if (s > e || s >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Content-Length': e - s + 1 });
    return fs.createReadStream(fp, { start: s, end: e }).pipe(res);
  }
  res.writeHead(200, { ...h, 'Content-Length': size });
  fs.createReadStream(fp).pipe(res);
}

async function gget(url, tok) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
  if (r.status === 401) bad(401, 'Google ulanishi muddati tugagan. Qayta ulaning');
  if (!r.ok) bad(502, 'Google API xatosi ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function gall(url, key, tok) {
  const all = []; let pt = '';
  do { const j = await gget(url + (url.includes('?') ? '&' : '?') + 'pageSize=100' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), tok); all.push(...(j[key] || [])); pt = j.nextPageToken || ''; } while (pt);
  return all;
}

async function api(req, res, u, sid, p, q, b) {
  const m = req.method;
  if (m === 'GET' && p === '/health') return { ok: true, up: Math.round(process.uptime()), store: store.kind };
  if (m === 'GET' && p === '/config') return { camera: CAMERA, teacherCode: !!TCODE, google: !!(GID && GSEC), ai: AI ? 'server' : false, aiProvider: AI ? AI.kind : '', fetchAudio: true, store: store.kind, telegram: tg ? (tg.username || true) : false };
  if (m === 'GET' && p === '/me') return { user: u ? core.self(u) : null };
  if (m === 'POST' && p === '/register') {
    limit('reg:' + ipOf(req), 20).n++;
    const name = str(b.name, 60), email = str(b.email, 120).toLowerCase(), pw = String(b.password || ''), role = b.role === 'teacher' ? 'teacher' : 'student';
    if (!name) bad(400, 'Ism-familiyangizni kiriting');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad(400, 'Email manzil noto‘g‘ri');
    if (pw.length < 6) bad(400, 'Parol kamida 6 belgidan iborat bo‘lsin');
    if (pw.length > 200) bad(400, 'Parol juda uzun');
    if (role === 'teacher' && TCODE && b.teacherCode !== TCODE) bad(403, 'O‘qituvchi kodi noto‘g‘ri');
    if (core.taken(email)) bad(409, 'Bu email bilan hisob allaqachon bor');
    const us = { id: crypto.randomBytes(5).toString('hex'), name, email, role, pw: hash(pw), created: Date.now(), lang: ['uz', 'ru', 'en'].includes(b.lang) ? b.lang : '' };
    db.users.push(us); startSession(res, us.id); return core.self(us);
  }
  if (m === 'POST' && p === '/login') {
    const id = str(b.email, 120).toLowerCase(), f = limit('id:' + id, 8), fi = limit('ip:' + ipOf(req), 40);
    const us = core.findUser(id);
    if (!us || !check(String(b.password || ''), us.pw)) { f.n++; fi.n++; bad(401, 'Email/login yoki parol noto‘g‘ri'); }
    delete fails['id:' + id]; startSession(res, us.id);
    if (['uz', 'ru', 'en'].includes(b.lang) && !us.lang) { us.lang = b.lang; save(); }
    return core.self(us);
  }
  if (m === 'POST' && p === '/logout') { if (sid) { delete db.sessions[sid]; delete gtok[sid]; } res.setHeader('Set-Cookie', 'sid=; Max-Age=0; Path=/'); save(); return { ok: 1 }; }
  if (!u) bad(401, 'Tizimga kiring');
  if (m === 'POST' && p === '/me/password') limit('pw:' + u.id, 10).n++;

  // ---- Telegram ----
  if (p === '/telegram/link' && m === 'POST') {
    if (!tg) bad(400, 'Telegram bot sozlanmagan (README, Telegram bo‘limi)');
    const url = tg.linkUrl(u.id); if (!url) bad(502, 'Telegram botiga ulanib bo‘lmadi. Birozdan keyin urinib ko‘ring');
    return { url };
  }
  if (p === '/telegram/unlink' && m === 'POST') { if (tg) tg.unlink(u); else { delete u.tg; save(); } return core.self(u); }

  // ---- audio havolani serverga saqlash ----
  if (p === '/fetch-audio' && m === 'POST') {
    if (u.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    let url; try { url = new URL(String(b.url || '')); } catch (e) { bad(400, 'Havola noto‘g‘ri'); }
    if (!/^https?:$/.test(url.protocol) || (!process.env.ZEM_TEST_LOCAL && /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname))) bad(400, 'Bu havoladan yuklab bo‘lmaydi');
    let r; try { r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Zemstark audio import)' }, signal: AbortSignal.timeout(120000) }); } catch (e) { bad(502, 'Audio yuklanmadi: sayt javob bermadi'); }
    if (!r.ok) bad(502, `Audio yuklanmadi: sayt ${r.status} xato qaytardi`);
    const extType = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', aac: 'audio/aac', webm: 'audio/webm' };
    const ext = (/\.([a-z0-9]{2,4})$/i.exec(url.pathname) || [])[1] || '';
    let type = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^audio\//.test(type)) type = extType[ext.toLowerCase()] || '';
    if (!type) bad(415, 'Bu havola audio faylga olib bormaydi');
    if (+r.headers.get('content-length') > MAXUP) bad(413, 'Audio 60 MB dan katta');
    const fid = crypto.randomBytes(10).toString('hex'), fp = path.join(UP, fid); let size = 0;
    const out = fs.createWriteStream(fp);
    try {
      for await (const ch of r.body) { size += ch.length; if (size > MAXUP) throw new HttpErr(413, 'Audio 60 MB dan katta'); if (!out.write(ch)) await new Promise(ok => out.once('drain', ok)); }
      await new Promise((ok, no) => { out.end(ok); out.on('error', no); });
    } catch (e) { out.destroy(); fs.rmSync(fp, { force: true }); throw e instanceof HttpErr ? e : new HttpErr(502, 'Audio yuklanmadi: ' + e.message); }
    if (!size) { fs.rmSync(fp, { force: true }); bad(502, 'Audio bo‘sh keldi'); }
    try { await pushFile(fid, fp); } catch (e) { fs.rmSync(fp, { force: true }); bad(502, 'Audioni saqlab bo‘lmadi, qaytadan urinib ko‘ring'); }
    const name = str(b.name, 120) || decodeURIComponent(url.pathname.split('/').pop() || 'audio').slice(0, 120);
    db.files[fid] = { uid: u.id, name, type, size, at: Date.now(), src: String(url).slice(0, 800) }; save();
    return { fid, name, type, size };
  }
  // ---- Google Forms import (ochiq forma sahifasidan) ----
  if (p === '/import/gform' && m === 'POST') {
    if (u.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    limit('gf:' + u.id, 30).n++;
    let url = str(b.url, 600).replace(/\/(edit|viewanalytics|prefill)(\?.*)?(#.*)?$/, '/viewform');
    if (!ZemImport.GFORM_RE.test(url)) bad(400, 'Bu Google Forms havolasi emas. Havola docs.google.com/forms/… yoki forms.gle/… ko‘rinishida bo‘lishi kerak');
    let r; try { r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Zemstark import)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(30000) }); } catch (e) { bad(502, 'Google Forms sahifasi ochilmadi. Birozdan keyin urinib ko‘ring yoki sahifa kodini joylang'); }
    if (!/^https:\/\/docs\.google\.com\/forms\//.test(r.url)) bad(400, 'Forma yopiq — Google login so‘rayapti. Formada “Restrict to users in…” sozlamasini o‘chiring yoki sahifa kodini joylang');
    if (!r.ok) bad(502, `Google Forms ${r.status} xato qaytardi`);
    const html = (await r.text()).slice(0, 6e6);
    try { return ZemImport.fromGForm(html); } catch (e) { bad(422, e.message); }
  }
  // ---- AI: savollar yaratish ----
  if (p === '/ai/generate' && m === 'POST') {
    if (u.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    if (!AI) bad(400, AI_OFF);
    limit('aig:' + u.id, 20).n++;
    const o = { text: String(b.text || '').slice(0, 15000), topic: str(b.topic, 500), types: Array.isArray(b.types) ? b.types.map(x => str(x, 10)) : ['mcq'], count: +b.count || 10, level: str(b.level, 30), ielts: !!b.ielts };
    if (!o.text.trim() && !o.topic) bad(400, 'Matn yoki mavzu kiriting');
    const t = await aiText(ZemImport.genPrompt(o), AI.kind === 'anthropic' ? 6000 : 4000, 180000);
    try { return { questions: ZemImport.genNormalize(t) }; } catch (e) { bad(502, e.message); }
  }
  // ---- AI: Writing bahosi (qoralama) ----
  if (p === '/ai/assess' && m === 'POST') {
    if (!AI) bad(400, AI_OFF);
    const d = core.route('GET', '/subs/' + str(b.sid, 20), u, {});
    if (d.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    const q = d.work.questions.find(x => x.id === b.qid && x.type === 'writing') || bad(404, 'Writing savoli topilmadi');
    return aiNormalize(await aiText(aiPrompt(d.work, q, d.sub.answers[q.id]), AI.kind === 'anthropic' ? 1500 : 2000), d.work, q);
  }
  // ---- Google Classroom ----
  if (p === '/google/start' && m === 'GET') {
    if (u.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    if (!GID || !GSEC) bad(400, 'Google sozlanmagan (README, 4-bo‘lim)');
    const st = crypto.randomBytes(12).toString('hex');
    db.sessions[sid].gstate = st; db.sessions[sid].gcid = str(q.get('cid'), 30); save();
    const scope = ['classroom.courses.readonly', 'classroom.coursework.students.readonly', 'classroom.courseworkmaterials.readonly', 'classroom.topics.readonly'].map(x => 'https://www.googleapis.com/auth/' + x).join(' ');
    res.writeHead(302, { Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: GID, redirect_uri: BASE + '/api/google/callback', response_type: 'code', scope, state: st, access_type: 'online', prompt: 'consent' }) });
    res.end(); return null;
  }
  if (p === '/google/callback' && m === 'GET') {
    const se = db.sessions[sid];
    if (!q.get('code') || !se.gstate || q.get('state') !== se.gstate) bad(400, 'Google javobi noto‘g‘ri. Qaytadan urinib ko‘ring');
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: q.get('code'), client_id: GID, client_secret: GSEC, redirect_uri: BASE + '/api/google/callback', grant_type: 'authorization_code' }) });
    const j = await r.json(); if (!r.ok) bad(502, 'Google token xatosi: ' + (j.error_description || j.error));
    gtok[sid] = j.access_token; delete se.gstate; save();
    res.writeHead(302, { Location: '/?g=1' + (/^\w+$/.test(se.gcid || '') ? '#c-' + se.gcid + '-settings' : '') }); res.end(); return null;
  }
  if (p === '/google/courses' && m === 'GET') {
    if (u.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    if (!gtok[sid]) bad(401, 'Google ulanmagan');
    const cs = await gall('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&courseStates=ARCHIVED', 'courses', gtok[sid]);
    return cs.map(c => ({ id: c.id, name: c.name, section: c.section || '', state: c.courseState }));
  }
  if (p === '/google/import' && m === 'POST') {
    if (u.role !== 'teacher') bad(403, 'Faqat o‘qituvchi uchun');
    if (!gtok[sid]) bad(401, 'Google ulanmagan');
    const c = db.classes.find(x => x.id === b.classId); if (!c || c.owner !== u.id) bad(403, 'Faqat o‘z sinfingizga import qila olasiz');
    const cid = encodeURIComponent(String(b.courseId)), base = `https://classroom.googleapis.com/v1/courses/${cid}`;
    const topics = Object.fromEntries((await gall(base + '/topics', 'topic', gtok[sid])).map(t => [t.topicId, t.name]));
    const work = await gall(base + '/courseWork', 'courseWork', gtok[sid]);
    let mats = []; try { mats = await gall(base + '/courseWorkMaterials', 'courseWorkMaterial', gtok[sid]); } catch (e) { if (e.c === 401) throw e; }
    const n1 = core.importWorks(c.id, work, topics), n2 = core.importWorks(c.id, mats, topics, 'material');
    return { imported: n1 + n2, works: n1, materials: n2 };
  }
  if (!CAMERA && m === 'POST' && /^\/works\/\w+\/submit$/.test(p)) b.snaps = [];
  return core.route(m, p, u, b, q);
}

// ---- statik fayllar: xotirada saqlanadi, ETag (304) va gzip bilan ----
const STATIC = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/htmlkit.js': ['htmlkit.js', 'text/javascript; charset=utf-8'], '/qimport.js': ['qimport.js', 'text/javascript; charset=utf-8'], '/i18n.js': ['i18n.js', 'text/javascript; charset=utf-8'],
  '/sw.js': ['sw.js', 'text/javascript; charset=utf-8'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/icon-192.png': ['icon-192.png', 'image/png'], '/icon-512.png': ['icon-512.png', 'image/png'], '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
const scache = new Map();
function sendStatic(req, res, f, type) {
  const fp = path.join(__dirname, 'public', f);
  let st; try { st = fs.statSync(fp); } catch (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Topilmadi'); }
  let c = scache.get(fp);
  if (!c || c.mtime !== st.mtimeMs) {
    const buf = fs.readFileSync(fp);
    c = { mtime: st.mtimeMs, buf, gz: /^(text|application)\/|svg/.test(type) ? zlib.gzipSync(buf, { level: 9 }) : null, etag: '"' + crypto.createHash('sha1').update(buf).digest('base64').slice(0, 20) + '"' };
    scache.set(fp, c);
  }
  const h = { 'Content-Type': type, 'Cache-Control': f.endsWith('.png') || f.endsWith('.svg') ? 'public, max-age=604800' : 'no-cache', ETag: c.etag, Vary: 'Accept-Encoding' };
  if (f === 'index.html') { h['X-Frame-Options'] = 'SAMEORIGIN'; h['Content-Security-Policy'] = "frame-ancestors 'self'; object-src 'none'"; }
  if (f === 'sw.js') h['Service-Worker-Allowed'] = '/';
  if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, h); return res.end(); }
  if (c.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', 'Content-Length': c.gz.length }); return res.end(req.method === 'HEAD' ? undefined : c.gz); }
  res.writeHead(200, { ...h, 'Content-Length': c.buf.length }); res.end(req.method === 'HEAD' ? undefined : c.buf);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), p = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
  const sid = ((req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]{48})/) || [])[1];
  let s = sid && db.sessions[sid];
  if (s && Date.now() - s.at > SESSION_MS) { delete db.sessions[sid]; s = null; save(); }
  const u = (s && db.users.find(x => x.id === s.uid)) || null;
  if (s && !u) { delete db.sessions[sid]; s = null; save(); }
  // faol foydalanuvchi sessiyasi kuniga bir marta uzaytiriladi (14 kun harakatsiz qolsa tugaydi)
  if (s && u && Date.now() - s.at > 864e5 && p.startsWith('/api/')) { s.at = Date.now(); res.setHeader('Set-Cookie', cookie(sid)); save(); }
  curSid = sid || null;
  try {
    if ((req.method === 'GET' || req.method === 'HEAD') && STATIC[p]) return sendStatic(req, res, ...STATIC[p]);
    const fm = p.match(/^\/files\/([a-f0-9]{20})$/);
    if (fm && req.method === 'GET') return await sendFile(req, res, u, fm[1]);
    if (!p.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Topilmadi'); }
    const ap = p.slice(4);
    if (ap === '/upload' && req.method === 'POST') return json(res, 200, await upload(req, u, url.searchParams));
    const b = req.method === 'POST' || req.method === 'DELETE' ? await readJson(req) : {};
    const r = await api(req, res, u, sid, ap, url.searchParams, b);
    if (r !== null) json(res, 200, r);
  } catch (e) {
    if (!(e instanceof HttpErr)) console.error(new Date().toISOString(), req.method, p, e);
    if (!res.headersSent) json(res, e.c || 500, { error: e.c ? e.message : 'Server xatosi' }); else res.end();
  }
});
server.listen(PORT, HOST, () => console.log(`Zemstark ishlayapti: ${BASE}\n  Ma’lumotlar: ${store.file} (${store.kind})\n  Kamera (autoproctor): ${CAMERA ? 'yoqilgan' : 'o‘chirilgan'}\n  AI yordamchi: ${AI ? 'yoqilgan (' + AI.kind + ', ' + AI.model + ')' : 'o‘chiq'}\n  Google import: ${GID && GSEC ? 'yoqilgan' : 'sozlanmagan'}\n  Telegram: ${tg ? 'yoqilgan' : 'sozlanmagan'}\n  O‘qituvchi kodi: ${TCODE ? 'talab qilinadi' : 'TALAB QILINMAYDI (TEACHER_CODE o‘rnating)'}`));
})().catch(e => { console.error('Server ishga tushmadi:', e.message); process.exit(1); });
