---
name: performance-profiler
description: Tìm bottleneck của service DMCL Super App — N+1 GORM/Prisma, thiếu index, thiếu cache Redis, blocking I/O gọi hệ thống ngoài, payload lớn, thiếu phân trang — kèm số đo trước/sau. Auto-trigger khi user nói "chậm" / "tối ưu" / "performance".
when:
  - User asks "tối ưu", "slow", "chậm", "performance", "API lâu"
  - User dán slow query log, log Graylog, hoặc thời gian phản hồi endpoint
  - User mentions timeout, 502, Redis, index
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(codegraph explore:*)
  - Bash(curl -s -w:*)
  - Bash(./tools/logs.sh:*)
  - Bash(go test:*)
---

# Performance Profiler — DMCL Super App

**Đo trước, sửa sau.** Mỗi finding phải có: nguyên nhân · file:line · fix · tác động dự kiến.

## 0. Đo baseline

```bash
# Latency thật qua gateway (cần token: tools/sso-login.sh)
curl -s -o /dev/null -w "dns=%{time_namelookup} connect=%{time_connect} ttfb=%{time_starttransfer} total=%{time_total}\n" \
  -H "Authorization: Bearer $TOKEN" http://localhost:9080/order/api/v1/orders/app-customer

# So sánh gọi thẳng service (loại trừ gateway/SSO)
curl -s -o /dev/null -w "total=%{time_total}\n" -H "X-User-Phone: 09xxxxxxxx" \
  http://localhost:8082/api/v1/orders/app-customer

# Log có sẵn: mọi request đều ghi kèm request_id + status (slog JSON)
./tools/logs.sh order | jq 'select(.status >= 400 or .duration_ms > 500)'
```

Ghi rõ: **gateway/SSO** bao nhiêu ms · **service** bao nhiêu · **hệ thống ngoài (CRM/OrderWeb)** bao nhiêu.
Phần lớn độ trễ của hệ thống này nằm ở **gọi external**, không phải DB.

## Layer 1 — Gọi hệ thống ngoài (nguyên nhân số 1)

Nhiều endpoint là **external-only passthrough** (AppCustomer GET list/detail luôn gọi Loyalty;
loyalty get-by-phone luôn gọi CRM) → latency = latency của upstream.

- Kiểm: có gọi external **trong vòng lặp** không? → gom lại 1 lần hoặc chạy song song có giới hạn.
- Timeout 3s là chuẩn: quá ngắn → 502 oan, quá dài → treo request. Đừng nâng timeout để "chữa chậm".
- Cân nhắc **cache Redis cho dữ liệu ít đổi** (mẫu thật: `order:cart_components` — lần đầu gọi OrderWeb,
  sau đọc DB/cache, `refresh=1` mới lấy lại).
- Fan-out song song trong Go:

```go
// ❌ tuần tự — n × 300ms
for _, id := range ids { d, _ := client.GetOrderDetail(ctx, id); out = append(out, d) }

// ✅ song song có giới hạn (đừng đập upstream)
sem := make(chan struct{}, 5)
var mu sync.Mutex
var wg sync.WaitGroup
for _, id := range ids {
    wg.Add(1)
    go func(id string) {
        defer wg.Done()
        sem <- struct{}{}; defer func() { <-sem }()
        if d, err := client.GetOrderDetail(ctx, id); err == nil {
            mu.Lock(); out = append(out, d); mu.Unlock()
        }
    }(id)
}
wg.Wait()
```

## Layer 2 — Truy vấn DB (GORM / Prisma)

```go
// 🔴 N+1
orders, _ := repo.List(ctx)
for _, o := range orders { c, _ := repo.GetCustomer(ctx, o.CustomerID) } // 1 query/vòng

// ✅ gom id, 1 query
ids := lo(orders)
var cs []Customer
db.WithContext(ctx).Where("id IN ?", ids).Find(&cs)
```

- **Thiếu phân trang**: `Find(&all)` không `Limit` → chậm dần theo dữ liệu. List phải có `Limit/Offset` + trần `limit`.
- **Thiếu index**: cột dùng `WHERE`/`ORDER BY` thường xuyên. Kiểm bằng `EXPLAIN ANALYZE`:

```bash
docker exec -it dmcl-order-postgres psql -U postgres -d order_db \
  -c "EXPLAIN ANALYZE SELECT * FROM app_customer_orders WHERE phone = '09xxxxxxxx' ORDER BY created_at DESC LIMIT 20;"
```

  Thấy `Seq Scan` trên bảng lớn → thêm index composite `(phone, created_at DESC)` vào `schema.sql`.
- **Chỉ lấy field cần**: `Select("id, code, total")` thay vì `SELECT *` khi payload lớn.
- **Đọc/ghi tách cụm**: prod có `DATABASE_URL_REPLICAS` + dbresolver — SELECT nên xuống replica;
  chỉ ép `dbresolver.Write` khi đọc-ngay-sau-ghi (ép sai làm master gánh hết).
- loyalty/Prisma: dùng `select` thu hẹp field, `take/skip`, tránh `include` lồng sâu không cần.

## Layer 3 — Cache Redis

- Repository Go **luôn** được bọc `Cached` — kiểm xem endpoint chậm có đi qua cache không, hay bỏ qua decorator.
- Key theo `docs/Naming-Convention.md`: `<service>:<entity>:<id>`; TTL hợp lý; **mutation → invalidate**.
- loyalty: Prisma luôn cache-aside TTL 60s (`loyalty:member:*`).
- Kiểm cache có đang bị **DISABLE** do circuit breaker không (Redis lỗi → cache tắt → mọi request xuống DB):

```bash
./tools/logs.sh order | grep -i "cache" | tail -20   # log enable/disable + Telegram
```

- Đừng cache dữ liệu passthrough external mà nghiệp vụ yêu cầu luôn mới (đơn hàng đang giao) —
  hỏi lại BA trước khi cache.

## Layer 4 — Payload & HTTP

- Passthrough `Raw` trả **đủ field upstream** → payload có thể rất lớn. Nếu client chỉ cần vài field,
  bàn với `dev-integration` để thêm endpoint gọn (KHÔNG âm thầm cắt field — sẽ vỡ client).
- List rỗng trả `[]`, không trả nguyên object rỗng lồng nhiều tầng.
- Gateway: `limit_req` có thể là nguyên nhân "chậm" giả (request bị xếp hàng) — kiểm log nginx trước khi tối ưu code.
- Timeout server (`Read/Write/IdleTimeout`) đặt hợp lý; đừng để request treo giữ connection.

## Layer 5 — Runtime Go

- Benchmark điểm nóng: `go test -bench=. -benchmem ./internal/...`
- Cấp phát thừa trong vòng lặp: `make([]T, 0, n)` khi biết trước kích thước; tránh `+=` chuỗi trong loop.
- Mutex giữ quá lâu quanh I/O → chỉ giữ quanh thao tác bộ nhớ.
- Goroutine leak: mọi goroutine phải có đường thoát theo `ctx`.

## Output report

```markdown
# Performance Audit — <endpoint>
Date: YYYY-MM-DD

## Baseline
- Qua gateway: p50 850ms · Gọi thẳng service: 780ms · Upstream CRM: 620ms
- Kết luận sơ bộ: 79% thời gian nằm ở gọi external

## Findings (theo mức tác động)

### 1. 🔴 Gọi external trong vòng lặp — `external/appcustomer` gọi 1 lần/đơn
- File: `internal/handler/orders.go:132`
- Tác động: ~70% latency (20 đơn × 300ms)
- Fix: gọi song song giới hạn 5, hoặc dùng endpoint list của upstream
- Dự kiến: p95 3.2s → 700ms

### 2. 🟡 Thiếu index (phone, created_at DESC)
- Query: `SELECT ... WHERE phone = $1 ORDER BY created_at DESC LIMIT 20` → Seq Scan (EXPLAIN kèm dưới)
- Fix: `CREATE INDEX IF NOT EXISTS idx_app_customer_orders_phone_created ON app_customer_orders (phone, created_at DESC);`
- Dự kiến: 180ms → 12ms

## Sau khi fix
- Đo lại cùng cách: p50 ... · p95 ...
```

## Anti-patterns

- ❌ Tối ưu trước khi đo; báo "đã nhanh hơn" mà không có số trước/sau
- ❌ Nâng timeout external để giấu chậm
- ❌ Thêm cache không có invalidation → dữ liệu cũ (đặc biệt đơn hàng/khách hàng)
- ❌ Cache dữ liệu bắt buộc realtime
- ❌ Index mọi cột (ghi chậm, tốn dung lượng)
- ❌ `go func` không giới hạn cho hàng nghìn item → đập chết upstream/DB
- ❌ Cắt field trong response passthrough để giảm payload (breaking change)

## References

- `services/order-service/internal/cache/cache.go` (circuit breaker) · `internal/repository/postgres.go`
- `docs/Codebase-Overview.md` (mục 5 — cache/external/dbresolver) · `docs/Naming-Convention.md` (mục 3 — Redis key)
- `tools/logs.sh` · `tools/appcustomer-tester.sh`
