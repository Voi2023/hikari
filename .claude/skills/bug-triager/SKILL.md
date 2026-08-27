---
name: bug-triager
description: Phân tích bug trong DMCL Super App — đọc log slog JSON/Graylog theo request_id, khoanh vùng gateway vs service vs hệ thống ngoài, đề xuất 3 hypothesis + cách verify + fix tối thiểu. KHÔNG code ngay.
when:
  - User dán stack trace, log JSON, message lỗi, hoặc mã lỗi HTTP
  - User asks "fix bug", "debug", "tại sao lỗi", "sao 502", "sao 401"
  - User mô tả triệu chứng ("API trả 500", "gọi qua gateway không thấy log")
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(codegraph explore:*)
  - Bash(git log:*)
  - Bash(git blame:*)
  - Bash(./tools/logs.sh:*)
  - Bash(docker compose ps:*)
  - Bash(curl -i http://localhost:*)
---

# Bug Triager — DMCL Super App

**KHÔNG code ngay.** Trình tự: Khoanh vùng → Reproduce → 3 hypothesis → Verify → Fix tối thiểu → Regression.

## Bước 1 — Khoanh vùng theo tầng (làm trước mọi thứ)

Hệ thống có 4 tầng có thể gây lỗi. Bảng này giải quyết ~70% ca:

| Triệu chứng | Gần như chắc chắn là |
|---|---|
| **401 và KHÔNG có log ở service** | Đúng thiết kế: nginx `auth_request` chặn tại gateway, chưa forward. Thiếu/hết hạn `Authorization: Bearer`. |
| **404 khi gọi prefix service** | Service đó bị **ẩn ở prod** (`profiles: optional`) hoặc chưa có `gateway/nginx/services/<svc>.conf` |
| **403** | Client truyền `phone` khác `X-User-Phone` (đúng thiết kế, chống IDOR) |
| **401 ở endpoint back-office** | `X-Admin-Token` sai, hoặc `ADMIN_API_TOKEN` chưa cấu hình → fail-safe khoá hết |
| **502 + Telegram** | Hệ thống ngoài (CRM/OrderWeb) timeout/mất kết nối/5xx |
| **404/200-rỗng nhưng không có alert** | Upstream báo "không có khách" — lỗi nghiệp vụ, đúng thiết kế |
| **500 + Telegram** | Panic hoặc lỗi nội bộ; nguyên nhân thật ở log/file lỗi, client chỉ thấy message chung |
| **Chậm rồi hết 5xx** | Redis down → cache DISABLE (kiểm log "cache"), hoặc DB quá tải |
| **Service không start** | `config.Load()` fail-fast: thiếu `DATABASE_URL`/`TELEGRAM_*`/`CRM_*` ở prod |
| **Không thấy log ở Graylog** | macOS: cần overlay `docker-compose.logging.gelf.yml` + `GELF_ADDR` (Fluent Bit không đọc được log container trên Docker Desktop) |

## Bước 2 — Lấy dữ liệu thật

```bash
# 1. Trace theo request_id (mọi request đều có, log slog JSON)
./tools/logs.sh order | jq 'select(.request_id == "<id>")'

# 2. Chỉ lỗi (file log lỗi riêng, order + loyalty)
./tools/logs.sh errors order -f
./tools/logs.sh grep order "<từ khoá>"

# 3. Service còn sống? cấu hình đúng?
docker compose ps
docker compose logs --tail=50 <svc>

# 4. Tách gateway khỏi service — gọi thẳng service, bỏ qua SSO
curl -i -H "X-User-Phone: 09xxxxxxxx" http://localhost:8082/api/v1/orders/app-customer
# nếu gọi thẳng OK mà qua gateway lỗi → vấn đề ở nginx/SSO
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:9080/order/api/v1/orders/app-customer

# 5. Thay đổi nào gây ra? (branch đang làm push liên tục nên git log rất hữu ích)
git log --oneline -15 -- services/<svc>
git blame -L <line>,+5 services/<svc>/internal/handler/<file>.go
```

## Bước 3 — Đúng 3 hypothesis (không 1, không 5)

```
H1: <suy ra trực tiếp từ triệu chứng + log>       — verify: <lệnh/test cụ thể>
H2: <từ thay đổi gần đây (git log/blame)>         — verify: ...
H3: <ngoài luồng: env, hệ thống ngoài, cache, race, TZ, dữ liệu bẩn> — verify: ...
```

Mỗi hypothesis phải có **cách kiểm chứng bằng dữ liệu**, không phải phỏng đoán.

## Bước 4 — Fix tối thiểu

```markdown
## Root cause
<1-2 dòng, có file:line và bằng chứng từ log>

## Fix plan
1. Viết test mô tả bug (PHẢI fail trước khi fix): <đường dẫn _test.go / *.spec.ts>
2. Sửa tối thiểu: <file:line> — <thay đổi ~n dòng>
3. Checks: gofmt/vet/build/test -race (hoặc pnpm typecheck/test)
4. Verify lại bằng đúng lệnh đã repro ở Bước 2
5. Nếu là lỗi định danh/bảo mật → chạy reviewer + security-auditor

## Rủi ro & rollback
- Rủi ro: ...
- Rollback: revert commit <sha>; không cần migration ngược / cần backfill ...

## KHÔNG kèm trong lần fix này
- ❌ Refactor xung quanh · ❌ sửa bug khác phát hiện được (tạo ghi chú riêng) · ❌ đổi convention
```

## Mẫu bug thường gặp của hệ thống này

**Lẫn "không có dữ liệu" với "lỗi hệ thống"** — upstream trả `success=false`/404 bị map thành 502 (spam Telegram),
hoặc timeout bị map thành 404 (mù lỗi). Fix: phân nhánh `ErrNotFound` vs lỗi liên kết ở tầng handler.

**Định danh sai nguồn** — đọc `?phone=` khi đã có `X-User-Phone` → rò rỉ dữ liệu khách khác. Fix: `appPhone(r)` + 403.

**Rớt field trong passthrough** — struct typed unmarshal làm mất field upstream, hoặc kiểu lẫn number/string làm
chết unmarshal. Fix: dùng `external/jsonx` + giữ/marshal `Raw`.

**Cache stale sau mutation** — ghi mà không invalidate key `<service>:<entity>:<id>` → đọc ra dữ liệu cũ.

**Cache im lặng DISABLE** — Redis chết, circuit breaker tắt cache, latency tăng dần, không ai để ý. Kiểm log cache + Telegram.

**Đồng bộ OrderWeb sót** — `synced=false` + `sync_error` nhưng không ai chạy resync. Kiểm
`GET /api/v1/orders/web/unsynced`.

**Race** — 2 request cùng ghi 1 bản ghi. Fix: `UPDATE ... WHERE <điều kiện>` kiểm số dòng ảnh hưởng,
hoặc transaction; test có `-race`.

**Thời gian / TZ** — DB `TIMESTAMPTZ` UTC nhưng so với `time.Now()` local → lệch 7h.

**Diacritics tiếng Việt** — chuỗi bị escape/cắt sai; chuẩn hoá NFC, kiểm cả ở Bruno.

**Rate-limit OTP hiểu nhầm thành bug** — 429 sau 3 lần/phút/SĐT là **đúng thiết kế**.

## Anti-patterns

- ❌ Fix khi chưa repro được
- ❌ Chỉ 1 hypothesis rồi code luôn
- ❌ `try/catch` nuốt lỗi hoặc nâng timeout để "hết lỗi"
- ❌ Refactor kèm bug fix
- ❌ Sửa triệu chứng (đổi 502 → 200) thay vì root cause
- ❌ Bỏ qua "chỉ 1% user" — đó thường là lỗi định danh/dữ liệu bẩn
- ❌ Kết luận "lỗi do Redis/CRM" mà không có log chứng minh

## References

- `tools/logs.sh` (3 nguồn log: stdout · file lỗi · Graylog `:9000`)
- `docs/Codebase-Overview.md` (mục 0, 3, 5, 7) · `services/<svc>/CLAUDE.md`
- `services/order-service/internal/handler/middleware.go` (RequestID/Logging/Recover) · `internal/alert`
