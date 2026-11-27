/* Zemstark core: vazifalar, savol turlari, tekshiruv va IELTS band hisobi.
   Node (server.js) va brauzer (demo) ikkalasida bir xil ishlaydi. */
(function (root) {
'use strict';

const SKILLS = ['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking', 'mixed'];
const IELTS_SKILLS = ['listening', 'reading', 'writing', 'speaking'];
const KINDS = ['homework', 'classwork', 'quiz', 'ielts', 'material', 'vocab'];
const NOSUB = new Set(['material', 'vocab']);
const LEITNER = [0, 1, 2, 4, 8, 16, 32];
const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'IELTS'];
const QTYPES = ['section', 'mcq', 'tfng', 'gap', 'short', 'match', 'order', 'writing', 'speaking', 'html'];
const OBJ = new Set(['mcq', 'tfng', 'gap', 'short', 'match', 'order', 'html']);
const HKIND = ['radio', 'check', 'select', 'text'];
const MAN = new Set(['writing', 'speaking']);
const RISK = { tab: 15, blur: 8, fs: 12, copy: 5, cut: 5, paste: 5, contextmenu: 3, key: 4, noface: 10, multi: 20, nav: 5, 'cam-fail': 10, 'fs-fail': 5, 'mic-fail': 3 };
// Taxminiy IELTS jadvallari: 40 ta savoldan to'g'ri javoblar soni -> band
const T_LIS = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [1, 1], [0, 0]];
const T_RAC = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [1, 1], [0, 0]];
const T_RGT = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0]];
const CRIT = ['a', 'b', 'c', 'd'];

class HttpErr extends Error { constructor(c, m) { super(m); this.c = c; } }
const bad = (c, m) => { throw new HttpErr(c, m); };
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const txt = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').slice(0, n);
const int = (v, lo, hi, d) => { if (v === '' || v == null) return d; const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const num = (v, lo, hi) => { if (v === '' || v == null) return null; const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
const half = x => Math.round(x * 2) / 2;
const floorHalf = x => Math.floor(x * 2 + 1e-9) / 2;
const r2 = x => Math.round(x * 100) / 100;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const norm = s => String(s ?? '').toLowerCase().replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ').trim().replace(/[.,!?;:]+$/, '').trim();
const words = s => (String(s || '').match(/\S+/g) || []).length;

function rng(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  if (!h) h = 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}
function shuffle(a, seed) { const r = rng(seed), b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function gapParse(text) {
  const parts = [], ans = [], re = /\{([^{}\n]*)\}/g; let last = 0, m;
  text = String(text || '');
  while ((m = re.exec(text))) { parts.push(text.slice(last, m.index)); ans.push(m[1].split('|').map(s => s.trim()).filter(Boolean)); last = re.lastIndex; }
  parts.push(text.slice(last));
  return { parts, ans };
}
function bandFromRaw(correct, units, skill, module) {
  if (!units) return null;
  const raw = Math.round(correct * 40 / units);
  const t = skill === 'listening' ? T_LIS : module === 'general' ? T_RGT : T_RAC;
  for (const [min, b] of t) if (raw >= min) return b;
  return 0;
}
const bandVal = v => { if (v === '' || v == null) return null; const x = Number(v); return Number.isFinite(x) && x >= 0 && x <= 9 && Number.isInteger(x * 2) ? x : null; };
function critBand(b) { if (!isObj(b)) return null; const v = CRIT.map(k => b[k]); if (v.some(x => x == null || x === '')) return null; return floorHalf(avg(v.map(Number))); }

const FID = /^[a-f0-9]{20}$/;
function fileRef(f, o, uid) {
  if (!isObj(f) || !FID.test(f.fid) || !o.fileOk(f.fid, uid)) return null;
  return { fid: f.fid, name: str(f.name, 150) || 'fayl', type: str(f.type, 100) };
}

/* ---------- savollarni tozalash (o'qituvchi kiritgan ma'lumot) ---------- */
function cleanQ(q, i, o, ielts, used) {
  if (!isObj(q)) bad(400, `${i + 1}-element noto‘g‘ri`);
  const n = i + 1, type = QTYPES.includes(q.type) ? q.type : bad(400, `${n}-element: noma’lum savol turi`);
  const id = typeof q.id === 'string' && /^[a-z0-9]{4,16}$/.test(q.id) && !used.has(q.id) ? q.id : o.id();
  used.add(id);
  const base = { id, type, text: txt(q.text, 6000).trim() };
  const pts = d => int(q.pts, 0, 100, d);
  const need = (cond, msg) => { if (!cond) bad(400, `${n}-element (${LABEL[type]}): ${msg}`); };
  switch (type) {
    case 'section':
      return { ...base, passage: txt(q.passage, 80000).trim(), audio: fileRef(q.audio, o), audioUrl: /^https?:\/\/\S+$/i.test(str(q.audioUrl, 800)) ? str(q.audioUrl, 800) : '', image: fileRef(q.image, o), pts: 0 };
    case 'mcq': {
      const raw = (Array.isArray(q.options) ? q.options : []).slice(0, 12).map(x => str(x, 600));
      const chosen = new Set((Array.isArray(q.answer) ? q.answer : []).map(Number));
      const options = [], answer = [];
      raw.forEach((x, j) => { if (!x) return; if (chosen.has(j)) answer.push(options.length); options.push(x); });
      need(base.text, 'savol matnini yozing');
      need(options.length >= 2, 'kamida 2 ta variant kerak');
      need(answer.length, 'to‘g‘ri javobni belgilang');
      return { ...base, options, answer, pts: pts(answer.length) };
    }
    case 'tfng': {
      const answer = ({ Y: 'T', N: 'F' })[q.answer] || q.answer;
      need(base.text, 'tasdiq matnini yozing');
      need(['T', 'F', 'NG'].includes(answer), 'to‘g‘ri javobni tanlang');
      return { ...base, variant: q.variant === 'ynng' ? 'ynng' : 'tfng', answer, pts: pts(1) };
    }
    case 'gap': {
      const g = gapParse(base.text);
      need(g.ans.length, 'kamida bitta bo‘sh joyni {javob} ko‘rinishida yozing');
      need(g.ans.every(a => a.length), 'bo‘sh {} qavs bor — ichiga javobni yozing');
      return { ...base, bank: !!q.bank, pts: g.ans.length };
    }
    case 'short': {
      const answers = (Array.isArray(q.answers) ? q.answers : String(q.answers || '').split('|')).map(x => str(x, 200)).filter(Boolean).slice(0, 20);
      need(base.text, 'savol matnini yozing');
      need(answers.length, 'kamida bitta to‘g‘ri javob yozing');
      return { ...base, answers, pts: pts(1) };
    }
    case 'match': {
      const pairs = (Array.isArray(q.pairs) ? q.pairs : []).slice(0, 40).map(p => ({ l: str(p && p.l, 400), r: str(p && p.r, 400) })).filter(p => p.l || p.r);
      need(pairs.every(p => p.l && p.r), 'har bir juftlikning ikki tomonini ham to‘ldiring');
      need(pairs.length >= 2, 'kamida 2 ta juftlik kerak');
      const extra = (Array.isArray(q.extra) ? q.extra : String(q.extra || '').split('\n')).map(x => str(x, 400)).filter(Boolean).slice(0, 20);
      const right = shuffle([...new Set([...pairs.map(p => p.r), ...extra])], id + 'm');
      return { ...base, pairs, extra, left: pairs.map(p => p.l), right, answer: pairs.map(p => right.indexOf(p.r)), pts: pairs.length };
    }
    case 'order': {
      const items = (Array.isArray(q.items) ? q.items : String(q.items || '').split('\n')).map(x => str(x, 400)).filter(Boolean).slice(0, 40);
      need(items.length >= 2, 'kamida 2 ta element kerak');
      return { ...base, items, pts: pts(1) };
    }
    case 'writing':
      need(base.text, 'topshiriq matnini yozing');
      return { ...base, image: fileRef(q.image, o), minWords: int(q.minWords, 0, 3000, 0), task: ['task1', 'task2'].includes(q.task) ? q.task : '', pts: ielts ? 9 : pts(10) };
    case 'html': {
      const c = isObj(q.html) ? String(q.html.content || '') : '';
      need(c.trim(), 'HTML fayl yuklang');
      need(c.length <= 1.6e6, 'HTML fayl 1.5 MB dan katta bo‘lmasin');
      const fields = (Array.isArray(q.fields) ? q.fields : []).slice(0, 300).filter(isObj).map(f => ({
        key: str(f.key, 120), kind: HKIND.includes(f.kind) ? f.kind : 'text', label: str(f.label, 400),
        options: (Array.isArray(f.options) ? f.options : []).slice(0, 40).map(x => str(x, 300)),
        answers: (Array.isArray(f.answers) ? f.answers : String(f.answers || '').split('|')).map(x => str(x, 300)).filter(Boolean).slice(0, 20) })).filter(f => f.key);
      const selfScore = !!q.selfScore, selfPts = selfScore ? int(q.selfPts, 1, 100, 10) : 0;
      return { ...base, html: { name: str(q.html.name, 150) || 'topshiriq.html', content: c }, theme: q.theme !== false, hideCheck: !!q.hideCheck,
        fields, selfScore, selfPts, pts: fields.filter(f => f.answers.length).length + selfPts };
    }
    case 'speaking':
      need(base.text, 'savol yoki cue card matnini yozing');
      return { ...base, part: ['1', '2', '3'].includes(String(q.part)) ? String(q.part) : '', prepSec: int(q.prepSec, 0, 600, 0), maxSec: int(q.maxSec, 10, 900, 120), pts: ielts ? 9 : pts(10) };
  }
}
const LABEL = { html: 'HTML topshiriq', section: 'Bo‘lim', mcq: 'Ko‘p tanlovli', tfng: 'True/False/Not Given', gap: 'Bo‘sh joyni to‘ldirish', short: 'Qisqa javob', match: 'Moslashtirish', order: 'Tartibga solish', writing: 'Writing', speaking: 'Speaking' };

function cleanWork(b, o) {
  const kind = KINDS.includes(b.kind) ? b.kind : 'homework';
  const ielts = kind === 'ielts';
  const skill = SKILLS.includes(b.skill) ? b.skill : 'mixed';
  if (ielts && !IELTS_SKILLS.includes(skill)) bad(400, 'IELTS mashqi uchun ko‘nikmani tanlang: Listening, Reading, Writing yoki Speaking');
  const title = str(b.title, 200); if (!title) bad(400, 'Sarlavha kiriting');
  const used = new Set();
  const questions = NOSUB.has(kind) ? [] : (Array.isArray(b.questions) ? b.questions : []).slice(0, 300).map((q, i) => cleanQ(q, i, o, ielts, used));
  const cids = new Set();
  const cards = kind !== 'vocab' ? [] : (Array.isArray(b.cards) ? b.cards : []).slice(0, 1000).filter(isObj).map(c => {
    const id = typeof c.id === 'string' && /^[a-z0-9]{4,16}$/.test(c.id) && !cids.has(c.id) ? c.id : o.id(); cids.add(id);
    return { id, w: str(c.w, 200), t: str(c.t, 300), ex: str(c.ex, 500) };
  }).filter(c => c.w && c.t);
  if (kind === 'vocab' && !cards.length) bad(400, 'Kamida bitta so‘z va uning tarjimasini kiriting');
  let html = null;
  if (isObj(b.html) && b.html.content) {
    if (String(b.html.content).length > 1.6e6) bad(413, 'HTML fayl 1.5 MB dan katta bo‘lmasin');
    html = { name: str(b.html.name, 150) || 'fayl.html', content: String(b.html.content) };
  }
  const dueAt = Number(b.dueAt) > 0 ? Number(b.dueAt) : null;
  return {
    title, desc: txt(b.desc, 20000).trim(), kind, skill, module: b.module === 'general' ? 'general' : 'academic', topic: str(b.topic, 80),
    dueAt, publishAt: Number(b.publishAt) > 0 ? Number(b.publishAt) : null, timeLimit: NOSUB.has(kind) ? 0 : int(b.timeLimit, 0, 600, 0), pts: int(b.pts, 0, 1000, 100),
    proctor: !NOSUB.has(kind) && !!b.proctor, cards, showAnswers: !!b.showAnswers, audioOnce: !!b.audioOnce,
    audio: fileRef(b.audio, o), files: (Array.isArray(b.files) ? b.files : []).slice(0, 20).map(f => fileRef(f, o)).filter(Boolean),
    html, questions, draft: !!b.draft
  };
}

function meta(w) {
  let obj = 0, man = 0, count = 0;
  for (const q of w.questions) { if (OBJ.has(q.type)) { if (q.type === 'html' && !q.pts) continue; obj += q.pts; count++; } else if (MAN.has(q.type)) { man += q.pts; count++; } }
  const general = !NOSUB.has(w.kind) && count === 0;
  if (general) man = w.pts;
  return { obj: r2(obj), man: r2(man), max: r2(obj + man), hasMan: general || w.questions.some(q => MAN.has(q.type)), general, count };
}

/* ---------- avtomatik tekshiruv ---------- */
function gradeQ(q, a) {
  switch (q.type) {
    case 'mcq': {
      const g = [...new Set((Array.isArray(a) ? a : []).map(Number).filter(Number.isInteger))];
      const units = q.answer.length; let hit = 0;
      if (g.length <= units) hit = g.filter(x => q.answer.includes(x)).length;
      return { ok: hit === units, hit, units, s: r2(q.pts * hit / units) };
    }
    case 'tfng': { const ok = a === q.answer; return { ok, hit: +ok, units: 1, s: ok ? q.pts : 0 }; }
    case 'short': { const v = norm(a); const ok = !!v && q.answers.some(x => norm(x) === v); return { ok, hit: +ok, units: 1, s: ok ? q.pts : 0 }; }
    case 'order': { const g = Array.isArray(a) ? a.map(String) : []; const ok = g.length === q.items.length && g.every((x, i) => x === q.items[i]); return { ok, hit: +ok, units: 1, s: ok ? q.pts : 0 }; }
    case 'gap': {
      const al = gapParse(q.text).ans, g = Array.isArray(a) ? a : [];
      const marks = al.map((alts, i) => { const v = norm(g[i]); return !!v && alts.some(x => norm(x) === v); });
      const hit = marks.filter(Boolean).length;
      return { ok: hit === al.length, marks, hit, units: al.length, s: hit };
    }
    case 'html': {
      const A = isObj(a) ? a : {}, F = isObj(A.fields) ? A.fields : {}, marks = {};
      let hit = 0, units = 0, s = 0;
      for (const f of q.fields) {
        if (!f.answers.length) continue;
        units++; const v = F[f.key]; let ok = false;
        if (f.kind === 'check') { const g = (Array.isArray(v) ? v : []).map(Number).filter(Number.isInteger).sort((x, y) => x - y).join(','); ok = f.answers.includes(g); }
        else if (f.kind === 'radio') ok = v !== null && v !== undefined && v !== '' && f.answers.includes(String(v));
        else { const n = norm(v); ok = !!n && f.answers.some(x => norm(x) === n); }
        marks[f.key] = ok; if (ok) { hit++; s += 1; }
      }
      if (q.selfScore && q.selfPts > 0) {
        units++; const sc = isObj(A.self) ? A.self : null;
        const fr = sc && sc.max > 0 ? Math.min(1, Math.max(0, sc.score / sc.max)) : 0;
        hit += fr; s += q.selfPts * fr; marks._self = r2(fr);
      }
      return { ok: units > 0 && Math.abs(hit - units) < 1e-9, marks, hit: r2(hit), units, s: r2(s) };
    }
    case 'match': {
      const g = Array.isArray(a) ? a : [];
      const marks = q.answer.map((x, i) => g[i] !== null && g[i] !== undefined && g[i] !== '' && Number(g[i]) === x);
      const hit = marks.filter(Boolean).length;
      return { ok: hit === q.answer.length, marks, hit, units: q.answer.length, s: hit };
    }
  }
  return { ok: false, hit: 0, units: 0, s: 0 };
}

function recompute(s, w) {
  const M = meta(w), A = isObj(s.answers) ? s.answers : {};
  s.manual = isObj(s.manual) ? s.manual : {};
  let score = 0, hit = 0, units = 0; const auto = {};
  for (const q of w.questions) {
    if (!OBJ.has(q.type)) continue;
    const r = gradeQ(q, A[q.id]);
    const ov = s.manual[q.id] && s.manual[q.id].override;
    if (ov != null) { r.ov = ov; r.s = Math.min(q.pts, Math.max(0, ov)); r.hit = q.pts ? r.units * r.s / q.pts : r.hit; }
    auto[q.id] = r; score += r.s; hit += r.hit; units += r.units;
  }
  s.auto = auto; s.autoScore = r2(score); s.correct = r2(hit); s.units = units;
  let man = 0, pending = 0; const bands = [];
  const mq = M.general ? [{ id: '_general', type: 'general', pts: w.pts }] : w.questions.filter(q => MAN.has(q.type));
  for (const q of mq) {
    const x = s.manual[q.id];
    if (w.kind === 'ielts' && q.type !== 'general') {
      const b = x ? critBand(x.bands) : null; if (x) x.band = b;
      if (b == null) pending++; else { man += b; bands.push({ q, b }); }
    } else {
      const v = x ? x.score : null;
      if (v == null) pending++; else man += Math.min(q.pts, Math.max(0, v));
    }
  }
  s.pending = pending; s.max = M.max; s.score = r2(score + man); s.band = null;
  if (w.kind === 'ielts') {
    if (w.skill === 'listening' || w.skill === 'reading') s.band = bandFromRaw(hit, units, w.skill, w.module);
    else if (!pending && bands.length) {
      if (w.skill === 'writing') {
        const t1 = bands.filter(x => x.q.task === 'task1').map(x => x.b), t2 = bands.filter(x => x.q.task === 'task2').map(x => x.b);
        s.band = t1.length && t2.length ? half((avg(t1) + 2 * avg(t2)) / 3) : half(avg(bands.map(x => x.b)));
      } else s.band = half(avg(bands.map(x => x.b)));
    }
    if (s.bandOverride != null) s.band = s.bandOverride;
  }
  if (!M.hasMan && !s.returned) { s.returned = true; s.returnedAt = s.at; }
  s.status = s.returned ? 'graded' : 'submitted';
}

function cleanAnswers(w, A, o, uid) {
  const out = {}; if (!isObj(A)) return out;
  for (const q of w.questions) {
    const a = A[q.id]; if (a == null) continue;
    switch (q.type) {
      case 'mcq': out[q.id] = (Array.isArray(a) ? a : []).slice(0, 12).map(Number).filter(Number.isInteger); break;
      case 'tfng': if (['T', 'F', 'NG'].includes(a)) out[q.id] = a; break;
      case 'gap': case 'order': out[q.id] = (Array.isArray(a) ? a : []).slice(0, 60).map(x => str(x, 400)); break;
      case 'match': out[q.id] = (Array.isArray(a) ? a : []).slice(0, 60).map(x => x === null || x === '' || x === undefined || !Number.isInteger(Number(x)) ? null : Number(x)); break;
      case 'short': out[q.id] = str(a, 400); break;
      case 'writing': out[q.id] = txt(a, 40000); break;
      case 'speaking': { const f = fileRef(a, o, uid); if (f) out[q.id] = f; break; }
      case 'html': {
        if (!isObj(a)) break;
        const F = {}, src = isObj(a.fields) ? a.fields : {}; let n = 0;
        for (const [k, v] of Object.entries(src)) { if (++n > 300) break; F[str(k, 120)] = Array.isArray(v) ? v.slice(0, 40).map(Number).filter(Number.isInteger) : str(v, 3000); }
        const r = { fields: F };
        if (q.selfScore && isObj(a.self)) { const sc = Number(a.self.score), mx = Number(a.self.max); if (Number.isFinite(sc) && Number.isFinite(mx) && mx > 0) r.self = { score: Math.max(0, Math.min(sc, mx)), max: mx }; }
        out[q.id] = r; break;
      }
    }
  }
  return out;
}

/* ---------- o'quvchiga ko'rsatiladigan shakl (javoblarsiz) ---------- */
function studentQ(q) {
  const b = { id: q.id, type: q.type, text: q.text, pts: q.pts };
  switch (q.type) {
    case 'section': return { ...b, passage: q.passage, audio: q.audio, audioUrl: q.audioUrl || '', image: q.image };
    case 'mcq': return { ...b, options: q.options, need: q.answer.length };
    case 'tfng': return { ...b, variant: q.variant };
    case 'gap': { const g = gapParse(q.text); return { ...b, text: '', parts: g.parts, blanks: g.ans.length, bank: q.bank ? shuffle(g.ans.map(x => x[0]), q.id + 'b') : null }; }
    case 'short': return b;
    case 'match': return { ...b, left: q.left, right: q.right };
    case 'order': { let it = shuffle(q.items, q.id + 'o'); if (it.length > 1 && it.every((x, i) => x === q.items[i])) it = it.slice(1).concat(it[0]); return { ...b, items: it }; }
    case 'writing': return { ...b, image: q.image, minWords: q.minWords, task: q.task };
    case 'speaking': return { ...b, part: q.part, prepSec: q.prepSec, maxSec: q.maxSec };
    case 'html': return { ...b, html: q.html, theme: q.theme, hideCheck: q.hideCheck, selfScore: q.selfScore, selfPts: q.selfPts,
      graded: q.fields.filter(f => f.answers.length).length, fields: q.fields.map(f => ({ key: f.key, kind: f.kind, label: f.label, options: f.options, graded: f.answers.length > 0 })) };
  }
  return b;
}
const canRedo = w => !w.timeLimit && !w.proctor;
function unitsOf(q) {
  switch (q.type) {
    case 'gap': return Math.max(1, gapParse(q.text).ans.length);
    case 'match': return Math.max(1, (q.answer || []).length);
    case 'mcq': return Math.max(1, (q.answer || []).length);
    case 'html': return q.fields.filter(f => f.answers.length).length + (q.selfScore ? 1 : 0);
    case 'section': case 'writing': case 'speaking': return 0;
    default: return 1;
  }
}
function gapLabel(text, k) { const p = gapParse(text).parts; const a = String(p[k] || '').replace(/\s+/g, ' '), b = String(p[k + 1] || '').replace(/\s+/g, ' '); return ((a.length > 45 ? '…' + a.slice(-45) : a) + '____' + (b.length > 35 ? b.slice(0, 35) + '…' : b)).trim(); }

function migrate(db) {
  for (const k of ['users', 'classes', 'members', 'works', 'subs', 'posts', 'starts', 'vocab']) if (!Array.isArray(db[k])) db[k] = [];
  if (!isObj(db.files)) db.files = {};
  if (!isObj(db.sessions)) db.sessions = {};
  if (!isObj(db.meta)) db.meta = {};
  for (const c of db.classes) { c.level = LEVELS.includes(c.level) ? c.level : ''; c.code = String(c.code || '').replace(/^ZEM-/, ''); c.sec = c.sec || ''; }
  for (const w of db.works) {
    w.questions = Array.isArray(w.questions) ? w.questions : [];
    w.kind = KINDS.includes(w.kind) ? w.kind : 'homework';
    w.skill = SKILLS.includes(w.skill) ? w.skill : 'mixed';
    w.module = w.module || 'academic'; w.files = Array.isArray(w.files) ? w.files : [];
    if (w.dueAt === undefined) w.dueAt = w.due ? Date.parse(w.due) || null : null;
    w.timeLimit = w.timeLimit || 0; w.pts = w.pts ?? 100; w.topic = w.topic || ''; w.desc = w.desc || '';
    w.draft = !!w.draft; w.created = w.created || 0; w.cards = Array.isArray(w.cards) ? w.cards : []; if (w.publishAt === undefined) w.publishAt = null;
    if (w.audio === undefined) w.audio = null; if (w.html === undefined) w.html = null;
  }
  for (const s of db.subs) {
    s.answers = isObj(s.answers) ? s.answers : {};
    if (!isObj(s.manual)) { s.manual = {}; if (s.score != null) s.manual._general = { score: s.score, fb: '' }; s.returned = s.score != null; }
    s.files = s.files || []; s.log = s.log || []; s.snaps = s.snaps || []; s.text = s.text || '';
    const w = db.works.find(x => x.id === s.wid); if (w) recompute(s, w);
  }
}

function emptyDb() { return { users: [], classes: [], members: [], works: [], subs: [], posts: [], starts: [], vocab: [], files: {}, sessions: {}, meta: {} }; }

/* ---------- API ---------- */
function createCore(db, o) {
  migrate(db);
  const save = () => o.save();
  const user = id => db.users.find(u => u.id === id);
  const cls = id => db.classes.find(c => c.id === id) || bad(404, 'Sinf topilmadi');
  const work = id => db.works.find(w => w.id === id) || bad(404, 'Vazifa topilmadi');
  const subOf = (wid, uid) => db.subs.find(s => s.wid === wid && s.uid === uid);
  const startOf = (wid, uid) => db.starts.find(s => s.wid === wid && s.uid === uid);
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const students = cid => db.members.filter(m => m.cid === cid).map(m => user(m.uid)).filter(Boolean).sort(byName);
  const owner = (c, u) => u.role === 'teacher' && c.owner === u.id;
  const member = (c, u) => c.owner === u.id || db.members.some(m => m.cid === c.id && m.uid === u.id);
  const needOwner = (c, u) => { if (!owner(c, u)) bad(403, 'Bu amal faqat sinf o‘qituvchisi uchun'); };
  const needMember = (c, u) => { if (!member(c, u)) bad(403, 'Siz bu sinf a’zosi emassiz'); };
  const live = w => !w.draft && !(w.publishAt && w.publishAt > o.now());
  const visible = (w, u) => live(w) || owner(cls(w.cid), u);
  const vstate = (wid, uid) => db.vocab.find(v => v.wid === wid && v.uid === uid);
  function vsum(w, uid) { const v = vstate(w.id, uid), now = o.now(); let learned = 0, seen = 0, due = 0, right = 0, wrong = 0; for (const c of w.cards) { const x = v && v.cards[c.id]; if (!x) { due++; continue; } seen++; right += x.r || 0; wrong += x.w || 0; if (x.b >= 4) learned++; if (x.due <= now) due++; } return { total: w.cards.length, learned, seen, due, acc: right + wrong ? Math.round(100 * right / (right + wrong)) : null, last: v ? v.last : null }; }
  const pub = u => u ? { id: u.id, name: u.name } : { id: '', name: 'O‘chirilgan foydalanuvchi' };
  // ---- hisoblar ----
  const LANGS = ['uz', 'ru', 'en'];
  const self = u => ({ id: u.id, name: u.name, email: u.email || '', login: u.login || '', role: u.role, mustChange: !!u.mustChange, lang: u.lang || '',
    tg: !!(u.tg && u.tg.chat), tgOn: u.tgOn !== false });
  const findUser = id => { id = String(id || '').trim().toLowerCase(); return id ? db.users.find(x => x.email === id || (x.login && x.login === id)) : undefined; };
  const taken = id => db.users.some(x => x.email === id || x.login === id);
  const TRL = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h' };
  function makeLogin(name) {
    const w = [...String(name).toLowerCase()].map(ch => TRL[ch] ?? ch).join('').replace(/[‘’'`ʻʼ]/g, '').split(/\s+/).map(x => x.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const base = (w[0] || 'oquvchi').slice(0, 14) + (w[1] ? '.' + w[1][0] : '');
    for (let i = 0; i < 300; i++) { const l = base + (10 + Math.floor(Math.random() * (i < 100 ? 90 : 900))); if (!taken(l)) return l; }
    return base + o.id();
  }
  const tempPw = () => (o.tempPw ? o.tempPw() : o.id() + o.id());
  const needPw = pw => { if (String(pw || '').length < 6) bad(400, 'Parol kamida 6 belgidan iborat bo‘lsin'); if (String(pw).length > 200) bad(400, 'Parol juda uzun'); };
  const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s; do { s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; } while (db.classes.some(c => c.code === s)); return s; };
  const PAL = ['reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary'];
  const color = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };

  function classInfo(c, u) {
    const own = owner(c, u);
    return { id: c.id, name: c.name, sec: c.sec, level: c.level, color: color(c.id), code: own ? c.code : undefined, isOwner: own,
      teacher: pub(user(c.owner)), students: db.members.filter(m => m.cid === c.id).length,
      works: db.works.filter(w => w.cid === c.id && live(w)).length };
  }
  function teacherWork(w) { return { ...w, meta: meta(w) }; }
  function studentWork(w) { const { questions, ...rest } = w; return { ...rest, questions: questions.map(studentQ), meta: meta(w) }; }
  function subSummary(s) { return { id: s.id, status: s.status, at: s.at, late: s.late, overtime: s.overtime, score: s.score, max: s.max, band: s.band, risk: s.risk, pending: s.pending, attempt: s.attempt || 1, correct: s.correct, units: s.units }; }
  function studentSub(s, w) {
    const base = { id: s.id, status: s.status, at: s.at, late: s.late, overtime: s.overtime, attempt: s.attempt || 1, answers: s.answers, text: s.text, files: s.files };
    if (s.returned) {
      const manual = {}; for (const [k, v] of Object.entries(s.manual || {})) manual[k] = { score: v.score ?? null, bands: v.bands, band: v.band ?? null, fb: v.fb || '' };
      return { ...base, score: s.score, max: s.max, band: s.band, correct: s.correct, units: s.units, fb: s.fb, auto: s.auto, manual, returnedAt: s.returnedAt };
    }
    const M = meta(w);
    return { ...base, autoPart: M.obj > 0 && M.hasMan ? { score: s.autoScore, max: M.obj } : null };
  }
  function workLight(w, u) {
    const M = meta(w);
    const r = { id: w.id, cid: w.cid, title: w.title, kind: w.kind, skill: w.skill, topic: w.topic, dueAt: w.dueAt, timeLimit: w.timeLimit,
      proctor: w.proctor, draft: w.draft, created: w.created, published: Math.max(w.published || w.created || 0, w.publishAt || 0), publishAt: w.publishAt, scheduled: !w.draft && !!(w.publishAt && w.publishAt > o.now()), count: M.count, max: M.max, cards: w.kind === 'vocab' ? w.cards.length : undefined };
    if (u.role === 'student' && w.kind === 'vocab') r.my = { status: 'vocab', ...vsum(w, u.id) };
    else if (u.role === 'student') {
      const s = subOf(w.id, u.id);
      r.my = s ? { status: s.status, score: s.returned ? s.score : null, band: s.returned ? s.band : null, max: s.max, late: s.late } : { status: startOf(w.id, u.id) ? 'started' : 'none' };
    } else {
      const subs = db.subs.filter(s => s.wid === w.id);
      if (w.kind === 'vocab') { const st = students(w.cid).map(x => vsum(w, x.id)); r.stats = { students: st.length, active: st.filter(x => x.seen).length, learnedAvg: st.length ? Math.round(100 * st.reduce((a, x) => a + x.learned / Math.max(1, x.total), 0) / st.length) : 0 }; return r; }
      r.stats = { students: db.members.filter(m => m.cid === w.cid).length, submitted: subs.length, toGrade: subs.filter(s => s.status !== 'graded').length };
    }
    return r;
  }
  function todo(u) {
    if (u.role === 'student') {
      const cs = db.classes.filter(c => member(c, u)), cm = new Map(cs.map(c => [c.id, c]));
      return db.works.filter(w => cm.has(w.cid) && live(w) && w.kind !== 'material' && (w.kind === 'vocab' ? vsum(w, u.id).due > 0 : !subOf(w.id, u.id)))
        .map(w => ({ id: w.id, title: w.title, kind: w.kind, skill: w.skill, dueAt: w.dueAt, due: w.kind === 'vocab' ? vsum(w, u.id).due : undefined, cls: { id: w.cid, name: cm.get(w.cid).name }, overdue: !!(w.dueAt && o.now() > w.dueAt) }))
        .sort((a, b) => (a.dueAt || 9e15) - (b.dueAt || 9e15)).slice(0, 30);
    }
    const cm = new Map(db.classes.filter(c => c.owner === u.id).map(c => [c.id, c]));
    const wm = new Map(db.works.filter(w => cm.has(w.cid)).map(w => [w.id, w]));
    return db.subs.filter(s => wm.has(s.wid) && s.status !== 'graded').sort((a, b) => b.at - a.at).slice(0, 40)
      .map(s => { const w = wm.get(s.wid); return { sid: s.id, wid: w.id, title: w.title, kind: w.kind, skill: w.skill, student: pub(user(s.uid)).name, at: s.at, cls: { id: w.cid, name: cm.get(w.cid).name } }; });
  }
  function gradebook(c) {
    const st = students(c.id);
    const ws = db.works.filter(w => w.cid === c.id && live(w) && !NOSUB.has(w.kind)).sort((a, b) => (a.published || a.created) - (b.published || b.created));
    const cells = {};
    for (const s of st) { cells[s.id] = {}; for (const w of ws) { const x = subOf(w.id, s.id); if (x) cells[s.id][w.id] = { sid: x.id, status: x.status, score: x.score, max: x.max, band: x.band, late: x.late }; } }
    return { students: st.map(s => ({ id: s.id, name: s.name })), works: ws.map(w => ({ id: w.id, title: w.title, kind: w.kind, skill: w.skill, max: meta(w).max, dueAt: w.dueAt })), cells, now: o.now() };
  }
  function progress(c, uid) {
    const ws = new Map(db.works.filter(w => w.cid === c.id && live(w)).map(w => [w.id, w]));
    const subs = db.subs.filter(s => s.uid === uid && ws.has(s.wid) && s.returned).sort((a, b) => a.at - b.at);
    const ielts = subs.filter(s => ws.get(s.wid).kind === 'ielts' && s.band != null).map(s => { const w = ws.get(s.wid); return { sid: s.id, wid: w.id, title: w.title, skill: w.skill, band: s.band, at: s.at }; });
    const skills = {};
    for (const k of IELTS_SKILLS) { const l = ielts.filter(x => x.skill === k).map(x => x.band); skills[k] = { latest: l.length ? l[l.length - 1] : null, avg: l.length ? half(avg(l)) : null, count: l.length, history: l.slice(-10) }; }
    const latest = IELTS_SKILLS.map(k => skills[k].latest);
    const other = subs.filter(s => ws.get(s.wid).kind !== 'ielts').map(s => { const w = ws.get(s.wid); return { sid: s.id, wid: w.id, title: w.title, kind: w.kind, skill: w.skill, score: s.score, max: s.max, at: s.at }; });
    const total = [...ws.values()].filter(w => !NOSUB.has(w.kind)).length;
    const vocab = [...ws.values()].filter(w => w.kind === 'vocab').map(w => ({ wid: w.id, title: w.title, ...vsum(w, uid) }));
    const done = db.subs.filter(s => s.uid === uid && ws.has(s.wid)).length;
    return { student: pub(user(uid)), skills, overall: latest.every(x => x != null) ? half(avg(latest)) : null, ielts: ielts.reverse(), other: other.reverse(), total, done,
      vocab, avgPct: other.filter(x => x.max).length ? Math.round(avg(other.filter(x => x.max).map(x => 100 * x.score / x.max))) : null };
  }
  function analysis(w) {
    const subs = db.subs.filter(s => s.wid === w.id), rows = []; let n = 1;
    const top = m => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v, c]) => ({ v, c }));
    const L = i => String.fromCharCode(65 + i);
    for (const q of w.questions) {
      const u = unitsOf(q);
      if (q.type === 'section') continue;
      const A = subs.map(s => ({ a: (s.answers || {})[q.id], r: s.auto && s.auto[q.id], s }));
      const base = { n, u, qid: q.id, type: q.type, label: q.text, count: A.length };
      if (q.type === 'mcq') {
        const d = q.options.map(() => 0); let hit = 0, tot = 0, none = 0;
        A.forEach(x => { const g = Array.isArray(x.a) ? x.a : []; if (!g.length) none++; g.forEach(i => { if (d[i] != null) d[i]++; }); if (x.r) { hit += x.r.hit; tot += x.r.units; } });
        rows.push({ ...base, rate: tot ? hit / tot : null, dist: q.options.map((op, i) => ({ label: L(i) + '. ' + op, c: d[i], ok: q.answer.includes(i) })).concat(none ? [{ label: 'Javobsiz', c: none }] : []) });
      } else if (q.type === 'tfng') {
        const T = q.variant === 'ynng' ? { T: 'Yes', F: 'No', NG: 'Not Given' } : { T: 'True', F: 'False', NG: 'Not Given' }, d = { T: 0, F: 0, NG: 0 }; let none = 0;
        A.forEach(x => { if (x.a in d) d[x.a]++; else none++; });
        rows.push({ ...base, rate: A.length ? A.filter(x => x.r && x.r.ok).length / A.length : null, dist: ['T', 'F', 'NG'].map(k => ({ label: T[k], c: d[k], ok: q.answer === k })).concat(none ? [{ label: 'Javobsiz', c: none }] : []) });
      } else if (q.type === 'gap') {
        gapParse(q.text).ans.forEach((alts, k) => {
          const wr = new Map(); let ok = 0;
          A.forEach(x => { if (x.r && x.r.marks && x.r.marks[k]) ok++; else { const v = norm((Array.isArray(x.a) ? x.a : [])[k]) || '(bo‘sh)'; wr.set(v, (wr.get(v) || 0) + 1); } });
          rows.push({ ...base, n: n + k, u: 1, label: gapLabel(q.text, k), correct: alts.join(' / '), rate: A.length ? ok / A.length : null, wrong: top(wr) });
        });
      } else if (q.type === 'short') {
        const wr = new Map(); let ok = 0;
        A.forEach(x => { if (x.r && x.r.ok) ok++; else { const v = norm(x.a) || '(bo‘sh)'; wr.set(v, (wr.get(v) || 0) + 1); } });
        rows.push({ ...base, correct: q.answers.join(' / '), rate: A.length ? ok / A.length : null, wrong: top(wr) });
      } else if (q.type === 'match') {
        q.left.forEach((l, k) => {
          const d = q.right.map(() => 0); let ok = 0, none = 0;
          A.forEach(x => { const g = Array.isArray(x.a) ? x.a[k] : null; if (g != null && d[g] != null) d[g]++; else none++; if (x.r && x.r.marks && x.r.marks[k]) ok++; });
          rows.push({ ...base, n: n + k, u: 1, label: l, correct: L(q.answer[k]) + '. ' + q.right[q.answer[k]], rate: A.length ? ok / A.length : null, dist: q.right.map((r, i) => ({ label: L(i) + '. ' + r, c: d[i], ok: i === q.answer[k] })).filter(x => x.c || x.ok).concat(none ? [{ label: 'Javobsiz', c: none }] : []) });
        });
      } else if (q.type === 'order') {
        rows.push({ ...base, correct: q.items.join(' '), rate: A.length ? A.filter(x => x.r && x.r.ok).length / A.length : null });
      } else if (q.type === 'html') {
        let k = 0;
        for (const f of q.fields) {
          if (!f.answers.length) continue;
          const wr = new Map(); let ok = 0;
          A.forEach(x => { if (x.r && x.r.marks && x.r.marks[f.key]) ok++; else { let v = ((x.a || {}).fields || {})[f.key]; if (f.kind === 'radio' && v !== '' && v != null) v = L(+v) + '. ' + (f.options[+v] || ''); if (Array.isArray(v)) v = v.map(i => L(i)).join(', '); v = norm(v) || '(bo‘sh)'; wr.set(v, (wr.get(v) || 0) + 1); } });
          const cor = f.kind === 'radio' ? L(+f.answers[0]) + '. ' + (f.options[+f.answers[0]] || '') : f.kind === 'check' ? f.answers[0].split(',').map(i => L(+i)).join(', ') : f.answers.join(' / ');
          rows.push({ ...base, n: n + k, u: 1, label: f.label || f.key, correct: cor, rate: A.length ? ok / A.length : null, wrong: top(wr) }); k++;
        }
      } else if (q.type === 'writing' || q.type === 'speaking') {
        const vals = subs.map(s => s.manual && s.manual[q.id]).filter(Boolean).map(m => w.kind === 'ielts' ? m.band : m.score).filter(v => v != null);
        rows.push({ ...base, n: q.type === 'writing' ? 'W' : 'S', manual: true, max: q.pts, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null, graded: vals.length });
      }
      n += u;
    }
    const scored = subs.filter(s => s.returned);
    return { rows, subs: subs.length, students: db.members.filter(m => m.cid === w.cid).length, ielts: w.kind === 'ielts',
      avgScore: scored.length ? Math.round(scored.reduce((a, s) => a + (s.max ? 100 * s.score / s.max : 0), 0) / scored.length) : null,
      avgBand: w.kind === 'ielts' && scored.some(s => s.band != null) ? half(avg(scored.filter(s => s.band != null).map(s => s.band))) : null,
      bands: w.kind === 'ielts' ? scored.filter(s => s.band != null).map(s => s.band) : [] };
  }
  function importWorks(cid, list, topics, kind) {
    let n = 0;
    for (const x of list) {
      if (!isObj(x)) continue;
      const title = str(x.title, 200); if (!title) continue;
      const mats = (Array.isArray(x.materials) ? x.materials : []).map(m => { const l = (m && m.driveFile && m.driveFile.driveFile) || (m && (m.link || m.youtubeVideo || m.form)) || {}; const u = l.alternateLink || l.url || l.formUrl || ''; return (l.title || 'Material') + (u ? ' — ' + u : ''); });
      let desc = txt(x.description, 15000).trim();
      if (x.multipleChoiceQuestion && Array.isArray(x.multipleChoiceQuestion.choices)) desc += '\n\nVariantlar:\n' + x.multipleChoiceQuestion.choices.map((c, i) => String.fromCharCode(65 + i) + ') ' + c).join('\n');
      if (mats.length) desc += '\n\nMateriallar:\n' + mats.join('\n');
      const d = x.dueDate, t = x.dueTime || {};
      const dueAt = d && d.year ? Date.UTC(d.year, (d.month || 1) - 1, d.day || 1, t.hours ?? 23, t.minutes ?? 59) : null;
      const created = Date.parse(x.creationTime) || o.now();
      db.works.push({ id: o.id(), cid, title, desc: desc.trim(), kind: kind || 'homework', skill: 'mixed', module: 'academic',
        topic: str(x.topic || x.topicName || (topics && topics[x.topicId]) || 'Classroom’dan', 80), dueAt, timeLimit: 0,
        pts: int(x.maxPoints, 1, 1000, 100), proctor: false, showAnswers: false, audioOnce: false, audio: null, files: [], html: null,
        questions: [], draft: true, created, updated: o.now(), src: 'classroom' });
      n++;
    }
    save(); return n;
  }

  function route(m, p, u, b, q) {
    b = isObj(b) || Array.isArray(b) ? b : {};
    let a;
    if (m === 'POST' && p === '/me/profile') {
      if (b.name !== undefined) { const n = str(b.name, 60); if (!n) bad(400, 'Ism-familiyangizni kiriting'); u.name = n; }
      if (b.lang !== undefined) u.lang = LANGS.includes(b.lang) ? b.lang : '';
      if (b.tgOn !== undefined) u.tgOn = !!b.tgOn;
      save(); return self(u);
    }
    if (m === 'POST' && p === '/me/password') {
      if (!o.check || !o.check(String(b.current || ''), u.pw)) bad(400, 'Joriy parol noto‘g‘ri');
      needPw(b.next);
      if (String(b.next) === String(b.current)) bad(400, 'Yangi parol eskisidan farq qilsin');
      u.pw = o.hash(String(b.next)); u.mustChange = false; u.pwAt = o.now();
      if (o.dropSessions) o.dropSessions(u.id, true);
      save(); return self(u);
    }
    if (m === 'POST' && (a = p.match(/^\/classes\/(\w+)\/students$/))) {
      const c = cls(a[1]); needOwner(c, u);
      const names = (Array.isArray(b.names) ? b.names : [b.name]).map(x => str(x, 60)).filter(Boolean).slice(0, 100);
      if (!names.length) bad(400, 'Kamida bitta ism kiriting');
      const out = [];
      for (const name of names) {
        const login = makeLogin(name), password = tempPw();
        const x = { id: o.id(), name, email: '', login, role: 'student', pw: o.hash(password), mustChange: true, created: o.now(), by: u.id };
        db.users.push(x); db.members.push({ cid: c.id, uid: x.id, at: o.now() });
        out.push({ id: x.id, name, login, password });
      }
      save(); return { created: out };
    }
    if (m === 'POST' && (a = p.match(/^\/classes\/(\w+)\/members\/(\w+)\/reset$/))) {
      const c = cls(a[1]); needOwner(c, u);
      const t = user(a[2]);
      if (!t || !db.members.some(x => x.cid === c.id && x.uid === t.id)) bad(404, 'O‘quvchi topilmadi');
      if (t.role !== 'student') bad(403, 'Faqat o‘quvchi parolini tiklash mumkin');
      if (!t.login) t.login = makeLogin(t.name);
      const password = tempPw();
      t.pw = o.hash(password); t.mustChange = true; t.pwAt = o.now();
      if (o.dropSessions) o.dropSessions(t.id, false);
      save(); return { id: t.id, name: t.name, login: t.login, email: t.email || '', password };
    }
    if (m === 'GET' && p === '/classes') {
      const cs = u.role === 'teacher' ? db.classes.filter(c => c.owner === u.id) : db.classes.filter(c => member(c, u));
      return cs.sort((x, y) => (y.created || 0) - (x.created || 0)).map(c => classInfo(c, u));
    }
    if (m === 'POST' && p === '/classes') {
      if (u.role !== 'teacher') bad(403, 'Sinfni faqat o‘qituvchi yarata oladi');
      const name = str(b.name, 80); if (!name) bad(400, 'Sinf nomini kiriting');
      const c = { id: o.id(), name, sec: str(b.sec, 120), level: LEVELS.includes(b.level) ? b.level : '', code: newCode(), owner: u.id, created: o.now() };
      db.classes.push(c); save(); return classInfo(c, u);
    }
    if (m === 'POST' && p === '/join') {
      if (u.role !== 'student') bad(403, 'Sinfga faqat o‘quvchi qo‘shila oladi');
      const k = str(b.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const c = db.classes.find(x => x.code === k || x.code === k.replace(/^ZEM/, '')) || bad(404, 'Bunday kodli sinf topilmadi. Kodni tekshirib qayta kiriting');
      if (!member(c, u)) { db.members.push({ cid: c.id, uid: u.id, at: o.now() }); save(); }
      return classInfo(c, u);
    }
    if (m === 'GET' && p === '/todo') return todo(u);

    if ((a = p.match(/^\/classes\/(\w+)$/))) {
      const c = cls(a[1]);
      if (m === 'GET') {
        needMember(c, u);
        return { ...classInfo(c, u), people: { teacher: pub(user(c.owner)), students: students(c.id).map(s => ({ id: s.id, name: s.name, email: owner(c, u) ? s.email : undefined, login: owner(c, u) ? s.login || '' : undefined, tg: owner(c, u) ? !!(s.tg && s.tg.chat) : undefined })) } };
      }
      needOwner(c, u);
      if (m === 'POST') {
        if (b.name !== undefined) { const n = str(b.name, 80); if (!n) bad(400, 'Sinf nomini kiriting'); c.name = n; }
        if (b.sec !== undefined) c.sec = str(b.sec, 120);
        if (b.level !== undefined) c.level = LEVELS.includes(b.level) ? b.level : '';
        if (b.newCode) c.code = newCode();
        save(); return classInfo(c, u);
      }
      if (m === 'DELETE') {
        const wids = new Set(db.works.filter(w => w.cid === c.id).map(w => w.id));
        db.classes = db.classes.filter(x => x !== c); db.members = db.members.filter(x => x.cid !== c.id);
        db.works = db.works.filter(w => w.cid !== c.id); db.subs = db.subs.filter(s => !wids.has(s.wid));
        db.starts = db.starts.filter(s => !wids.has(s.wid)); db.vocab = db.vocab.filter(v => !wids.has(v.wid)); db.posts = db.posts.filter(x => x.cid !== c.id);
        save(); return { ok: 1 };
      }
    }
    if (m === 'DELETE' && (a = p.match(/^\/classes\/(\w+)\/members\/(\w+)$/))) {
      const c = cls(a[1]);
      if (!(u.role === 'student' && u.id === a[2])) needOwner(c, u);
      db.members = db.members.filter(x => !(x.cid === c.id && x.uid === a[2])); save(); return { ok: 1 };
    }
    if ((a = p.match(/^\/classes\/(\w+)\/posts$/))) {
      const c = cls(a[1]); needMember(c, u);
      if (m === 'GET') return db.posts.filter(x => x.cid === c.id).sort((x, y) => y.at - x.at).map(x => ({ ...x, author: pub(user(x.uid)) }));
      if (m === 'POST') {
        needOwner(c, u);
        const text = txt(b.text, 10000).trim(), files = (Array.isArray(b.files) ? b.files : []).slice(0, 10).map(f => fileRef(f, o)).filter(Boolean);
        if (!text && !files.length) bad(400, 'E’lon matnini yozing');
        const x = { id: o.id(), cid: c.id, uid: u.id, text, files, at: o.now() }; db.posts.push(x); save(); return x;
      }
    }
    if (m === 'DELETE' && (a = p.match(/^\/posts\/(\w+)$/))) {
      const x = db.posts.find(y => y.id === a[1]) || bad(404, 'E’lon topilmadi'); needOwner(cls(x.cid), u);
      db.posts = db.posts.filter(y => y !== x); save(); return { ok: 1 };
    }
    if ((a = p.match(/^\/classes\/(\w+)\/works$/))) {
      const c = cls(a[1]); needMember(c, u);
      if (m === 'GET') return db.works.filter(w => w.cid === c.id && visible(w, u)).sort((x, y) => (y.published || y.created || 0) - (x.published || x.created || 0)).map(w => workLight(w, u));
      if (m === 'POST') {
        needOwner(c, u);
        const w = { id: o.id(), cid: c.id, ...cleanWork(b, o), created: o.now(), updated: o.now() };
        if (!w.draft) w.published = o.now();
        db.works.push(w); save(); return { id: w.id };
      }
    }
    if (m === 'POST' && (a = p.match(/^\/classes\/(\w+)\/import$/))) {
      const c = cls(a[1]); needOwner(c, u);
      if (b.zemstark && Array.isArray(b.works)) {
        const ids = [];
        for (const x of b.works.slice(0, 50)) { if (!isObj(x)) continue; const w = { id: o.id(), cid: c.id, ...cleanWork(x, o), created: o.now(), updated: o.now() }; if (!w.draft) w.published = o.now(); db.works.push(w); ids.push(w.id); }
        save(); return { imported: ids.length, ids, zemstark: true };
      }
      const list = Array.isArray(b) ? b : Array.isArray(b.courseWork) ? b.courseWork : bad(400, 'JSON ichida courseWork (Classroom) yoki works (Zemstark) ro‘yxati topilmadi');
      return { imported: importWorks(c.id, list, {}) };
    }
    if (m === 'GET' && (a = p.match(/^\/classes\/(\w+)\/gradebook$/))) { const c = cls(a[1]); needOwner(c, u); return gradebook(c); }
    if (m === 'GET' && (a = p.match(/^\/classes\/(\w+)\/progress(?:\/(\w+))?$/))) {
      const c = cls(a[1]); needMember(c, u);
      const uid = a[2] || u.id; if (uid !== u.id) needOwner(c, u);
      if (!db.members.some(x => x.cid === c.id && x.uid === uid)) bad(404, 'O‘quvchi topilmadi');
      return progress(c, uid);
    }

    if ((a = p.match(/^\/works\/(\w+)$/))) {
      const w = work(a[1]), c = cls(w.cid); needMember(c, u); if (!visible(w, u)) bad(404, 'Vazifa topilmadi');
      if (m === 'GET') {
        const ci = { id: c.id, name: c.name, color: color(c.id) };
        if (owner(c, u)) return { role: 'teacher', work: teacherWork(w), cls: ci };
        const s = subOf(w.id, u.id), st = startOf(w.id, u.id);
        if (w.kind === 'vocab') { const v = vstate(w.id, u.id); return { role: 'student', work: studentWork(w), cls: ci, vocab: { cards: v ? v.cards : {}, ...vsum(w, u.id) }, now: o.now() }; }
        const reveal = !!(s && s.returned && w.showAnswers);
        return { role: 'student', work: reveal ? teacherWork(w) : studentWork(w), reveal, cls: ci, sub: s ? studentSub(s, w) : null,
          started: st ? st.at : null, canRedo: s ? !s.returned && canRedo(w) : true, now: o.now() };
      }
      needOwner(c, u);
      if (m === 'POST') {
        const wasDraft = w.draft;
        Object.assign(w, cleanWork(b, o), { updated: o.now() });
        if (wasDraft && !w.draft) w.published = o.now();
        db.subs.filter(s => s.wid === w.id).forEach(s => recompute(s, w));
        save(); return { id: w.id };
      }
      if (m === 'DELETE') {
        db.works = db.works.filter(x => x !== w); db.subs = db.subs.filter(s => s.wid !== w.id); db.starts = db.starts.filter(s => s.wid !== w.id); db.vocab = db.vocab.filter(v => v.wid !== w.id);
        save(); return { ok: 1 };
      }
    }
    if (m === 'POST' && (a = p.match(/^\/works\/(\w+)\/publish$/))) {
      const w = work(a[1]); needOwner(cls(w.cid), u);
      if (w.draft) { w.draft = false; w.published = o.now(); save(); }
      return { ok: 1 };
    }
    if (m === 'POST' && (a = p.match(/^\/works\/(\w+)\/copy$/))) {
      const w = work(a[1]); needOwner(cls(w.cid), u);
      const t = cls(str(b.cid, 30) || w.cid); needOwner(t, u);
      const n = JSON.parse(JSON.stringify(w));
      Object.assign(n, { id: o.id(), cid: t.id, title: t.id === w.cid ? w.title + ' (nusxa)' : w.title, draft: true, created: o.now(), updated: o.now() });
      delete n.published; delete n.src; delete n.nt; delete n.rem;
      db.works.push(n); save(); return { id: n.id };
    }
    if (m === 'POST' && (a = p.match(/^\/works\/(\w+)\/start$/))) {
      const w = work(a[1]), c = cls(w.cid);
      if (u.role !== 'student') bad(403, 'Faqat o‘quvchi uchun'); needMember(c, u);
      if (!live(w) || NOSUB.has(w.kind)) bad(400, 'Bu vazifani bajarib bo‘lmaydi');
      let st = startOf(w.id, u.id);
      if (!st) { st = { wid: w.id, uid: u.id, at: o.now() }; db.starts.push(st); save(); }
      return { startedAt: st.at, now: o.now() };
    }
    if (m === 'POST' && (a = p.match(/^\/works\/(\w+)\/submit$/))) {
      const w = work(a[1]), c = cls(w.cid);
      if (u.role !== 'student') bad(403, 'Faqat o‘quvchi topshira oladi'); needMember(c, u);
      if (!live(w) || NOSUB.has(w.kind)) bad(400, 'Bu vazifani topshirib bo‘lmaydi');
      const old = subOf(w.id, u.id);
      if (old && old.returned) bad(409, 'Ish allaqachon baholangan');
      if (old && !canRedo(w)) bad(409, 'Bu vazifani faqat bir marta topshirish mumkin');
      const st = startOf(w.id, u.id), now = o.now();
      const s = { id: old ? old.id : o.id(), wid: w.id, uid: u.id, answers: cleanAnswers(w, b.answers, o, u.id), text: txt(b.text, 30000),
        files: (Array.isArray(b.files) ? b.files : []).slice(0, 10).map(f => fileRef(f, o, u.id)).filter(Boolean),
        at: now, startedAt: st ? st.at : null, late: !!(w.dueAt && now > w.dueAt), overtime: !!(w.timeLimit && st && now - st.at > w.timeLimit * 60000 + 90000),
        log: [], snaps: [], risk: 0, manual: {}, fb: '', bandOverride: null, returned: false, attempt: (old ? old.attempt || 1 : 0) + 1 };
      if (w.proctor) {
        s.log = (Array.isArray(b.log) ? b.log : []).slice(0, 300).map(e => ({ t: Number(e && e.t) || 0, k: str(e && e.k, 20), m: str(e && e.m, 140) }));
        s.snaps = (Array.isArray(b.snaps) ? b.snaps : []).slice(0, 16).filter(x => x && typeof x.img === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.img) && x.img.length < 40000).map(x => { const r = { why: str(x.why, 140), t: Number(x.t) || 0 }; const fid = o.saveSnap ? o.saveSnap(x.img, u.id) : null; if (fid) r.fid = fid; else r.img = x.img; return r; });
        s.risk = Math.min(100, s.log.reduce((acc, e) => acc + (RISK[e.k] || 0), 0));
      }
      db.subs = db.subs.filter(x => x !== old); db.subs.push(s); recompute(s, w); save();
      return { id: s.id, status: s.status };
    }
    if (m === 'POST' && (a = p.match(/^\/works\/(\w+)\/review$/))) {
      const w = work(a[1]), c = cls(w.cid);
      if (u.role !== 'student') bad(403, 'Faqat o‘quvchi uchun'); needMember(c, u);
      if (w.kind !== 'vocab' || !live(w)) bad(400, 'Bu lug‘at to‘plami emas');
      const card = w.cards.find(x => x.id === str(b.card, 20)) || bad(404, 'Kartochka topilmadi');
      let v = vstate(w.id, u.id); if (!v) { v = { wid: w.id, uid: u.id, cards: {}, last: 0 }; db.vocab.push(v); }
      const x = v.cards[card.id] || (v.cards[card.id] = { b: 0, due: 0, r: 0, w: 0 }), now = o.now();
      if (b.ok) { x.b = Math.min(LEITNER.length - 1, x.b + 1); x.r++; x.due = now + LEITNER[x.b] * 864e5; }
      else { x.b = 1; x.w++; x.due = now + 60000; }
      x.last = now; v.last = now; save();
      return { card: x, ...vsum(w, u.id) };
    }
    if (m === 'GET' && (a = p.match(/^\/works\/(\w+)\/vocab$/))) {
      const w = work(a[1]), c = cls(w.cid); needOwner(c, u);
      return students(c.id).map(st => ({ uid: st.id, name: st.name, ...vsum(w, st.id) }));
    }
    if (m === 'GET' && (a = p.match(/^\/works\/(\w+)\/analysis$/))) {
      const w = work(a[1]); needOwner(cls(w.cid), u); return analysis(w);
    }
    if (m === 'GET' && (a = p.match(/^\/works\/(\w+)\/subs$/))) {
      const w = work(a[1]), c = cls(w.cid); needOwner(c, u);
      return students(c.id).map(st => { const s = subOf(w.id, st.id); return { uid: st.id, name: st.name, started: !!startOf(w.id, st.id), sub: s ? subSummary(s) : null }; });
    }
    if (m === 'GET' && (a = p.match(/^\/subs\/(\w+)$/))) {
      const s = db.subs.find(x => x.id === a[1]) || bad(404, 'Topshirilgan ish topilmadi');
      const w = work(s.wid), c = cls(w.cid);
      if (!owner(c, u)) { if (s.uid !== u.id) bad(403, 'Ruxsat yo‘q'); return { role: 'student', wid: w.id }; }
      const order = students(c.id).map(x => subOf(w.id, x.id)).filter(Boolean);
      const i = order.findIndex(x => x.id === s.id);
      return { role: 'teacher', sub: s, work: teacherWork(w), student: pub(user(s.uid)), cls: { id: c.id, name: c.name },
        nav: { prev: i > 0 ? order[i - 1].id : null, next: i >= 0 && i < order.length - 1 ? order[i + 1].id : null, index: i + 1, total: order.length } };
    }
    if (m === 'POST' && (a = p.match(/^\/subs\/(\w+)\/grade$/))) {
      const s = db.subs.find(x => x.id === a[1]) || bad(404, 'Topshirilgan ish topilmadi');
      const w = work(s.wid); needOwner(cls(w.cid), u);
      const M = meta(w), mm = isObj(b.manual) ? b.manual : {}, qmap = new Map(w.questions.map(x => [x.id, x]));
      for (const [qid, x] of Object.entries(mm)) {
        if (!isObj(x)) continue;
        const qq = qid === '_general' ? (M.general ? { id: '_general', type: 'general', pts: w.pts } : null) : qmap.get(qid);
        if (!qq || qq.type === 'section') continue;
        const e = { fb: str(x.fb, 3000) };
        if (MAN.has(qq.type) || qq.type === 'general') {
          if (w.kind === 'ielts' && qq.type !== 'general') { e.bands = {}; CRIT.forEach(k => { e.bands[k] = bandVal(isObj(x.bands) ? x.bands[k] : null); }); }
          else e.score = num(x.score, 0, qq.pts);
        } else e.override = num(x.override, 0, qq.pts);
        s.manual[qid] = e;
      }
      if (b.fb !== undefined) s.fb = str(b.fb, 5000);
      if (b.bandOverride !== undefined) s.bandOverride = w.kind === 'ielts' ? bandVal(b.bandOverride) : null;
      if (b.returned === true) { s.returned = true; s.returnedAt = o.now(); }
      recompute(s, w); save(); return subSummary(s);
    }
    bad(404, 'Topilmadi');
  }
  return { route, importWorks, db, self, findUser, taken };
}

/* ---------- AI yordamchi (Writing) — server va demo bir xil so'rovdan foydalanadi ---------- */
function aiPrompt(w, q, answer) {
  const ielts = w.kind === 'ielts', t1 = q.task === 'task1', n = words(answer);
  const crit = ielts ? [(t1 ? 'Task Achievement' : 'Task Response'), 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy'] : null;
  return [
    ielts ? `You are an experienced IELTS Writing examiner. Assess this IELTS Writing ${t1 ? 'Task 1' : 'Task 2'} response using the public IELTS band descriptors.`
          : `You are an experienced English teacher. Assess this student's writing for an English class (level and topic are given by the task).`,
    '', 'TASK:', q.text || '(no prompt)', q.minWords ? `Minimum length: ${q.minWords} words.` : '',
    '', `STUDENT RESPONSE (${n} words), between the markers:`, '<<<RESPONSE', String(answer || '').slice(0, 12000), 'RESPONSE>>>', '',
    'Reply with ONLY one JSON object, no other text:',
    ielts ? `{"bands":{"a":6.5,"b":6,"c":6,"d":6.5},"feedback":"...","strengths":["..."],"improve":["..."]}\nbands: a = ${crit[0]}, b = ${crit[1]}, c = ${crit[2]}, d = ${crit[3]}; each 0 to 9 in steps of 0.5. Apply the usual penalty if the response is under the minimum length, off-topic or memorised.`
          : `{"score":7,"feedback":"...","strengths":["..."],"improve":["..."]}\nscore: 0 to ${q.pts} (the task is worth ${q.pts} points).`,
    'feedback: 3-5 sentences in Uzbek (Latin script), addressed to the student, concrete, quoting 1-2 short phrases from the response.',
    'strengths and improve: 2-3 short items each, in Uzbek (Latin script); for "improve" give a corrected English example where useful.',
    'If the response is empty or unrelated to the task, give the lowest scores and say so in feedback.'
  ].filter(x => x !== '').join('\n');
}
function aiNormalize(raw, w, q) {
  if (typeof raw === 'string') { const i = raw.indexOf('{'), j = raw.lastIndexOf('}'); try { raw = JSON.parse(raw.slice(i, j + 1)); } catch (e) { raw = null; } }
  if (!isObj(raw)) bad(502, 'AI javobini o‘qib bo‘lmadi. Qaytadan urinib ko‘ring');
  const list = v => (Array.isArray(v) ? v : []).map(x => str(x, 300)).filter(Boolean).slice(0, 4);
  const out = { feedback: str(raw.feedback, 3000), strengths: list(raw.strengths), improve: list(raw.improve) };
  if (w.kind === 'ielts') { out.bands = {}; for (const k of CRIT) { const b = Number(isObj(raw.bands) ? raw.bands[k] : NaN); out.bands[k] = Number.isFinite(b) ? Math.min(9, Math.max(0, Math.round(b * 2) / 2)) : null; } }
  else { const sc = Number(raw.score); out.score = Number.isFinite(sc) ? Math.min(q.pts, Math.max(0, Math.round(sc * 2) / 2)) : null; }
  return out;
}

const api = { createCore, emptyDb, HttpErr, bad, str, unitsOf, LEITNER, aiPrompt, aiNormalize, words, gapParse, words, norm, bandFromRaw, critBand, half, floorHalf, meta, gradeQ, studentQ, shuffle };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZemCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
