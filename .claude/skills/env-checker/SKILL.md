---
name: env-checker
description: Kiểm tra env của DMCL Super App — phân biệt 3 lớp env (app service / compose prod / compose host), so key với file .example, tìm key thiếu, phát hiện secret bị commit, kiểm fail-fast ở prod. Auto-trigger khi user sửa file .env hoặc hỏi thiếu env nào.
when:
  - User editing .env, .env.example, .env.production*, services/*/.env*
  - User asks "env check", "thiếu env nào", "validate env", "sao service không start"
  - User setup lần đầu hoặc chuẩn bị deploy prod
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash(ls -la:*)
  - Bash(diff:*)
  - Bash(grep:*)
  - Bash(git log:*)
  - Bash(git check-ignore:*)
  - Bash(docker compose config:*)
---

# Env Checker — DMCL Super App

## Ba lớp env — ĐỪNG NHẦM (nguồn lỗi phổ biến nhất)

| Lớp | File | Ai đọc | Committed? |
|---|---|---|---|
| **1. App env** | `services/<svc>/.env.dev` · `.env.staging` · `.env.production` (template) · `.env.production.local` (secret thật) | Chính service (Go `internal/config`, Node `process.env`), nạp qua `env_file` trong compose | `.env.dev` **có** · `.env.production` là template placeholder · `*.local` **KHÔNG** (gitignored) |
| **2. Compose env PROD** | **`/.env.production`** ở gốc repo | Chỉ dùng để interpolation `${VAR}` trong `docker-compose.prod.yml` | **KHÔNG** (template `.env.production.example`) |
| **3. Compose env host (dev)** | **`/.env`** ở gốc repo | Interpolation `${VAR}` của `docker-compose.yml` — KHÔNG vào app | **KHÔNG** (template `.env.example`) |

⚠️ Chạy prod **bắt buộc** truyền `--env-file`:
```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Thiếu `--env-file` → biến `${VAR:?...}` làm compose báo lỗi ngay (đúng thiết kế, đừng "chữa" bằng cách bỏ `:?`).

## Biến thật của hệ thống

**Lớp 3 (`/.env`)**: `GELF_ADDR` (Graylog cho gelf driver — dev Docker Desktop:
`udp://host.docker.internal:12201`) · `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID`.

**Lớp 2 (`/.env.production`)**: `APP_ENV` · `REGISTRY`/`IMAGE_PREFIX`/`TAG` ·
`ORDER_DB_PASSWORD`/`LOYALTY_DB_PASSWORD`/`IDENTITY_DB_PASSWORD` · `CRM_TOKEN`/`CRM_HASH_KEY` ·
`OTP_API_BASE_URL`/`OTP_API_KEY`/`OTP_TEST_CODE`/`OTP_TEST_PHONES` · `CERT_DOMAIN`/`CERT_EMAIL` ·
`TELEGRAM_*`.

**Lớp 1 — order-service**: `APP_ENV` · `HTTP_ADDR` · `LOG_LEVEL` · `ERROR_LOG_FILE` · `DATABASE_URL`
(+ `DATABASE_URL_REPLICAS` khi có cụm replica) · `REDIS_ADDR` · `APPCUSTOMER_BASE_URL`/`_TOKEN`/`_HASH_KEY` ·
`ORDERWEB_BASE_URL`/`ORDERWEB_API_KEY` · `TELEGRAM_*`.
**loyalty**: `DATABASE_URL` · `REDIS_ADDR` · `CRM_TOKEN`/`CRM_HASH_KEY` · `ADMIN_API_TOKEN` · `TELEGRAM_*`.
**identity**: `DATABASE_URL` (lưu binding bền) · `NONCE_TTL_SEC` · `OTP_API_BASE_URL`/`OTP_API_KEY` · `APP_ENV`.

## Các bước kiểm

### 1. File có đúng chỗ + đã gitignore chưa

```bash
ls -la .env* services/*/.env* 2>/dev/null
git check-ignore -v .env .env.production services/order-service/.env.production.local
grep -nE "^\.?env|\.env" .gitignore
```
Kỳ vọng: `.env`, `.env.production`, `*.local`, `gateway/nginx/certs/*` **đều bị ignore**;
chỉ `.env.example`, `.env.production.example`, `services/*/.env.dev` được commit.

### 2. So key với file `.example` (so KEY, không so value)

```bash
diff <(grep -oE '^[A-Z_][A-Z0-9_]*' .env.production          | sort -u) \
     <(grep -oE '^[A-Z_][A-Z0-9_]*' .env.production.example  | sort -u)

diff <(grep -oE '^[A-Z_][A-Z0-9_]*' .env         | sort -u) \
     <(grep -oE '^[A-Z_][A-Z0-9_]*' .env.example | sort -u)
```

### 3. Biến compose dùng nhưng chưa khai báo

```bash
# mọi ${VAR} trong compose
grep -ohE '\$\{[A-Z_][A-Z0-9_]*' docker-compose.yml docker-compose.prod.yml | tr -d '${' | sort -u
# validate thật (fail nếu thiếu biến bắt buộc)
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml config >/dev/null
```

### 4. Biến code đọc nhưng chưa có trong env

```bash
# Go: qua internal/config
grep -rnoE 'getenv\("[A-Z_]+"\)|Getenv\("[A-Z_]+"\)' services/*/internal/config/*.go | sort -u
# Node
grep -rnoE 'process\.env\.[A-Z_]+' services/*/src | sort -u
```
Thiếu ở `.env.dev` → dev không chạy được; thiếu ở prod → **fail-fast lúc boot** (đúng thiết kế).

### 5. Secret bị commit / hardcode

```bash
git log --oneline -20 -- .env.production .env.example services/*/.env.production
grep -rnE "(TOKEN|SECRET|PASSWORD|API_KEY|HASH_KEY)\s*[:=]\s*[\"'][^\"'$<{][^\"']{7,}" \
  services/ gateway/ docker-compose*.yml Jenkinsfile .github/ 2>/dev/null
```
Có secret thật trong file committed hoặc trong history → **phải rotate**, theo `docs/Security-Secret-Rotation.md`.
Trong file template dùng placeholder: `__FROM_VAULT__` / `<get_from_vault>`.

### 6. Dev vs prod phải khác

| Key | Dev | Prod |
|---|---|---|
| `APP_ENV` | `dev` | **`production`** (quyết định OTP tĩnh vs random!) |
| `NONCE_TTL_SEC` | 86400 | **90** |
| `LOG_LEVEL` | debug/info | info/warn |
| `*_BASE_URL` external | có thể `mock` | URL thật |
| `DATABASE_URL` | postgres docker dev | Postgres prod (mật khẩu từ Vault) |
| `TELEGRAM_*` | có thể rỗng (no-op) | **bắt buộc có** |
| `ADMIN_API_TOKEN` | có thể rỗng → **khoá hết** back-office | bắt buộc, ngẫu nhiên dài |

## Report

```markdown
## Env check — <scope>

### Thiếu (phải bổ sung)
- `/.env.production`: `CRM_HASH_KEY` — loyalty cần để ký X-Hash-PhoneKey, thiếu → service không start
- `services/order-service/.env.dev`: `ORDERWEB_API_KEY` — trống thì client dùng mock (có chủ ý?)

### Có trong env nhưng không ai đọc (rác, nên xoá)
- `OLD_APISIX_KEY`

### Có trong code nhưng chưa khai báo ở example
- `DATABASE_URL_REPLICAS` → thêm vào `.env.production.example` kèm chú thích

### 🔴 Rủi ro secret
- `.env.production` từng commit ở `<sha>` → cần rotate: DB password, CRM_TOKEN, TELEGRAM_BOT_TOKEN

### Kết luận
- docker compose config (prod): PASS/FAIL
- Sẵn sàng deploy: có/không — lý do
```

## Anti-patterns

- ❌ Nhét biến app vào `/.env` (lớp 3) và tưởng service đọc được — service chỉ đọc `env_file` của nó
- ❌ Bỏ `${VAR:?...}` để compose "chạy được" → prod chạy sai cấu hình âm thầm
- ❌ Điền secret thật vào `.env.example` / `.env.production` (template) — phải là placeholder
- ❌ Đọc `os.Getenv` rải rác trong code thay vì qua `internal/config` (mất fail-fast)
- ❌ Đặt `APP_ENV=dev` trên prod → OTP tĩnh `123456` + cho đăng ký lại = **chiếm số**
- ❌ Gửi secret qua chat/mail; commit rồi mới xoá (history vẫn còn → phải rotate)

## References

- `docs/Codebase-Overview.md` (mục 8 — Config & môi trường) · `docs/Security-Secret-Rotation.md`
- `.env.example` · `.env.production.example` · `services/*/.env.dev` · `services/order-service/.env.production.example`
- `services/order-service/internal/config/config.go` (Load + validate fail-fast)
