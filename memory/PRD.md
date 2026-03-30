# BudgetWise - Aplikasi Pencatatan Keuangan Pribadi

## Deskripsi
Aplikasi mobile pencatatan keuangan pribadi menggunakan React Native (Expo) dengan TypeScript dan MongoDB backend. Membantu pengguna mencatat pemasukan dan pengeluaran harian, memantau saldo, dan menganalisis kebiasaan keuangan melalui laporan visual.

## Fitur Utama

### 1. Dashboard (Beranda)
- Saldo total dengan kartu hijau gelap
- Ringkasan bulanan: pemasukan, pengeluaran, selisih
- Grafik donut pengeluaran per kategori (react-native-gifted-charts)
- Grafik bar tren 7 hari terakhir
- 5 transaksi terbaru
- Tombol "Tambah Transaksi"

### 2. Transaksi
- Form tambah/edit transaksi (jenis, jumlah Rp, kategori, catatan)
- Daftar semua transaksi dengan FlatList + infinite scroll
- Filter: bulan, jenis (semua/masuk/keluar)
- Hapus transaksi dengan konfirmasi

### 3. Kategori (14 default)
- **Pengeluaran**: Makanan & Minuman, Transportasi, Rumah & Utilitas, Belanja, Kesehatan, Hiburan, Pendidikan, Tabungan & Investasi, Lainnya
- **Pemasukan**: Gaji, Freelance/Bisnis, Hadiah/Bonus, Investasi, Lainnya
- Kategori custom (tambah/edit/hapus)

### 4. Laporan & Analitik
- Ringkasan bulanan (pemasukan vs pengeluaran)
- Grafik garis tren keuangan (3 bulan, 6 bulan, 1 tahun)
- Pie chart distribusi pengeluaran
- Statistik: rata-rata harian, hari tertinggi, jumlah transaksi
- Export CSV

### 5. Anggaran (Budget)
- Set budget bulanan per kategori
- Progress bar visual dengan warning 80% & 100%
- Ringkasan total anggaran
- Hapus anggaran

### 6. Pengaturan
- Nama profil
- PIN 6 digit keamanan (set/hapus)
- Backup data
- Reset semua data
- Info mata uang dan versi

## Teknologi
- **Frontend**: React Native + Expo SDK 54, TypeScript, expo-router
- **Backend**: FastAPI, Motor (async MongoDB)
- **Database**: MongoDB
- **Charts**: react-native-gifted-charts
- **Icons**: @expo/vector-icons (Ionicons)

## API Endpoints
- `GET/POST /api/categories` - CRUD kategori
- `GET/POST/PUT/DELETE /api/transactions` - CRUD transaksi
- `GET/POST/DELETE /api/budgets` - CRUD anggaran
- `GET /api/analytics/summary` - Ringkasan keuangan
- `GET /api/analytics/category-breakdown` - Breakdown per kategori
- `GET /api/analytics/daily-trend` - Tren harian
- `GET /api/analytics/monthly-trend` - Tren bulanan
- `GET/PUT /api/settings` - Pengaturan
- `POST /api/settings/pin/set|verify` - PIN management
- `GET /api/export/csv` - Export CSV
- `GET/POST /api/export/backup` - Backup/Import

## Tema Desain
- Warna utama: #1A4D2E (hijau gelap forest)
- Aksen: #E86A33 (terracotta)
- Pemasukan: #3A6E4B (hijau)
- Pengeluaran: #D34A3E (merah)
- Background: #F9F9F6 (krem terang)
