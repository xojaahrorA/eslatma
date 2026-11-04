# Universal Life OS — «Eslatma» 🌗

**Shaxsiy hayot boshqaruv tizimi** — vazifalar, kalendar, maqsadlar, kundalik, moliya, fokus va tahlil — barchasi **bir ilovada, to'liq offline**, ma'lumotlaringiz faqat o'zingizning qurilmangizda saqlanadi.

> 📱 Ilova real **APK** — Chrome yorlig'i emas, alohida o'rnatiladigan Android ilovasi (ikonka, splash ekran, offline ishlash).

---

## 📥 APK yuklab olish (Android 7.0+)

Repositoriyadagi fayl: **[`apk/Universal-Life-OS-v1.8.apk`](apk/Universal-Life-OS-v1.8.apk)** (≈4.5 MB)

1. Faylni bosing → **Download** (yoki `Download raw file`)
2. Telefonda yuklangan faylni oching
3. «Noma'lum manbalardan o'rnatish» ga **bir marta** ruxsat bering
4. Ilova o'rnatiladi — ishga tushiring!

> ✅ Ilova **0 ma'lumot** bilan boshlanadi — hech qanday demo, hech qanday ro'yxatdan o'tish.
> Hammasini o'zingiz uchun o'zingiz to'ldirasiz. Xohlasangiz: *Sozlamalar → Namuna ma'lumotlar yuklash*.

---

## ✨ Imkoniyatlar

| Modul | Nima qiladi |
|---|---|
| 🌅 **Bugun** | Kun lentasi, kun hikoyasi, fokus vazifa |
| ✅ **Vazifalar** | Tez kiritish: `ertaga 14:00 kitob o'qish` — ilova o'zi tahlil qiladi |
| 📅 **Kalendar** | Hafta/oy ko'rinishi, rejalar |
| 🎯 **Maqsadlar** | Maqsadlar + odatlar trekeri (streak) |
| 💰 **Moliya** | Daromat/xarajat kundaligi, byudjet, 6 kategoriya |
| ⏱ **Fokus** | Pomodoro taymer (darajaga qarab) |
| 📊 **Tahlil** | Haftalik / oylik / yillik statistika va chizmalar |
| 🤖 **AI Gateway** | Buyruq → taklif → tasdiqlash zanjiri. Bulut ishlamasa **T0 qoidalar dvigateli** javob beradi |
| 🔒 **Maxfiylik** | Barcha ma'lumot `localStorage`da — serverga hech narsa yuborilmaydi |
| 🌍 **3 til** | O'zbek / Русский / English |
| 🎨 **4 daraja** | Oddiy → Faol → Kuchli → Dasturchi (interfeys darajaga moslashadi) |
| 🔐 **Ekran qulfi** | PIN kod (4–8 xona) — hash sifatida saqlanadi, 5 xato urinishda 30s blok |
| 🫆 **Barmoq izi** | BiometricPrompt bilan ochish (Android 9+) — PIN zaxira usul qoladi |
| 🔑 **O'z AI kaliti (BYOK)** | DeepSeek / Gemini / OpenRouter / Z.ai kaliti bilan APK'da ham bulut AI ishlaydi |
| 🔔 **Bildirishnomalar** | Vazifa eslatmasi (belgilangan vaqtdan oldin), har kuni odat va ertalabki reja eslatmasi — ilova yopiq turganda ham |
| ⏰ **Aqili budilnik** | Missiyali budilnik (Mission Alarm uslubi): matematika, xotira, yozish, silkitish, qadamlar — ketma-ket zanjir. Snooze cheklovi, yengil uyg'otish, moslashuvchan qiyinlik |
| 🌙 **Uyqu kuzatuvi** | Sensor rejimi (akselerometr + Foreground Service), uyqu tahlili va ballari, yotish eslatmasi (budilnik vaqtidan avtomatik hisoblanadi) |

---

## 🔔 Bildirishnomalar

**Sozlamalar → Bildirishnomalar** bo'limida:

- **Vazifa eslatmasi** — vazifa boshlanishidan 5/10/15/30/60 daqiqa oldin xabar beradi
- **Odat eslatmasi** — har kuni belgilangan vaqtda odatlarni belgilashga eslatadi
- **Ertalabki reja** — har kuni tongda bugungi rejani eslatadi
- **Sinov xabari** — tizim ishlashini darhol tekshirish uchun

Barcha eslatmalar **faqat qurilmada** rejalashadi (Android Local Notifications) — hech qanday server yoki push xizmati ishtirok etmaydi. Telefon qayta yoqilganda eslatmalar saqlanib qoladi.

---

## ⏰ Aqili budilnik (v1.8)

Budilnik endi oddiy jiringlovchi emas — **Mission Alarm uslubidagi missiyalar** bilan:

- **5 xil missiya**: 🧮 Matematika · 🧠 Xotira · ⌨️ Yozish · 📳 Silkitish · 🚶 Qadamlar
- **Zanjir**: 1–4 ta missiya tanlanadi — zangni to'xtatish uchun barchasi ketma-ket bajariladi (bitta bosish bilan o'chmaydi)
- **Aqili rejim** (yangi budilnikda avtomatik yoqiq):
  - missiya tartibi **har zangda aralashadi** (mushak xotirasi bilan o'chib qolmaydi)
  - **qiyinlik moslashadi** — snooze qilsangiz, keyingi safar misol qiyinroq bo'ladi
  - **yotish eslatmasi o'zi qo'yiladi** — budilnik vaqtidan uyqu maqsadiga qarab
  - **uyg'onish statistikasi** avtomatik yig'iladi (ketma-ket uyg'onish streak'i 🔥)
- **Snooze nazorati**: davomiyligi (5/10/15 daq), soni cheklovi (∞/0/1/2/3) — cheklov tugasa, snooze tugmasi o'chadi
- **Yengil uyg'otish**: ovoz asta-sekin kuchayadi (≈40 sekund)
- **Sensor missiyalari**: akselerometr orqali; sensor javob bermasa — zaxira tugma chiqadi (tizilib qolmaysiz)

---

## 🔑 O'z AI kalitini ulash (BYOK)

APK offline ishlaydi, lekin xohlasangiz bulut AI'ni ham ulashing mumkin:

1. Ilovani oching: **Sozlamalar → O'z AI kaliti (BYOK) → Sozlash**
2. Provayder tanlang (DeepSeek, Gemini, OpenRouter, Z.ai yoki Boshqa)
3. Shu provayder saytida API kalit oling va kiriting
4. **Sinab ko'rish** tugmasi bilan tekshiring → **Saqlash**

Kalit **faqat shu qurilmada** saqlanadi (eksportga kirmaydi). Kill Switch yoqilganda hamma bulut so'rovlari to'xtaydi — ilova T0 dvigateli bilan ishlashda davom etadi.

---

## 🛠 O'zingizga moslashtirish

### 1. Kodni olish

```bash
git clone https://github.com/xojaahrorA/eslatma.git
cd eslatma
bun install        # yoki: npm install
bun run dev        # http://localhost:3000
```

### 2. O'z APK'ingizni yasash

Talablar: **Java 17+**, **Android SDK** (platform 36), **Bun** yoki **Node 20+**.

```bash
# 1) Web qismini statik eksport qilish
bash scripts/build-apk-web.sh

# 2) Android loyihasiga sinxronlash
bunx cap sync android
python3 scripts/gen-android-icons.py   # ikonkalarni yangilash

# 3) APK build
cd android
./gradlew assembleDebug    # kalitsiz — debug APK (o'rnatib bo'ladi)
# yoki o'z kalitingiz bilan:
#   keytool -genkeypair -v -keystore ulos.keystore -alias ulos -validity 10000
#   ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/...
```

### 3. Shaxsiylashtirish g'oyalari

| Nima | Qayerda |
|---|---|
| Ilova nomi | `android/variables.gradle` yo'q — `android/app/src/main/res/values/strings.xml` (`app_name`) |
| Ranglar / gradientlar | `src/app/globals.css` (`brand-grad`, `--primary`...) |
| Ikonka | `public/icon-512.png` ni almashtiring → `python3 scripts/gen-android-icons.py` |
| Tillar / matnlar | `src/lib/i18n.ts` (uz), `dict-ru.ts`, `dict-en.ts` |
| Paket nomi | `capacitor.config.ts` (`appId`) + `android/app/build.gradle` (`applicationId`) |
| Versiya | `android/app/build.gradle` (`versionCode`, `versionName`) |
| Demo ma'lumotlar tarkibi | `src/lib/store.ts` → `seed()` funksiyasi |

---

## 🏗 Texnologiyalar

**Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS 4** · **shadcn/ui** · **Zustand** (persist — offline bazangiz) · **Capacitor 8** (Android) · **Framer Motion** · **lucide-react**

```
src/
  app/            # Next.js sahifalar (page.tsx — asosiy shell)
  components/app/ # Har bir modul alohida view (dashboard, tasks, finance...)
  components/ui/  # shadcn/ui komponentlar
  lib/            # store (Zustand), i18n, t0 (AI'siz dvigatel), types
android/          # Capacitor Android loyihasi (Gradle)
scripts/          # build va ikonka skriptlari
```

---

## 🔐 Maxfiylik tamoyillari (PRD)

- Barcha ma'lumot qurilmada (`localStorage`) — **server yo'q, akkaunt yo'q**
- AI buyruqlarida shaxsiy maydonlar yuborilishidan oldin **tozalanadi**
- **Kill Switch**: Sozlamalar → AI'ni to'xtatish — bulut so'rovlari butunlay o'chadi
- Har bir AI taklifi **audit jurnaliga** yoziladi va siz tasdiqlamasangiz bajarilmaydi

### Xavfsizlik qatlamlari

| Qatlam | Holat |
|---|---|
| Ruxsatlar | `INTERNET`, `POST_NOTIFICATIONS` va eslatma ruxsatlari — boshqa hech narsa yo'q |
| Tarmoq | APK **100% offline** — AI kalit ulagandagina tanlangan provayderga so'rov ketadi |
| Ekran qulfi | PIN (4–8 xona), **SHA-256 hash** sifatida saqlanadi — ochiq matn yo'q |
| Brute-force | 5 marta xato → **30 soniya** kutish rejimi |
| Avto-qulf | Ilovani fonaga yuborsangiz — qaytganda PIN so'raladi |
| Recents ekranida | Mazmun yashiriladi (`FLAG_SECURE`), skrinshot bloklanadi |
| Bulut zaxira | `allowBackup=false` — ma'lumotlar Google Drive'ga ko'chmaydi |
| AI nazorati | Har taklif audit jurnalida — siz tasdiqlamasangiz bajarilmaydi |
| Ko'chiring | `Sozlamalar → Eksport` — ma'lumotlaringiz doimo o'zingizniki |

---

## 📄 Litsenziya

Erkin foydalanish, o'zgartirish va tarqatish uchun ochiq.
