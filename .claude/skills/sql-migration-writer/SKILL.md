---
name: sql-migration-writer
description: Viết thay đổi schema an toàn (zero-downtime, backward-compatible) cho DMCL Super App — schema.sql + GORM model cho service Go, Prisma cho loyalty-service. Auto-trigger khi user thêm/sửa bảng, cột, index.
when:
  - User editing services/*/internal/repository/schema.sql hoặc models.go
  - User editing services/loyalty-service/prisma/schema.prisma
  - User asks "thêm column", "đổi schema", "migration", "thêm bảng", "thêm index"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash(gofmt:*)
  - Bash(go build:*)
  - Bash(go test:*)
  - Bash(pnpm typecheck)
---

# SQL Migration Writer — DMCL Super App

Hệ thống **database-per-service**, mỗi service 1 Postgres riêng. Hai cơ chế schema khác nhau:

| Service | Nguồn chuẩn schema | Cách áp dụng |
|---|---|---|
| Go (`order`, `identity`, `voucher`, `tracking`, `payment`, `service-mgmt`, `brand`) | `internal/repository/schema.sql` (+ `seed.sql`) | `Migrate()` chạy file này lúc boot (phải idempotent) |
| `loyalty-service` | `prisma/schema.prisma` | Prisma + bootstrap idempotent lúc boot (`ALTER ... ADD COLUMN IF NOT EXISTS`) |

## Nguyên tắc bất biến

1. **Idempotent** — chạy lại nhiều lần không lỗi: `CREATE TABLE IF NOT EXISTS`,
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
2. **Backward-compatible** — code cũ đang chạy phải sống được với schema mới (rolling deploy):
   cột mới **nullable** hoặc **có DEFAULT**; KHÔNG `NOT NULL` không default trên bảng đã có dữ liệu.
3. **Expand → Migrate → Contract** — không xoá/đổi tên trong 1 bước:
   (1) thêm cột mới + ghi song song → (2) backfill + code đọc cột mới → (3) xoá cột cũ ở release sau.
4. **Naming** theo `docs/Naming-Convention.md`: bảng **snake_case số nhiều** (`app_customer_orders`),
   cột snake_case, `idx_<table>_<cols>`, `uq_<table>_<cols>`, `fk_<table>_<ref>`.
5. **KHÔNG tự chạy migration trên UAT/prod** — chỉ viết + nêu lệnh, thời gian lock, cách rollback.
   Việc áp dụng do user/`devops` quyết định.

## An toàn vs cần cẩn thận

**✅ Deploy được luôn:** thêm cột nullable · thêm bảng mới · `CREATE INDEX CONCURRENTLY` ·
drop index không dùng · nới độ dài cột · thêm FK `NOT VALID` rồi `VALIDATE` sau.

**⚠️ Cần chia pha:** cột `NOT NULL` (cần DEFAULT hoặc backfill trước) · `DROP COLUMN` (deploy code
không tham chiếu trước) · rename (cột mới + dual-write) · đổi kiểu (cột mới + migrate + swap) ·
thêm unique (kiểm duplicate trước) · thêm FK trực tiếp (lock bảng → dùng `NOT VALID`, `VALIDATE` off-peak).

## Go — quy trình

1. Sửa `internal/repository/schema.sql` (nguồn chuẩn: giữ đúng CHECK/UUID/index thật).
2. Sửa `internal/repository/models.go`: field + tag `gorm:"column:...;type:...;index"`; cột nullable →
   `*string` / `*time.Time`; cập nhật converter `model → domain`; giữ `TableName()`.
3. Sửa `postgres.go` nếu query đổi — truy vấn mới phải `WithContext(ctx)` + tham số hoá (`?`).
4. Index cho mọi cột dùng filter/sort/join thường xuyên. Bảng lớn → `CREATE INDEX CONCURRENTLY`
   (ghi rõ **phải chạy ngoài transaction**).
5. `gofmt -l .` · `go build ./...` · `go test ./... -race`

```sql
-- schema.sql — thêm cột + index an toàn (mẫu thật của order-service)
ALTER TABLE web_orders
  ADD COLUMN IF NOT EXISTS synced BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE web_orders
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- index partial: chỉ đơn chờ đồng bộ
CREATE INDEX IF NOT EXISTS idx_web_orders_unsynced
  ON web_orders (created_at)
  WHERE synced = FALSE;
```

```go
type WebOrder struct {
    ID        string    `gorm:"column:id;primaryKey"`
    Synced    bool      `gorm:"column:synced;not null;default:false"`
    SyncError *string   `gorm:"column:sync_error"`
    CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (WebOrder) TableName() string { return "web_orders" }
```

## loyalty (Prisma) — quy trình

1. Sửa `prisma/schema.prisma` — field optional `?` hoặc có `@default`.
2. `pnpm prisma generate` rồi `pnpm typecheck`.
3. Nêu rõ lệnh migration (`prisma migrate dev` ở local; `migrate deploy` ở prod — **không tự chạy prod**).
4. Service còn bootstrap schema idempotent lúc boot → thêm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   tương ứng để 2 cơ chế không lệch nhau.

## Kiểu dữ liệu — quy ước hệ thống

- Tiền tệ: **integer VND**, KHÔNG `float`/`double`/`real`.
- Thời gian: `TIMESTAMPTZ`, lưu **UTC**; so sánh cũng bằng UTC (đừng dùng `now()` local ở tầng app).
- Khoá chính: UUID (`gen_random_uuid()`) hoặc id do hệ thống ngoài cấp — ghi rõ nguồn.
- JSON nguyên văn từ hệ thống ngoài → `JSONB` (mẫu: `external_raw` của loyalty, `request` của web_orders).
- SĐT: `VARCHAR` chuẩn hoá 1 định dạng duy nhất (đừng lẫn `84...` và `0...` trong cùng cột).

## Checklist trước khi báo xong

- [ ] Idempotent (chạy 2 lần không lỗi)
- [ ] Cột mới nullable hoặc có DEFAULT — code cũ không vỡ
- [ ] Không `DROP`/`RENAME` trực tiếp trên bảng đang dùng
- [ ] Index cho cột filter/sort mới; bảng lớn dùng `CONCURRENTLY`
- [ ] Model GORM / Prisma khớp cột (tên, kiểu, nullable)
- [ ] Naming theo `docs/Naming-Convention.md`; tiền tệ integer, thời gian TIMESTAMPTZ UTC
- [ ] Nêu rõ: lệnh áp dụng · lock dự kiến · cách rollback
- [ ] Ghi ý chính vào `docs/Codebase-Overview.md` nếu thêm bảng/luồng mới

## Anti-patterns

- ❌ `ADD COLUMN ... NOT NULL` không default trên bảng có dữ liệu
- ❌ `DROP COLUMN` / `RENAME` cùng release với code đổi → rolling deploy vỡ
- ❌ `CREATE INDEX` (thiếu `CONCURRENTLY`) trên bảng lớn ở prod → khoá ghi
- ❌ Chỉ sửa `models.go` mà quên `schema.sql` (hoặc ngược lại) → dev và prod lệch schema
- ❌ `AutoMigrate` trên bảng đã có dữ liệu thật (chỉ dùng cho model greenfield)
- ❌ Tự chạy migration/`UPDATE`/`DELETE` dữ liệu thật trên prod
- ❌ Đặt cột kiểu `float` cho tiền

## References

- `services/order-service/internal/repository/{schema.sql,models.go,postgres.go}`
- `services/loyalty-service/prisma/schema.prisma`
- `docs/Naming-Convention.md` (mục 2 — Database) · `docs/Codebase-Overview.md` (mục 5)
