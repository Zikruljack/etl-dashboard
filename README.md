# ETL Dashboard

> Platform ETL visual untuk data yang berantakan — terinspirasi oleh Airbyte, Airflow, dan Metabase.

Dikembangkan untuk kebutuhan pengelolaan dan visualisasi **data bencana Aceh 2025** — dari spreadsheet multi-header yang acak-acakan, hingga dashboard yang bersih dan siap presentasi.

---

## Fitur Utama

### Connect & Snapshot
- Hubungkan ke **Google Sheets**, upload **CSV**, atau **Excel** (.xlsx/.xls)
- Fetch seluruh cell dari A1 sampai ujung data, simpan sebagai raw snapshot
- Koneksi tetap hidup — re-sync kapan saja dari source yang sama

### Extract — Visual Selection
- Lihat raw grid seperti apa adanya (termasuk merged cell, multi-header, baris kosong)
- **Klik row** untuk tandai sebagai header (multi-header support)
- Set range data: baris awal, baris akhir, kolom awal, kolom akhir
- **Skip rows** untuk total, catatan kaki, baris kosong
- Edit label kolom manual (override nama hasil flatten otomatis)
- Preview hasil extraction real-time

### Transform — Visual Pipeline
- Pipeline cleaning berbasis step yang bisa disusun secara visual
- **10 step type** yang tersedia:
  - `rename` — ubah nama kolom
  - `change_type` — ubah tipe data (string, number, date, boolean)
  - `trim` — hapus spasi ekstra
  - `map_values` — mapping nilai (L → Laki-laki, dll)
  - `remove_duplicates` — hapus baris duplikat
  - `fill_missing` — isi nilai kosong (forward fill, backward fill, konstanta)
  - `find_replace` — cari & ganti nilai (support regex)
  - `filter_rows` — filter berdasarkan kondisi
  - `split_column` — pecah satu kolom menjadi dua
  - `merge_columns` — gabung beberapa kolom

### Track — Sync & Change History
- Setiap re-sync: fetch raw baru → apply extraction config → diff dengan data lama
- Deteksi otomatis: baris baru, baris berubah, baris terhapus
- Timeline perubahan per sync run
- Riwayat nilai per baris per kolom over time

### Visualize — Dashboard Grid
- Grid editor dengan drag & resize komponen
- **5 widget type**: Tabel, Chart (ECharts), Peta (Leaflet), Timeline, KPI
- Config per widget: pilih dataset, kolom, warna, format
- Dashboard bisa dipublish untuk akses publik

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Nuxt 3 + Vue 3 + TypeScript |
| **Styling** | Tailwind CSS |
| **State** | Pinia |
| **Charts** | ECharts via vue-echarts |
| **Maps** | Leaflet via @vue-leaflet |
| **Grid** | vue-grid-layout |
| **Backend** | Express + TypeScript |
| **ORM** | Drizzle ORM |
| **Database** | PostgreSQL |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **Validation** | Zod |
| **File Parsing** | xlsx + csv-parse |
| **Monorepo** | pnpm workspaces |

---

## Arsitektur

```
etl-dashboard/
├── apps/
│   ├── server/          # Express API server
│   │   └── src/
│   │       ├── core/    # Base repo, middleware, security, logger
│   │       ├── modules/ # auth, user, dataset, dashboard, source, pipeline, sync
│   │       └── db/      # Drizzle schema definitions
│   └── web/             # Nuxt 3 frontend
│       ├── components/  # common, source, pipeline, dataset, dashboard
│       ├── composables/ # useApi, usePipeline, usePagination, useLoading
│       ├── pages/       # datasets, dashboard, admin
│       └── stores/      # auth, editor, wizard
└── packages/
    └── shared/          # Shared TypeScript types (monorepo)
```

### Backend: 4-Layer Architecture

```
Route → Service → Repository → Database
```

| Layer | Tanggung Jawab |
|-------|---------------|
| **Route** | Parse request, validasi Zod, format response |
| **Service** | Business logic, orchestrasi |
| **Repository** | CRUD & query builder |
| **Strategy** | Connector & pipeline step (pluggable) |

### Security

- **IDOR Guard** — verifikasi kepemilikan resource sebelum akses
- **File Validator** — magic bytes, MIME type, size limit, content scan (no macros)
- **Input Sanitizer** — strip HTML, prevent NoSQL injection
- **Rate Limiting** — express-rate-limit
- **Helmet** — security headers

---

## Alur Kerja (Core Flow)

```
CONNECT → SNAPSHOT → EXTRACT → TRANSFORM → LOAD → TRACK → VISUALIZE
                ↑                                              |
                └──────────────── RE-SYNC ←────────────────────┘
```

1. **Connect** — Pilih source (Google Sheets / CSV / Excel)
2. **Snapshot** — Fetch seluruh cell, simpan raw_snapshot di DB
3. **Extract** — Visual selection: header rows, data range, skip rows, column labels
4. **Transform** — Susun pipeline cleaning (opsional)
5. **Load** — Apply extraction + transform → simpan data bersih ke `dataset_rows`
6. **Track** — Re-sync: fetch baru → diff → log perubahan di `dataset_changes`
7. **Visualize** — Dashboard widgets konsumsi clean data

---

## Database Schema

```
users              — akun pengguna + role (admin/editor/viewer)
datasets           — metadata dataset + source_config + extraction_config
dataset_rows       — baris data bersih (JSONB per baris)
raw_snapshots      — raw cell grid per fetch (2D array)
pipelines          — definisi pipeline per dataset
dataset_syncs      — riwayat setiap sync run (stats, durasi, status)
dataset_changes    — perubahan per baris per kolom antar sync
dashboard          — metadata dashboard
dashboard_pages    — halaman per dashboard
dashboard_components — widget configs (layout + dataset + type-specific config)
```

---

## Setup & Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- PostgreSQL >= 14

### 1. Clone & Install

```bash
git clone https://github.com/Zikruljack/etl-dashboard.git
cd etl-dashboard
pnpm install
```

### 2. Environment Variables

Salin `.env.example` ke `.env` di root project:

```bash
cp .env.example .env
```

Isi variabel yang diperlukan:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/etl_dashboard
JWT_SECRET=your-secret-key-here
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
PORT=3001
```

### 3. Setup Database

```bash
# Push schema ke PostgreSQL
cd apps/server
pnpm db:push
```

### 4. Jalankan Development Server

```bash
# Di root — jalankan backend + frontend sekaligus
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
```

### Datasets
```
GET    /api/datasets              — list datasets
POST   /api/datasets              — create dataset
GET    /api/datasets/:id          — get dataset detail
PATCH  /api/datasets/:id          — update dataset
DELETE /api/datasets/:id          — delete dataset
GET    /api/datasets/:id/data     — get clean rows (paginated)
POST   /api/datasets/:id/sync     — trigger re-sync
GET    /api/datasets/:id/syncs    — sync history
GET    /api/datasets/:id/changes  — change timeline
```

### Source & Extraction
```
POST   /api/sources/connect         — test connection
POST   /api/sources/fetch-raw       — fetch raw snapshot
POST   /api/sources/extract-preview — preview extraction config
POST   /api/sources/create-dataset  — create dataset from extraction
POST   /api/sources/upload          — upload CSV/Excel file
```

### Pipeline
```
GET    /api/datasets/:id/pipeline         — get pipeline
POST   /api/datasets/:id/pipeline         — save pipeline
POST   /api/datasets/:id/pipeline/preview — preview pipeline output
DELETE /api/datasets/:id/pipeline         — delete pipeline
GET    /api/datasets/:id/pipeline/step-types — list all step types
```

### Dashboard
```
GET    /api/dashboard                         — list dashboards
POST   /api/dashboard                         — create dashboard
GET    /api/dashboard/:id                     — get dashboard
PATCH  /api/dashboard/:id                     — update dashboard
DELETE /api/dashboard/:id                     — delete dashboard
PUT    /api/dashboard/:id/pages/:pid/components — bulk save components
```

---

## Role & Akses

| Role | Akses |
|------|-------|
| **admin** | Full akses — semua CRUD, admin panel, kelola user |
| **editor** | Buat & edit dataset + dashboard sendiri |
| **viewer** | Hanya lihat dashboard yang dipublish |

---

## Status Pengembangan

| Phase | Fitur | Status |
|-------|-------|--------|
| 0 | Core architecture (backend + frontend refactor) | ✅ Selesai |
| 1 | Connect & Snapshot (Google Sheets, CSV, Excel) | ✅ Selesai |
| 2 | Extract — Visual selection di raw grid | ✅ Selesai |
| 2.5 | Transform — Visual pipeline (10 step types) | ✅ Selesai |
| 3 | Track — Sync & change history | ✅ Selesai |
| 4 | Visualize — Dashboard enhancements (KPI widget) | ✅ Selesai |
| 5 | Admin backend (activity logs, settings persistence) | 🔄 In Progress |
| 6 | Full integration testing | ⏳ Planned |

---

## Lisensi

MIT License — lihat [LICENSE](LICENSE) untuk detail.

---

## Kontribusi

Pull request dan issue welcome. Pastikan ikuti konvensi yang ada di `CLAUDE.md` untuk konsistensi arsitektur.
