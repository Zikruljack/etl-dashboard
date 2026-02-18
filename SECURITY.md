# Security Review — ETL Dashboard

> Last reviewed: 2026-02-17
> Reviewer: Automated Security Audit (Claude)
> Scope: Full codebase (`c602bac` — init awal)

---

## Summary

| # | Vulnerability | Severity | Status |
|---|--------------|----------|--------|
| 1 | Hardcoded JWT Secret Fallback | **HIGH** | Open |
| 2 | Mass Assignment on Dashboard PATCH Endpoints | **HIGH** | Open |
| 3 | Broken Access Control (IDOR) on Read Endpoints | **MEDIUM** | Open |

---

## Vuln 1: Hardcoded JWT Secret Fallback

**Severity**: HIGH
**File**: `apps/server/src/config/env.ts:10`
**Category**: Hardcoded Secret / Authentication Bypass

### Description

```typescript
JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
```

Jika environment variable `JWT_SECRET` tidak di-set (misalnya lupa config di production), aplikasi diam-diam pakai string default `'dev-secret-change-me'`. Tidak ada validasi saat startup yang mencegah server jalan dengan secret default ini.

### Exploit Scenario

Attacker yang tahu default secret bisa forge JWT token dengan role admin:

```javascript
const token = jwt.sign(
  { userId: 'any-uuid', role: 'admin' },
  'dev-secret-change-me',
  { expiresIn: '7d' }
);
// Gunakan token ini untuk akses semua endpoint admin
```

### Fix

Tambahkan validasi startup di `apps/server/src/config/env.ts` atau `apps/server/src/index.ts`:

```typescript
// Di config/env.ts — tambahkan setelah export env
if (!process.env.JWT_SECRET || env.JWT_SECRET === 'dev-secret-change-me') {
  if (env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be explicitly set in production!');
  }
  console.warn('⚠ WARNING: Using default JWT secret. Do NOT use in production.');
}
```

---

## Vuln 2: Mass Assignment on Dashboard PATCH Endpoints

**Severity**: HIGH
**File**: `apps/server/src/modules/dashboard/dashboard.routes.ts:88-128`
**Category**: Mass Assignment / Privilege Escalation

### Description

Dua PATCH endpoint menerima `req.body` langsung tanpa Zod validation:

```typescript
// Line 88 — PATCH /api/dashboard/:id — TIDAK ADA validate() middleware
router.patch('/:id', requireRole('admin', 'editor'), verifyDashboardOwner, async (req, res, next) => {
  const dashboard = await dashboardervice.updateDashboard(req.params.id, req.body);
  // ...
});

// Line 123 — PATCH /api/dashboard/:id/pages/:pid — TIDAK ADA validate() middleware
router.patch('/:id/pages/:pid', requireRole('admin', 'editor'), verifyDashboardOwner, async (req, res, next) => {
  const page = await dashboardervice.updatePage(req.params.pid, req.body);
  // ...
});
```

Service layer menggunakan `as any` cast, dan `BaseRepository.update()` juga pakai `as any` pada `.set()`, sehingga Drizzle ORM akan update field apapun yang match dengan kolom database.

### Exploit Scenario

**Hijack ownership:**
```bash
curl -X PATCH /api/dashboard/abc-123 \
  -H "Authorization: Bearer <editor-token>" \
  -d '{ "title": "Legit Update", "createdBy": "<attacker-user-id>" }'
```

**Steal pages dari dashboard lain:**
```bash
curl -X PATCH /api/dashboard/abc/pages/xyz \
  -H "Authorization: Bearer <editor-token>" \
  -d '{ "dashboardId": "<attacker-dashboard-id>" }'
```

**Force publish tanpa approval:**
```bash
curl -X PATCH /api/dashboard/abc-123 \
  -d '{ "isPublished": true }'
```

### Fix

Tambahkan Zod validation schema untuk whitelist field yang boleh di-update:

```typescript
// Di dashboard.routes.ts

const updateDashboardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Pasang validate() middleware
router.patch('/:id',
  requireRole('admin', 'editor'),
  verifyDashboardOwner,
  validate(updateDashboardSchema),  // <-- tambah ini
  async (req, res, next) => { ... }
);

router.patch('/:id/pages/:pid',
  requireRole('admin', 'editor'),
  verifyDashboardOwner,
  validate(updatePageSchema),       // <-- tambah ini
  async (req, res, next) => { ... }
);
```

---

## Vuln 3: Broken Access Control (IDOR) on Read Endpoints

**Severity**: MEDIUM
**Files**: `apps/server/src/modules/dataset/dataset.routes.ts`, `apps/server/src/modules/dashboard/dashboard.routes.ts`
**Category**: Broken Access Control (OWASP #1)

### Description

Write operations (PATCH, DELETE, POST sync) sudah benar pakai `verifyDatasetOwner`/`verifyDashboardOwner`, tapi **semua read endpoints tidak ada ownership check**. User manapun yang authenticated (termasuk `viewer`) bisa baca resource milik user lain.

Ditambah lagi, list endpoints (`GET /api/datasets`, `GET /api/dashboard`) return SEMUA resource tanpa filter `createdBy`, sehingga UUID enumeration sangat mudah.

### Affected Endpoints

| Endpoint | File:Line | Issue |
|----------|-----------|-------|
| `GET /api/datasets` | dataset.routes.ts:84 | Returns ALL datasets, no user filtering |
| `GET /api/datasets/:id` | dataset.routes.ts:109 | No ownership check |
| `GET /api/datasets/:id/data` | dataset.routes.ts:153 | No ownership check — full data access |
| `GET /api/datasets/:id/columns` | dataset.routes.ts:165 | No ownership check |
| `GET /api/datasets/:id/raw` | dataset.routes.ts:188 | No ownership check — raw snapshot access |
| `POST /api/data/query` | dataset.routes.ts:200 | Accepts any datasetId, no ownership check |
| `GET /api/dashboard` | dashboard.routes.ts:51 | Returns ALL dashboards |
| `GET /api/dashboard/:id` | dashboard.routes.ts:77 | No ownership check |

### Exploit Scenario

1. User `viewer` register dan login
2. Call `GET /api/datasets` → dapat list semua dataset beserta UUID
3. Call `GET /api/datasets/:id/data` untuk setiap dataset → baca semua data milik user lain
4. Call `POST /api/data/query` dengan `datasetId` apapun → query data tanpa batasan

### Fix

**Option A: Tambah ownership check ke read endpoints**

```typescript
// dataset.routes.ts
router.get('/:id', verifyDatasetOwner, async (req, res, next) => { ... });
router.get('/:id/data', verifyDatasetOwner, async (req, res, next) => { ... });
router.get('/:id/columns', verifyDatasetOwner, async (req, res, next) => { ... });
router.get('/:id/raw', verifyDatasetOwner, async (req, res, next) => { ... });
```

**Option B: Filter list endpoint by createdBy (non-admin)**

```typescript
// dataset.service.ts
async listDatasets(userId: string, role: string) {
  if (role === 'admin') {
    return this.repository.findAllOrdered();
  }
  return this.repository.findByCreator(userId);
}
```

**Option C: Implement isPublished for dashboards**

```typescript
// Viewer hanya bisa lihat published dashboards
router.get('/:id', async (req, res, next) => {
  const dashboard = await dashboardService.getDashboard(req.params.id);
  if (req.user.role === 'viewer' && !dashboard.isPublished) {
    throw new AppError(404, 'Dashboard not found');
  }
  sendSuccess(res, dashboard);
});
```

---

## Items Reviewed & Found Secure

| Area | Notes |
|------|-------|
| SQL Injection | Drizzle ORM digunakan secara eksklusif dengan parameterized queries. Tidak ada raw SQL. |
| Password Hashing | bcryptjs dengan 12 rounds salt. Implementasi benar. |
| Registration Role Escalation | Zod schema pada register hanya izinkan `email`, `password`, `name`. Field `role` tidak bisa di-set user. |
| File Validator | Magic bytes, extension whitelist, content scanning, filename sanitization — implementasi thorough. |
| XSS | Satu-satunya `v-html` di `ToastContainer.vue` hanya render hardcoded HTML entities. Data dari dataset di-render via Vue text interpolation (auto-escape). |
| CORS | Meskipun `origin: true`, auth menggunakan Bearer token (bukan cookie), jadi cross-origin attack terbatas. |
| Admin Routes | Semua admin endpoint sudah apply `authenticate` + `requireRole('admin')`. Self-deletion dicegah. |
| .env Secrets | File `.env` ada di `.gitignore` dan tidak pernah di-commit ke git history. |

---

## Recommended Priority

1. **Immediate** — Fix Vuln 1 (JWT secret validation) — risiko tertinggi jika deploy tanpa config
2. **Immediate** — Fix Vuln 2 (Mass assignment) — exploit langsung oleh authenticated user
3. **Soon** — Fix Vuln 3 (IDOR read) — data exposure antar user

---

## Checklist Setelah Fix

- [ ] Tambah startup validation untuk JWT_SECRET
- [ ] Tambah Zod schema untuk PATCH `/api/dashboard/:id`
- [ ] Tambah Zod schema untuk PATCH `/api/dashboard/:id/pages/:pid`
- [ ] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id`
- [ ] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id/data`
- [ ] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id/columns`
- [ ] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id/raw`
- [ ] Tambah ownership check ke POST `/api/data/query`
- [ ] Filter `GET /api/datasets` by `createdBy` (non-admin)
- [ ] Tambah `verifyDashboardOwner` ke GET `/api/dashboard/:id`
- [ ] Filter `GET /api/dashboard` by `createdBy` (non-admin)
- [ ] Implement `isPublished` filtering for viewer role
