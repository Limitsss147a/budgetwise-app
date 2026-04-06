# 🚀 Panduan Deployment Lengkap BudgetWise
Panduan ini dirancang untuk memandu Anda mendeploy backend ke **Railway**, database ke **MongoDB Atlas**, dan aplikasi mobile frontend Anda ke **Expo Application Services (EAS)** agar tidak bergantung lagi pada backend sementara.

---

## 📅 Tahap 1: Setup Database (MongoDB Atlas)
1. Buka [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) dan login/daftar.
2. Buat sebuah **Cluster gratis** (M0 Sandbox).
3. Setelah cluster dibuat, klik **Connect** pada cluster Anda.
4. Pilih **Drivers** (Node.js atau Python tidak masalah, kita hanya butuh string URL-nya).
5. Salin *Connection String* yang diberikan. Formatnya akan seperti ini:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Buka menu **Database Access** di sidebar, lalu klik **Add New Database User**. Buat username dan password (catat password ini).
7. Ganti `<username>` dan `<password>` pada *Connection String* Anda dengan yang baru saja Anda buat.
8. Buka menu **Network Access**, klik **Add IP Address**, dan pilih **Allow Access from Anywhere** (atau `0.0.0.0/0`) agar server Railway dapat mengakses database Anda. 
9. **Simpan *Connection String* tersebut karena akan kita gunakan di Railway (disebut `MONGO_URL`).**

---

## 🚂 Tahap 2: Deploy Backend & Database ke Railway
Karena Anda sudah menggunakan GitHub, kita akan menyambungkan repositori GitHub langsung ke Railway. *Catatan: File [Procfile](file:///d:/coding/BudgetWise/backend/Procfile) telah saya tambahkan ke backend untuk mempermudah Railway menjalankan FastAPI.*

1. Buka [Railway](https://railway.app/) dan buat akun/login dengan akun GitHub Anda.
2. Klik **New Project** dan pilih **Deploy from GitHub repo**.
3. Cari dan pilih repositori `BudgetWise` Anda.
4. Railway akan mencoba membangun (build) aplikasi Anda. Proses build awal mungkin akan *error* karena *Environment Variables* belum diatur.
5. Klik pada project "Backend" yang baru saja dibuat di dashboard Railway.
6. Buka tab **Variables** dan tambahkan variabel lingkungan (Environment Variables) berikut satu per satu:

| Variable Name | Keterangan & Nilai (Values) |
| ------------- | --------------------------- |
| `MONGO_URL` | *Connection String* milik Anda dari Tahap 1 (MongoDB Atlas). |
| `DB_NAME` | Nama database yang Anda inginkan (contoh: `budgetwise-prod`). |
| `JWT_SECRET` | Buat kombinasi teks/angka acak yang panjang (contoh: `supeR_r4hasIa_123!45`). |
| `ADMIN_EMAIL` | Email untuk akun admin (contoh: `admin@budgetwise.mobi`). |
| `ADMIN_PASSWORD` | Password akun admin saat pertama kali masuk (contoh: `admin1234`). |
| `ALLOWED_ORIGINS` | Daftar asal (*origins*) yang diizinkan untuk bypass CORS (berguna bila Anda merilis web/dashboard di luar mobile app). Bisa diabaikan atau contoh: `https://frontend-anda.vercel.app`. |

7. Setelah variabel dimasukkan, buka tab **Settings**, gulir ke bawah ke bagian **Networking**, dan klik **Generate Domain**. Railway akan memberikan Anda URL permanen yang aman (contoh: `https://budgetwise-backendxxxx.up.railway.app`).
8. **Simpan URL Public ini**! Ini adalah `BACKEND_URL` Anda yang akan dipakai di aplikasi mobile (frontend).

---

## 📱 Tahap 3: Update Konfigurasi Aplikasi Mobile (Frontend)
Sekarang, backend Anda telah hidup di Railway. Kita perlu mengarahkan aplikasi seluler Anda untuk berkomunikasi dengan server baru Anda dengan menggunakan metode aman (EAS Secrets), bukan di-_hardcode_ secara lokal.

1. Buka halaman proyek Expo Anda di [EAS (Expo Application Services)](https://expo.dev), masuk ke menu **Secrets** ATAU gunakan terminal bawaan.
2. Daftarkan URL Public dari Railway melalui terminal di lingkungan `frontend`:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "https://budgetwise-backendxxxx.up.railway.app"
   ```
   *(Ingat: pastikan mengganti link tersebut dengan URL aslinya dan tidak memakai garis miring (`/`) di paling akhir URL!)*

3. Anda **tidak perlu mengedit** file [frontend/eas.json](file:///d:/coding/BudgetWise/frontend/eas.json) secara manual karena hal tersebut sudah dikonfigurasikan agar mendelegasikan nilai otomatis dari `$EXPO_PUBLIC_BACKEND_URL` sebagai lingkungan *preview* maupun *production*.

---

## 🏗️ Tahap 4: Build Aplikasi Mobile (APK) Secara Permanen
Setelah Anda siap dengan URL backend yang baru, langkah terakhir adalah menginstruksikan server Expo Application Services (EAS) untuk membuild versi Android Anda.

1. Buka terminal di CWD `frontend` server Anda (`cd frontend`).
2. Jalankan perintah: 
   ```bash
   eas build --profile preview --platform android
   ```
3. Tunggu hingga selesai di Cloud Expo. Saat sudah selesai, Anda akan mendapatkan URL permanen ke sebuah file `.apk` instalasi.

🎉 **Selesai!** Anda sekarang men-deploy aplikasi Anda sepenuhnya, backend, database dan frontend sudah dikonfigurasikan dari sistem lokal Anda!

---
> **Info Seputar Bug Notifikasi Mingguan:**
> Bug crash yang sebelumnya Anda hadapi pada notifikasi mingguan di Android bersumber dari kurangnya persetujuan/izin OS terkait `USE_EXACT_ALARM` dan fitur Alarm & Reminders di API Android 13/14 baru yang membuat jadwal crash diam-diam di belakan layar. Saya *telah secara otomatis memodifikasi izin di file [app.json](file:///d:/coding/BudgetWise/frontend/app.json) serta mengupdate fungsi handling notifikasi di services agar aman digunakan.*
