# Security Review — ETL Dashboard

> Last reviewed: 2026-02-20
> Reviewer: Automated Security Audit (Claude)
> Scope: Full codebase — comprehensive review of all backend modules

---

## Summary

| # | Vulnerability | Severity | Status |
|---|--------------|----------|--------|
| 1 | Hardcoded JWT Secret Fallback | **HIGH** | ✅ Fixed |
| 2 | Mass Assignment on Dashboard PATCH Endpoints | **HIGH** | ✅ Fixed |
| 3 | Broken Access Control (IDOR) on Read Endpoints | **MEDIUM** | ✅ Fixed |
| 4 | SSRF in REST API Connector | **HIGH** | ✅ Fixed |

---

## Vuln 1: Hardcoded JWT Secret Fallback

**Severity**: HIGH
**File**: `apps/server/src/config/env.ts`
**Category**: Hardcoded Secret / Authentication Bypass
**Status**: ✅ Fixed — 2026-02-20

### Description

If `JWT_SECRET` was not set in environment variables, the server would silently start with
no usable secret (TypeScript non-null assertion `!` does not validate at runtime). An attacker
who discovered the service was misconfigured could exploit the missing secret to forge JWT tokens.

### Exploit Scenario

```javascript
// If JWT_SECRET were undefined or a known default:
const token = jwt.sign(
  { userId: 'any-uuid', role: 'admin' },
  'dev-secret-change-me',
  { expiresIn: '7d' },
);
// Use this token to access all admin endpoints
```

### Fix Applied

Added startup validation in `apps/server/src/config/env.ts`:

```typescript
if (!env.JWT_SECRET) {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY] FATAL: JWT_SECRET environment variable must be set in production.',
    );
  }
  (env as { JWT_SECRET: string }).JWT_SECRET = 'dev-secret-do-not-use-in-production';
  console.warn('[SECURITY] ⚠ WARNING: JWT_SECRET is not set. Using insecure default. DO NOT use in production!');
}
```

Server now **refuses to start in production** if `JWT_SECRET` is missing.

---

## Vuln 2: Mass Assignment on Dashboard PATCH Endpoints

**Severity**: HIGH
**File**: `apps/server/src/modules/dashboard/dashboard.routes.ts:88-128`
**Category**: Mass Assignment / Privilege Escalation
**Status**: ✅ Fixed — 2026-02-20

### Description

Two PATCH endpoints accepted `req.body` directly without Zod validation, allowing any
field in the database schema to be overwritten — including `createdBy`, `dashboardId`, etc.

```typescript
// BEFORE — no validate() middleware
router.patch('/:id', requireRole('admin', 'editor'), verifyDashboardOwner, async (req, res, next) => {
  const dashboard = await dashboardervice.updateDashboard(req.params.id, req.body); // ← unsafe
});
```

### Exploit Scenario

```bash
# Hijack ownership of a dashboard:
curl -X PATCH /api/dashboard/abc-123 \
  -H "Authorization: Bearer <editor-token>" \
  -d '{ "title": "Legit Update", "createdBy": "<attacker-user-id>" }'

# Force-publish a dashboard without approval:
curl -X PATCH /api/dashboard/abc-123 \
  -d '{ "isPublished": true }'
```

### Fix Applied

Added Zod whitelist schemas and attached `validate()` middleware to both PATCH routes:

```typescript
const updateDashboardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

router.patch('/:id', requireRole('admin', 'editor'), verifyDashboardOwner, validate(updateDashboardSchema), ...);
router.patch('/:id/pages/:pid', requireRole('admin', 'editor'), verifyDashboardOwner, validate(updatePageSchema), ...);
```

---

## Vuln 3: Broken Access Control (IDOR) on Read Endpoints

**Severity**: MEDIUM
**Files**: `apps/server/src/modules/dataset/dataset.routes.ts`, `apps/server/src/modules/dashboard/dashboard.routes.ts`
**Category**: Broken Access Control (OWASP #1)
**Status**: ✅ Fixed — 2026-02-20

### Description

Write operations (PATCH, DELETE, POST sync) correctly applied `verifyDatasetOwner` /
`verifyDashboardOwner`, but all read endpoints had no ownership check. Any authenticated
user (including `viewer` role) could read resources belonging to other users.
List endpoints also returned ALL resources, enabling UUID enumeration.

### Affected Endpoints (before fix)

| Endpoint | Issue |
|----------|-------|
| `GET /api/datasets` | Returned ALL datasets — no user filtering |
| `GET /api/datasets/:id` | No ownership check |
| `GET /api/datasets/:id/data` | No ownership check — full data access |
| `GET /api/datasets/:id/columns` | No ownership check |
| `GET /api/datasets/:id/raw` | No ownership check — raw snapshot access |
| `POST /api/data/query` | Accepted any datasetId — no ownership check |
| `GET /api/dashboard` | Returned ALL dashboards |
| `GET /api/dashboard/:id` | No ownership check |

### Exploit Scenario

1. `viewer` role registers and logs in
2. `GET /api/datasets` → receives list of all datasets with UUIDs
3. `GET /api/datasets/:id/data` for each UUID → reads all data owned by other users
4. `POST /api/data/query` with any `datasetId` → queries any dataset without restriction

### Fix Applied

**Dataset read endpoints** — added `verifyDatasetOwner` middleware:
```typescript
router.get('/:id', verifyDatasetOwner, ...);
router.get('/:id/data', verifyDatasetOwner, ...);
router.get('/:id/columns', verifyDatasetOwner, ...);
router.get('/:id/raw', verifyDatasetOwner, ...);
```

**Dataset list** — filter by `createdBy` for non-admin:
```typescript
// dataset.service.ts
export async function listDatasets(userId: string, role: string): Promise<DatasetRecord[]> {
  if (role === 'admin') return datasetRepository.findAllOrdered();
  return datasetRepository.findByCreator(userId);
}
```

**Widget query endpoint** — inline ownership check:
```typescript
router.post('/query', validate(querySchema), async (req, res, next) => {
  const targetDataset = await datasetRepository.findById(req.body.datasetId);
  if (!targetDataset) throw new AppError(404, 'Dataset not found');
  if (req.user?.role !== 'admin' && targetDataset.createdBy !== req.user?.userId) {
    throw new AppError(404, 'Dataset not found'); // 404 to avoid enumeration
  }
  ...
});
```

**Dashboard list** — filter by `createdBy` for non-admin:
```typescript
export async function listdashboard(userId: string, role: string): Promise<DashboardRecord[]> {
  if (role === 'admin') return dashboardRepository.findAllOrdered();
  return dashboardRepository.findByCreator(userId);
}
```

**Dashboard detail** — non-owners can only view published dashboards:
```typescript
router.get('/:id', async (req, res, next) => {
  const dash = await dashboardervice.getDashboard(req.params.id as string);
  if (req.user?.role !== 'admin' && dash.createdBy !== req.user?.userId) {
    if (!dash.isPublished) throw new AppError(404, 'Dashboard not found');
  }
  sendSuccess(res, dash);
});
```

---

## Vuln 4: Server-Side Request Forgery (SSRF) in REST API Connector

**Severity**: HIGH
**File**: `apps/server/src/modules/source/connectors/rest.connector.ts`
**Category**: SSRF
**Status**: ✅ Fixed — 2026-02-20

### Description

The REST connector accepted a user-supplied URL and passed it directly to `fetch()` with
zero validation. This allowed any authenticated editor/admin to make arbitrary HTTP requests
from the server to internal services, cloud metadata endpoints, or private networks.

```typescript
// BEFORE — no URL validation
response = await fetch(config.url, { ... });  // ← user-controlled URL
```

No blocklist for private IP ranges, no protocol restriction, no timeout.

### Exploit Scenario

```bash
POST /api/sources/connect
Authorization: Bearer <valid-editor-token>
Content-Type: application/json

{
  "sourceType": "rest_api",
  "sourceConfig": {
    "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "authType": "none"
  }
}
```

Server would fetch the AWS metadata endpoint and return the IAM credentials in the API response.
Also exploitable for internal network port scanning (`http://localhost:5432/`, `http://10.0.0.x:8080/`).

### Fix Applied

Added `assertSafeUrl()` called before every `fetch()`, plus a 15-second request timeout:

```typescript
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i, /^127\./, /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i, /^fd/i,
];

function assertSafeUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl); // throws AppError(400) on invalid format
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(400, 'Only http and https protocols are allowed');
  }
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(parsed.hostname)) {
      throw new AppError(400, 'Requests to private or internal addresses are not allowed');
    }
  }
}

// In fetchRestApi():
assertSafeUrl(config.url);  // ← called before fetch()
response = await fetch(config.url, {
  ...,
  signal: AbortSignal.timeout(15_000),  // 15s hard timeout
});
```

---

## Items Reviewed & Found Secure

| Area | Notes |
|------|-------|
| SQL Injection | Drizzle ORM used exclusively with parameterized queries. `sql.raw()` calls use only hardcoded string literals — zero user input flows into them. |
| Password Hashing | bcryptjs with 12 rounds salt. Correct implementation. |
| Registration Role Escalation | Zod schema on register only allows `email`, `password`, `name`. `role` field cannot be set by user. |
| File Validator | Magic bytes, extension whitelist, content scanning, filename sanitization — thorough implementation. |
| XSS | Only `v-html` instance in `ToastContainer.vue` renders hardcoded HTML entities. All dataset data renders via Vue text interpolation (auto-escaped). |
| CORS | `origin: true` is permissive but safe: auth uses `Authorization: Bearer` header (not cookies), so browsers cannot auto-include it in cross-origin requests — CSRF not possible. |
| Admin Routes | All admin endpoints apply `authenticate` + `requireRole('admin')`. Self-deletion prevented. |
| SSRF (REST connector) | Fixed — see Vuln 4 above. |
| JWT Secret | Fixed — see Vuln 1 above. |
| Mass Assignment | Fixed — see Vuln 2 above. |
| IDOR Read Endpoints | Fixed — see Vuln 3 above. |

---

## Recommended Priority (all now fixed)

1. ~~**Immediate** — Fix Vuln 1 (JWT secret validation)~~ ✅
2. ~~**Immediate** — Fix Vuln 2 (Mass assignment)~~ ✅
3. ~~**Immediate** — Fix Vuln 4 (SSRF in REST connector)~~ ✅
4. ~~**Soon** — Fix Vuln 3 (IDOR read endpoints)~~ ✅

---

## Checklist

- [x] Tambah startup validation untuk JWT_SECRET
- [x] Tambah Zod schema untuk PATCH `/api/dashboard/:id`
- [x] Tambah Zod schema untuk PATCH `/api/dashboard/:id/pages/:pid`
- [x] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id`
- [x] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id/data`
- [x] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id/columns`
- [x] Tambah `verifyDatasetOwner` ke GET `/api/datasets/:id/raw`
- [x] Tambah ownership check ke POST `/api/data/query`
- [x] Filter `GET /api/datasets` by `createdBy` (non-admin)
- [x] Tambah `verifyDashboardOwner` logic ke GET `/api/dashboard/:id` (isPublished check)
- [x] Filter `GET /api/dashboard` by `createdBy` (non-admin)
- [x] SSRF protection di REST connector (`assertSafeUrl` + request timeout)
