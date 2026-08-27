---
name: api-builder
description: Tạo REST endpoint mới cho service DMCL Super App — Go (net/http + GORM) hoặc Node (NestJS/loyalty, zero-dep/ecom), kèm envelope v2, guard định danh SSO, route gateway NGINX, request Bruno và test. Auto-trigger khi user muốn thêm API/endpoint.
when:
  - User asks "tạo API", "thêm endpoint", "implement <feature> backend"
  - User editing services/*/internal/handler/*.go, services/loyalty-service/src/internal/**, services/ecom-service/src/server.js
  - User thêm route mới vào gateway/nginx/services/
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash(gofmt:*)
  - Bash(go build:*)
  - Bash(go vet:*)
  - Bash(go test:*)
  - Bash(pnpm typecheck)
  - Bash(pnpm test:*)
  - Bash(npm test:*)
  - Bash(curl -i http://localhost:*)
---

# API Builder — DMCL Super App

Tạo endpoint `/api/v1/**` đúng chuẩn hệ thống. **Service tham chiếu: `services/order-service`.**

## 0. Xác định scope trước khi viết code

1. **Service nào sở hữu dữ liệu?** (database-per-service — không query DB service khác)
2. Endpoint **public** hay **enforce SSO**? Có phải **back-office** (cần `X-Admin-Token`) không?
3. Dữ liệu từ đâu: DB của service · hệ thống ngoài (CRM/OrderWeb) · cả hai (external + bản sao DB)?
4. Service đó **có đang bật ở prod** không (prod chỉ chạy identity/order/loyalty)?
5. Đã có endpoint tương tự chưa — `codegraph explore "<resource> handler"` trước khi tạo mới.

## 1. Envelope v2 (BẮT BUỘC — 6 khoá luôn có mặt)

```json
{
  "success": true,
  "status": 200,
  "message": "Success",
  "data": {},
  "errors": null,
  "meta": { "requestId": "f6f4c4d9", "timestamp": "2026-07-27T11:00:00Z", "version": "v1" }
}
```

`success` = `status < 400` · `status` == HTTP status · `data` list rỗng → `[]`, khi lỗi → `null` ·
`errors` `null` khi thành công, array `[{field?, message}]` khi lỗi · `meta` luôn có
`requestId`/`timestamp`(UTC RFC3339 `Z`)/`version`, phân trang thêm `page`/`limit`/`totalPages`/`totalItems`.
Khoá `meta` camelCase; field trong `data` snake_case (ngoại lệ passthrough external giữ casing nguồn).

⚠️ Endpoint cũ còn ở v1 (`code`) — **không migrate kèm** trong task tạo API mới.

## 2. Quy ước HTTP status (đã chốt — giữ nhất quán)

| Tình huống | Status |
|---|---|
| Thành công | 200 · tạo mới 201 |
| Không có dữ liệu — **list** | **200 + `data: []`** (không alert) |
| Không có dữ liệu — **detail** | **404** (không alert) |
| Sai định dạng tham số (vd phone) | **400** |
| Thiếu field bắt buộc / validate fail | **422** + `errors[]` |
| Chưa đăng nhập (thiếu định danh SSO) | **401** |
| Client truyền phone khác `X-User-Phone` | **403** |
| Thiếu/sai `X-Admin-Token` ở endpoint back-office | **401/403** |
| Lỗi hệ thống thật (timeout/mất kết nối/upstream 5xx) | **502** + Telegram + file log |
| Panic/lỗi nội bộ | **500** + Telegram |

## 3. Go — các bước

```text
1. internal/handler/<resource>.go   — handler + parse/validate + envelope
2. internal/repository/             — models.go (GORM) + postgres.go + schema.sql nếu cần bảng mới
3. external/<system>/               — nếu gọi hệ thống ngoài: interface Client + adapter + mock + timeout 3s
4. cmd/server/main.go               — mux.HandleFunc("GET /api/v1/<resource>/{id}", h.Get)
5. gateway/nginx/services/<svc>.conf— chỉ khi service chưa có prefix (dev-integration)
6. bruno/<svc>/NN-<ten>.bru         — request + assert envelope
7. *_test.go                        — happy + định danh + external lỗi + validate
```

**Skeleton handler:**

```go
func (h *Handler) ListAppCustomerOrders(w http.ResponseWriter, r *http.Request) {
    phone, err := appPhone(r) // định danh CHỈ từ X-User-Phone; client truyền khác → 403
    if err != nil {
        writeError(w, r, http.StatusForbidden, "Không được truy vấn dữ liệu của số khác")
        return
    }

    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    items, err := h.repo.ListByPhone(ctx, phone)
    switch {
    case errors.Is(err, domain.ErrNotFound):
        writeList(w, r, http.StatusOK, "Success", []Order{}, Page{}) // list rỗng → 200 + []
    case err != nil:
        RecordError(r, err) // Telegram + file log, client không thấy nguyên nhân
        writeError(w, r, http.StatusBadGateway, "Lỗi hệ thống, vui lòng thử lại")
    default:
        writeList(w, r, http.StatusOK, "Success", items, Page{Page: 1, Limit: len(items)})
    }
}
```

**Checks:** `gofmt -l .` (rỗng) · `go vet ./...` · `go build ./...` · `go test ./... -race`

## 4. Node — các bước

**loyalty (NestJS + Prisma):** `src/internal/<feature>/` → `*.controller.ts` (HTTP + guard) ·
`*.service.ts` (nghiệp vụ) · repo qua `PrismaService` (**luôn đi qua cache Redis**, key `loyalty:<entity>:*`) ·
external client ở `src/external/<sys>` (interface + mock + timeout 3s). Envelope do **interceptor +
exception filter global** dựng — controller chỉ `return data`. Checks: `pnpm typecheck` · `pnpm test` · `pnpm build`.

**ecom (Node 22 zero-dep):** thêm nhánh route trong `src/server.js`, dùng `src/response.js` cho envelope,
`src/logger.js` + `src/alert.js` cho log/alert. **KHÔNG thêm dependency.** Checks: `npm test`.

## 5. Bảo mật (không có ngoại lệ)

- Định danh **chỉ** từ `X-User-Phone` / `X-User-Sub` (gateway gắn sau SSO, đã ghi đè để chống giả mạo).
  KHÔNG tin `?phone=` / body.
- Endpoint back-office → AdminGuard: `X-Admin-Token` khớp `ADMIN_API_TOKEN`, **fail-safe** (chưa cấu hình → khoá hết).
- Mọi `{id}` phải kiểm chủ sở hữu (chống IDOR).
- SQL luôn tham số hoá; secret qua config/env; không log OTP/JWT/token CRM/PII không cần.

## 6. Hoàn tất

- [ ] Request Bruno đã thêm (`bruno/<svc>/`), assert `success`/`status`/`data`/`errors`/`meta`
- [ ] Test: happy · thiếu/sai định danh · external lỗi (timeout → 502) vs không có dữ liệu (200/404) · validate 422
- [ ] Checks của service PASS
- [ ] `docs/Codebase-Overview.md` ghi ý chính endpoint mới (+ doc service nếu là loyalty/order)
- [ ] Nếu service chưa có prefix gateway → đã thêm `gateway/nginx/services/<svc>.conf`

## Anti-patterns

- ❌ Tự `json.Encode`/`res.end(JSON.stringify(...))` envelope thay vì dùng helper
- ❌ Lấy phone từ query/body khi đã có header SSO
- ❌ Map "không tìm thấy khách" thành 502 (spam Telegram) hoặc map timeout thành 404 (mù lỗi)
- ❌ `Find(&all)` không phân trang · query trong vòng `for` (N+1)
- ❌ Gọi hệ thống ngoài không timeout / không mock / không alert khi lỗi
- ❌ Endpoint mới mà không có request Bruno
- ❌ Thêm dependency vào `ecom-service`

## References

- `services/order-service/internal/handler/{orders.go,response.go,middleware.go}`
- `services/order-service/external/{appcustomer,orderweb,jsonx}` · `internal/cache/cache.go`
- `docs/Codebase-Overview.md` (mục 0, 3, 5) · `docs/Naming-Convention.md` (mục 4)
- `bruno/order/` (mẫu request) · `gateway/nginx/services/order.conf` (mẫu route)
