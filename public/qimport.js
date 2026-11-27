/* Zemstark: savollarni turli manbalardan import qilish (brauzer va Node'da bir xil ishlaydi).
   - fromText(text): oddiy matn, Word'dan nusxa, Moodle Aiken formati, Excel/CSV qatorlari -> savollar
   - docxText(bytes): .docx fayldan matn (jadvallar qatorlari tab bilan)
   - fromGForm(html): ochiq Google Forms sahifasidan savollar (FB_PUBLIC_LOAD_DATA_)
   - genPrompt()/genNormalize(): AI bilan savol yaratish uchun so'rov va javobni tekshirish
   Natija — muharrir formatidagi savollar: {id, type, text, ...}. */
(function (root) {
'use strict';
let seq = 0;
const rid = () => (Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6)).slice(-10).replace(/[^a-z0-9]/g, 'x').padStart(6, 'q');
const clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
const LET = 'ABCDEFGHIJKL';

// ---------- javob kalitini tanish ----------
const ANS_RE = /^\s*(?:answer|answers|ans|key|correct(?:\s+answer)?|javob(?:i)?|to[‘’'`ʻ]?g[‘’'`ʻ]?ri\s+javob|ответ|правильный\s+ответ)\s*[:=\-–—]\s*(.+)$/i;
const OPT_RE = /^\s*(?:\(?([A-La-l])[\.\)\]:]|\(([A-La-l])\))\s*(.*)$/;
const NUM_RE = /^\s*(?:(?:question|savol|вопрос|q)\s*)?(\d{1,3})\s*[\.\)\]:]\s*(.*)$/i;
const TF = { TRUE: 'T', T: 'T', FALSE: 'F', F: 'F', 'NOT GIVEN': 'NG', NG: 'NG', YES: 'T', Y: 'T', NO: 'F', N: 'F', 'TO‘G‘RI': 'T', "TO'G'RI": 'T', 'NOTO‘G‘RI': 'F', "NOTO'G'RI": 'F', 'BERILMAGAN': 'NG', 'ВЕРНО': 'T', 'НЕВЕРНО': 'F', 'НЕТ ДАННЫХ': 'NG' };
const tfOf = s => TF[clean(s).toUpperCase().replace(/[.!]$/, '')];
const SEC_RE = /^\s*(part|passage|section|reading passage|listening part|bo[‘’'`ʻ]?lim|qism|часть|раздел)\s*\d*[\s:.\-–—·]*.{0,60}$/i;
const markCorrect = s => { const m = /^\s*[*✓✔+]\s*(.+)$/.exec(s) || /^(.+?)\s*(?:\*|✓|✔|\(\+\)|\[x\])\s*$/i.exec(s); return m ? m[1] : null; };

// "1-B 2-C 3 TRUE" yoki qatorma-qator "1. B" ko'rinishidagi umumiy kalit
function parseKey(lines) {
  const key = {}; let n = 0;
  for (const raw of lines) {
    const s = clean(raw); if (!s) continue;
    const re = /(\d{1,3})\s*[\.\)\-–:=]?\s*((?:not given|true|false|yes|no|[A-La-l](?:\s*[,&]\s*[A-La-l])*|[^\s,;]+(?:\s+[^\s\d,;][^\s,;]*)*?))(?=\s*(?:[,;]|\s\d{1,3}\s*[\.\)\-–:=]?\s|$))/gi;
    let m, any = false;
    while ((m = re.exec(s))) { key[+m[1]] = clean(m[2]); any = true; n++; }
    if (!any) return null;
  }
  return n ? key : null;
}

function blockToQ(b, warn) {
  const lines = b.lines.map(l => l.replace(/\s+$/, '')).filter(l => clean(l));
  let ans = b.key != null ? b.key : null;
  const text = [], opts = [], correct = [];
  for (const l of lines) {
    const am = ANS_RE.exec(l); if (am) { ans = clean(am[1]); continue; }
    const om = OPT_RE.exec(l);
    if (om && (opts.length || text.length) && clean(om[3])) {
      // bir qatorda bir nechta variant: "A) play  B) are playing  C) played"
      const many = /\s\(?[B-L][\.\)]\s/.test(om[3]) ? l.split(/(?:^|\s+)\(?[A-L][\.\)]\s*/).map(clean).filter(Boolean) : [om[3]];
      for (let v of many) { v = clean(v); const mk = markCorrect(v); if (mk) { v = clean(mk); correct.push(opts.length); } opts.push(v); }
      continue;
    }
    if (opts.length && /^\s{2,}|^\t/.test(l)) { opts[opts.length - 1] += ' ' + clean(l); continue; }
    text.push(clean(l));
  }
  let qt = text.join('\n').trim();
  if (!qt && !opts.length) return null;
  // variantlar bitta qatorda: "A) cat B) dog C) cow"
  if (!opts.length) {
    const one = /(?:^|\s)\(?([A-D])[\.\)]\s*\S/g; const hits = [...qt.matchAll(one)];
    if (hits.length >= 3 && hits[0][1] === 'A') {
      const first = qt.slice(0, hits[0].index).trim();
      const rest = qt.slice(hits[0].index).split(/(?:^|\s)\(?[A-L][\.\)]\s*/).map(clean).filter(Boolean);
      if (first && rest.length >= 2) { qt = first; rest.forEach(v => { const mk = markCorrect(v); if (mk) correct.push(opts.length); opts.push(clean(mk || v)); }); }
    }
  }
  const q = { id: rid(), type: 'short', text: qt };
  if (opts.length >= 2) {
    // faqat True/False/Not Given variantlari bo'lsa — TFNG
    const tfOpts = opts.map(tfOf);
    if (opts.length <= 3 && tfOpts.every(Boolean)) {
      q.type = 'tfng'; q.variant = /yes|no/i.test(opts.join(' ')) ? 'ynng' : 'tfng';
      const a = correct.length ? tfOpts[correct[0]] : ans != null ? (tfOf(ans) || tfOpts[LET.indexOf(clean(ans).toUpperCase())]) : '';
      q.answer = a || ''; q.pts = 1; if (!q.answer) warn.push(q.id);
      return q;
    }
    q.type = 'mcq'; q.options = opts; q.pts = 1;
    let a = correct.slice();
    if (!a.length && ans != null) {
      const s = clean(ans);
      if (/^[A-La-l](\s*[,&/\s]\s*[A-La-l])*$/.test(s)) a = s.toUpperCase().split(/[^A-L]+/).filter(Boolean).map(x => LET.indexOf(x));
      else { const k = opts.findIndex(o => o.toLowerCase() === s.toLowerCase()); if (k >= 0) a = [k]; }
    }
    q.answer = [...new Set(a.filter(i => i >= 0 && i < opts.length))].sort((x, y) => x - y);
    if (q.answer.length > 1) q.pts = q.answer.length;
    if (!q.answer.length) warn.push(q.id);
    return q;
  }
  const tf = ans != null && tfOf(ans);
  if (tf) { q.type = 'tfng'; q.variant = /^(yes|no|y|n)$/i.test(clean(ans)) ? 'ynng' : 'tfng'; q.answer = tf; q.pts = 1; return q; }
  if (/\{[^{}\n]+\}/.test(qt)) { q.type = 'gap'; q.bank = false; delete q.pts; return q; }
  const blank = /_{3,}|…{1,}|\.{4,}|\(\s*\d*\s*\)/;
  if (ans != null && blank.test(qt)) {
    const parts = clean(ans).split(/\s*[;|]\s*/); let k = 0;
    q.type = 'gap'; q.bank = false; q.text = qt.replace(new RegExp(blank.source, 'g'), m => parts[k] !== undefined ? '{' + parts[k++].split(/\s*\/\s*/).join('|') + '}' : m);
    return q;
  }
  if (ans != null) { q.answers = clean(ans).split(/\s*[|/]\s*/).filter(Boolean); q.pts = 1; return q; }
  if (/\b(write|essay|describe|explain|discuss|letter|words)\b|yozing|esse|напишите/i.test(qt) && qt.length > 40) { q.type = 'writing'; q.minWords = (/(\d{2,4})\s*(words|so[‘’'`ʻ]?z|слов)/i.exec(qt) || [])[1] * 1 || 0; q.task = ''; q.image = null; q.pts = 10; return q; }
  q.answers = []; q.pts = 1; warn.push(q.id); return q;
}

// Excel/Google Sheets'dan nusxa (tab) yoki CSV qatorlari
function fromRows(rows, warn) {
  let start = 0;
  if (rows[0] && rows[0].some(c => /^(savol|question|вопрос|q)$/i.test(clean(c)))) start = 1;
  const out = [];
  for (const r of rows.slice(start)) {
    const cells = r.map(clean); while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (!cells.length || !cells[0]) continue;
    if (cells.length === 1) { out.push({ id: rid(), type: 'section', text: cells[0], passage: '', audio: null, image: null }); continue; }
    const [text, ...rest] = cells;
    if (rest.length === 1) { const b = blockToQ({ lines: [text], key: rest[0] }, warn); if (b) out.push(b); continue; }
    const last = rest[rest.length - 1], opts = rest.slice(0, -1);
    const isKey = /^[A-La-l](\s*[,&/]\s*[A-La-l])*$/.test(last) || opts.some(o => o.toLowerCase() === last.toLowerCase()) || tfOf(last);
    const b = blockToQ({ lines: [text, ...(isKey ? opts : rest).map((o, i) => LET[i] + ') ' + o)], key: isKey ? last : null }, warn);
    if (b) out.push(b);
  }
  return out;
}
function splitCsv(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}

function fromText(input) {
  const text = String(input || '').replace(/\r\n?/g, '\n').replace(/\u2028|\u2029/g, '\n');
  const warn = [];
  const all = text.split('\n');
  const nonEmpty = all.filter(l => clean(l));
  if (!nonEmpty.length) return { questions: [], missing: [], format: 'empty' };
  // jadval?
  const tabbed = nonEmpty.filter(l => l.includes('\t')).length;
  if (tabbed >= Math.max(1, nonEmpty.length * 0.6)) return { questions: fromRows(nonEmpty.map(l => l.split('\t')), warn), missing: warn, format: 'table' };
  const semi = nonEmpty.filter(l => (l.match(/;/g) || []).length >= 2).length;
  if (semi >= Math.max(2, nonEmpty.length * 0.8)) return { questions: fromRows(nonEmpty.map(l => splitCsv(l, ';')), warn), missing: warn, format: 'csv' };
  // oxiridagi umumiy javoblar kaliti
  let body = all, key = null;
  for (let i = all.length - 1; i >= 0; i--) {
    if (/^\s*(answer\s*key|answers|javoblar(?:\s+kaliti)?|kalit|ключ(?:\s+ответов)?|ответы)\s*[:\-–—]?\s*(.*)$/i.test(all[i])) {
      const head = /^\s*(?:answer\s*key|answers|javoblar(?:\s+kaliti)?|kalit|ключ(?:\s+ответов)?|ответы)\s*[:\-–—]?\s*(.*)$/i.exec(all[i])[1];
      const k = parseKey([head, ...all.slice(i + 1)].filter(l => clean(l)));
      if (k) { key = k; body = all.slice(0, i); }
      break;
    }
  }
  // matn ichidagi jadvallar (ketma-ket tabli qatorlar) alohida o'qiladi
  const tables = [];
  { const nb = []; let run = [];
    const flushRun = () => { if (run.length >= 2) { tables.push(run); nb.push('\u0000T' + (tables.length - 1)); } else nb.push(...run); run = []; };
    for (const l of body) { if (l.includes('\t') && clean(l)) run.push(l); else { flushRun(); nb.push(l); } }
    flushRun(); body = nb; }
  // bloklarga ajratish: raqamli savol boshi yoki bo'sh qator
  const blocks = []; let cur = null, sawNum = false;
  const numbered = body.filter(l => NUM_RE.test(l) && !OPT_RE.test(l)).length >= 2;
  const push = () => { if (cur && cur.lines.some(l => clean(l))) blocks.push(cur); cur = null; };
  for (const l of body) {
    if (l.startsWith('\u0000T')) { push(); blocks.push({ table: tables[+l.slice(2)] }); continue; }
    if (!clean(l)) { if (!numbered) push(); continue; }
    const nm = NUM_RE.exec(l);
    if (nm && numbered && !OPT_RE.test(l)) { push(); cur = { num: +nm[1], lines: [nm[2]] }; sawNum = true; continue; }
    if (!cur && SEC_RE.test(l) && clean(l).length < 70) { blocks.push({ section: clean(l) }); continue; }
    if (!cur) cur = { lines: [] };
    cur.lines.push(l);
  }
  push();
  const qs = [];
  for (const b of blocks) {
    if (b.section) { qs.push({ id: rid(), type: 'section', text: b.section, passage: '', audio: null, image: null }); continue; }
    if (b.table) { qs.push(...fromRows(b.table.map(l => l.split('\t')), warn)); continue; }
    // raqamli rejimda birinchi savoldan oldingi matn — sarlavha yoki matn (passage)
    if (numbered && !b.num) {
      const t = b.lines.map(clean).filter(Boolean);
      const lastQ = qs[qs.length - 1];
      if (t.length && lastQ && lastQ.type === 'section' && !lastQ.passage && t.join(' ').length > 120) { lastQ.passage = t.join('\n\n'); continue; }
      if (t.length && !t.some(x => ANS_RE.test(x))) { qs.push(t.join(' ').length <= 120 ? { id: rid(), type: 'section', text: t.join(' '), passage: '', audio: null, image: null } : { id: rid(), type: 'section', text: t[0].length <= 100 ? t[0] : 'Passage', passage: (t[0].length <= 100 ? t.slice(1) : t).join('\n\n'), audio: null, image: null }); continue; }
    }
    if (key && b.num && key[b.num] != null) b.key = key[b.num];
    // raqamsiz rejimda: birinchi qator sarlavha bo'lsa (variant/javobsiz qisqa qator va undan keyin matn) — bo'lim
    const q = blockToQ(b, warn); if (q) qs.push(q);
  }
  // ketma-ket kelgan javobsiz uzun matn — Reading passage bo'lishi mumkin: oldingi bo'limga biriktiramiz
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (q.type === 'writing' || q.type !== 'short' || q.answers.length || q.text.length < 400) continue;
    const prev = qs[i - 1];
    if (prev && prev.type === 'section' && !prev.passage) { prev.passage = q.text; qs.splice(i, 1); i--; warn.splice(warn.indexOf(q.id), 1); }
    else { qs[i] = { id: q.id, type: 'section', text: 'Passage', passage: q.text, audio: null, image: null }; warn.splice(warn.indexOf(q.id), 1); }
  }
  return { questions: qs, missing: warn.filter(id => qs.some(q => q.id === id)), format: sawNum ? 'numbered' : 'blocks' };
}

// ---------- .docx -> matn ----------
async function inflateRaw(bytes) {
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') { try { return new Uint8Array(require('zlib').inflateRawSync(bytes)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } }
  if (typeof DecompressionStream === 'undefined') throw new Error('Brauzer .docx faylni ocha olmaydi. Matnni nusxalab joylang');
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
async function unzipEntry(bytes, name) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Bu .docx fayl emas yoki buzilgan');
  let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const fname = dec.decode(b.subarray(p + 46, p + 46 + nl));
    if (fname === name) {
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
      const data = b.subarray(start, start + csize);
      return dec.decode(method === 0 ? data : await inflateRaw(data));
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error('Bu .docx fayl emas yoki buzilgan');
}
const xmlText = s => s.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
async function docxText(bytes) {
  const xml = await unzipEntry(bytes, 'word/document.xml');
  const body = (/<w:body>([\s\S]*)<\/w:body>/.exec(xml) || [, xml])[1];
  const out = [];
  // jadvallar: har qator — tab bilan ajratilgan
  const parts = body.split(/(<w:tbl>[\s\S]*?<\/w:tbl>)/);
  let listNo = {};
  for (const part of parts) {
    if (part.startsWith('<w:tbl>')) {
      for (const tr of part.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || []) out.push((tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(tc => (tc.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || []).map(xmlText).join(' ').trim()).join('\t'));
      out.push('');
      continue;
    }
    for (const p of part.match(/<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g) || []) {
      let t = xmlText(p);
      // Word'ning avtomatik raqamlangan ro'yxati: matnda raqam yo'q, uni tiklaymiz
      const num = /<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"\/>[\s\S]*?<w:numId w:val="(\d+)"\/>/.exec(p);
      if (num && clean(t)) {
        const lvl = +num[1], id = num[2], k = id + ':' + lvl;
        listNo[k] = (listNo[k] || 0) + 1;
        for (const kk of Object.keys(listNo)) if (kk.startsWith(id + ':') && +kk.split(':')[1] > lvl) delete listNo[kk];
        t = (lvl === 0 ? listNo[k] + '. ' : LET[(listNo[k] - 1) % 12] + ') ') + t;
      }
      const bold = /<w:b\/>|<w:b w:val="(?:1|true)"\/>/.test(p) && /<w:highlight|<w:color w:val="(?:00B050|00FF00|FF0000)"/.test(p);
      out.push(bold && OPT_RE.test(t) ? t + ' *' : t);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------- Google Forms ----------
function fromGForm(html) {
  const s = String(html || '');
  const m = /FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/.exec(s);
  if (!m) throw new Error('Bu sahifada Google Forms ma’lumoti topilmadi. Forma ochiq (login talab qilmaydigan) ekanini tekshiring');
  let data; try { data = JSON.parse(m[1]); } catch (e) { throw new Error('Google Forms ma’lumotini o‘qib bo‘lmadi'); }
  const f = data[1] || [], items = f[1] || [];
  const title = clean(f[8] || data[3] || ''), desc = String(f[0] || '').trim();
  const qs = [], warn = [], skipped = [];
  for (const it of items) {
    if (!Array.isArray(it)) continue;
    const t = clean(it[1]), d = String(it[2] || '').trim(), type = it[3], q4 = Array.isArray(it[4]) ? it[4] : [];
    const text = [t, d].filter(Boolean).join('\n');
    const opts = q4[0] && Array.isArray(q4[0][1]) ? q4[0][1].map(o => clean(o && o[0])).filter(Boolean) : [];
    // test (quiz) rejimida to'g'ri javoblar ba'zan ochiq bo'ladi
    const keyRaw = q4[0] && Array.isArray(q4[0][9]) ? q4[0][9] : null;
    const keyVals = keyRaw && Array.isArray(keyRaw[1]) ? keyRaw[1].map(x => clean(x && x[0])).filter(Boolean) : [];
    const pts = keyRaw && keyRaw[0] ? +keyRaw[0] || 1 : 1;
    if (type === 0) { const q = { id: rid(), type: 'short', text, answers: keyVals, pts }; if (!keyVals.length) warn.push(q.id); qs.push(q); }
    else if (type === 1) qs.push({ id: rid(), type: 'writing', text, minWords: 0, task: '', image: null, pts: Math.max(pts, 1) === 1 ? 10 : pts });
    else if (type === 2 || type === 3 || type === 4) {
      if (opts.length < 2) { skipped.push(t || '?'); continue; }
      const tfo = opts.map(tfOf);
      if (opts.length <= 3 && tfo.every(Boolean) && type !== 4) {
        const a = keyVals.length ? tfOf(keyVals[0]) : ''; const q = { id: rid(), type: 'tfng', text, variant: /yes|no/i.test(opts.join(' ')) ? 'ynng' : 'tfng', answer: a || '', pts };
        if (!q.answer) warn.push(q.id); qs.push(q); continue;
      }
      const ans = keyVals.map(v => opts.findIndex(o => o === v)).filter(i => i >= 0);
      const q = { id: rid(), type: 'mcq', text, options: opts, answer: ans, pts: type === 4 ? Math.max(ans.length, 1) : pts };
      if (!ans.length) warn.push(q.id); qs.push(q);
    }
    else if (type === 6 || type === 8) { if (t || d) qs.push({ id: rid(), type: 'section', text: t || 'Bo‘lim', passage: d, audio: null, image: null }); }
    else if (type === 11 || type === 12) { qs.push({ id: rid(), type: 'section', text: t || (type === 11 ? 'Rasm' : 'Video'), passage: d + (type === 12 && it[6] && it[6][3] ? '\nhttps://youtu.be/' + it[6][3] : ''), audio: null, image: null }); skipped.push((type === 11 ? 'rasm: ' : 'video: ') + (t || '—')); }
    else skipped.push(t || '?');
  }
  return { title, desc, questions: qs, missing: warn, skipped };
}
const GFORM_RE = /^https:\/\/(docs\.google\.com\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[\w-]+|forms\.gle\/[\w-]+)/i;

// ---------- AI bilan savol yaratish ----------
const GEN_TYPES = { mcq: 'multiple choice (4 options, one correct)', tfng: 'True / False / Not Given statements', gap: 'gap fill (sentence with the answer in {curly braces})', short: 'short answer (1-3 words)', match: 'matching (pairs)', writing: 'writing task' };
function genPrompt(o) {
  const types = (o.types || ['mcq']).filter(t => GEN_TYPES[t]);
  const n = Math.max(1, Math.min(30, +o.count || 10));
  return [
    'You are an experienced English teacher preparing exercises for Uzbek learners of English' + (o.level ? ` at ${o.level} level` : '') + (o.ielts ? ' preparing for IELTS' : '') + '.',
    o.text ? 'Create questions based ONLY on this text (between the markers):\n<<<TEXT\n' + String(o.text).slice(0, 15000) + '\nTEXT>>>' : 'Topic: ' + String(o.topic || 'general English grammar and vocabulary').slice(0, 500),
    `Create exactly ${n} questions. Use these question types, mixed: ${types.map(t => t + ' = ' + GEN_TYPES[t]).join('; ')}.`,
    'All questions and options in English. Make wrong options plausible. Do not repeat questions.',
    'Reply with ONLY one JSON object, no other text, in this shape:',
    '{"questions":[{"type":"mcq","text":"...","options":["...","...","...","..."],"answer":1},{"type":"tfng","text":"statement","answer":"T|F|NG"},{"type":"gap","text":"She {goes} to school."},{"type":"short","text":"...","answers":["..."]},{"type":"match","text":"instruction","pairs":[{"l":"...","r":"..."}]},{"type":"writing","text":"task","minWords":150}]}',
    'answer for mcq is the 0-based index of the correct option.'
  ].join('\n');
}
function genNormalize(raw) {
  let j = raw;
  if (typeof raw === 'string') { const m = /\{[\s\S]*\}/.exec(raw); if (!m) throw new Error('AI javobini o‘qib bo‘lmadi. Qaytadan urinib ko‘ring'); try { j = JSON.parse(m[0]); } catch (e) { throw new Error('AI javobini o‘qib bo‘lmadi. Qaytadan urinib ko‘ring'); } }
  const list = Array.isArray(j) ? j : j && Array.isArray(j.questions) ? j.questions : [];
  const out = [];
  for (const x of list.slice(0, 40)) {
    if (!x || typeof x !== 'object') continue;
    const text = clean(x.text).slice(0, 2000); if (!text) continue;
    if (x.type === 'mcq') { const options = (Array.isArray(x.options) ? x.options : []).map(clean).filter(Boolean).slice(0, 8); const a = Array.isArray(x.answer) ? x.answer.map(Number) : [Number(x.answer)]; if (options.length < 2) continue; out.push({ id: rid(), type: 'mcq', text, options, answer: a.filter(i => Number.isInteger(i) && i >= 0 && i < options.length), pts: 1 }); }
    else if (x.type === 'tfng') { const a = tfOf(x.answer) || ''; out.push({ id: rid(), type: 'tfng', text, variant: 'tfng', answer: a, pts: 1 }); }
    else if (x.type === 'gap') { if (/\{[^{}\n]+\}/.test(text)) out.push({ id: rid(), type: 'gap', text, bank: false }); }
    else if (x.type === 'short') { const answers = (Array.isArray(x.answers) ? x.answers : [x.answer]).map(clean).filter(Boolean); if (answers.length) out.push({ id: rid(), type: 'short', text, answers, pts: 1 }); }
    else if (x.type === 'match') { const pairs = (Array.isArray(x.pairs) ? x.pairs : []).map(p => ({ l: clean(p && p.l), r: clean(p && p.r) })).filter(p => p.l && p.r).slice(0, 20); if (pairs.length >= 2) out.push({ id: rid(), type: 'match', text, pairs, extra: [] }); }
    else if (x.type === 'writing') out.push({ id: rid(), type: 'writing', text, minWords: Math.max(0, Math.min(1000, +x.minWords || 0)), task: '', image: null, pts: 10 });
  }
  if (!out.length) throw new Error('AI yaroqli savol qaytarmadi. Qaytadan urinib ko‘ring');
  return out;
}

const api = { fromText, docxText, fromGForm, GFORM_RE, genPrompt, genNormalize, parseKey };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZemImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
