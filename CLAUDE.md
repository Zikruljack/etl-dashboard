# ETL Dashboard

## Overview
ETL Dashboard untuk data yang berantakan — terinspirasi Airbyte (connectors) + Airflow (pipeline) + Metabase (visualisasi).
Fokus utama: import data dari sumber berantakan (spreadsheet multi-header, merged cells, format laporan), cleaning/transform via visual pipeline, load ke dataset bersih, visualisasi di dashboard, dan tracking perubahan data antar sync.

Fokus saat ini: data bencana Aceh 2025.

## Core Flow
```
CONNECT → SNAPSHOT → EXTRACT → LOAD → TRACK → VISUALIZE
               ↑                                    |
               └────────── RE-SYNC ←─────────────────┘
```
1. **Connect** — Hubungkan ke sumber data (Google Sheets, CSV/Excel upload)
2. **Snapshot** — Fetch SELURUH cell dari A1 sampai sejauh ada data, simpan as raw_snapshot di DB
3. **Extract** — User lihat raw grid → manual select: mana row header (multi-header), mana range data, mana yang di-skip, tambah label/rename kolom. Config extraction disimpan.
4. **Load** — Apply extraction config ke raw snapshot → simpan hasil bersih ke dataset_rows
5. **Track** — Setiap re-sync: fetch raw baru → simpan snapshot baru → apply extraction config yang sama → diff dengan data lama → simpan change history
6. **Visualize** — Dashboard grid editor dengan widgets + change timeline

### Key Principles
- **Raw data selalu tersimpan** — raw_snapshot disimpan per fetch, user bisa lihat ulang kapan saja
- **Extraction = manual selection** — user pilih header rows, data range, skip rows secara visual di raw grid
- **Koneksi tetap hidup** — setelah dataset tersimpan, re-sync fetch raw baru dari source yang sama
- **Perubahan terdeteksi otomatis** — saat re-sync, apply extraction config → compare dengan data lama → log perubahan

## Tech Stack
- **Database**: PostgreSQL + Drizzle ORM
- **Backend**: Express + TypeScript (`apps/server`)
- **Frontend**: Nuxt 3 + Vue 3 (`apps/web`)
- **Shared Types**: `packages/shared`
- **Monorepo**: pnpm workspaces + concurrently (`pnpm dev` runs both)

## Architecture & Design Patterns

### Backend: Core + Module Architecture
```
apps/server/src/
├── core/                         # Framework layer — reusable, domain-agnostic
│   ├── base.repository.ts        # Generic CRUD base class
│   ├── errors.ts                 # AppError + error codes
│   ├── response.ts               # sendSuccess(), sendPaginated()
│   ├── pagination.ts             # parsePagination(), buildPaginatedResult()
│   ├── logger.ts                 # Structured logging
│   ├── security/
│   │   ├── idor-guard.ts         # Ownership verification middleware
│   │   ├── file-validator.ts     # Magic bytes, MIME, size, content scanning
│   │   └── sanitizer.ts          # Input sanitization
│   └── middleware/
│       ├── auth.ts               # JWT verification
│       ├── roles.ts              # Role-based access control
│       ├── validate.ts           # Zod schema validation
│       └── error-handler.ts      # Global error handler
├── modules/                      # Domain modules — each self-contained
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.service.ts
│   │   └── auth.repository.ts
│   ├── user/
│   │   ├── user.routes.ts
│   │   ├── user.service.ts
│   │   └── user.repository.ts
│   ├── dataset/
│   │   ├── dataset.routes.ts
│   │   ├── dataset.service.ts
│   │   └── dataset.repository.ts
│   ├── dashboard/
│   │   ├── dashboard.routes.ts
│   │   ├── dashboard.service.ts
│   │   └── dashboard.repository.ts
│   ├── source/                   # (Phase 1)
│   │   ├── source.routes.ts
│   │   ├── source.service.ts
│   │   └── connectors/
│   ├── pipeline/                 # (Phase 2)
│   │   ├── pipeline.routes.ts
│   │   ├── pipeline.service.ts
│   │   └── steps/
│   └── sync/                     # (Phase 3)
│       ├── sync.routes.ts
│       ├── sync.service.ts
│       └── diff-engine.ts
├── db/schema/                    # Drizzle table definitions
├── config/                       # env.ts, database.ts
├── utils/                        # jwt, hash (non-domain helpers)
└── index.ts
```

**4 layers, masing-masing punya 1 tanggung jawab:**

| Layer | Tanggung Jawab | Tidak Boleh |
|-------|---------------|-------------|
| **Route** | Parse request, validasi (Zod), panggil service, format response | Query DB, business logic |
| **Service** | Orchestrasi business logic, koordinasi antar repository/strategy | Query DB langsung, handle HTTP |
| **Repository** | CRUD operations, query builder, pagination | Business logic, HTTP concerns |
| **Strategy** | Implementasi spesifik (connector, pipeline step) | Akses DB langsung |

### Security

**1. IDOR Guard** — Cek kepemilikan resource sebelum akses
```typescript
// Middleware: verify user owns the resource or is admin
// Contoh: user hanya bisa akses dataset yang dia buat, admin bisa semua
checkOwnership({
  resourceFn: (id) => datasetRepo.findById(id),  // fetch resource
  ownerField: 'createdBy',                         // field yang berisi userId
  paramName: 'id',                                 // req.params key
})
```

**2. File Validator** — Validasi file upload secara mendalam (seperti `file_get_contents` + `finfo` di PHP)
```typescript
// Bukan cuma cek extension, tapi baca isi file:
// 1. Magic bytes — cek file signature (CSV, XLSX, dll)
// 2. MIME type — verify actual content type
// 3. Size limit — max file size per type
// 4. Content scan — no embedded scripts/macros berbahaya
// 5. Extension whitelist — hanya .csv, .xlsx, .xls
// 6. Filename sanitize — hapus path traversal (../, null bytes)
validateUpload({
  allowedTypes: ['csv', 'xlsx', 'xls'],
  maxSizeBytes: 50 * 1024 * 1024,  // 50MB
  scanContent: true,                 // deep content validation
})
```

**3. Input Sanitizer** — Bersihkan semua input
```typescript
// Strip HTML tags, trim whitespace, prevent NoSQL injection on JSONB
sanitize(input: unknown): unknown
```

### Design Patterns

**1. Repository Pattern** — Decouple data access dari business logic
```typescript
// Base repository dengan generic CRUD — extend per entity
class BaseRepository<T> {
  findById(id: string): Promise<T | null>
  findMany(filters?, pagination?): Promise<PaginatedResult<T>>
  create(data: InsertT): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}

// Concrete repositories extend base, add entity-specific queries
class DatasetRepository extends BaseRepository<Dataset> {
  findByCreator(userId: string): Promise<Dataset[]>
  updateSyncStatus(id: string, status: SyncStatus): Promise<void>
}
```

**2. Strategy Pattern** — Connector & pipeline step yang pluggable
```typescript
// Setiap connector implement interface yang sama
interface IConnector {
  fetchRaw(config: SourceConfig): Promise<RawData>
  testConnection(config: SourceConfig): Promise<boolean>
}

// Setiap pipeline step implement interface yang sama
interface IPipelineStep {
  execute(data: TabularData, config: StepConfig): TabularData
  validate(config: StepConfig): ValidationResult
  describe(): StepDescription
}
```

**3. Factory Pattern** — Create strategy instances by type string
```typescript
// Connector factory: "google_sheets" → GoogleSheetsConnector instance
ConnectorFactory.create("google_sheets"): IConnector

// Step factory: "rename" → RenameStep instance
StepFactory.create("rename"): IPipelineStep
```

**4. Pipeline Pattern (Chain)** — Execute steps sequential
```typescript
// PipelineExecutor iterates steps, each transforms output of previous
class PipelineExecutor {
  execute(data: TabularData, steps: PipelineStepConfig[]): PipelineResult {
    let current = data;
    for (const step of steps) {
      const handler = StepFactory.create(step.type);
      current = handler.execute(current, step.config);
    }
    return { data: current, stats };
  }
}
```

**5. Diff Engine** — Compare datasets between syncs
```typescript
// DiffEngine: compare old vs new data by key columns
class DiffEngine {
  compare(oldRows: DataRow[], newRows: DataRow[], keyColumns: string[]): DiffResult {
    // returns: { added: [], changed: [], deleted: [], unchanged: [] }
  }
}
```

(Backend structure tertulis di bagian "Core + Module Architecture" di atas)

### Frontend Architecture
```
apps/web/
├── components/
│   ├── common/                   # NEW — Reusable UI components
│   │   ├── DataTable.vue         # Generic table with sort/filter/pagination
│   │   ├── EmptyState.vue        # "No data" placeholder
│   │   ├── LoadingState.vue      # Loading spinner/skeleton
│   │   ├── ConfirmDialog.vue     # Reusable confirmation modal
│   │   ├── StatusBadge.vue       # Colored status indicator
│   │   ├── StepWizard.vue        # Multi-step wizard wrapper
│   │   └── PageHeader.vue        # Title + actions bar
│   ├── layout/
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   └── AdminSidebar.vue
│   ├── source/                   # NEW — Connect & Extract
│   │   ├── SourcePicker.vue      # Pilih connector type
│   │   ├── GoogleSheetsConfig.vue
│   │   ├── FileUploadConfig.vue
│   │   ├── RawPreview.vue        # Cell grid as-is
│   │   ├── RangeSelector.vue     # Drag-select area
│   │   └── HeaderConfig.vue      # Multi-header settings
│   ├── pipeline/                 # NEW — Transform
│   │   ├── PipelineEditor.vue    # Step list, add/remove/reorder
│   │   ├── StepCard.vue          # Single step display
│   │   ├── StepConfig.vue        # Config form per step type
│   │   ├── StepPreview.vue       # Before/after data preview
│   │   └── steps/                # Config forms per type
│   │       ├── RenameConfig.vue
│   │       ├── ChangeTypeConfig.vue
│   │       ├── TrimConfig.vue
│   │       ├── MapValuesConfig.vue
│   │       └── ...
│   ├── dataset/
│   │   ├── DatasetPreview.vue    # Clean data table
│   │   ├── DatasetChanges.vue    # NEW — Change timeline
│   │   ├── RowHistory.vue        # NEW — Per-row value history
│   │   └── SyncHistory.vue       # NEW — Sync runs list
│   ├── dashboard/
│   │   ├── DashboardGrid.vue
│   │   ├── ComponentWrapper.vue
│   │   ├── ComponentConfig.vue
│   │   └── widgets/
│   │       ├── WidgetTable.vue
│   │       ├── WidgetChart.vue
│   │       ├── WidgetMap.vue
│   │       ├── WidgetTimeline.vue
│   │       └── WidgetKPI.vue     # NEW
│   └── auth/
├── composables/                  # Reusable logic hooks
│   ├── useApi.ts                 # HTTP client with auth
│   ├── usePagination.ts          # NEW — page, pageSize, total, helpers
│   ├── useLoading.ts             # NEW — loading, error, execute() wrapper
│   ├── useDataset.ts             # NEW — dataset CRUD + data fetching
│   ├── usePipeline.ts            # NEW — pipeline state + step operations
│   └── useConfirm.ts             # NEW — confirmation dialog state
├── stores/
│   ├── auth.ts                   # User state + token
│   ├── editor.ts                 # Dashboard grid editing
│   └── wizard.ts                 # NEW — Dataset creation wizard state
├── layouts/
│   ├── default.vue               # Sidebar + header
│   ├── auth.vue                  # Centered form
│   ├── dashboard-view.vue        # Clean view mode
│   └── admin.vue                 # NEW — Admin layout + sidebar
├── middleware/
│   └── auth.ts
└── pages/
    ├── login.vue, register.vue
    ├── datasets/
    │   ├── index.vue             # Dataset list
    │   ├── new.vue               # NEW — Multi-step wizard (connect→extract→transform→load)
    │   └── [id]/
    │       ├── index.vue         # Dataset detail (tabs: data, changes, syncs, pipeline, settings)
    │       └── edit.vue          # NEW — Edit pipeline / re-extract
    ├── dashboard/
    │   ├── index.vue
    │   ├── new.vue
    │   └── [id]/
    │       ├── index.vue         # View mode
    │       └── edit.vue          # Grid editor
    └── admin/
        ├── index.vue             # Admin dashboard/overview
        ├── users.vue
        ├── datasets.vue
        ├── dashboard.vue
        ├── settings.vue
        ├── logs.vue
        └── system.vue
```

### Shared Types Structure
```
packages/shared/src/types/
├── api.ts                        # ApiResponse<T>, PaginatedResponse<T>, ApiError
├── auth.ts                       # User, UserRole, AuthResponse, LoginRequest
├── dataset.ts                    # Dataset, DatasetRow, ColumnDefinition, SourceConfig
├── dashboard.ts                  # Dashboard, DashboardPage, DashboardComponent, widget configs
├── pipeline.ts                   # NEW — Pipeline, PipelineStep, StepType, all step config types
├── extraction.ts                 # NEW — ExtractionConfig, RawData, HeaderFlattenMode
├── sync.ts                       # NEW — DatasetSync, DatasetChange, ChangeType, DiffResult
├── connector.ts                  # NEW — ConnectorType, ConnectorConfig (per type)
└── index.ts                      # Re-export all
```

## Documentation Convention

Setiap function/method/class HARUS punya JSDoc:

```typescript
/**
 * Fetch raw data dari source connector tanpa transform.
 * Mengembalikan data mentah as-is termasuk multi-header, empty rows, dll.
 *
 * @param config - Source connector configuration
 * @returns Raw cell data as 2D string array + sheet metadata
 * @throws AppError(400) jika config tidak valid
 * @throws AppError(502) jika source tidak bisa dihubungi
 */
async fetchRaw(config: SourceConfig): Promise<RawData> { ... }

/**
 * Flatten multi-level header rows menjadi single header.
 * Contoh: row1=["","Korban","Korban"], row2=["Kecamatan","Meninggal","Luka"]
 * Result: ["Kecamatan", "Korban_Meninggal", "Korban_Luka"]
 *
 * @param headerRows - Array of header row arrays
 * @param separator - Join character untuk multi-level (default: "_")
 * @returns Flattened column names
 */
flattenHeaders(headerRows: string[][], separator?: string): string[] { ... }
```

**Rules:**
- Kalimat pertama = apa yang dilakukan (singkat)
- `@param` untuk setiap parameter
- `@returns` untuk return value
- `@throws` untuk error cases
- Contoh di description jika logic complex
- Interface/type juga perlu JSDoc

## Database Schema

### Existing Tables
- **users**: id, email, password_hash, name, role (admin/editor/viewer), timestamps
- **datasets**: id, name, description, source_type, source_config (jsonb), extraction_config (jsonb), columns (jsonb), sync_status, last_synced_at, created_by, timestamps
- **dataset_rows**: id, dataset_id, data (jsonb), row_number, row_hash, first_seen_at, last_changed_at, sync_id, created_at
- **raw_snapshots**: id, dataset_id, snapshot_data (jsonb — 2D array seluruh cell), total_rows, total_cols, fetched_at, source_hash
- **dashboard**: id, title, description, is_published, created_by, timestamps
- **dashboard_pages**: id, dashboard_id, title, sort_order, timestamps
- **dashboard_components**: id, page_id, type (table/chart/map/timeline/kpi), title, layout (jsonb: x,y,w,h), config (jsonb), dataset_id, timestamps

### New Tables
- **pipelines**: id, name, dataset_id, steps (jsonb), is_active, created_by, timestamps
- **pipeline_steps**: id, pipeline_id, sort_order, type, config (jsonb), timestamps
- **dataset_syncs**: id, dataset_id, synced_at, status (success/failed/running), rows_total, rows_new, rows_changed, rows_deleted, source_snapshot_hash, error_log, duration_ms
- **dataset_changes**: id, dataset_id, sync_id, row_key, change_type (new/changed/deleted), column_name, old_value, new_value, changed_at
- **activity_logs**: id, user_id, action, resource_type, resource_id, details (jsonb), created_at

### Key JSONB Structures

**source_config** (per connector type):
```jsonc
// Google Sheets
{ "connector": "google_sheets", "spreadsheet_id": "abc", "sheet_name": "Sheet1" }
// CSV Upload
{ "connector": "csv_upload", "file_path": "/uploads/data.csv", "encoding": "utf-8" }
```

**extraction_config** (how to read raw data — saved per dataset, applied on every sync):
```jsonc
{
  "header_row_indices": [0, 1],     // row indices (0-based) yang jadi header (multi-header: [0,1])
  "header_flatten_separator": "_",  // multi-header join: "Korban" + "Meninggal" → "Korban_Meninggal"
  "data_start_row": 2,              // row index dimulai data (setelah header)
  "data_end_row": null,             // row index akhir data (null = sampai habis)
  "column_start": 0,                // kolom awal (0-based, A=0)
  "column_end": null,               // kolom akhir (null = sampai habis)
  "skip_rows": [51, 52],            // row indices to skip (totals, footnotes, empty)
  "key_columns": ["Kecamatan"],     // columns used for row identity (for change tracking)
  "column_labels": {                // manual label override per column index or auto-name
    "0": "Kecamatan",
    "Korban_Meninggal": "Jumlah Meninggal"
  }
}
```

**raw_snapshot** (stored per fetch):
```jsonc
{
  // snapshot_data: 2D array seluruh cell dari source
  // Contoh: spreadsheet dengan 3 baris, 4 kolom
  "snapshot_data": [
    ["", "Korban", "Korban", "Kerusakan"],     // row 0 (header level 1)
    ["Kecamatan", "Meninggal", "Luka", "Rumah"], // row 1 (header level 2)
    ["Banda Aceh", "5", "12", "100"],            // row 2 (data)
    ["Aceh Besar", "3", "8", "50"]              // row 3 (data)
  ],
  "total_rows": 4,
  "total_cols": 4
}
```

**pipeline step config** (per step type):
```jsonc
// rename
{ "type": "rename", "column": "old_name", "new_name": "new_name" }
// change_type
{ "type": "change_type", "column": "Korban", "target_type": "number" }
// trim
{ "type": "trim", "columns": ["Kecamatan", "Kabupaten"] }
// map_values
{ "type": "map_values", "column": "Jenis Kelamin", "mapping": { "L": "Laki-laki", "P": "Perempuan" } }
// remove_duplicates
{ "type": "remove_duplicates", "columns": ["Kecamatan", "Kejadian"] }
// fill_missing
{ "type": "fill_missing", "column": "Kabupaten", "strategy": "forward_fill" }
// find_replace
{ "type": "find_replace", "column": "Alamat", "find": "Jl.", "replace": "Jalan", "use_regex": false }
// filter_rows
{ "type": "filter_rows", "condition": { "column": "Status", "operator": "!=", "value": "" } }
// split_column
{ "type": "split_column", "column": "Lokasi", "separator": ",", "new_columns": ["Kota", "Provinsi"] }
// merge_columns
{ "type": "merge_columns", "columns": ["Kota", "Provinsi"], "separator": ", ", "new_column": "Lokasi" }
```

## API Routes

### Auth
- `POST /api/auth/register|login` + `GET /api/auth/me`

### Datasets
- `GET|POST /api/datasets`, `GET|PATCH|DELETE /api/datasets/:id`
- `POST /api/datasets/:id/sync` — trigger sync (extract → transform → load → diff)
- `GET /api/datasets/:id/data` — get clean data (paginated)
- `GET /api/datasets/:id/columns` — get column definitions
- `GET /api/datasets/:id/changes` — get change history timeline
- `GET /api/datasets/:id/changes/:rowKey` — get single row change history
- `GET /api/datasets/:id/syncs` — get sync history

### Source & Extraction
- `POST /api/sources/connect` — test connection to source (Google Sheets, etc)
- `POST /api/sources/fetch-raw` — fetch ALL cells from source, save raw_snapshot, return snapshot
- `GET /api/datasets/:id/raw` — get latest raw snapshot for dataset
- `POST /api/sources/extract-preview` — apply extraction config to snapshot, return preview (no save)

### Pipelines (Phase 2.5)
- `GET|POST /api/datasets/:id/pipeline` — get/save pipeline for dataset
- `POST /api/datasets/:id/pipeline/preview` — run pipeline on sample data, return preview

### dashboard
- `GET|POST /api/dashboard`, `GET|PATCH|DELETE /api/dashboard/:id`
- `POST|PATCH|DELETE /api/dashboard/:id/pages/:pid`
- `PUT /api/dashboard/:id/pages/:pid/components` (bulk save)
- `POST /api/data/query` (flexible query for widgets)

### Admin
- `GET|PATCH|DELETE /api/users` (admin only)
- `GET /api/admin/logs` — activity logs
- `GET /api/admin/system` — system info

## Key Packages
**Backend**: express, drizzle-orm, drizzle-kit, postgres, googleapis, zod, jsonwebtoken, bcryptjs, cors, helmet, express-rate-limit, tsx, xlsx (for Excel parsing), csv-parse, multer (file upload)
**Frontend**: nuxt, @pinia/nuxt, @nuxtjs/tailwindcss, vue-grid-layout, echarts, vue-echarts, @vue-leaflet/vue-leaflet, leaflet, @tanstack/vue-table, @vueuse/core

## Auth
- JWT-based, roles: admin (full access), editor (dashboard + datasets), viewer (view published only)

## Admin Panel (admin only)
Full admin panel dengan sidebar terpisah:
- **Users** (`/admin/users`) — kelola semua user, ubah role, hapus
- **Datasets** (`/admin/datasets`) — kelola semua datasets, trigger sync, hapus
- **dashboard** (`/admin/dashboard`) — kelola semua dashboard, publish/unpublish, hapus
- **Settings** (`/admin/settings`) — konfigurasi Google API credentials, app settings
- **Activity Logs** (`/admin/logs`) — log aktivitas user (login, sync, create, delete)
- **System Info** (`/admin/system`) — info server, DB stats, versi app

## Conventions
- All API responses use `ApiResponse<T>` or `PaginatedResponse<T>` wrapper
- Zod for request validation on backend
- Dataset data stored as JSONB rows for flexibility (different schemas per dataset)
- Dashboard component configs are type-specific JSONB (TableConfig, ChartConfig, MapConfig, TimelineConfig)
- Grid layout uses {x, y, w, h} format compatible with vue-grid-layout
- Schema imports in `db/schema/` must use extensionless paths (drizzle-kit CJS compat)
- `.env` file lives at project root, loaded via relative path from apps
- Pipeline steps are executed sequentially, each step transforms the output of the previous step
- Change tracking uses key_columns for row identity; falls back to row_hash if no key defined
- Every function/method/class MUST have JSDoc documentation
- Reusable logic goes in composables (frontend) or utils (backend)
- Common UI patterns use shared components in `components/common/`
- Repository classes handle ALL database queries — services NEVER query DB directly
- One file = one responsibility. Max ~200 lines per file, split if larger.

## Completed
- [x] Monorepo setup (pnpm workspaces, tsconfig, concurrently)
- [x] Shared types package (auth, dataset, dashboard, api)
- [x] Database schema (6 tables, all pushed to PostgreSQL)
- [x] Backend: Express app, middleware (auth, roles, validate, error), all routes, all services
- [x] Frontend: Nuxt 3 + Tailwind, layouts, auth pages, stores
- [x] Dataset pages (list, create, detail/preview, sync)
- [x] Dashboard pages (list, create, view, grid editor)
- [x] All 4 widgets (Table, Chart/ECharts, Map/Leaflet, Timeline)
- [x] Component config panel (dataset selector, column picker, type-specific settings)
- [x] Admin user management page
- [x] **Phase 0 Backend**: Core + Module architecture refactor
  - [x] `core/base.repository.ts` — Generic BaseRepository with CRUD (findById, findAll, findWhere, findPaginated, create, update, delete, count)
  - [x] `core/errors.ts` — AppError class + assertFound helper
  - [x] `core/response.ts` — sendSuccess(), sendPaginated()
  - [x] `core/pagination.ts` — parsePagination(), buildPaginationMeta()
  - [x] `core/logger.ts` — Structured logger with child context
  - [x] `core/security/idor-guard.ts` — checkOwnership() middleware (IDOR protection)
  - [x] `core/security/file-validator.ts` — Magic bytes, MIME, size, content scanning
  - [x] `core/security/sanitizer.ts` — sanitizeString, sanitizeDeep, stripHtml, isValidUuid
  - [x] `core/middleware/` — auth, roles, validate, error-handler (moved from src/middleware/)
  - [x] `modules/auth/` — auth.repository + auth.service + auth.routes
  - [x] `modules/user/` — user.repository + user.service + user.routes
  - [x] `modules/dataset/` — dataset.repository + dataset.service + dataset.routes + data.service + google-sheets.service
  - [x] `modules/dashboard/` — dashboard.repository + dashboard.service + dashboard.routes
  - [x] Deleted old `src/routes/`, `src/services/`, `src/middleware/` (replaced by core + modules)
  - [x] `tsc --noEmit` clean — zero errors
- [x] **Phase 0 Frontend**: Reusable components + composables refactor
  - [x] `composables/useLoading.ts` — Wraps async fn with loading/error/data state
  - [x] `composables/usePagination.ts` — Reactive pagination state + nav helpers
  - [x] `composables/useConfirm.ts` — Promise-based confirmation dialog state
  - [x] `composables/useApi.ts` — Fixed: auto-serialize body, typed options, removed JSON.stringify requirement
  - [x] `components/common/LoadingState.vue` — Centered spinner + message
  - [x] `components/common/EmptyState.vue` — Centered icon + title + message + action
  - [x] `components/common/PageHeader.vue` — Title + badge + actions bar with optional back nav
  - [x] `components/common/StatusBadge.vue` — Colored pill badge by status string
  - [x] `components/common/ConfirmDialog.vue` — Modal dialog with Teleport, works with useConfirm
  - [x] `components/common/DataTable.vue` — Generic table with slots, loading, empty state
  - [x] Refactored all pages: datasets (index, [id], new), dashboard (index, new, [id]/index, [id]/edit), admin/users, login, register
  - [x] Replaced all `any` types with shared types (Dataset, Dashboard, User, ApiResponse, etc.)
  - [x] Removed all `JSON.stringify(body)` calls — useApi now auto-serializes
  - [x] Replaced vanilla `confirm()` with useConfirm + ConfirmDialog
  - [x] DatasetPreview now uses usePagination composable
- [x] **Phase 1: Connect & Snapshot + CSV/Excel Upload** (semua connector selesai)
  - [x] Shared types: `packages/shared/src/types/extraction.ts` — RawSnapshot, CellGrid, ExtractionConfig, ExtractionPreview, FetchRawRequest/Response, ExtractPreviewRequest, CreateDatasetFromExtractionRequest
  - [x] DB: `db/schema/raw-snapshots.ts` — raw_snapshots table (id, datasetId, snapshotData JSONB, totalRows, totalCols, sourceHash, fetchedAt)
  - [x] Backend: `modules/source/snapshot.repository.ts` — SnapshotRepository (findLatestByDataset, findByDataset, linkToDataset)
  - [x] Backend: `modules/source/source.service.ts` — connectSource(), fetchRaw(), extractPreview(), createDatasetFromExtraction(), getSnapshot(), uploadFileSource()
  - [x] Backend: `modules/source/source.routes.ts` — POST /connect, POST /fetch-raw, POST /extract-preview, POST /create-dataset, POST /upload, GET /snapshot/:id
  - [x] Backend: GoogleSheetsConnector via `modules/dataset/google-sheets.service.ts` (testConnection, fetchAllCells)
  - [x] Backend: `core/middleware/upload.ts` — multer config (memory storage, 50MB limit, magic byte validation)
  - [x] Backend: `modules/source/connectors/csv.connector.ts` — parse CSV buffer → CellGrid (2D string array)
  - [x] Backend: `modules/source/connectors/excel.connector.ts` — parse .xlsx/.xls buffer → CellGrid, multi-sheet support
  - [x] Backend: `modules/source/connectors/connector.factory.ts` — ConnectorFactory: 'csv' → CsvConnector, 'excel' → ExcelConnector
  - [x] Frontend: `components/source/RawPreview.vue` — Cell grid as-is, row click events, color coding (header=blue, skip=red, data=green), column letters, legend
  - [x] Frontend: `components/source/SourcePicker.vue` — pilih antara Google Sheets / Upload CSV / Upload Excel
  - [x] Frontend: `components/source/FileUploadConfig.vue` — drag-drop upload, sheet selector untuk Excel, file info display
  - [x] Frontend: Dataset creation wizard `pages/datasets/new.vue` — multi-step wizard UI (connect → preview → extract → configure → load), fully integrated with SourcePicker + FileUploadConfig
  - [x] Frontend: `stores/wizard.ts` — Wizard state (step, source, snapshotId, rawData, extractionConfig, preview, setSource, setRawData, toggleHeaderRow, toggleSkipRow, goTo, nextStep, prevStep, reset)
- [x] **Phase 2: Extract — Manual Selection** (core logic selesai)
  - [x] Shared types: ExtractionConfig in `extraction.ts` (headerRowIndices, headerFlattenSeparator, dataStartRow, dataEndRow, columnStart, columnEnd, skipRows, keyColumns, columnLabels)
  - [x] Backend: `modules/source/extractor.service.ts` — flattenHeaders() (multi-header flatten dengan dedupe), applyExtraction() (core extraction logic), previewToRowData() (convert to JSONB format)
  - [x] Backend: POST /api/sources/extract-preview — apply config to snapshot, return preview
  - [x] Backend: POST /api/sources/create-dataset — save dataset + extraction_config + initial load from snapshot
  - [x] Frontend: `components/source/ExtractionGrid.vue` — interactive extraction config UI with:
    - [x] Click row to mark as header (toggle, multi-row, auto-adjust dataStartRow)
    - [x] Set data range (start row, end row, columns) via input fields
    - [x] Right-click row to skip (UI instruction, uses RawPreview row-click)
    - [x] Edit column labels (inline input, override auto-flattened names, blue highlight for custom labels)
    - [x] Live preview of extraction result (debounced, shows headers + first 50 rows)
    - [x] Header separator config
- [x] **Phase 2.5: Transform — Cleaning Pipeline** (selesai)
  - [x] Shared types: `packages/shared/src/types/pipeline.ts` — Pipeline, PipelineStep, StepType, all step config types, StepDescription, SavePipelineRequest, PipelinePreviewRequest/Response
  - [x] DB: `db/schema/pipelines.ts` — pipelines + pipeline_steps tables
  - [x] Backend: `modules/pipeline/steps/step.interface.ts` — IPipelineStep interface (execute, validate, describe)
  - [x] Backend: Step implementations (10 steps): rename, change_type, trim, map_values, remove_duplicates, fill_missing, find_replace, filter_rows, split_column, merge_columns
  - [x] Backend: `modules/pipeline/step.factory.ts` — StepFactory (create by type, getAllDescriptions, isValidType)
  - [x] Backend: `modules/pipeline/pipeline.executor.ts` — PipelineExecutor (execute + preview with per-step results)
  - [x] Backend: `modules/pipeline/pipeline.repository.ts` — upsert atomically, findByDataset, deleteByDataset
  - [x] Backend: `modules/pipeline/pipeline.service.ts` — getPipeline, savePipeline, previewPipeline, deletePipeline
  - [x] Backend: `modules/pipeline/pipeline.routes.ts` — GET|POST|DELETE /api/datasets/:id/pipeline + POST /preview + GET /step-types
  - [x] Frontend: `composables/usePipeline.ts` — pipeline state + step CRUD + savePipeline + runPreview
  - [x] Frontend: `components/pipeline/StepCard.vue` — step card with expand/move/remove
  - [x] Frontend: `components/pipeline/StepConfig.vue` — config form for all 10 step types
  - [x] Frontend: `components/pipeline/StepPreview.vue` — output table + per-step stats tabs
  - [x] Frontend: `components/pipeline/PipelineEditor.vue` — full editor (step list, add menu, save, preview)
  - [x] Frontend: Pipeline tab in `pages/datasets/[id].vue` — lazy-loads sample rows for preview
- [x] **Phase 3: Track — Sync & Change History** (selesai)
  - [x] Shared types: `packages/shared/src/types/sync.ts` — DatasetSync, DatasetChange, ChangeType, DiffResult
  - [x] DB: `db/schema/dataset-syncs.ts` — dataset_syncs table
  - [x] DB: `db/schema/dataset-changes.ts` — dataset_changes table
  - [x] DB: Update dataset_rows schema — row_hash, first_seen_at, last_changed_at, sync_id
  - [x] Backend: `modules/sync/` — sync.repository, change.repository, diff-engine, sync.service, sync.routes
  - [x] Backend: GET /api/datasets/:id/syncs|changes|changes/:rowKey + POST /api/datasets/:id/sync
  - [x] Frontend: `components/dataset/SyncHistory.vue` — sync run list
  - [x] Frontend: `components/dataset/DatasetChanges.vue` — change timeline
  - [x] Frontend: `components/dataset/RowHistory.vue` — per-row value history
  - [x] Frontend: Dataset detail page tabs: Data | Raw | Changes | Syncs | Pipeline | Settings
- [x] **Phase 4 (partial): Visualize — Dashboard Enhancements**
  - [x] Frontend: `components/dashboard/widgets/WidgetKPI.vue` — KPI widget dengan aggregation, color accent, unit
  - [x] Shared types: tambah 'kpi' ke ComponentType di `dashboard.ts`, tambah KPIConfig type
  - [x] Frontend: Update `components/dashboard/ComponentConfig.vue` — config form untuk KPI widget
  - [x] Bug fix: `stores/editor.ts` `addComponent` — array spread (bukan push) agar watcher DashboardGrid trigger
  - [x] Bug fix: `stores/editor.ts` `addComponent` — bottomY calculation agar widget baru tidak collide
  - [x] Bug fix: `components/dashboard/DashboardGrid.vue` — hilangkan `layout.value = normalizedLayout` di onLayoutUpdated (cegah infinite recursive update)
  - [x] Integration test (Playwright): full flow dashboard — create, add widgets (Table/Chart/KPI/Timeline), config, save, view
- [x] **Phase 5 Frontend (partial)**: Admin pages + layout
  - [x] `layouts/admin.vue` — Admin layout
  - [x] `pages/admin/users.vue` — User management
  - [x] `pages/admin/datasets.vue` — Dataset management
  - [x] `pages/admin/dashboard.vue` — Dashboard management
  - [x] `pages/admin/settings.vue` — Settings page (UI only, no backend persistence)
  - [x] `pages/admin/logs.vue` — Activity logs page (UI only, no backend API)
  - [x] `pages/admin/system.vue` — System info page (UI only, no backend API)

## TODO

### Phase 4 Remaining: Dashboard Enhancements
- [ ] Frontend: Global filter per dashboard page (date range, kategori, lokasi → filter semua widgets)
- [ ] Frontend: Enhanced WidgetTimeline — consume dataset_changes data (bukan hanya dataset biasa)
- [ ] Backend + Frontend: Dashboard publish toggle (isPublished) + public share URL tanpa login

### Phase 5 Remaining: Admin Backend + Activity Logging
- [ ] DB: `db/schema/activity-logs.ts` — activity_logs table (id, user_id, action, resource_type, resource_id, details JSONB, created_at)
- [ ] Backend: `modules/admin/activity-log.repository.ts` — CRUD + paginated query
- [ ] Backend: `modules/admin/activity-log.service.ts` — log activity, query logs
- [ ] Backend: `core/middleware/activity-logger.ts` — auto-log middleware (create/update/delete actions)
- [ ] Backend: `modules/admin/admin.routes.ts`:
  - [ ] GET /api/admin/logs — activity logs (paginated, filterable by user, action, resource)
  - [ ] GET /api/admin/system — system info (DB stats, server version, uptime, memory)
- [ ] Backend: Settings persistence — simpan Google API credentials / app settings ke DB
- [ ] Frontend: Update admin pages — connect ke real backend API endpoints

### Phase 6: Full Integration Testing
- [x] Test full flow: register → login → connect Google Sheets → fetch raw → extract → load → view data
- [ ] Test CSV upload flow: upload file → preview raw → extract → load
- [ ] Test re-sync: edit data di source → trigger sync → lihat diff/changes
- [ ] Test pipeline: add transform steps → preview → apply
- [x] Test dashboard: create → add widgets (Table/Chart/KPI/Timeline) → config → save → view
- [ ] Test admin panel: manage users → view logs → system info

## Expected Output

### Dataset Creation Wizard (New Flow)
```
Step 1: Connect       → Pilih source (Google Sheets / Upload CSV/Excel)
Step 2: Raw Preview   → Fetch & simpan raw snapshot, tampilkan seluruh cell as-is di grid
Step 3: Extract       → User select di grid:
                         - Klik row(s) untuk tandai sebagai header (multi-header)
                         - Drag/set range data (start row, end row, columns)
                         - Klik row untuk skip (total rows, footnotes)
                         - Tambah/edit label kolom (override auto-flatten)
                         - Preview hasil extraction real-time
Step 4: Configure     → Set nama dataset, key columns untuk change tracking
Step 5: Load          → Apply extraction config ke raw snapshot → simpan data bersih
```

### Re-Sync Flow
```
1. Fetch raw data baru dari source → simpan raw_snapshot baru
2. Apply extraction_config yang sama ke raw snapshot baru
3. Compare hasil extraction dengan dataset_rows yang ada
4. Detect: new rows, changed rows, deleted rows
5. Update dataset_rows + simpan changes ke dataset_changes
```

### Dataset Detail Page (Tabs)
```
[Data]       — Tabel data bersih (hasil extraction), paginated, searchable
[Raw]        — Lihat raw snapshot terakhir + extraction config overlay (highlight header, data range, skipped rows)
[Changes]    — Timeline perubahan: per sync lihat apa yang new/changed/deleted
[Row: X]     — Klik row → lihat history value per kolom over time
[Extraction] — Edit extraction config: header rows, data range, skip rows, column labels → re-apply
[Syncs]      — History setiap sync run (waktu, durasi, stats, status)
[Settings]   — Source config, key columns, sync mode
```

### Dashboard View
```
Grid layout dengan widgets:
- Table: data tabular with sorting/filtering
- Chart: bar, line, pie via ECharts
- Map: geo data via Leaflet
- Timeline: data evolution dari change history
- KPI: angka summary besar
- Global filter: date range, kategori, lokasi → filter semua widget
```
