# Zemstark'ni internetga joylash (VPS)

Natija: o'quvchilar `https://...` manzil orqali istalgan joydan kiradi. Taxminan 20–30 daqiqa.

## 1. VPS server olish

Tavsiya: **O'zbekistondagi** provayder. Sabab: platforma o'quvchilarning ism-familiyasi, emaili va autoproctor
kamera suratlarini saqlaydi. Biometrik ma'lumotlar (yuz tasvirlari shunga kirishi mumkin) qonunga ko'ra
O'zbekiston hududidagi serverlarda saqlanishi kerak. Bundan tashqari mahalliy provayderga Uzcard/Humo bilan to'lash mumkin
va Toshkentdan tezlik yuqori bo'ladi.

Toshkentda VPS beradigan provayderlarga misollar: tcloud.uz, Serverspace (Toshkent), Pro-Data, dicloud.uz, uzsci.net, Billur, ahost.uz.
Narxlarni o'zingiz solishtiring — ular tez-tez o'zgaradi.

Tanlanadigan sozlamalar:

| Parametr | Kamida | Tavsiya |
|---|---|---|
| Operatsion tizim | Ubuntu 22.04 | **Ubuntu 24.04 LTS** |
| Protsessor | 1 vCPU | 2 vCPU |
| Xotira (RAM) | 1 GB | 2 GB |
| Disk | 20 GB SSD | 40 GB SSD (audio fayllar uchun) |
| IP | ochiq (public) IPv4 manzil | |

Xarid qilgach provayder sizga **IP manzil** (masalan `203.0.113.7`) va **root paroli**ni beradi.

> Muhim: serverda 80 va 443 portlari ochiq bo'lishi kerak (HTTPS sertifikati uchun). Ba'zi provayderlarning
> boshqaruv panelida alohida "firewall" bo'ladi — u yerda ham 22, 80, 443 portlarini oching.

## 2. Fayllarni serverga yuklash (Windows)

`zemstark.zip` faylini, masalan, `Yuklanmalar` (Downloads) papkasiga saqlang. Shu papkada **PowerShell** oching
(papkada bo'sh joyga Shift + o'ng tugma → "PowerShell oynasini ochish"; yoki Start → PowerShell, so'ng `cd $HOME\Downloads`).

IP manzilni o'zingiznikiga almashtirib, quyidagini kiriting:

    scp .\zemstark.zip root@203.0.113.7:/root/

Birinchi marta `Are you sure you want to continue connecting` deb so'raladi — `yes` deb yozing. So'ng root parolini kiriting
(yozayotganda belgilar ko'rinmaydi — bu normal).

## 3. Serverga ulanib o'rnatish

    ssh root@203.0.113.7

Ulangach, quyidagi bitta qatorni nusxalab qo'ying:

    apt-get update && apt-get install -y unzip && unzip -o zemstark.zip && bash zemstark/deploy/setup.sh

Skript to'rtta savol beradi (har birida **Enter** bossangiz standart qiymat olinadi):

1. **Sayt manzili** — domeningiz bo'lmasa Enter: `203-0-113-7.sslip.io` kabi bepul manzil ishlatiladi.
2. **O'qituvchi kodi** — faqat shu kodni bilgan kishi o'qituvchi bo'lib ro'yxatdan o'ta oladi. Eslab qoling.
3. **AI kaliti** — AI yordamchi uchun. Bepul variant: console.groq.com → API Keys (`gsk_...`). Bo'sh qoldirish ham mumkin.
4. **Telegram bot tokeni** — bildirishnomalar uchun (6a-qadam). Hozircha bo'sh qoldirish mumkin.

> Tavsiya: o'rnatishdan oldin 6a-qadamdagi botni yaratib qo'ysangiz, tokenni shu yerning o'zida kiritasiz.

Skript o'zi o'rnatadi va sozlaydi: Node.js, HTTPS (Caddy, bepul Let's Encrypt sertifikati), avtomatik ishga tushish,
firewall, kunlik ma'lumotlar zaxirasi va haftalik fayllar zaxirasi. Oxirida sayt manzili va o'qituvchi kodi chiqadi.

## 4. Birinchi kirish

1. Brauzerda skript ko'rsatgan manzilni oching (masalan `https://203-0-113-7.sslip.io`).
2. "Ro'yxatdan o'tish" → "O'qituvchiman" → o'qituvchi kodini kiriting.
3. Sinf yarating va sinf kodini o'quvchilarga yuboring.
4. Listening Practice 3 ni joylash: sinf → Sozlamalar → "JSON fayl orqali import" →
   `vazifalar/IELTS-Listening-Practice-3.zemstark.json` (bu fayl ZIP ichida bor).
   So'ng vazifani tahrirlab, "Barcha audio havolalarni serverga saqlash" tugmasini bosing.

## 5. Keyinroq: domen ulash

`.uz` domen sotib olgach, domen boshqaruv panelida **A yozuvi**ni server IP manziliga yo'naltiring
(masalan `zemstark.uz → 203.0.113.7`, `www` uchun ham). 5–30 daqiqadan so'ng serverda:

    bash /opt/zemstark/deploy/setup.sh

Birinchi savolga yangi domenni yozing (masalan `zemstark.uz`), qolganlariga Enter. HTTPS o'zi yangilanadi.
Google Classroom ulangan bo'lsa, Google Console'dagi redirect manzilini ham yangilang.

## 6. AI yordamchini yoqish (bepul)

1. **console.groq.com** → Google yoki GitHub bilan kiring → **API Keys → Create API Key**. Kalit `gsk_...` bilan boshlanadi. Karta so'ralmaydi.
2. Serverda: `bash /opt/zemstark/deploy/setup.sh` — AI kaliti savoliga kalitni qo'ying, qolganlariga Enter.

Groq o'rniga Gemini (`AIza...`, aistudio.google.com) yoki pullik Anthropic (`sk-ant-...`) kalitini ham qo'yish mumkin — sayt kalit turini o'zi aniqlaydi.

## 6a. Telegram bildirishnomalarini yoqish

1. Telegram'da **@BotFather** ni oching → `/newbot` yozing.
2. Bot nomini (masalan `Zemstark IELTS`) va username'ni (oxiri `_bot` bilan, masalan `zemstark_ielts_bot`) yuboring.
3. BotFather bergan tokenni nusxalang (`123456789:AAE...` ko'rinishida). Tokenni hech kimga bermang.
4. Serverda: `bash /opt/zemstark/deploy/setup.sh` — to'rtinchi savolga tokenni qo'ying, qolganlariga Enter.
5. Saytda **Profil → Telegram'ni ulash** → botda **Start**. O'quvchilaringizga ham shuni qilishni ayting.

## 6b. O'quvchi hisoblari va parollar

- O'quvchilarni o'zingiz qo'shishingiz mumkin: sinf → **A'zolar → O'quvchi qo'shish** → ism-familiyalar ro'yxati.
  Sayt har biriga login va vaqtinchalik parol beradi — jadvalni nusxalab, o'quvchilarga tarqating.
- O'quvchi parolni unutsa: A'zolar ro'yxatida uning yonidagi **kalit** belgisini bosing.
- O'zingiz (o'qituvchi) parolni unutsangiz, serverda:

      bash /opt/zemstark/deploy/reset-password.sh sizning@email.uz

## 6c. Telefonga ilova sifatida o'rnatish

Sayt HTTPS orqali ochilganda telefonda ilova kabi o'rnatiladi:
- **Android (Chrome)**: menyu → "Ilovani o'rnatish" yoki "Bosh ekranga qo'shish".
- **iPhone (Safari)**: "Ulashish" tugmasi → "Bosh ekranga qo'shish".

## 7. Yangi versiyani o'rnatish

Yangi `zemstark.zip` ni 2-qadamdagidek yuklang, so'ng serverda:

    unzip -o zemstark.zip && bash zemstark/deploy/update.sh

Skript avval ma'lumotlar zaxirasini oladi. Yangi versiya ishga tushmasa, eski versiyani o'zi qaytaradi.

## 8. Zaxira nusxalar

| Nima | Qayerda | Qachon |
|---|---|---|
| Ma'lumotlar bazasi | `/var/lib/zemstark/backups/zemstark-SANA.sqlite` | har kuni, 14 kun saqlanadi |
| Yangilashdan oldingi nusxa | `/var/lib/zemstark/backups/pre-update-...sqlite` | har yangilashda |
| Yuklangan fayllar (audio, rasm) | `/var/lib/zemstark-files-backup/uploads-SANA.tgz` | har hafta, 4 ta saqlanadi |

Bu nusxalar o'sha serverning o'zida turadi. Server butunlay ishdan chiqsa ham yo'qolmasligi uchun
oyiga bir marta o'z kompyuteringizga ko'chirib oling (Windows PowerShell'da):

    scp -r root@203.0.113.7:/var/lib/zemstark/backups .\zemstark-zaxira

Ko'pchilik provayderlar oyiga ozgina to'lov evaziga butun serverning avtomatik nusxasini (snapshot) ham taklif qiladi — uni yoqish tavsiya etiladi.

## 9. Xavfsizlik bo'yicha tavsiyalar

- Root parolini provayder bergan paroldan o'zgartiring: serverda `passwd`.
- O'qituvchi kodini hech kimga bermang; o'quvchilar unga muhtoj emas.
- Imkoni bo'lsa, SSH kalit bilan kirishni sozlang va parol bilan kirishni o'chiring.

## 10. Muammo bo'lsa

| Belgi | Nima qilish kerak |
|---|---|
| Sayt ochilmayapti | `systemctl status zemstark` va `journalctl -u zemstark -n 50 --no-pager` |
| "Xavfsiz emas" / sertifikat xatosi | `journalctl -u caddy -n 50 --no-pager`. Odatda 80/443 port yopiq yoki domen boshqa IP'ga yo'naltirilgan |
| Kamera yoki mikrofon ishlamaydi | Sayt `https://` bilan ochilganini tekshiring; brauzer manzil qatoridagi qulf belgisi orqali ruxsat bering |
| Ma'lumotni qaytarish kerak | `systemctl stop zemstark`, `/var/lib/zemstark/data.sqlite*` fayllarini boshqa joyga olib, kerakli zaxirani `data.sqlite` nomi bilan qo'ying, `chown zemstark:zemstark /var/lib/zemstark/data.sqlite`, `systemctl start zemstark` |

Xato chiqsa, ekrandagi matnni to'liq nusxalab yuboring.
