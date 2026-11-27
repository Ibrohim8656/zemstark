/* Zemstark HTML kit: o'qituvchi yuklagan HTML vazifani tahlil qiladi.
   - parse(): kutubxonasiz kichik HTML parser (brauzer va Node'da bir xil ishlaydi)
   - fieldKeys(): maydon kalitlari — iframe ichidagi "ko'prik" ham aynan shu funksiyadan foydalanadi
   - analyze(): maydonlar, ularning yorlig'i, variantlari va aniqlangan to'g'ri javoblari
   - convert(): HTML'ni saytning o'z savollariga aylantirish */
(function (root) {
'use strict';
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const BLOCK = new Set('p div li tr td th h1 h2 h3 h4 h5 h6 section article blockquote pre ul ol table fieldset legend dt dd dl header footer main form label figure figcaption'.split(' '));
const CLOSE_P = new Set('address article aside blockquote div dl fieldset footer form h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section table ul'.split(' '));
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', times: '×', copy: '©', bull: '•', middot: '·', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', pound: '£', euro: '€', yen: '¥', cent: '¢', sect: '§', reg: '®', trade: '™', larr: '←', rarr: '→', uarr: '↑', darr: '↓', ensp: ' ', emsp: ' ', thinsp: ' ', shy: '', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', check: '✓', divide: '÷', plusmn: '±', minus: '−', prime: '′', iquest: '¿', iexcl: '¡' };
const decode = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } }
  return ENT[e.toLowerCase()] ?? m;
});

function parse(src) {
  const s = String(src || ''), lower = s.toLowerCase(), root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root, i = 0;
  const push = n => { n.parent = cur; cur.children.push(n); };
  const closeTo = tag => { let n = cur; while (n && n !== root && n.tag !== tag) n = n.parent; if (n && n !== root) cur = n.parent; };
  const autoclose = tag => {
    for (let n = cur; n && n !== root; n = n.parent) {
      if (n.tag === 'p' && CLOSE_P.has(tag)) { cur = n.parent; return; }
      if (n.tag === 'li' && tag === 'li') { cur = n.parent; return; }
      if ((n.tag === 'option' || n.tag === 'optgroup') && (tag === 'option' || tag === 'optgroup')) { cur = n.parent; return; }
      if ((n.tag === 'td' || n.tag === 'th') && (tag === 'td' || tag === 'th' || tag === 'tr')) { cur = n.parent; if (tag === 'tr') continue; return; }
      if (n.tag === 'tr' && tag === 'tr') { cur = n.parent; return; }
      if ((n.tag === 'dt' || n.tag === 'dd') && (tag === 'dt' || tag === 'dd')) { cur = n.parent; return; }
      if (['ul', 'ol', 'select', 'table', 'tbody', 'thead', 'div', 'section', 'article', 'body', 'form', 'fieldset', 'dl'].includes(n.tag)) return;
    }
  };
  while (i < s.length) {
    if (s.startsWith('<!--', i)) { const j = s.indexOf('-->', i + 4); i = j < 0 ? s.length : j + 3; continue; }
    if (s[i] === '<' && (s[i + 1] === '!' || s[i + 1] === '?')) { const j = s.indexOf('>', i); i = j < 0 ? s.length : j + 1; continue; }
    if (s[i] === '<' && s[i + 1] === '/') {
      const m = /^<\/([a-zA-Z][\w-]*)[^>]*>/.exec(s.slice(i, i + 200));
      if (m) { closeTo(m[1].toLowerCase()); i += m[0].length; continue; }
    }
    if (s[i] === '<' && /[a-zA-Z]/.test(s[i + 1] || '')) {
      const m = /^<([a-zA-Z][\w-]*)/.exec(s.slice(i, i + 80)), tag = m[1].toLowerCase(), attrs = {};
      let j = i + m[0].length, selfClose = false;
      while (j < s.length) {
        while (/\s/.test(s[j] || '')) j++;
        if (s[j] === '>') { j++; break; }
        if (s[j] === '/' && s[j + 1] === '>') { j += 2; selfClose = true; break; }
        const am = /^[^\s=>/"']+/.exec(s.slice(j, j + 300));
        if (!am) { j++; continue; }
        const an = am[0].toLowerCase(); j += am[0].length;
        while (/\s/.test(s[j] || '')) j++;
        let av = '';
        if (s[j] === '=') {
          j++; while (/\s/.test(s[j] || '')) j++;
          const q = s[j];
          if (q === '"' || q === "'") { const e = s.indexOf(q, j + 1); av = s.slice(j + 1, e < 0 ? s.length : e); j = e < 0 ? s.length : e + 1; }
          else { const vm = /^[^\s>]*/.exec(s.slice(j, j + 2000)); av = vm[0]; j += av.length; }
        }
        if (!(an in attrs)) attrs[an] = decode(av);
      }
      autoclose(tag);
      const node = { tag, attrs, children: [] }; push(node);
      if (VOID.has(tag) || selfClose) { i = j; continue; }
      if (RAW.has(tag)) {
        const e = lower.indexOf('</' + tag, j), raw = s.slice(j, e < 0 ? s.length : e);
        node.children.push({ tag: '#text', text: tag === 'script' || tag === 'style' ? raw : decode(raw), parent: node });
        const g = e < 0 ? -1 : s.indexOf('>', e); i = g < 0 ? s.length : g + 1; continue;
      }
      cur = node; i = j; continue;
    }
    const nx = s.indexOf('<', i + 1), end = nx < 0 ? s.length : nx;
    push({ tag: '#text', text: decode(s.slice(i, end)) }); i = end;
  }
  let k = 0; (function num(n) { n.o = k++; (n.children || []).forEach(num); })(root);
  return root;
}
function walk(n, f) { for (const c of n.children || []) { if (f(c) === false) continue; walk(c, f); } }
function all(n) { const a = []; walk(n, x => { if (x.tag[0] !== '#') a.push(x); }); return a; }
const isAnc = (a, b) => { for (let n = b; n; n = n.parent) if (n === a) return true; return false; };
const closest = (n, f) => { for (let x = n; x && x.tag !== '#root'; x = x.parent) if (f(x)) return x; return null; };
const CHROME = new Set(['header', 'footer', 'navbar', 'nav-row', 'modal', 'modal-overlay', 'modal-content', 'modal-dialog', 'popup', 'overlay', 'context-menu', 'contextmenu', 'mobile-selection-menu', 'toolbar', 'sr-only', 'visually-hidden', 'timer-container', 'site-header', 'site-footer', 'results-modal', 'result-modal']);
const chrome = n => !!closest(n, x => ['nav', 'header', 'footer', 'template', 'dialog', 'noscript'].includes(x.tag) || (x.attrs.class || '').split(/\s+/).some(c => CHROME.has(c.toLowerCase())) || /^(results?|score|context|modal|toolbar|popup)([-_]|$)/i.test(x.attrs.id || ''));
function text(n, skip) {
  if (skip && skip.has(n)) return '';
  if (n.tag === '#text') return n.text;
  if (['script', 'style', 'head', 'title', 'select', 'button', 'noscript', 'template'].includes(n.tag)) return '';
  if (n.tag === 'br') return '\n';
  let t = ''; for (const c of n.children || []) t += text(c, skip);
  return BLOCK.has(n.tag) ? '\n' + t + '\n' : t;
}
const clean = s => String(s).replace(/[ \t \r]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const inline = s => clean(s).replace(/\s*\n\s*/g, ' ');
const stripLead = s => s.replace(/^\s*\d{1,3}\s+(?=\S)/, '').trim();
const stripNum = s => s.replace(/^\s*(?:(?:q(?:uestion)?|savol)\s*)?\d{1,3}\s*[.):\-]\s+/i, '').trim();
const truthy = v => v !== undefined && !/^(false|0|no|off|yo['‘’]?q)$/i.test(String(v).trim());
const KEYATTR = ['data-answer', 'data-correct', 'answer', 'data-key', 'data-ans', 'data-solution', 'data-right'];
const norm = s => String(s ?? '').toLowerCase().replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.,!?;:]+$/, '');

/* Maydon kalitlari. Bu funksiya iframe ichidagi ko'prikka ham matn sifatida joylanadi, shuning uchun ES5 da yozilgan. */
function fieldKeys(list) {
  var keys = [], seen = {}, skip = ['hidden', 'submit', 'button', 'reset', 'image', 'file', 'range', 'color'];
  for (var i = 0; i < list.length; i++) {
    var f = list[i], t = f.tag === 'input' ? String(f.type || 'text').toLowerCase() : f.tag, k;
    if (f.tag === 'input' && skip.indexOf(t) >= 0) { keys.push(null); continue; }
    if ((t === 'radio' || t === 'checkbox') && f.name) { keys.push('g:' + t.charAt(0) + ':' + f.name); continue; }
    k = (t === 'radio' || t === 'checkbox') ? 'f' + i : (f.name || f.id || 'f' + i);
    if (seen[k]) { seen[k]++; k = k + '#' + seen[k]; } else seen[k] = 1;
    keys.push(k);
  }
  return keys;
}

/* JS ichidagi obyekt/massivni xavfsiz o'qish (kod ishga tushirilmaydi) */
function balanced(s, i) {
  const open = s[i], close = open === '[' ? ']' : '}'; let d = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && s[j + 1] === '/') { const e = s.indexOf('\n', j); j = e < 0 ? s.length : e; continue; }
    if (c === '/' && s[j + 1] === '*') { const e = s.indexOf('*/', j + 2); j = e < 0 ? s.length : e + 1; continue; }
    if (c === open) d++; else if (c === close) { d--; if (!d) return s.slice(i, j + 1); }
  }
  return null;
}
function relaxed(src) {
  try { return JSON.parse(src); } catch (e) {}
  let out = '', i = 0, seg = '';
  const flush = () => { out += seg.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, '$1'); seg = ''; };
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      flush(); let j = i + 1, v = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { const n = src[j + 1]; v += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue; } if (c === '`' && src[j] === '$' && src[j + 1] === '{') return null; v += src[j]; j++; }
      out += JSON.stringify(v); i = j + 1; continue;
    }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    seg += c; i++;
  }
  flush();
  try { return JSON.parse(out.replace(/,\s*([}\]])/g, '$1')); } catch (e) { return null; }
}
function scriptValues(js) {
  const out = []; const re = /(?:(?:const|let|var)\s+|window\.|this\.)?([A-Za-z_$][\w$]*)\s*(?:=|:)\s*(?=[[{])/g; let m;
  while ((m = re.exec(js))) {
    const start = re.lastIndex, raw = balanced(js, start);
    if (!raw || raw.length > 400000) continue;
    const v = relaxed(raw); if (v != null) out.push({ name: m[1], value: v, len: raw.length });
    re.lastIndex = start + 1;
  }
  return out;
}
const QK = ['question', 'q', 'text', 'title', 'savol', 'prompt', 'sentence', 'statement', 'stem', 'ask', 'matn'];
const OK = ['options', 'choices', 'answers', 'variants', 'variantlar', 'javoblar', 'opts', 'option', 'alternatives'];
const AK = ['answer', 'correct', 'correctanswer', 'correct_answer', 'right', 'rightanswer', 'javob', 'togri', 'to‘g‘ri', 'ans', 'correctindex', 'correctoption', 'key', 'solution', 'answerindex'];
const pick = (o, keys) => { for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase())) return o[k]; return undefined; };
const optText = x => typeof x === 'string' || typeof x === 'number' ? String(x) : x && typeof x === 'object' ? String(x.text ?? x.label ?? x.option ?? x.value ?? x.title ?? '') : '';
function dataQuestions(js) {
  let best = null;
  for (const c of scriptValues(js)) {
    const v = c.value; if (!Array.isArray(v) || v.length < 1 || !v.every(x => x && typeof x === 'object' && !Array.isArray(x))) continue;
    const good = v.filter(x => pick(x, QK) !== undefined && (pick(x, OK) !== undefined || pick(x, AK) !== undefined)).length;
    if (good >= Math.max(1, v.length * 0.6) && (!best || good > best.good)) best = { good, v };
  }
  if (!best) return [];
  const qs = [];
  for (const x of best.v) {
    const t = String(pick(x, QK) ?? '').trim(); if (!t) continue;
    let opts = pick(x, OK), ans = pick(x, AK);
    if (Array.isArray(opts) && opts.length && typeof opts[0] === 'object' && opts[0] && ans === undefined) {
      const ci = []; opts.forEach((o, j) => { if (o && truthy(o.correct ?? o.isCorrect ?? o.right ?? o.true)) ci.push(j); }); if (ci.length) ans = ci.length === 1 ? ci[0] : ci;
    }
    if (Array.isArray(opts) && opts.length >= 2) {
      const options = opts.map(optText).map(s => s.trim());
      const idx = a => {
        if (typeof a === 'number') return a;
        if (typeof a === 'string') { const s = a.trim(); if (/^[A-Ha-h]$/.test(s) && !options.some(o => norm(o) === norm(s))) return s.toUpperCase().charCodeAt(0) - 65; if (/^\d+$/.test(s) && !options.some(o => norm(o) === norm(s))) return +s; const j = options.findIndex(o => norm(o) === norm(s) || norm(o).replace(/^[a-h][.)]\s*/, '') === norm(s)); return j; }
        if (a && typeof a === 'object') return options.findIndex(o => norm(o) === norm(optText(a)));
        return -1;
      };
      let answer = (Array.isArray(ans) ? ans : ans === undefined ? [] : [ans]).map(idx).filter(n => Number.isInteger(n) && n >= 0);
      qs.push({ type: 'mcq', text: t, options, answer, _raw: ans });
    } else if (typeof ans === 'boolean') {
      qs.push({ type: 'tfng', text: t, variant: 'tfng', answer: ans ? 'T' : 'F' });
    } else if (ans !== undefined && String(ans).trim()) {
      const alts = (Array.isArray(ans) ? ans : [ans]).map(a => String(a).trim()).filter(Boolean);
      const blank = /_{2,}|…|\.{3,}|\[\s*\]|\(\s*\)/;
      if (blank.test(t)) qs.push({ type: 'gap', text: t.replace(blank, '{' + alts.join('|') + '}'), bank: false });
      else qs.push({ type: 'short', text: t, answers: alts });
    }
  }
  // 1 dan boshlangan raqamlar: agar biror javob variantlar soniga teng bo'lsa — hammasini bittaga suramiz
  const mc = qs.filter(q => q.type === 'mcq' && q._raw !== undefined && typeof q._raw === 'number');
  if (mc.length && mc.some(q => q.answer.some(a => a >= q.options.length)) && mc.every(q => q.answer.every(a => a >= 1))) mc.forEach(q => { q.answer = q.answer.map(a => a - 1); });
  qs.forEach(q => { if (q.type === 'mcq') { q.answer = q.answer.filter(a => a < q.options.length); delete q._raw; } });
  return qs;
}
function scriptKey(js) {
  let best = null;
  for (const c of scriptValues(js)) {
    if (!/answer|correct|key|solution|javob|togri/i.test(c.name)) continue;
    const v = c.value;
    if ((Array.isArray(v) && v.every(x => typeof x !== 'object' || Array.isArray(x))) || (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => typeof x !== 'object' || Array.isArray(x)))) { if (!best || c.len > best.len) best = c; }
  }
  return best ? best.value : null;
}

/* ---------- maydonlarni tahlil qilish ---------- */
function analyze(src) {
  const doc = parse(src), els = all(doc);
  const byId = new Map(els.filter(n => n.attrs.id).map(n => [n.attrs.id, n]));
  const labelFor = new Map(els.filter(n => n.tag === 'label' && n.attrs.for).map(n => [n.attrs.for, n]));
  const js = els.filter(n => n.tag === 'script' && !/json|template|text\/html/i.test(n.attrs.type || '') && !n.attrs.src).map(n => n.children.map(c => c.text).join('')).join('\n;\n');
  const title = inline(text(els.find(n => n.tag === 'title') ? { tag: 'x', children: els.find(n => n.tag === 'title').children } : { tag: 'x', children: [] })) || inline(text(els.find(n => n.tag === 'h1') || { tag: 'x', children: [] }));
  const fe = els.filter(n => n.tag === 'input' || n.tag === 'select' || n.tag === 'textarea');
  const keys = fieldKeys(fe.map(n => ({ tag: n.tag, type: n.attrs.type, name: n.attrs.name, id: n.attrs.id })));
  const map = new Map();
  fe.forEach((n, i) => {
    const k = keys[i]; if (!k || chrome(n)) return;
    const t = n.tag === 'input' ? String(n.attrs.type || 'text').toLowerCase() : n.tag;
    const kind = t === 'radio' ? 'radio' : t === 'checkbox' ? 'check' : n.tag === 'select' ? 'select' : 'text';
    if (!map.has(k)) map.set(k, { key: k, kind, els: [], name: n.attrs.name || n.attrs.id || '' });
    map.get(k).els.push(n);
  });
  const jsKey = scriptKey(js);
  const fields = [...map.values()];
  const fieldOf = new Map(); fields.forEach(f => f.els.forEach(e => fieldOf.set(e, f)));
  // variant yorlig'i
  const optNode = n => (n.attrs.id && labelFor.get(n.attrs.id)) || closest(n, x => x.tag === 'label');
  const optLabel = n => {
    const l = optNode(n); if (l) { const s = inline(text(l)); if (s) return { s, node: l }; }
    const sib = n.parent ? n.parent.children : [], at = sib.indexOf(n); let s = '', nodes = [];
    for (let j = at + 1; j < sib.length; j++) { const x = sib[j]; if (x.tag === 'input' || x.tag === 'br' || x.tag === 'select' || x.tag === 'textarea' || (x.tag !== '#text' && BLOCK.has(x.tag))) break; s += text(x); nodes.push(x); }
    return { s: inline(s) || n.attrs.value || '', nodes };
  };
  const marked = n => { for (const a of KEYATTR.concat(['correct', 'data-correct-answer'])) if (a in n.attrs && truthy(n.attrs[a])) return true; const l = optNode(n); const cls = (n.attrs.class || '') + ' ' + (l ? l.attrs.class || '' : ''); return /\b(correct|is-correct|right-answer|answer-correct|true-answer)\b/i.test(cls) || !!(l && KEYATTR.some(a => a in l.attrs && truthy(l.attrs[a]))); };
  const keyFor = f => { if (!jsKey) return undefined; if (Array.isArray(jsKey)) return undefined; return jsKey[f.name] ?? jsKey[f.key] ?? undefined; };
  fields.forEach((f, fi) => {
    f.index = fi;
    if (f.kind === 'radio' || f.kind === 'check') {
      const L = f.els.map(optLabel); f.options = L.map(x => x.s); f.optNodes = new Set(L.flatMap(x => x.node ? [x.node] : x.nodes));
      let idx = f.els.map((e, j) => marked(e) ? j : -1).filter(j => j >= 0);
      if (!idx.length) idx = f.els.map((e, j) => 'checked' in e.attrs ? j : -1).filter(j => j >= 0);
      const block = closest(f.els[0], x => x.tag === 'fieldset' || x.tag === 'li' || /question|savol|quiz-item|\bq\b/i.test(x.attrs.class || ''));
      const ba = block && KEYATTR.map(a => block.attrs[a]).find(v => v !== undefined);
      let jk = keyFor(f); if (jk === undefined && ba !== undefined) jk = ba;
      if (!idx.length && jk !== undefined) {
        const one = v => { const s = String(v).trim(); let j = f.els.findIndex(e => e.attrs.value !== undefined && norm(e.attrs.value) === norm(s)); if (j < 0) j = f.options.findIndex(o => norm(o) === norm(s)); if (j < 0 && /^[A-Ha-h]$/.test(s)) j = s.toUpperCase().charCodeAt(0) - 65; if (j < 0 && /^\d+$/.test(s)) j = +s; return j; };
        idx = (Array.isArray(jk) ? jk : String(jk).split(/\s*,\s*/)).map(one).filter(j => j >= 0 && j < f.els.length);
      }
      f.answers = f.kind === 'radio' ? (idx.length ? [String(idx[0])] : []) : (idx.length ? [idx.slice().sort((a, b) => a - b).join(',')] : []);
    } else if (f.kind === 'select') {
      const sel = f.els[0], opts = all(sel).filter(n => n.tag === 'option');
      const isPh = o => (o.attrs.value === '' || /^[-–—\s.]*$|^(select|choose|tanlang|—|--)/i.test(inline(text({ tag: 'x', children: o.children })))) && ('value' in o.attrs ? o.attrs.value === '' : true);
      const real = opts.filter((o, j) => !(j === 0 && isPh(o)));
      f.options = real.map(o => inline(text({ tag: 'x', children: o.children })) || o.attrs.value || '');
      let a = real.findIndex(o => marked(o));
      const sa = KEYATTR.map(k => sel.attrs[k]).find(v => v !== undefined) ?? keyFor(f);
      if (a < 0 && sa !== undefined) { const s = norm(sa); a = real.findIndex(o => norm(o.attrs.value ?? '') === s || norm(inline(text({ tag: 'x', children: o.children }))) === s); }
      f.answers = a >= 0 ? [f.options[a]] : [];
    } else {
      const e = f.els[0], v = KEYATTR.map(k => e.attrs[k]).find(x => x !== undefined) ?? keyFor(f);
      f.answers = v !== undefined && String(v).trim() ? (Array.isArray(v) ? v.map(String) : String(v).split('|')).map(x => x.trim()).filter(Boolean) : [];
      f.long = e.tag === 'textarea' && (Number(e.attrs.rows) || 2) >= 4;
    }
  });
  // massiv ko'rinishidagi kalit (answers = ['b','c',...]) — maydonlar tartibida
  if (Array.isArray(jsKey)) {
    const g = fields.filter(f => !f.answers.length);
    if (g.length === jsKey.length) g.forEach((f, j) => {
      const v = jsKey[j];
      if (f.kind === 'radio') { let k = f.els.findIndex(e => norm(e.attrs.value ?? '') === norm(v)); if (k < 0) k = f.options.findIndex(o => norm(o) === norm(v)); if (k < 0 && /^[A-Ha-h]$/.test(String(v))) k = String(v).toUpperCase().charCodeAt(0) - 65; if (k < 0 && Number.isInteger(v)) k = v; if (k >= 0 && k < f.els.length) f.answers = [String(k)]; }
      else if (f.kind === 'select') { const k = f.options.findIndex(o => norm(o) === norm(v)); if (k >= 0) f.answers = [f.options[k]]; }
      else if (f.kind === 'text') f.answers = (Array.isArray(v) ? v : String(v).split('|')).map(x => String(x).trim()).filter(Boolean);
    });
  }
  // yorliq (savol matni)
  const seq = []; (function flat(n) { seq.push(n); (n.children || []).forEach(flat); })(doc);
  const pos = new Map(seq.map((n, i) => [n, i]));
  const labelText = new Set();
  const prevText = (f, extraSkip) => {
    let acc = '', i = pos.get(f.els[0]); const usedNodes = [];
    for (let k = i - 1; k >= 0 && acc.length < 600; k--) {
      const n = seq[k];
      if (fieldOf.has(n) || n.tag === 'script' || n.tag === 'style') { if (acc.trim() || fieldOf.has(n)) break; continue; }
      if (n.tag === '#text') { if (closest(n.parent, x => x.tag === 'script' || x.tag === 'style' || x.tag === 'select' || x.tag === 'button' || (extraSkip && extraSkip.has(x)) || (x.tag === 'label' && [...fieldOf.keys()].some(e => isAnc(x, e))))) continue; acc = n.text + acc; if (n.text.trim()) usedNodes.push(n); }
      else if (BLOCK.has(n.tag) && acc.trim()) break;
    }
    usedNodes.forEach(x => labelText.add(x));
    return stripNum(inline(acc));
  };
  fields.forEach(f => {
    let lca = f.els[0].parent;
    if (f.els.length > 1) while (lca && !f.els.every(e => isAnc(lca, e))) lca = lca.parent;
    else lca = closest(f.els[0], x => BLOCK.has(x.tag) && x.tag !== 'label') || f.els[0].parent;
    const others = fields.some(g => g !== f && g.els.some(e => isAnc(lca, e)));
    f.block = others ? null : lca;
    if (f.kind === 'radio' || f.kind === 'check') {
      let t = '';
      if (f.block) { t = inline(text(f.block, f.optNodes)); for (const o of f.options) if (o) t = t.replace(o, ' '); t = stripNum(inline(t)); }
      f.label = stripLead(t || prevText(f, f.optNodes));
    } else {
      const e = f.els[0], l = (e.attrs.id && labelFor.get(e.attrs.id)) || closest(e, x => x.tag === 'label');
      f.label = stripNum(inline(l ? text(l) : '')) || e.attrs['aria-label'] || prevText(f) || e.attrs.placeholder || '';
    }
    f.label = f.label.slice(0, 400);
  });
  const drags = [];
  const zoneEls = els.filter(n => !chrome(n) && (n.attrs['data-question'] !== undefined || n.attrs['data-q'] !== undefined || /(^|\s)(drop-?zone|drop-?target|dropzone|drop-area|blank-drop)(\s|$)/i.test(n.attrs.class || '')));
  const isDrag = n => n.attrs.draggable === 'true' || /(^|\s)(drag-?item|draggable|drag-option|option-item)(\s|$)/i.test(n.attrs.class || '');
  const groups = new Map();
  for (const z of zoneEls) {
    if (zoneEls.some(o => o !== z && isAnc(o, z))) continue;
    let c = z.parent; while (c && c.tag !== '#root' && !all(c).some(x => isDrag(x) && !isAnc(z, x))) c = c.parent;
    if (!c || c.tag === '#root') continue;
    if (!groups.has(c)) groups.set(c, []); groups.get(c).push(z);
  }
  for (const [c, zs] of groups) {
    const items = all(c).filter(x => isDrag(x) && !zs.some(z => isAnc(z, x)) && !all(x).some(y => y !== x && isDrag(y)));
    if (items.length < 2) continue;
    const options = items.map(x => ({ text: inline(text(x)), value: x.attrs['data-value'] ?? x.attrs['data-answer'] ?? x.attrs.value ?? '' }));
    const zones = zs.map(z => {
      const row = closest(z, x => ['tr', 'li', 'p'].includes(x.tag) || /item|row|question/i.test(x.attrs.class || '')) || z.parent;
      const label = stripLead(stripNum(inline(text(row === z ? z.parent : row, new Set([z])))));
      const qk = z.attrs['data-question'] ?? z.attrs['data-q'] ?? z.attrs.id ?? '';
      let v = z.attrs['data-answer'] ?? z.attrs['data-correct'];
      if (v === undefined && jsKey && !Array.isArray(jsKey)) v = jsKey[qk];
      let ai = -1;
      if (v !== undefined && v !== null) { const sv = String(Array.isArray(v) ? v[0] : v).trim(); ai = options.findIndex(o => o.value && norm(o.value) === norm(sv)); if (ai < 0) ai = options.findIndex(o => norm(o.text) === norm(sv)); if (ai < 0 && /^[A-Za-z]$/.test(sv)) ai = sv.toUpperCase().charCodeAt(0) - 65; if (ai >= options.length) ai = -1; }
      return { el: z, label, answer: ai };
    });
    drags.push({ container: c, items, options, zones });
  }
  let timer = 0;
  for (const n of els) if (/timer|countdown|time-left/i.test((n.attrs.class || '') + ' ' + (n.attrs.id || ''))) { const m = /(\d{1,3}):00\b/.exec(inline(text(n))); if (m) { timer = +m[1]; break; } }
  const audioUrls = [];
  const addUrl = u => { u = String(u || '').trim(); if (/^https?:\/\/\S+\.(mp3|m4a|ogg|oga|wav|aac|webm)(\?\S*)?$/i.test(u) && !audioUrls.includes(u)) audioUrls.push(u); };
  els.filter(n => n.tag === 'audio' || n.tag === 'source').forEach(n => addUrl(n.attrs.src));
  for (const c of scriptValues(js)) {
    const v = c.value, vals = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)).map(k => v[k]) : [];
    vals.forEach(x => typeof x === 'string' ? addUrl(x) : x && typeof x === 'object' && addUrl(x.src || x.url || x.audio));
  }
  (js.match(/https?:\/\/[^\s'"`]+\.(?:mp3|m4a|ogg|wav|aac)(?:\?[^\s'"`]*)?/gi) || []).forEach(addUrl);
  const media = { images: els.filter(n => n.tag === 'img').length, audios: els.filter(n => n.tag === 'audio' || n.tag === 'video').length };
  return { doc, els, fields, fieldOf, title, js, jsKey, media, seq, pos, labelText, drags, timer, audioUrls };
}

/* Maydonlar ro'yxati (o'zicha joylash rejimi uchun) */
function fields(src) {
  return analyze(src).fields.map(f => ({ key: f.key, kind: f.kind, label: f.label, options: f.options || [], answers: f.answers }));
}

/* ---------- saytning o'z savollariga aylantirish ---------- */
const TF = { 'true': 'T', 'false': 'F', 'not given': 'NG', 'yes': 'Y', 'no': 'N', 'ng': 'NG', 't': 'T', 'f': 'F' };
function convert(src) {
  const A = analyze(src), { doc, fields: F, fieldOf, seq, pos } = A;
  const items = [], used = new Set();
  const blockOf = f => f.block;
  // select qatorlari -> moslashtirish
  const selects = F.filter(f => f.kind === 'select');
  const sig = f => f.options.map(norm).join('|');
  const runs = []; let run = [];
  for (const f of F) { if (f.kind === 'select' && run.length && sig(run[0]) === sig(f) && f.options.length >= 2) run.push(f); else { if (run.length) runs.push(run); run = f.kind === 'select' ? [f] : []; } }
  if (run.length) runs.push(run);
  const inMatch = new Set();
  for (const r of runs) if (r.length >= 2 && !r[0].options.every(o => TF[norm(o)])) {
    const opts = r[0].options;
    const pairs = r.map(f => { const a = f.answers[0]; return { l: f.label, r: a !== undefined ? opts.find(o => norm(o) === norm(a)) || a : '' }; });
    const extra = opts.filter(o => !pairs.some(p => p.r === o));
    items.push({ at: pos.get(r[0].els[0]), q: { type: 'match', text: '', pairs, extra } });
    r.forEach(f => inMatch.add(f));
  }
  for (const d of A.drags) {
    const opts = d.options.map(o => o.text);
    const pairs = d.zones.map(z => ({ l: z.label, r: z.answer >= 0 ? opts[z.answer] : '' }));
    items.push({ at: pos.get(d.zones[0].el), q: { type: 'match', text: '', pairs, extra: opts.filter(o => !pairs.some(p => p.r === o)) } });
    used.add(d.container);
  }
  // bo'sh joy: bitta blokdagi matnli maydonlar
  const gapDone = new Set();
  for (const f of F) {
    if (inMatch.has(f) || gapDone.has(f)) continue;
    if (f.kind === 'text' && !f.long) {
      const blk = closest(f.els[0], x => ['p', 'li', 'div', 'td', 'dd', 'h3', 'h4', 'h5', 'span', 'blockquote'].includes(x.tag) && x.tag !== 'label');
      const inBlk = blk ? F.filter(g => g.els.some(e => isAnc(blk, e))) : [f];
      const onlyText = inBlk.every(g => (g.kind === 'text' && !g.long) || g.kind === 'select');
      if (blk && onlyText) {
        let t = '', ok = true;
        (function build(n) {
          for (const c of n.children) {
            if (c.tag === '#text') t += c.text;
            else if (c.tag === 'br') t += '\n';
            else if (fieldOf.has(c)) { const g = fieldOf.get(c); gapDone.add(g); t += '{' + (g.kind === 'select' ? (g.answers[0] || '') : g.answers.join('|')) + '}'; }
            else if (c.tag === 'label' && c.attrs.for && F.some(g => g.els.some(e => e.attrs.id === c.attrs.for))) t += text(c);
            else if (!['script', 'style', 'button'].includes(c.tag)) build(c);
          }
        })(blk);
        t = stripNum(clean(t).replace(/\n+/g, ' '));
        const before = t.split('{')[0], after = t.slice(t.lastIndexOf('}') + 1).trim();
        if (inBlk.length === 1 && !after && (/[?:]\s*$/.test(before) || before.length > 60)) {
          items.push({ at: pos.get(f.els[0]), q: { type: 'short', text: before.trim() || f.label, answers: f.answers.slice() } });
        } else if (t.replace(/\{[^}]*\}/g, '').trim()) {
          const bankOpts = inBlk.filter(g => g.kind === 'select').flatMap(g => g.options);
          items.push({ at: pos.get(f.els[0]), q: { type: 'gap', text: t, bank: bankOpts.length > 0 } });
        } else items.push({ at: pos.get(f.els[0]), q: { type: 'short', text: f.label || 'Javobni yozing', answers: f.answers.slice() } });
        inBlk.forEach(g => gapDone.add(g)); if (blk) used.add(blk); continue;
      }
      items.push({ at: pos.get(f.els[0]), q: { type: 'short', text: f.label || 'Javobni yozing', answers: f.answers.slice() } });
      gapDone.add(f); continue;
    }
    if (f.kind === 'text' && f.long) { items.push({ at: pos.get(f.els[0]), q: { type: 'writing', text: f.label || 'Javobingizni yozing', minWords: 0 } }); continue; }
    if (f.kind === 'radio' || (f.kind === 'select' && !inMatch.has(f))) {
      const tf = f.options.map(o => TF[norm(o)]);
      if (f.options.length === 3 && tf.every(Boolean) && new Set(tf.map(x => x === 'Y' ? 'T' : x === 'N' ? 'F' : x)).size === 3) {
        const v = tf.includes('Y') ? 'ynng' : 'tfng';
        const ai = f.kind === 'radio' ? (f.answers.length ? +f.answers[0] : -1) : f.options.findIndex(o => f.answers[0] && norm(o) === norm(f.answers[0]));
        const ans = ai >= 0 ? ({ Y: 'T', N: 'F' }[tf[ai]] || tf[ai]) : '';
        items.push({ at: pos.get(f.els[0]), q: { type: 'tfng', text: f.label, variant: v, answer: ans } });
      } else {
        const answer = f.kind === 'radio' ? f.answers.map(Number) : f.answers.length ? [f.options.findIndex(o => norm(o) === norm(f.answers[0]))].filter(x => x >= 0) : [];
        items.push({ at: pos.get(f.els[0]), q: { type: 'mcq', text: f.label, options: f.options.map(o => o.replace(/^[A-Ha-h][.)]\s+/, '')), answer } });
      }
      if (f.block) used.add(f.block); continue;
    }
    if (f.kind === 'check') {
      if (f.els.length < 2) continue;
      items.push({ at: pos.get(f.els[0]), q: { type: 'mcq', text: f.label, options: f.options.map(o => o.replace(/^[A-Ha-h][.)]\s+/, '')), answer: f.answers.length ? f.answers[0].split(',').map(Number) : [] } });
      if (f.block) used.add(f.block);
    }
  }
  // matn bloklari -> bo'lim / Reading matni
  const fieldEls = [...fieldOf.keys()];
  const isQPart = n => [...used].some(b => isAnc(b, n)) || F.some(f => f.block && isAnc(f.block, n)) || fieldEls.some(e => isAnc(n, e));
  const cand = A.els.filter(n => {
    if (!/^(h[1-6]|p|blockquote|pre|li|figcaption)$/.test(n.tag) && !(n.tag === 'div' && n.children.every(c => c.tag === '#text' || !BLOCK.has(c.tag)))) return false;
    if (closest(n.parent || n, x => ['script', 'style', 'head', 'button', 'label', 'select', 'template', 'noscript', 'nav', 'footer'].includes(x.tag)) || chrome(n)) return false;
    if (A.els.some(x => x !== n && /^(h[1-6]|p|blockquote|pre|li)$/.test(x.tag) && isAnc(x, n))) return false;
    if (isQPart(n)) return false;
    { let own = false, lab = false; walk(n, x => { if (x.tag === '#text' && x.text.trim()) { if (A.labelText.has(x)) lab = true; else own = true; } }); if (lab && !own) return false; }
    return inline(text(n)).length > 0;
  });
  for (const n of cand) items.push({ at: pos.get(n), txt: inline(text(n)), h: /^h[1-6]$/.test(n.tag), tag: n.tag });
  items.sort((a, b) => a.at - b.at);
  // ketma-ket matnlarni birlashtirish
  const out = []; let buf = null;
  const firstH1 = A.els.find(n => n.tag === 'h1'); const h1t = firstH1 ? inline(text(firstH1)) : '';
  const flushBuf = () => {
    if (!buf) return;
    const passage = buf.paras.join('\n\n');
    if (passage.length >= 400) out.push({ type: 'section', text: (buf.title || 'Matn').slice(0, 300), passage });
    else if (buf.title || passage) out.push({ type: 'section', text: (buf.title && /^(part|section|passage|questions?)\s*\d/i.test(buf.title) ? [buf.title, passage].filter(Boolean).join('\n') : [buf.title, passage].filter(Boolean).join(' — ')).slice(0, 1000), passage: '' });
    buf = null;
  };
  let desc = '';
  for (const it of items) {
    if (it.q) { flushBuf(); out.push(it.q); continue; }
    if (it.h && it.txt === h1t && !out.length && !desc) continue;
    if (/^(check|submit|reset|tekshir)/i.test(it.txt)) continue;
    if (it.h) { flushBuf(); buf = { title: it.txt, paras: [] }; }
    else { if (!buf) buf = { title: '', paras: [] }; buf.paras.push(it.txt); }
  }
  flushBuf();
  // birinchi qisqa bo'lim savollardan oldin bo'lsa — ko'rsatmaga
  if (out[0] && out[0].type === 'section' && !out[0].passage && out.length > 1 && !/^(part|section|passage)\s*\d/i.test(out[0].text)) { desc = out[0].text; out.shift(); }
  // JS massividagi savollar
  const scripted = dataQuestions(A.js);
  if (scripted.length && F.length === 0) {
    while (out.length && out[out.length - 1].type === 'section' && !out[out.length - 1].passage) { const s = out.pop(); desc = [desc, s.text].filter(Boolean).join('\n'); }
    out.push(...scripted);
  }
  const qs = out.filter(q => q.type !== 'section' || q.text || q.passage);
  const U = A.audioUrls;
  if (U.length) {
    const parts = qs.filter(q => q.type === 'section' && /^(part|section)\s*\d+/i.test(q.text));
    if (parts.length && U.length >= parts.length) parts.forEach(q => { const n = +/(\d+)/.exec(q.text)[1]; q.audioUrl = U[n - 1] || U[parts.indexOf(q)]; });
    else if (U.length === 1) { const first = qs.find(q => q.type === 'section'); if (first) first.audioUrl = U[0]; else qs.unshift({ type: 'section', text: 'Audio', passage: '', audioUrl: U[0] }); }
  }
  const tt = (A.title || '') + ' ' + qs.filter(q => q.type === 'section').map(q => q.text).join(' ');
  const suggest = {};
  if (/ielts|cdi/i.test(tt) && /listening/i.test(tt)) Object.assign(suggest, { kind: 'ielts', skill: 'listening', audioOnce: true });
  else if (/ielts|cdi/i.test(tt) && /reading/i.test(tt)) Object.assign(suggest, { kind: 'ielts', skill: 'reading' });
  if (A.timer) suggest.timeLimit = A.timer;
  const keyed = q => q.type === 'mcq' ? q.answer.length > 0 : q.type === 'tfng' ? !!q.answer : q.type === 'short' ? q.answers.length > 0 : q.type === 'gap' ? !/\{\s*\}/.test(q.text) : q.type === 'match' ? q.pairs.every(p => p.r) : true;
  const gradable = qs.filter(q => q.type !== 'section' && q.type !== 'writing');
  return { title: A.title, desc, questions: qs, suggest, audioUrls: U,
    stats: { total: qs.filter(q => q.type !== 'section').length, keyed: gradable.filter(keyed).length, gradable: gradable.length, missing: gradable.filter(q => !keyed(q)).length, scripted: scripted.length && !F.length ? scripted.length : 0, fields: F.length, drags: A.drags.length, audioUrls: U.length, images: A.media.images, audios: A.media.audios } };
}

const api = { parse, fieldKeys, analyze, fields, convert, relaxed, balanced, dataQuestions, scriptKey };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZemHtml = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
