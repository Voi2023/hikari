# Security Audit Checklist — DMCL Super App

Tick từng mục khi audit thủ công. Thứ tự = mức độ rủi ro thật của hệ thống này.

## A. Định danh & phân quyền (12 items — QUAN TRỌNG NHẤT)

- [ ] SĐT/định danh **chỉ** lấy từ `X-User-Phone` / `X-User-Sub`; không đọc từ `?phone=` / body
- [ ] Client truyền phone khác header SSO → **403** (không âm thầm dùng phone của client)
- [ ] Thiếu định danh ở endpoint nghiệp vụ → **401** (không fallback "khách ẩn danh")
- [ ] Mọi `GET/PUT/DELETE {id}` kiểm **chủ sở hữu** trước khi trả/ghi (chống IDOR)
- [ ] Endpoint back-office (tra cứu theo SĐT/id, list toàn hệ thống, resync) có **AdminGuard**
- [ ] AdminGuard **fail-safe**: `ADMIN_API_TOKEN` rỗng/chưa cấu hình → khoá hết (không fail-open)
- [ ] So sánh `X-Admin-Token` bằng constant-time, không `==` chuỗi thường
- [ ] Prefix nghiệp vụ trong `gateway/nginx/services/*.conf` có `include snippets/sso.conf`
- [ ] Endpoint public chỉ gồm `/`, `/healthz`, `/readyz`, `/identity/*` — không lọt endpoint dữ liệu
- [ ] Service KHÔNG tự implement verify JWT thay gateway (trừ identity-service)
- [ ] Không tin bất kỳ header `X-User-*` do client gửi (gateway ghi đè — kiểm còn đúng không)
- [ ] Không truy cập DB service khác (database-per-service) — không có DSN chéo trong config

## B. Secret & cấu hình (8 items)

- [ ] `.env`, `.env.*.local`, `services/*/.env.production.local` **gitignored**
- [ ] Không secret thật trong `.env.example` / `.env.production` / compose / Jenkinsfile / workflow
- [ ] Không secret trong code, comment, README, doc HTML
- [ ] `git log -- .env.production .env.example` — nếu từng commit secret → **đã rotate?**
      (`docs/Security-Secret-Rotation.md`)
- [ ] Biến bắt buộc ở prod dùng `${VAR:?...}` trong compose (fail sớm, không chạy sai)
- [ ] `internal/config.Load()` validate + fail-fast ở prod (thiếu `DATABASE_URL`/`TELEGRAM_*` → không start)
- [ ] Không `os.Getenv` rải rác ngoài package config
- [ ] Cert TLS (`gateway/nginx/certs/*.pem`) gitignored; `key.txt`/`logs.txt` không chứa secret

## C. Log & dữ liệu nhạy cảm (7 items)

- [ ] Log KHÔNG chứa: OTP, nonce, JWT/refresh token, private key, `CRM_TOKEN`, `X-Hash-PhoneKey`, `ADMIN_API_TOKEN`
- [ ] Lỗi 5xx: client chỉ thấy message chung; nguyên nhân thật vào log + Telegram (`RecordError`)
- [ ] Không trả stack trace / DSN / câu query ra response
- [ ] PII trong log ở mức tối thiểu cần để trace (`request_id` + phone khi thật cần)
- [ ] Telegram alert không chứa PII/secret (chỉ service, env, loại lỗi, tóm tắt, timestamp)
- [ ] File log lỗi (`ERROR_LOG_FILE`) không bị mount ra ngoài container không kiểm soát
- [ ] Graylog/GELF không nhận field chứa secret

## D. Input & truy vấn (8 items)

- [ ] Validate mọi input client trước khi vào tầng nghiệp vụ; thiếu field → 422 + `errors[]`
- [ ] SĐT chuẩn hoá + validate định dạng (sai → 400)
- [ ] SQL/GORM luôn tham số hoá (`?`, `Where("col = ?", v)`); `db.Raw` không nối chuỗi
- [ ] Không mass-assignment: chỉ bind field cho phép, không đổ nguyên body vào model
- [ ] Giới hạn kích thước body + độ dài field (chống payload lớn)
- [ ] Phân trang bắt buộc cho list (`limit` có trần, không cho `limit=100000`)
- [ ] JSON từ hệ thống ngoài đi qua `jsonx` — kiểu lệch không làm chết unmarshal, không rớt field
- [ ] Không dùng input client để dựng đường dẫn file / URL đích (SSRF/path traversal)

## E. identity-service / SSO (8 items)

- [ ] OTP prod: random `crypto/rand` 6 số, TTL 5', one-time, **KHÔNG lộ ra response** (dev tĩnh `123456` là chủ ý)
- [ ] Rate-limit gửi OTP: 3 lần/SĐT/phút → 429 + `Retry-After` (còn nguyên, cả dev lẫn prod)
- [ ] So sánh OTP/nonce bằng `subtle.ConstantTimeCompare`
- [ ] Prod **chặn ghi đè binding** đã tồn tại (chống chiếm số qua đăng ký lại)
- [ ] JWT ES256, không nhận `alg: none`; access ~15', refresh 30d
- [ ] Nonce challenge TTL ngắn ở prod (không để 86400 như dev)
- [ ] Mã lỗi phân biệt lỗi user (`otp_invalid`/`otp_expired`/`already_registered`, 4xx) vs hệ thống (`internal`, 500)
- [ ] JWKS chỉ phơi public key; private key không rời container/không log

## F. Độ bền & lạm dụng (6 items)

- [ ] Mọi HTTP client ra ngoài có **timeout** (3s theo chuẩn) + không retry vô hạn
- [ ] HTTP server có `ReadTimeout`/`WriteTimeout`/`IdleTimeout`
- [ ] `limit_req` ở gateway còn bật cho mọi prefix nghiệp vụ
- [ ] Redis down → cache tự DISABLE, service vẫn phục vụ (không 5xx hàng loạt)
- [ ] Lỗi nghiệp vụ (không có khách) KHÔNG gửi Telegram — tránh spam làm mù alert thật
- [ ] Alert có throttle (5'/key) để không tự DoS kênh cảnh báo

## G. Hạ tầng & deploy (7 items)

- [ ] Postgres/Redis ở prod **không publish port** ra host
- [ ] Gateway prod nghe **HTTPS 9443**, cert hợp lệ (certbot chạy được, không dùng self-signed lâu dài)
- [ ] Port 80 chỉ dùng cho ACME challenge, không phục vụ API
- [ ] Service ẩn ở prod (`profiles: optional`) không có route gateway (gọi trả 404, không lọt vào service dev)
- [ ] Image build multi-stage distroless, `CGO_ENABLED=0`; **container chạy nonroot** (đang là nợ — kiểm lại)
- [ ] CI không in secret ra log; GHCR credential dùng `GITHUB_TOKEN`, không PAT dài hạn trong repo
- [ ] Backup/volume `*-pg-data` có kế hoạch phục hồi; không lệnh `down -v` trong script deploy

## H. Phụ thuộc (4 items)

- [ ] Go: `go.mod`/`go.sum` committed, không thêm dep không cần (stdlib-first)
- [ ] `ecom-service` vẫn **zero-dependency**
- [ ] loyalty: `pnpm-lock.yaml` committed; dep mới có lý do rõ, không lấy package lạ ít download
- [ ] Không dep bị CVE nghiêm trọng đang dùng ở service chạy prod

---

**Tổng: 60 items**

Kết luận:
- Mục **A** hoặc **B** fail bất kỳ item nào → **BLOCK DEPLOY**
- Mục C–E fail → phải có ticket fix trước sprint sau
- Mục F–H fail → hardening, ghi vào nợ kỹ thuật ở `docs/Codebase-Overview.md`
