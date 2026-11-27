# Zemstark — English & IELTS

Ingliz tili o'qituvchisi uchun Google Classroom uslubidagi platforma: sinflar, e'lonlar, vazifalar,
avtomatik tekshiruv, IELTS band ballari, autoproctor va Google Classroom'dan ko'chirish.
Qo'shimcha kutubxona kerak emas — faqat **Node.js 18 yoki yangisi**.

## 1. Ishga tushirish (Windows)

1. https://nodejs.org dan Node.js (LTS) o'rnating.
2. Shu papkada PowerShell oching:

       $env:TEACHER_CODE="o'zingizning-sirli-kodingiz"; node server.js

3. Brauzerda http://localhost:3000 ni oching.
4. "Ro'yxatdan o'tish" → "O'qituvchiman" → yuqoridagi kodni kiriting.

`TEACHER_CODE` o'rnatilmasa, istalgan kishi o'qituvchi bo'lib ro'yxatdan o'ta oladi.

Ma'lumotlar `data.sqlite` bazasida (Node.js 22.5+ da o'rnatilgan SQLite), yuklangan fayllar `uploads/` papkasida saqlanadi.
Eski `data.json` bo'lsa, birinchi ishga tushganda avtomatik SQLite'ga ko'chiriladi (`data.json.migrated` qoladi).
Node eski bo'lsa yoki `STORE=json` berilsa, `data.json` ishlatiladi.

## 2. Fayllar

| Fayl | Vazifasi |
|---|---|
| `server.js` | Login, sessiya, fayl yuklash/uzatish, Google Classroom ulanishi, statik fayllar (gzip, ETag) |
| `telegram.js` | Telegram bildirishnomalari (11-bo'lim) |
| `reset-password.js` | Administrator uchun parol tiklash (12-bo'lim) |
| `turso-export.js` | Turso'dagi ma'lumotlarni VPS'ga ko'chirish |
| `render.yaml` | Render.com'ga bepul joylash sozlamasi (`BEPUL-JOYLASH.md`) |
| `store.js` | Ma'lumotlar ombori (SQLite / JSON) va kunlik zaxira |
| `core.js` | Sinflar, vazifalar, savol turlari, avtomatik tekshiruv, IELTS band hisobi, ruxsatlar |
| `public/index.html` | Butun sayt (bitta sahifa) |
| `public/htmlkit.js` | HTML vazifalarni tahlil qilish va savollarga aylantirish |
| `public/qimport.js` | Matn, Word (.docx), Excel/CSV, Google Forms'dan import va AI bilan savol yaratish |
| `public/sw.js`, `public/manifest.webmanifest`, ikonalar | Saytni telefonga ilova sifatida o'rnatish (PWA) |
| `public/i18n.js` | Interfeys tillari (o‘zbek / English / русский) va kunduzgi/tungi rejim. Yangi matn qo‘shsangiz, lug‘atga ham qo‘shing |
| `demo/` | Serversiz demo yig'ish uchun (`node demo/build.js`) |

## 3. Vazifa turlari

- **Uy vazifasi**, **Sinf ishi**, **Test** (vaqt chegarali), **IELTS mashqi**, **Material** (topshirishsiz).
- Ko'nikma: Grammar, Vocabulary, Reading, Listening, Writing, Speaking yoki aralash.
- Autoproctor har qanday vazifaga, jumladan uy vazifasiga ham yoqiladi.

Savol turlari:

| Tur | Tekshiruv | Izoh |
|---|---|---|
| Bo'lim / matn | — | Reading matni (imtihonda chap panelda), audio, rasm |
| Ko'p tanlovli | avtomatik | Ikki to'g'ri javob belgilansa — "Choose TWO" |
| True / False / Not Given | avtomatik | Yes / No / Not Given varianti ham bor |
| Bo'sh joyni to'ldirish | avtomatik | `She {goes} to school. He {doesn't\|does not} …` |
| Qisqa javob | avtomatik | Bir nechta to'g'ri javob: `colour\|color` |
| Moslashtirish | avtomatik | Ortiqcha (chalg'ituvchi) variantlar qo'shish mumkin |
| Tartibga solish | avtomatik | Word order, gaplarni tartiblash |
| Writing | o'qituvchi | So'z soni, rasm/grafik, IELTS Task 1/2 |
| Speaking | o'qituvchi | Brauzerda ovoz yozish, tayyorlanish vaqti, IELTS Part 1/2/3 |

Avtomatik tekshiruvda katta-kichik harf, ortiqcha bo'sh joy, oxirgi tinish belgisi va
apostrof turi (`'` / `’`) hisobga olinmaydi. O'qituvchi istalgan savol ballini qo'lda o'zgartira oladi.

## 3a. HTML vazifalar

Muharrirda **"HTML yuklash"** tugmasi bosilganda sayt faylni tahlil qiladi va ikki yo'l taklif qiladi:

1. **Sayt savollariga aylantirish (tavsiya etiladi).** Topiladi: radio/checkbox savollar, matn maydonlari
   (gap fill), select ro'yxatlar (True/False/Not Given va matching), textarea (writing), Reading matnlari, hamda
   skript ichidagi savollar massivi (`const questions = [{question, options, answer}, …]`).
   To'g'ri javoblar `data-correct`, `data-answer`, `checked` yoki skriptdagi `answers`/`correctAnswers` obyektidan olinadi.
   Natija saytning o'z savollari: sayt dizaynida ko'rinadi, avtomatik tekshiriladi, to'g'ri javoblar o'quvchiga yuborilmaydi.
   Javobi topilmagan savollarda "Javobni belgilang" belgisi chiqadi.
2. **HTML'ni o'z holicha joylash** (o'yin, drag-and-drop, murakkab sahifalar uchun).
   Sahifaga sayt shrifti va ranglari qo'llanadi, balandligi avtomatik moslashadi.
   Sayt HTML ichidagi maydonlarni o'qiydi va o'qituvchi belgilagan kalit bo'yicha tekshiradi.
   "Check" tugmalarini yashirish mumkin. HTML'ning o'zi ball hisoblasa, sahifa ichidan quyidagini chaqirsin:

       Zemstark.submitScore(ball, maksimal_ball);
       // yoki: parent.postMessage({type: 'zemstark:score', score: 8, max: 10}, '*');

   Eslatma: bu rejimda HTML kodi o'quvchi brauzeriga yuboriladi — unda yozilgan javoblarni ko'rish mumkin.

Tayyor vazifa fayli (`.zemstark.json`) bo'lsa: sinf → Sozlamalar → "JSON fayl orqali import" — vazifa darhol joylanadi.
Masalan, `IELTS-Listening-Practice-3.zemstark.json` (40 savol, 4 Part, audio havolalari bilan).

Autoproctor HTML ichida ham ishlaydi: nusxa olish/qo'yish, o'ng tugma, F12/Ctrl+P bloklanadi,
HTML oynasidan boshqa ilovaga o'tish qayd etiladi.

## 4. IELTS

- **Listening / Reading**: to'g'ri javoblar soni 40 ga keltiriladi va taxminiy jadval bo'yicha bandga aylantiriladi
  (Reading uchun Academic va General Training jadvallari alohida).
- **Writing**: 4 mezon (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy).
  Task 2 ikki barobar og'irlikda hisoblanadi.
- **Speaking**: 4 mezon (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation).
- O'qituvchi yakuniy bandni qo'lda belgilashi mumkin.
- "Natijalarim" bo'limida har bir ko'nikma bo'yicha so'nggi band, o'rtacha va tarix, hamda Overall ko'rinadi.
- Muharrirda "Tuzilmani qo'shish" tugmasi IELTS formatidagi bo'sh tuzilmani qo'yadi (bo'limlar, vaqt, so'z soni).

Band jadvallari rasmiy emas, taxminiy. Haqiqiy imtihon natijasini kafolatlamaydi.

## 5. Autoproctor

Qayd etiladi: boshqa tab/oynaga o'tish, fokus yo'qotish, to'liq ekrandan chiqish, nusxa olish/qo'yish,
o'ng tugma, F12/Ctrl+P kabi tugmalar, imtihon sahifasidan chiqishga urinish.
Kamera: yuz borligi (Chrome'da) va vaqti-vaqti bilan kichik surat. O'qituvchi jurnal, suratlar va xavf balini ko'radi.

Cheklov: bu brauzer darajasidagi nazorat. U buzilishlarni qayd etadi, lekin ikkinchi telefon yoki boshqa odam
yordamini to'liq oldini ololmaydi. Xavf balini dalil emas, signal deb qabul qiling va o'quvchilarni kuzatuv
haqida oldindan ogohlantiring. Kamera va to'liq ekran `localhost` yoki `https://` manzilda ishlaydi.

## 6. Google Classroom'dan ko'chirish

1. https://console.cloud.google.com da yangi loyiha oching.
2. "APIs & Services → Library" da **Google Classroom API** ni yoqing.
3. "OAuth consent screen" ni sozlang (External; o'zingizni "Test users" ga qo'shing).
4. "Credentials → Create credentials → OAuth client ID → Web application".
   "Authorized redirect URIs": `http://localhost:3000/api/google/callback`
5. Serverni kalitlar bilan ishga tushiring:

       $env:GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
       $env:GOOGLE_CLIENT_SECRET="..."
       $env:TEACHER_CODE="..."
       node server.js

6. Saytda: sinf → Sozlamalar → "Google Classroom bilan ulanish" → kursni tanlang (arxivdagilar ham chiqadi).

Ko'chadi: vazifalar va materiallar (sarlavha, ko'rsatma, ball, muddat, mavzu, Drive/havolalar matn sifatida).
Hammasi **qoralama** bo'lib keladi — kerakligini ko'rib chiqib joylaysiz.
Ko'chmaydi: Drive fayllarining o'zi, test savollarining to'g'ri javoblari (Google API bermaydi),
o'quvchilarning eski topshirishlari va baholari.

Google ulanmasa, JSON usuli ham bor (Sozlamalar → "JSON fayl orqali ko'chirish").

## 7. Internetga chiqarish

- `BASE_URL` ni o'rnating (masalan `https://zemstark.uz`) va serverni HTTPS (Caddy, Nginx yoki Cloudflare) orqasida ishlating.
- Google'dagi redirect URI ni ham shu manzilga o'zgartiring.
- `data.json` yuzlab foydalanuvchigacha yetadi; undan ko'p bo'lsa PostgreSQL'ga o'tish kerak.

| O'zgaruvchi | Vazifasi |
|---|---|
| `PORT` | Port (standart 3000) |
| `TEACHER_CODE` | O'qituvchi ro'yxatdan o'tish kodi |
| `BASE_URL` | Saytning tashqi manzili |
| `DATA_DIR` | `data.sqlite`, `uploads/` va `backups/` joylashadigan papka |
| `STORE` | `json` — SQLite o'rniga data.json; `libsql` — masofaviy Turso bazasi (bepul hosting, `BEPUL-JOYLASH.md`) |
| `LIBSQL_URL`, `LIBSQL_TOKEN` | Turso bazasi manzili va tokeni (`STORE=libsql`) |
| `PROCTOR_CAMERA` | `off` — autoproctor kamerani ishlatmaydi (suratlar olinmaydi) |
| `KEEP_BACKUPS` | Nechta kunlik zaxira saqlansin (standart 14) |
| `AI_KEY`, `AI_MODEL` | AI yordamchi: Groq (bepul), Gemini yoki Anthropic kaliti (9-bo'lim) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Classroom importi |
| `TELEGRAM_BOT_TOKEN` | Telegram bildirishnomalari (11-bo'lim) |
| `TZ_NAME` | Telegram xabarlaridagi vaqt mintaqasi (standart `Asia/Tashkent`) |

## 8. Zaxira nusxalar

Server har kuni avtomatik nusxa oladi: `backups/zemstark-YYYY-MM-DD.sqlite`, oxirgi 14 tasi saqlanadi (`KEEP_BACKUPS`).
`uploads/` papkasi (audio, rasmlar) zaxiraga kirmaydi — uni alohida nusxalang.

Tiklash: serverni to'xtating, `data.sqlite` (va `-wal`, `-shm`) fayllarini olib tashlang, kerakli nusxani `data.sqlite` nomi bilan qo'ying va qayta ishga tushiring.

## 9. AI yordamchi (Writing)

Baholash sahifasida Writing javobi yonida **"AI bahosi (qoralama)"** tugmasi chiqadi. AI to'rt mezon bo'yicha band (yoki ball),
o'zbekcha izoh, kuchli tomonlar va yaxshilash kerak bo'lgan joylarni taklif qiladi. Hech narsa o'quvchiga avtomatik yuborilmaydi —
siz tekshirib "Saqlash" yoki "Baholab qaytarish"ni bosasiz. Speaking uchun AI yo'q (ovozni matnga aylantirish kerak bo'ladi).

Xuddi shu kalit **AI bilan savol yaratish** (13-bo'lim) uchun ham ishlatiladi.

Yoqish — bitta `AI_KEY` o'zgaruvchisi. Kalit turi uning boshlanishidan aniqlanadi:

| Xizmat | Narx | Kalit | Standart model |
|---|---|---|---|
| **Groq** (tavsiya) | Bepul tarif: kuniga ~1000 so'rov | console.groq.com → API Keys, `gsk_...` | `openai/gpt-oss-120b` |
| Google Gemini | Bepul limit bilan | aistudio.google.com → Get API key, `AIza...` | `gemini-2.5-flash` |
| Anthropic Claude | Pullik, eng sifatli | console.anthropic.com, `sk-ant-...` | `claude-sonnet-5-5` |

    $env:AI_KEY="gsk_..."; node server.js

Ixtiyoriy: `AI_MODEL` (boshqa model), `AI_URL` (boshqa OpenAI-mos xizmat), `AI_PROVIDER` (`groq`/`gemini`/`anthropic`/`openai`).
Eslatma: bepul tariflarning daqiqalik limiti bor — ko'p so'rov yuborilsa, "birozdan keyin urinib ko'ring" degan xabar chiqadi.
O'quvchi inshosi tanlangan xizmatga yuboriladi; Groq shartlariga ko'ra ma'lumotlar modelni o'qitishga ishlatilmaydi.
Eski `ANTHROPIC_API_KEY` o'zgaruvchisi ham ishlayveradi.

## 10. Boshqa imkoniyatlar

- **Lug'at to'plami** (vazifa turi "Lug'at"): so'zlar ro'yxati, o'quvchi kartochka yoki yozish rejimida mashq qiladi.
  Leitner tizimi: bilgan so'z 1, 2, 4, 8, 16, 32 kundan keyin qaytadi, bilmagani darhol qaytadi.
  O'qituvchi har bir o'quvchi nechta so'zni o'rganganini ko'radi. Ro'yxatni `so'z — tarjima — misol` ko'rinishida bir yo'la joylash mumkin.
- **Rejalashtirish**: muharrirdagi "Joylash vaqti" — vazifa o'quvchilarga shu vaqtda o'zi ko'rinadi.
- **Savollar tahlili**: vazifa sahifasidagi "Tahlil" bo'limi — har bir savolga to'g'ri javob bergan o'quvchilar foizi,
  ko'p uchragan xato javoblar, variantlar taqsimoti, IELTS band taqsimoti.
- **Audioni serverga saqlash**: bo'limdagi audio havolasi yonidagi tugma faylni serverga yuklab oladi — tashqi sayt o'chsa ham test ishlaydi.
- **Kamera suratlari** alohida fayl sifatida saqlanadi va ularni faqat o'qituvchi ko'ra oladi.
- **Ilova sifatida o'rnatish (PWA)**: HTTPS orqali ochilganda telefonda "Bosh ekranga qo'shish" yoki menyudagi
  "Ilovani o'rnatish" bilan sayt alohida ilova bo'lib ochiladi. Internet uzilsa ham sahifa ochiladi (ma'lumotlar uchun internet kerak).
- **Telefonda Reading testi**: matn va savollar orasida "Matn / Savollar" tugmalari bilan almashiladi.

## 11. Telegram bildirishnomalari

1. Telegram'da **@BotFather** ga yozing → `/newbot` → bot nomi va `..._bot` bilan tugaydigan username bering.
2. BotFather bergan tokenni (`123456789:AAE...`) serverga qo'ying: `bash /opt/zemstark/deploy/setup.sh` → "Telegram bot tokeni".
   Lokal sinov uchun: `$env:TELEGRAM_BOT_TOKEN="..."; node server.js`.
3. Har bir foydalanuvchi saytda **Profil → Telegram'ni ulash** tugmasini bosadi va botda "Start" ni bosadi.

Xabarlar foydalanuvchi tanlagan tilda (o'zbek/rus/ingliz) keladi:

| Kimga | Qachon |
|---|---|
| O'quvchiga | Yangi vazifa joylanganda (rejalashtirilgan vazifa — ochilgan vaqtda) |
| O'quvchiga | Muddatga 24 soatdan kam qolganda, agar hali topshirmagan bo'lsa |
| O'quvchiga | O'qituvchi ishni baholab qaytarganda (ball yoki band bilan) |
| O'qituvchiga | Yangi topshirilgan ishlar (har daqiqada bitta umumiy xabar) |

Webhook kerak emas — server Telegram'dan xabarlarni o'zi so'rab turadi. Bitta tokenni faqat bitta serverda ishlating.
Foydalanuvchi botda `/stop` yozsa yoki Profilda "Uzish"ni bossa, xabarlar to'xtaydi.

## 12. Hisoblar va parollar

- **O'qituvchi o'quvchi hisobini o'zi ochadi**: sinf → A'zolar → "O'quvchi qo'shish" → ism-familiyalar (har qatorga bittasi).
  Har biriga login (masalan `aliyev.v42`) va vaqtinchalik parol beriladi, o'quvchi darhol sinfga qo'shiladi.
  Birinchi kirishda o'quvchi parolni o'zi almashtiradi.
- **O'quvchi parolni unutsa**: A'zolar ro'yxatida o'quvchi yonidagi kalit belgisi → yangi vaqtinchalik parol.
  Eski parol ishlamay qoladi, o'quvchi barcha qurilmalardan chiqariladi.
- **Profil**: ismni va parolni o'zgartirish, Telegram, til va rejim. Parol o'zgarsa, boshqa qurilmalardagi kirishlar yopiladi.
- **O'qituvchi parolni unutsa** (serverda): `bash /opt/zemstark/deploy/reset-password.sh ustoz@example.com`
  — server bir necha soniya to'xtab, vaqtinchalik parol chiqaradi.
- Xavfsizlik: kirishga urinishlar soni cheklangan (login bo'yicha 10 daqiqada 8 ta, IP bo'yicha 40 ta),
  sessiya 14 kun harakatsizlikdan keyin tugaydi, parollar scrypt bilan saqlanadi.

## 13. Savollarni tez qo'shish (import)

Muharrirda savol yo'q paytda "Savollarni qanday qo'shamiz?" oynasi chiqadi, keyin esa "Import:" qatori doim pastda turadi.

- **Matn / Word / Excel**: testni Word, Google Docs, Telegram yoki Excel'dan nusxalab joylang yoki .docx fayl tanlang.
  Tushuniladi: `1.` raqamli savollar, `A)`/`a.`/`(A)` variantlar (bir qatorda ham), `Answer: B` / `Javob: B` / `Ответ: B`,
  to'g'ri variant oxirida `*`, `True/False/Not Given`, `___` + javob yoki `{javob}` (bo'sh joy), oxirida `Answer key: 1-B, 2-C`,
  Moodle Aiken formati, Excel ustunlari (savol, A, B, C, D, javob), "Part 1"/"Passage 1" bo'limlari va uzun Reading matni.
  Natija qo'shishdan oldin ko'rsatiladi: nechta savol, qaysi turlar, qaysilariga javob belgilanmagan.
- **Google Forms**: ochiq forma havolasi (`forms.gle/…` yoki `docs.google.com/forms/…`). Server sahifani o'qib, savollar va variantlarni
  ko'chiradi (test javoblari Google tomonidan yashirilgan bo'lsa, ularni o'zingiz belgilaysiz). Havola ishlamasa — sahifa kodini (Ctrl+U) joylash mumkin.
- **HTML fayl**: avvalgidek (3a-bo'lim).
- **AI bilan yaratish**: matn yoki mavzu, savol turlari, soni va darajasi — AI taklif qilgan savollarni ko'rib chiqib qo'shasiz (`AI_KEY` kerak — bepul Groq kaliti yetadi).
- Muharrirdagi ish brauzerda avtomatik saqlanib boriladi: sahifa yopilib qolsa, qayta ochganda "Tiklash" taklif qilinadi. **Ctrl+S** — saqlash.
