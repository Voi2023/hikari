---
name: security-auditor
description: Audit bảo mật code DMCL Super App — định danh SSO/IDOR, AdminGuard, secret trong git, log leak, SQL injection, rate-limit OTP, TLS/gateway. Auto-trigger khi user yêu cầu review bảo mật hoặc trước khi deploy prod.
when:
  - User asks "audit security", "review bảo mật", "OWASP", "quét lỗ hổng"
  - User mentions "auth", "JWT", "SSO", "OTP", "secret", "PII", "token"
  - User sắp deploy production hoặc vừa sửa identity-service/gateway
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(codegraph explore:*)
---

# Security Auditor — DMCL Super App

Audit theo **rủi ro thật của hệ thống này**, không phải checklist chung. Đọc `./checklist.md` để tick từng mục.

## Mô hình bảo mật của hệ thống (phải hiểu trước khi audit)

- **SSO ở gateway NGINX = AUTHENTICATION**, KHÔNG phải authorization. Gateway `auth_request` →
  `identity-service:8080/auth/verify` → **ghi đè** `X-User-Sub` / `X-User-Phone` vào request (chống client giả header).
- **Authorization là trách nhiệm của từng service** — "user chỉ xem/sửa dữ liệu của chính mình" phải do
  service tự kiểm. Đây là nguồn lỗ hổng số 1 của hệ thống.
- **Định danh chỉ lấy từ `X-User-Phone`** — có header thì bắt buộc dùng; client truyền phone khác → **403**.
- **Back-office** → `X-Admin-Token` khớp `ADMIN_API_TOKEN`, **fail-safe** (chưa cấu hình → khoá hết).
- Identity: ECDSA P-256 + JWT ES256 + JWKS; OTP prod random 6 số qua API OTP nội bộ, dev tĩnh `123456`;
  rate-limit gửi OTP **3 lần/SĐT/phút**; so sánh nonce/OTP bằng `subtle.ConstantTimeCompare`.

## Quy trình

### 1. Chốt scope
Diff hiện tại (`git diff`), 1 service, hay toàn hệ thống? Nêu rõ trong report.

### 2. Quét cơ học (grep — nhanh, nhiều tín hiệu thật)

```bash
# Định danh lấy sai nguồn — rủi ro IDOR/giả mạo SĐT
grep -rn "Query().Get(\"phone\")\|query.phone\|body.phone" services/ --include=*.go --include=*.ts

# Endpoint back-office thiếu AdminGuard
grep -rln "ADMIN_API_TOKEN\|X-Admin-Token" services/

# Secret hardcode / lọt vào file committed
grep -rnE "(TOKEN|SECRET|PASSWORD|API_KEY|HASH_KEY)\s*[:=]\s*[\"'][^\"'$]{8,}" services/ gateway/ --include=*.go --include=*.ts --include=*.js --include=*.yml
git log --oneline -20 -- .env.production .env.example   # secret từng nằm trong history?

# Log leak
grep -rnE "log.*(otp|token|jwt|password|privateKey|X-Hash-PhoneKey)" services/ -i

# SQL nối chuỗi
grep -rn "Raw(\|Exec(" services/ --include=*.go | grep -iE "\+|fmt.Sprintf"

# Thiếu timeout ra ngoài
grep -rn "http.Client{" services/ --include=*.go | grep -v Timeout
```

### 3. Review tay theo `./checklist.md`
Ưu tiên theo thứ tự: **định danh/authorization → secret → log leak → input/SQL → độ bền → hạ tầng**.

### 4. Phân loại
```
🔴 CRITICAL — khai thác được ngay: rò rỉ dữ liệu khách hàng, chiếm SĐT, secret lộ
🟠 HIGH     — lỗ hổng rõ, phải fix trong sprint
🟡 MEDIUM   — rủi ro, cần kế hoạch
🟢 LOW      — hardening
🔵 INFO     — ghi chú
```

### 5. Report

```markdown
# Security Audit — <scope>
Date: YYYY-MM-DD · Scope: <diff/service/toàn hệ thống>

## Summary
- 🔴 CRITICAL: n · 🟠 HIGH: n · 🟡 MEDIUM: n · 🟢 LOW: n
- Kết luận: BLOCK DEPLOY / CẦN FIX TRƯỚC SPRINT SAU / OK

## Findings

### 🔴 [CRITICAL] C-001: Lấy SĐT từ query khi đã có header SSO
- File: `services/order-service/internal/handler/orders.go:88`
- Issue: `r.URL.Query().Get("phone")` → user đăng nhập bằng SĐT A tra được đơn của SĐT B (IDOR, rò rỉ PII).
- Fix: dùng `appPhone(r)` (chỉ đọc `X-User-Phone`); client truyền phone khác → 403.
- Test: case "phone khác SSO → 403".
- OWASP: A01 Broken Access Control

### 🟠 [HIGH] H-001: ...
```

## Nợ bảo mật đã biết của hệ thống (đừng báo lại như phát hiện mới — kiểm xem đã vá chưa)

- JWT chưa ràng buộc `iss`/`aud` khi verify
- Refresh token 30 ngày chưa revoke/rotation
- Chưa rate-limit brute-force `/auth/*` (chỉ có rate-limit gửi OTP)
- Gateway chưa strip `X-User-*` do client gửi (hiện chống bằng cách ghi đè — defense-in-depth còn thiếu)
- Container chạy **root**
- Secret thật từng nằm trong git history (`.env.production`, `.env.example`) → **phải rotate**,
  checklist `docs/Security-Secret-Rotation.md`
- Rate-limit OTP in-memory → nhiều instance sẽ hở, cần chuyển Redis (INCR + EXPIRE)

## Anti-patterns thật trong codebase này

```go
// ❌ BAD — tin phone client gửi
phone := r.URL.Query().Get("phone")
orders, _ := repo.ListByPhone(ctx, phone)

// ✅ GOOD — định danh từ SSO, client gửi khác thì chặn
phone, err := appPhone(r) // đọc X-User-Phone; body/query khác → ErrPhoneMismatch
if err != nil {
    writeError(w, r, http.StatusForbidden, "Không được truy vấn dữ liệu của số khác")
    return
}
```

```go
// ❌ BAD — AdminGuard fail-open: chưa cấu hình token thì cho qua hết
if os.Getenv("ADMIN_API_TOKEN") == "" { next(w, r); return }

// ✅ GOOD — fail-safe: chưa cấu hình thì khoá
want := cfg.AdminAPIToken
if want == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Admin-Token")), []byte(want)) != 1 {
    writeError(w, r, http.StatusUnauthorized, "Không có quyền truy cập")
    return
}
```

```go
// ❌ BAD — lộ nguyên nhân hệ thống ra client + không alert
writeError(w, r, 500, err.Error())

// ✅ GOOD — client thấy message chung, nguyên nhân vào log + Telegram
RecordError(r, err)
writeError(w, r, http.StatusBadGateway, "Lỗi hệ thống, vui lòng thử lại")
```

## References

- `./checklist.md` (tick từng mục) · `docs/Codebase-Overview.md` **mục 0** (bảo mật) và mục 4 (SSO)
- `docs/Security-Secret-Rotation.md` · `gateway/nginx/snippets/sso.conf`
- `services/identity-service/internal/auth/` (jwt, ratelimit, errors, binding)
- OWASP Top 10: https://owasp.org/Top10/
