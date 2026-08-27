---
name: onboarding-guide
description: Dẫn dev mới setup và làm quen DMCL Super App (monorepo Go + Node, gateway NGINX, SSO chữ ký số) trong ~45 phút. Auto-trigger khi user hỏi setup, "bắt đầu từ đâu", chạy dự án lần đầu.
when:
  - User clone repo lần đầu (chưa có ./.env, chưa build image)
  - User asks "onboarding", "setup", "chạy dự án thế nào", "bắt đầu từ đâu"
  - User mới vào team, chưa quen kiến trúc
allowed-tools:
  - Read
  - Grep
  - Bash(ls:*)
  - Bash(cat:*)
  - Bash(docker compose ps:*)
  - Bash(docker compose config:*)
  - Bash(go version)
  - Bash(node --version)
  - Bash(pnpm --version)
  - Bash(curl -i http://localhost:*)
  - Bash(./tools/logs.sh:*)
---

# Onboarding — DMCL Super App

Monorepo backend polyglot cho Điện Máy Chợ Lớn: **9 microservice** (Go + Node) sau **API Gateway NGINX**,
**SSO chữ ký số bằng số điện thoại**, **database-per-service**. **Không có frontend trong repo này.**

## Phase 1 — Công cụ (5 phút)

```bash
docker --version   # ≥ 24 (bắt buộc — mọi thứ chạy bằng compose)
go version         # ≥ 1.23 (chỉ cần khi dev service Go ngoài docker)
node --version     # ≥ 22 (ecom, loyalty)
corepack enable    # pnpm cho loyalty-service
```

Nên có: **DBeaver** (mỗi service 1 Postgres, port host riêng) · **Bruno** (API collection trong `bruno/`) ·
`jq` (đọc log JSON).

## Phase 2 — Chạy hệ thống (15 phút)

```bash
# 1. Env host cho compose (interpolation ${VAR}) — KHÔNG phải env của app
cp .env.example .env
#   GELF_ADDR: macOS Docker Desktop → udp://host.docker.internal:12201
#   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID: để trống cũng chạy (alert thành no-op)

# 2. Chạy 3 service lõi trước (giống prod: identity + order + loyalty + gateway)
docker compose up -d --build nginx identity-service order-service loyalty-service

# 3. Kiểm gateway chặn đúng: chưa đăng nhập phải 401 NGAY tại gateway
curl -i http://localhost:9080/order/api/v1/orders/app-customer     # → 401

# 4. Lấy token SSO (tự sinh khoá + ký + gọi identity)
./tools/sso-login.sh                                                # in ra accessToken

# 5. Gọi lại có token
curl -i -H "Authorization: Bearer <accessToken>" \
  http://localhost:9080/order/api/v1/orders/app-customer

# 6. Gọi thẳng service (bỏ qua gateway — hữu ích khi debug)
curl -i -H "X-User-Phone: 09xxxxxxxx" http://localhost:8082/api/v1/orders/app-customer

# 7. Toàn bộ stack (9 service + DB riêng) khi cần
docker compose up -d --build

# 8. Log tập trung (tuỳ chọn): Graylog UI :9000 (admin/admin)
docker compose --profile logging up -d
docker compose -f docker-compose.yml -f docker-compose.logging.gelf.yml up -d   # macOS
```

**Cổng cần nhớ:** gateway **9080** (dev HTTP) · identity 8088 · ecom 8081 · order 8082 · voucher 8083 ·
loyalty 8084 · service-mgmt 8085 · tracking 8086 · payment 8087 · brand 8089 (container đều nghe 8080).
Postgres host **5433–5441**, Graylog **9000**.

**Prefix qua gateway:** `/identity` (public) · `/order` · `/loyalty` (enforce SSO). Prefix bị strip
(`/order/api/v1/x` → service nhận `/api/v1/x`).

## Phase 3 — Đọc theo thứ tự này (20 phút)

| Thứ tự | File | Vì sao |
|---|---|---|
| 1 | `docs/Codebase-Overview.md` | **Bản đồ toàn hệ thống** — đọc kỹ mục 0 (bảo mật), 2 (danh sách service), 3 (gateway), 5 (order-service) |
| 2 | `CLAUDE.md` | Quy trình git + nguyên tắc kiến trúc không được phá |
| 3 | `docs/Naming-Convention.md` | Đặt tên code/DB/cache/API/ENV |
| 4 | `services/order-service/` | **Service tham chiếu chuẩn** — mọi service khác bắt chước cái này |
| 5 | `gateway/README.md` + `gateway/nginx/services/order.conf` | Cách route + enforce SSO |
| 6 | `bruno/order/` | Contract API đang chạy |
| 7 | `docs/SSO-Chu-Ky-So-SDT.html` | Luồng đăng ký/đăng nhập bằng chữ ký số |

## Mental map — một request đi qua đâu

```
App/Bruno
  → NGINX :9080 (dev) | :9443 (prod)
      ├─ location /order/ : limit_req → auth_request /_sso_verify
      │                       → identity-service:8080/auth/verify
      │                       (200 → GHI ĐÈ X-User-Sub/X-User-Phone · 401 → chặn tại đây)
      └─ rewrite bỏ prefix → order-service:8080
            → middleware Recover(RequestID(Logging(mux)))
              → handler (envelope + kiểm định danh/quyền)
                → repository (Cached decorator → Redis → GORM/Postgres)
                └→ external/appcustomer|orderweb (hệ thống ngoài, timeout 3s)
            log JSON stdout → Fluent Bit/GELF → Graylog
            5xx/panic/external lỗi/Redis down → Telegram (throttle 5')
```

## Điều PHẢI biết trước khi viết dòng code đầu tiên

1. **Database-per-service** — không bao giờ query DB service khác.
2. **SSO ở gateway chỉ là authentication.** Kiểm "user chỉ xem dữ liệu của mình" là việc **của service**:
   định danh chỉ lấy từ `X-User-Phone`; client truyền phone khác → **403**.
3. **Envelope v2 bắt buộc** cho `/api/v1/**`:
   `{success, status, message, data, errors, meta{requestId, timestamp, version}}` — dùng helper, không tự encode.
4. **Go + Postgres ⇒ GORM.** Node: loyalty = NestJS + Prisma; **ecom = zero-dependency, không thêm package.**
5. **`internal/` (bên trong) vs `external/` (bên ngoài)**: External không được import Internal.
6. **Lỗi external → Telegram**; nhưng "không tìm thấy khách" là nghiệp vụ → **không alert**.
7. **Mỗi feature mới → thêm request Bruno**; thay đổi kiến trúc → ghi `docs/Codebase-Overview.md` cùng commit.
8. **Git**: pull trước khi làm, **commit + push ngay sau mỗi việc** lên branch đang làm; không tạo PR nếu không được yêu cầu.
9. **Secret không commit** — 3 lớp env khác nhau (xem skill `env-checker`).
10. **Prod chỉ chạy identity · order · loyalty**; 6 service còn lại đang ẩn (`profiles: optional`).

## Việc đầu tiên nên làm (thay cho "hello world")

```bash
# 1. Đọc + chạy test của service tham chiếu
cd services/order-service && go test ./... -race && gofmt -l .

# 2. Trace 1 request thật từ log
./tools/logs.sh order | jq 'select(.path != null)' | tail -5

# 3. Chạy 1 request Bruno (mở bruno/ bằng Bruno app, env local)

# 4. Thử phá: gọi API với phone khác header SSO → phải nhận 403
```

## FAQ

**"Gọi qua gateway trả 401 mà service không có log gì?"** — Đúng thiết kế: nginx chặn tại `auth_request`,
chưa forward. Gửi `Authorization: Bearer` hoặc gọi thẳng service.

**"Gọi prefix service trả 404?"** — Service đó chưa có `gateway/nginx/services/<svc>.conf`, hoặc đang bị ẩn ở prod.

**"Service không start?"** — `config.Load()` fail-fast: thiếu `DATABASE_URL`/`REDIS_ADDR`/`TELEGRAM_*` ở prod.
Xem `docker compose logs <svc>`.

**"Không thấy log ở Graylog (macOS)?"** — Fluent Bit không đọc được log container trên Docker Desktop →
dùng overlay `docker-compose.logging.gelf.yml` + `GELF_ADDR` trong `./.env`.

**"Thêm service mới thế nào?"** — `./tools/new-service.sh <name>` (sinh cả thư mục Bruno), rồi thêm
`gateway/nginx/services/<svc>.conf`, job CI, `profiles: ["optional"]` ở prod nếu chưa chạy thật.

**"Cần tìm code ở đâu?"** — Repo có CodeGraph: `codegraph explore "<symbol hoặc câu hỏi>"` **trước khi** grep.

**"Agent/skill nào dùng khi nào?"** — `.claude/agents/`: `leader` (điều phối) · `ba` · `dev-backend` (Go) ·
`dev-node` · `dev-integration` (contract/gateway/Bruno) · `devops` · `tester` · `reviewer` · `docs-keeper`.

## Mục tiêu tuần đầu

- [ ] Chạy được 3 service lõi + lấy token SSO + gọi 1 API thành công qua gateway
- [ ] Đọc xong `docs/Codebase-Overview.md` mục 0–5 và `CLAUDE.md`
- [ ] Hiểu envelope v2 + quy ước status (200+[] / 404 / 400 / 422 / 403 / 502)
- [ ] Đọc hiểu 1 luồng external đầy đủ (`external/appcustomer` → handler → repository → cache)
- [ ] Sửa 1 việc nhỏ có test + commit/push đúng quy trình + cập nhật Bruno/doc nếu cần

## References

- `README.md` · `docs/Codebase-Overview.md` · `CLAUDE.md` · `gateway/README.md` · `logging/README.md`
- `tools/`: `sso-login.sh` · `sso-keygen.sh` · `logs.sh` · `new-service.sh` · `appcustomer-tester.sh`
- ⚠️ `README.md` mục "Chạy nhanh" còn ghi `apisix` (đã gỡ) — dùng lệnh trong skill này, và báo `docs-keeper` sửa.
