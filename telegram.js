'use strict';
/* Zemstark — Telegram bildirishnomalari.
   Webhook kerak emas: server Telegram'dan yangi xabarlarni o'zi so'rab turadi (long polling),
   shuning uchun domen bo'lmasa ham ishlaydi.
   Ulash: foydalanuvchi profilda "Telegram'ni ulash"ni bosadi -> t.me/<bot>?start=<kod> -> bot kodni taniydi.
   Xabarlar: yangi vazifa, muddat yaqinlashganda eslatma, baho qaytarilganda (o'quvchiga),
   yangi topshirilgan ishlar (o'qituvchiga). Foydalanuvchi tanlagan tilda (uz/ru/en). */
const crypto = require('crypto');

const T = {
  uz: {
    hello: n => `Assalomu alaykum, ${n}! Zemstark bildirishnomalari ulandi. Yangi vazifalar, muddatlar va baholar haqida shu yerga xabar beraman.\nO‘chirish uchun: /stop`,
    bad: 'Havola eskirgan yoki noto‘g‘ri. Zemstark’da Profil → “Telegram’ni ulash” tugmasini qayta bosing.',
    help: 'Bu bot Zemstark bildirishnomalarini yuboradi. Ulash uchun saytda Profil → “Telegram’ni ulash” tugmasini bosing.',
    stop: 'Bildirishnomalar o‘chirildi. Qayta ulash uchun saytda Profil → “Telegram’ni ulash”.',
    work: (c, t, due) => `📘 <b>${c}</b>: yangi vazifa\n${t}${due ? `\nMuddat: ${due}` : ''}`,
    remind: (c, t, due) => `⏰ <b>${c}</b>: muddat yaqinlashmoqda\n${t}\nMuddat: ${due}`,
    graded: (c, t, r) => `✅ <b>${c}</b>: ishingiz baholandi\n${t}${r ? `\nNatija: ${r}` : ''}`,
    subs: (n, list) => `📥 ${n} ta yangi topshirilgan ish:\n${list}`,
    open: 'Ochish'
  },
  ru: {
    hello: n => `Здравствуйте, ${n}! Уведомления Zemstark подключены. Буду присылать сюда новые задания, сроки и оценки.\nОтключить: /stop`,
    bad: 'Ссылка устарела или неверна. Нажмите в Zemstark «Профиль → Подключить Telegram» ещё раз.',
    help: 'Этот бот присылает уведомления Zemstark. Чтобы подключить, нажмите на сайте «Профиль → Подключить Telegram».',
    stop: 'Уведомления отключены. Подключить снова: «Профиль → Подключить Telegram» на сайте.',
    work: (c, t, due) => `📘 <b>${c}</b>: новое задание\n${t}${due ? `\nСрок: ${due}` : ''}`,
    remind: (c, t, due) => `⏰ <b>${c}</b>: приближается срок\n${t}\nСрок: ${due}`,
    graded: (c, t, r) => `✅ <b>${c}</b>: работа оценена\n${t}${r ? `\nРезультат: ${r}` : ''}`,
    subs: (n, list) => `📥 Новых сданных работ: ${n}\n${list}`,
    open: 'Открыть'
  },
  en: {
    hello: n => `Hello, ${n}! Zemstark notifications are on. I’ll send new assignments, due dates and grades here.\nTo turn off: /stop`,
    bad: 'This link has expired or is invalid. In Zemstark, press Profile → “Connect Telegram” again.',
    help: 'This bot sends Zemstark notifications. To connect, press Profile → “Connect Telegram” on the site.',
    stop: 'Notifications are off. To reconnect, use Profile → “Connect Telegram” on the site.',
    work: (c, t, due) => `📘 <b>${c}</b>: new assignment\n${t}${due ? `\nDue: ${due}` : ''}`,
    remind: (c, t, due) => `⏰ <b>${c}</b>: due soon\n${t}\nDue: ${due}`,
    graded: (c, t, r) => `✅ <b>${c}</b>: your work was graded\n${t}${r ? `\nResult: ${r}` : ''}`,
    subs: (n, list) => `📥 ${n} new submission(s):\n${list}`,
    open: 'Open'
  }
};
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NOSUB = new Set(['material', 'vocab']);

function createTelegram({ token, api, db, save, base, tz, log = console }) {
  if (!token) return null;
  const API = (api || 'https://api.telegram.org').replace(/\/$/, '') + '/bot' + token + '/';
  const codes = new Map();
  let username = '', offset = 0, stopped = false;
  const user = id => db.users.find(u => u.id === id);
  const L = u => T[u && u.lang] || T.uz;
  const fmt = t => {
    try { return new Intl.DateTimeFormat('ru-RU', { timeZone: tz || 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(t)); }
    catch (e) { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
  };

  async function call(method, body, timeoutMs = 15000) {
    const r = await fetch(API + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(timeoutMs) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { const e = new Error(j.description || 'Telegram ' + r.status); e.code = j.error_code || r.status; throw e; }
    return j.result;
  }
  async function sendChat(chat, text, url, lang) {
    const body = { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (url && /^https:\/\//.test(url)) body.reply_markup = { inline_keyboard: [[{ text: (T[lang] || T.uz).open, url }]] };
    return call('sendMessage', body);
  }
  async function send(u, text, url) {
    if (!u || !u.tg || !u.tg.chat || u.tgOn === false) return false;
    try { await sendChat(u.tg.chat, text, url, u.lang); return true; }
    catch (e) {
      if (e.code === 403 || e.code === 400) { delete u.tg; save(); } // bot bloklangan yoki chat yo'q
      else log.error('Telegram xabar yuborilmadi:', e.message);
      return false;
    }
  }

  function linkUrl(uid) {
    const now = Date.now();
    for (const [k, v] of codes) if (v.exp < now) codes.delete(k);
    const code = crypto.randomBytes(12).toString('hex');
    codes.set(code, { uid, exp: now + 15 * 60e3 });
    return username ? `https://t.me/${username}?start=${code}` : '';
  }
  function unlink(u) { if (u) { delete u.tg; save(); } }

  async function onMessage(msg) {
    if (!msg || !msg.chat || msg.chat.type !== 'private') return;
    const text = String(msg.text || '').trim(), chat = msg.chat.id;
    const linked = db.users.find(u => u.tg && u.tg.chat === chat);
    const m = /^\/start(?:\s+([a-f0-9]{24}))?$/.exec(text);
    if (m && m[1]) {
      const c = codes.get(m[1]); codes.delete(m[1]);
      const u = c && c.exp > Date.now() && user(c.uid);
      if (!u) return sendChat(chat, (L(linked)).bad);
      db.users.forEach(x => { if (x !== u && x.tg && x.tg.chat === chat) delete x.tg; });
      u.tg = { chat, at: Date.now(), name: str(msg.from && (msg.from.username || msg.from.first_name)) }; u.tgOn = true; save();
      return sendChat(chat, L(u).hello(esc(u.name)));
    }
    if (/^\/stop\b/.test(text)) { if (linked) { delete linked.tg; save(); } return sendChat(chat, L(linked).stop); }
    return sendChat(chat, L(linked).help);
  }
  const str = s => String(s || '').slice(0, 60);

  async function poll() {
    while (!stopped) {
      try {
        const ups = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] }, 65000);
        for (const up of ups) { offset = up.update_id + 1; try { await onMessage(up.message); } catch (e) { log.error('Telegram:', e.message); } }
      } catch (e) {
        if (stopped) return;
        if (e.code === 409) log.error('Telegram: boshqa joyda ham shu bot ishlayapti (webhook yoki ikkinchi server).');
        else if (e.name !== 'TimeoutError') log.error('Telegram ulanmadi:', e.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // ---- bildirishnomalarni tekshirish (har daqiqada) ----
  const link = h => base && /^https:/.test(base) ? base + '/#' + h : '';
  async function scan() {
    const silent = !db.meta.tg || !db.meta.tg.init; // birinchi ishga tushishda eski narsalar haqida xabar yuborilmaydi
    const now = Date.now(), jobs = [];
    let changed = false;
    const clsMap = new Map(db.classes.map(c => [c.id, c]));
    const studentsOf = cid => db.members.filter(m => m.cid === cid).map(m => user(m.uid)).filter(Boolean);
    for (const w of db.works) {
      const c = clsMap.get(w.cid); if (!c) continue;
      const live = !w.draft && !(w.publishAt && w.publishAt > now);
      if (!live) continue;
      if (!w.nt) {
        w.nt = now; changed = true;
        if (!silent) for (const s of studentsOf(c.id)) jobs.push([s, L(s).work(esc(c.name), esc(w.title), w.dueAt ? fmt(w.dueAt) : ''), link('w-' + w.id)]);
      }
      if (w.dueAt && !w.rem && w.dueAt > now && w.dueAt - now <= 24 * 3600e3 && !NOSUB.has(w.kind)) {
        w.rem = now; changed = true;
        if (!silent) {
          const done = new Set(db.subs.filter(s => s.wid === w.id).map(s => s.uid));
          for (const s of studentsOf(c.id)) if (!done.has(s.id)) jobs.push([s, L(s).remind(esc(c.name), esc(w.title), fmt(w.dueAt)), link('w-' + w.id)]);
        }
      }
    }
    const perTeacher = new Map();
    for (const s of db.subs) {
      const w = db.works.find(x => x.id === s.wid), c = w && clsMap.get(w.cid);
      if (!w || !c) continue;
      if (s.returned && (s.ntR || 0) < (s.returnedAt || 1)) {
        s.ntR = s.returnedAt || now; changed = true;
        if (!silent) {
          const st = user(s.uid);
          const r = s.band != null ? 'Band ' + Number(s.band).toFixed(1) : s.score != null && s.max ? `${Math.round(s.score * 100) / 100}/${s.max}` : '';
          jobs.push([st, L(st).graded(esc(c.name), esc(w.title), r), link('w-' + w.id)]);
        }
      }
      if ((s.ntT || 0) < (s.at || 0)) {
        s.ntT = s.at; changed = true;
        if (!silent) { const k = c.owner; if (!perTeacher.has(k)) perTeacher.set(k, []); perTeacher.get(k).push({ s, w, c }); }
      }
    }
    for (const [tid, list] of perTeacher) {
      const t = user(tid); if (!t) continue;
      const lines = list.slice(0, 10).map(({ s, w, c }) => `• ${esc((user(s.uid) || {}).name || '?')} — ${esc(w.title)} (${esc(c.name)})`).join('\n') + (list.length > 10 ? '\n…' : '');
      jobs.push([t, L(t).subs(list.length, lines), link('')]);
    }
    if (silent) { db.meta.tg = { init: now }; changed = true; }
    if (changed) save();
    let sent = 0;
    for (const [u, text, url] of jobs) { if (await send(u, text, url)) sent++; await new Promise(r => setTimeout(r, 40)); }
    return sent;
  }

  let timer = null;
  async function start() {
    try { const me = await call('getMe'); username = me.username || ''; log.log('Telegram bot: @' + username); }
    catch (e) { log.error('Telegram token ishlamadi:', e.message); }
    poll();
    const tick = () => scan().catch(e => log.error('Telegram tekshiruv xatosi:', e.message));
    setTimeout(tick, 5000).unref?.();
    timer = setInterval(tick, 60e3); timer.unref?.();
  }
  return { start, stop: () => { stopped = true; clearInterval(timer); }, linkUrl, unlink, scan, get username() { return username; } };
}
module.exports = { createTelegram };
