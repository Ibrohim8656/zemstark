# Zemstark'ni bepul joylash (VPS'siz, vaqtinchalik)

Natija: sayt `https://zemstark-xxxx.onrender.com` kabi manzilda ishlaydi, ma'lumotlar o'chib ketmaydi.
Karta talab qilinmaydi. Taxminan 30 daqiqa.

| Qism | Xizmat | Bepul chegarasi |
|---|---|---|
| Sayt (server) | **Render** | 750 soat/oy — bitta saytni kun-u tun ishlatishga yetadi. 15 daqiqa hech kim kirmasa uxlaydi |
| Ma'lumotlar bazasi va fayllar | **Turso** | 5 GB, 100 tagacha baza |
| Uyg'oq tutish | **cron-job.org** yoki **UptimeRobot** | bepul |

Nega ikkita xizmat? Render'ning bepul serverida disk har qayta ishga tushganda tozalanadi.
Shuning uchun Zemstark barcha ma'lumotlarni (foydalanuvchilar, vazifalar, baholar, yuklangan audio va fayllar) Turso bazasida saqlaydi.

## 1. Kodni GitHub'ga joylash

Render kodni GitHub'dan oladi. `Ibrohim8656/zemstark` repozitoriyingizga `zemstark.zip` ichidagi fayllarni joylang
(GitHub sahifasida **Add file → Upload files**, papka ichidagi hamma narsani sudrab tashlang → **Commit changes**).
Repozitoriy ildizida `server.js`, `render.yaml`, `public/` turishi kerak.

> Repozitoriy ochiq (public) bo'lsa ham xavfsiz: parollar, tokenlar va kalitlar kodda yo'q — ular Render sozlamalarida saqlanadi.

## 2. Turso bazasini yaratish

1. **turso.tech** → **Sign up** → GitHub bilan kiring.
2. **Create Database**: nomi `zemstark`, joylashuvi — Yevropa (masalan Frankfurt).
3. Baza sahifasidan ikkita narsani nusxalab oling:
   - **URL** — `libsql://zemstark-....turso.io` ko'rinishida;
   - **Token** — "Create Token" / "Generate Token" (o'qish va yozish huquqi bilan, muddatsiz).

Token — bazaning kaliti. Uni hech kimga bermang va chatga yozmang.

## 3. Render'da saytni ishga tushirish

1. **render.com** → **Get Started** → GitHub bilan kiring (karta so'ralmaydi).
2. **New → Blueprint** → `zemstark` repozitoriyini tanlang. Render `render.yaml` faylini o'zi o'qiydi.
3. So'ralgan qiymatlarni kiriting:
   - `LIBSQL_URL` — Turso URL;
   - `LIBSQL_TOKEN` — Turso token;
   - `TELEGRAM_BOT_TOKEN` — bot tokeni (bo'lmasa bo'sh qoldiring);
   - `AI_KEY` — AI kaliti. Bepul: **console.groq.com** → Google bilan kiring → **API Keys → Create API Key** (`gsk_...`). Bo'lmasa bo'sh qoldiring.
4. **Apply** → 2–3 daqiqa kuting. Sayt manzili xizmat sahifasining tepasida chiqadi.
5. **O'qituvchi kodi**: xizmat sahifasi → **Environment** → `TEACHER_CODE` qiymati (Render uni tasodifiy yaratgan).
   Xohlasangiz o'zingiz o'zgartiring va **Save Changes**.

Endi saytni oching → Ro'yxatdan o'tish → O'qituvchiman → shu kod.
Listening Practice 3: sinf → Sozlamalar → JSON import → `vazifalar/IELTS-Listening-Practice-3.zemstark.json`.

## 4. Saytni uyg'oq tutish

Render bepul sayti 15 daqiqa hech kim kirmasa uxlaydi va keyingi kirishda ~1 daqiqada uyg'onadi.
Uxlab qolganda Telegram xabarlari ham to'xtaydi. Buning oldini olish uchun:

1. **cron-job.org** (yoki **uptimerobot.com**) da bepul ro'yxatdan o'ting.
2. Yangi vazifa: manzil `https://SIZNING-SAYT.onrender.com/api/health`, har **10 daqiqada**.

Bu bitta saytga oyiga ~744 soat sarflaydi — bepul 750 soatga sig'adi. Render'da ikkinchi bepul sayt ochmang.

## 5. Bepul rejimdagi cheklovlar

- **Kamera suratlari o'chirilgan** (`PROCTOR_CAMERA=off`). Bepul serverlar O'zbekistondan tashqarida joylashgan,
  yuz tasvirlari esa biometrik ma'lumot sifatida O'zbekiston hududida saqlanishi kerak. Tab, to'liq ekran va nusxa olish nazorati ishlayveradi.
  VPS'ga ko'chganingizda kamera qaytadan yoqiladi.
- **Audio**: imkon qadar audioni havola ko'rinishida qoldiring ("serverga saqlash"ni bosmasdan) — Render'ning bepul trafigi cheklangan.
  O'zingiz yuklagan fayllar ham ishlaydi, faqat ularni o'quvchilar yuklab olishi trafikni sarflaydi.
- **Zaxira**: Turso har kuni bitta nusxa oladi (oxirgi 7 kun saqlanadi), Turso'ning o'zi ham oxirgi 1 kunni tiklay oladi.
- Render bepul serverni istalgan vaqtda qayta ishga tushirishi mumkin — ma'lumotlar Turso'da bo'lgani uchun hech narsa yo'qolmaydi.

## 6. Yangilash

GitHub'dagi fayllarni yangilasangiz, Render saytni o'zi qayta joylaydi (`autoDeploy`).

## 7. Parolni tiklash (o'qituvchi unutsa)

O'z kompyuteringizda (Node.js o'rnatilgan, Zemstark papkasida, PowerShell):

    $env:STORE="libsql"; $env:LIBSQL_URL="libsql://..."; $env:LIBSQL_TOKEN="..."; node reset-password.js sizning@email.uz

So'ng Render'da **Manual Deploy → Restart service** — yangi vaqtinchalik parol bilan kirasiz.

## 8. Keyinroq VPS'ga ko'chish

VPS'da `DEPLOY.md` bo'yicha o'rnating (saytda hali hech kim ro'yxatdan o'tmasin), so'ng:

    bash /opt/zemstark/deploy/turso-import.sh 'libsql://zemstark-....turso.io' 'TOKEN'

Barcha foydalanuvchilar, sinflar, baholar va fayllar VPS'ga ko'chadi. Keyin Render'dagi saytni o'chirib qo'ying.
