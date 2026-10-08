# ZEMSTARK — Intelligent LMS & AI AutoProctor Platform

> **ZEMSTARK** — Google Classroom va Egnovate imkoniyatlarini o'zida mujassam etgan, o'rnatilgan sun'iy intellektual **AutoProctor** tizimi hamda to'liq **IELTS Preparation Master Hub**ga ega bo'lgan innovatsion ta'lim platformasi.

---

## 🌟 Asosiy Imkoniyatlar (Features)

### 1. 🔒 Majburiy Autorizatsiya Devori (Mandatory Auth Wall)
- Tizimga kirmagan har qanday foydalanuvchi birinchi navbatda **Ro'yxatdan O'tish (Sign Up)** yoki **Tizimga Kirish (Login)** oynasiga yo'naltiriladi.
- Rollar: **O'qituvchi (Teacher)** yoki **O'quvchi (Student)**.
- Xavfsiz sessiya boshqaruvi va Chiqish (Logout) mexanizmi.

### 2. 📚 Google Classroom Uslubidagi Sinf va Classwork Tizimi
- **Stream (E'lonlar devori)**: Google Classroom kabi sinf e'lonlari, materiallar va fikr-mulohazalar (Comments).
- **Classwork (Topshiriqlar va Darslar)**:
  - **Mavzular (Topics)** bo'yicha strukturaviy tartiblash.
  - **Topshiriq (Assignment)**: Sarlavha, ko'rsatmalar, maksimal ball (100 ball), Muxlat (Due date) va mavzuga biriktirish.
  - **🌐 Tayyor HTML Fayl Yuklash**: O'qituvchi o'z kompyuteridagi `.html` faylni yangi topshiriq sifatida yuklaydi va u sinf ichida to'g'ridan-to'g'ri interaktiv `iframe` da ochiladi.
  - **AutoProctor Test (Quiz)**: AI nazorati ostida o'tadigan savollar to'plami.
  - **Material**: Video darsliklar va o'quv qo'llanmalari.
- **People (A'zolar)**: O'qituvchilar va o'quvchilar ro'yxati hamda taklif kodi (`ZM-XXXX`).
- **Grades (Baholash)**: O'quvchilar javoblarini topshirishi ("Turn In") va o'qituvchi tomonidan ball hamda fikr (Feedback) bilan baholanishi.

### 3. 🛡️ AI AutoProctor Engine (Imtihon Nazorati)
- **Webcam & AI Face Tracking**: Real vaqtli video oqimi, yuz borligi va begona shaxslarni aniqlash.
- **Audio Monitor**: Mikrofon orqali atrof-muhit shovqinini sezuvchi vizual indikator.
- **Tab Switch & Focus Guard**: Brauzerdan boshqa oynaga o'tishni avtomatik aniqlash va ball ayirish (-15%).
- **AI Snapshot Capture**: Qoidabuzarlik yuz berganda avtomatik kadr suratini olish.
- **Trust Score**: Har bir o'quvchi uchun 0-100% oraliqdagi ishonch reytingi.

### 4. 🎯 IELTS Preparation Master Hub
- **Listening**: Audio trek, savollar va Band Score hisoblagichi.
- **Reading**: Split-screen (matn va savollar yonma-yon) hamda True/False/Not Given testlari.
- **Writing**: Task 1 & Task 2 insho muharriri, so'zlar sonini jonli sanash va AI Band score taxmini.
- **Speaking**: `MediaRecorder` API orqali mikrofondan real ovoz yozib olish, ovoz to'lqini (Waveform) va pleyer.

### 5. 📜 Rasmiy Sertifikat va Hisobotlar
- QR-kod va AutoProctor ishonch muhri bilan tasdiqlangan rasmiy ZEMSTARK sertifikati (Chop etish / PDF saqlash).
- Baholar jurnali va proctoring hisobotlarini **CSV / Excel** formatida yuklab olish.

---

## 📁 Loyiha Strukturasi (Project Structure)

```
zemstark/
├── index.html       # Asosiy SPA interfeysi, barcha modal va darchalar
├── styles.css       # Master dizayn tizimi (Dark cyber-proctor UI, responsive)
├── app.js           # Boshqaruvchi controller (Auth, Routing, Classwork, Submissions)
├── proctor.js       # AutoProctor AI dvigateli (Webcam, Tab switch, Audio, Snapshots)
├── ielts.js         # IELTS Hub modullari, Audio yozuvchi va Sertifikat generatori
├── data.js          # Ma'lumotlar bazasi (LocalStorage persistent storage)
└── README.md        # Loyiha hujjatlari va yo'riqnoma
```

---

## 🚀 Ishga Tushirish (Quick Start)

### 1-usul: Oddiy ochish
[index.html](index.html) faylini istalgan brauzerda (Chrome, Edge, Firefox) ikki marta bosib oching.

### 2-usul: Lokal server (Tavsiya etiladi)
```bash
# Loyiha papkasiga o'ting
cd zemstark

# Python orqali serverni ishga tushiring
python -m http.server 8080
```
Brauzerda: `http://localhost:8080/`

---

## 🤖 AI Agentlar va Dasturchilar Uchun Qo'llanma

Kelajakda ushbu loyihani kengaytirishda quyidagi arxitekturaga amal qiling:
1. **Holat boshqaruvi (State):** Barcha yangi ma'lumotlar tuzilmasi `data.js` dagi `initialAppState` ga kiritiladi va `window.ZemstarkDB` orqali saqlanadi.
2. **AutoProctor kengaytmalari:** `proctor.js` dagi `AutoProctor` sinfiga yangi hodisalar (masalan, ko'z qorachig'i kuzatuvi yoki ikkinchi monitor deteksiyasi) qo'shilishi mumkin.
3. **Backend integratsiyasi:** Kelgusida `data.js` o'rniga Node.js / Express / FastApi REST API yoki Firebase / Supabase osongina ulanishi uchun funksiyalar modulli arxitekturada tuzilgan.

---

## 📄 Litsenziya
MIT License © 2026 ZEMSTARK Educational Platform.
