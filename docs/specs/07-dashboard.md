# 07 — Dashboard quản trị (đăng nhập 2FA + quản lý)

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/dashboard.html`](../prototype/dashboard.html)
Gộp các mục #07 (đăng nhập 2FA) và #08 (quản lý) trong FEATURES.

## 1. Mục tiêu & phạm vi

**Làm:** web admin (Next.js) để nhân viên/quản lý vận hành: **đăng nhập có 2FA (TOTP)**, quản lý menu, đơn hàng,
tích điểm/khách, thông báo, giao hàng, đồng bộ Sapo, báo cáo. **Không làm (spec này):** logic nghiệp vụ chi tiết của
từng module (đã ở spec 01–06) — đây là **lớp quản trị** trên các nghiệp vụ đó.

## 2. Đăng nhập & 2FA (TOTP)

```text
Bước 1: email + mật khẩu  → BE verify (Argon2id/bcrypt), rate-limit theo IP+email
Bước 2: nhập mã TOTP 6 số → BE verify bằng otplib (cửa sổ ±1)
      → cấp JWT admin (chứa role) + refresh; ghi audit "login"
Thiết lập lần đầu: BE tạo secret → hiện QR (otpauth://) để quét bằng Google Authenticator/Authy
      → xác nhận 1 mã đúng → bật 2FA + phát 8 mã dự phòng (backup codes, hash lưu DB)
```

- **2FA bắt buộc** cho mọi tài khoản admin (không cho bỏ qua).
- Mất thiết bị → dùng **backup code**; hết backup → owner reset (audit).
- Mật khẩu hash **Argon2id**; secret TOTP mã hoá khi lưu.

## 3. RBAC (phân quyền)

| Role | Quyền |
|---|---|
| `owner` | Toàn quyền + quản lý tài khoản admin + reset 2FA |
| `manager` | Menu, đơn, điểm, thông báo, giao hàng, Sapo, báo cáo |
| `staff` | Xem & xử lý đơn, cập nhật trạng thái; không đổi giá/menu, không gửi thông báo hàng loạt |

## 4. Các module quản lý

| Module | Chức năng | Liên quan spec |
|---|---|---|
| **Tổng quan** | KPI: đơn hôm nay, doanh thu, đơn chờ xử lý, đồng bộ Sapo lỗi | — |
| **Đơn hàng** | Danh sách + chi tiết, đổi trạng thái, xem realtime đơn mới | 03, 04 |
| **Menu** | Bật/tắt món (còn/hết), sửa giá/mô tả, sắp xếp nhóm | 01 |
| **Khách & điểm** | Tra cứu khách, xem/điều chỉnh điểm (có audit), hạng | 02 |
| **Thông báo** | Soạn & gửi (đối tượng + kênh), xem lịch sử | 05 |
| **Giao hàng** | Theo dõi shipment, xử lý đơn lỗi giao | 03 |
| **Sapo** | Trạng thái đồng bộ, thử lại đơn lỗi | 06 |
| **Báo cáo** | Doanh thu theo ngày/món, top khách | — |

## 5. Màn hình / UI

Prototype [`dashboard.html`](../prototype/dashboard.html): màn **đăng nhập 2 bước** (mật khẩu → TOTP 6 số) rồi
**dashboard tổng quan** (sidebar module + KPI + bảng đơn realtime).

## 6. API & dữ liệu

### REST (admin, envelope chuẩn)

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Bước 1: email+password → `{ mfaRequired: true, mfaToken }` |
| `POST` | `/api/v1/admin/auth/2fa` | Bước 2: `{ mfaToken, code }` → JWT admin + refresh |
| `POST` | `/api/v1/admin/auth/2fa/setup` | Tạo secret + QR (lần đầu) |
| `GET`  | `/api/v1/admin/overview` | KPI tổng quan |
| … | (mỗi module map tới API spec tương ứng, đều qua AdminGuard + RolesGuard) | |

### Model Prisma (dự kiến)

```prisma
model AdminUser {
  id String @id @default(cuid())
  email String @unique
  passwordHash String        // Argon2id
  role String @default("staff")
  totpSecret String?         // mã hoá; null = chưa bật 2FA
  totpEnabled Boolean @default(false)
  backupCodes String[]       // hash
  createdAt DateTime @default(now())
  @@map("admin_users")
}
model AdminAudit {
  id String @id @default(cuid())
  adminId String; action String; meta Json?
  ip String?; createdAt DateTime @default(now())
  @@index([adminId, createdAt])
  @@map("admin_audits")
}
```

## 7. Edge case & bảo mật

- **HTTPS bắt buộc**; cookie/refresh `HttpOnly` + `Secure` + `SameSite`.
- **Rate-limit** đăng nhập + xác thực 2FA (chống brute-force mã 6 số); khoá tạm sau N lần sai.
- JWT admin ngắn hạn + refresh; **RolesGuard** cho từng route; `staff` không chạm route quản lý cao.
- **Audit** mọi hành động nhạy cảm (login, đổi giá, chỉnh điểm, gửi thông báo, reset 2FA).
- Verify TOTP chống **replay** (từ chối mã vừa dùng); so sánh mã bằng hằng thời gian.
- KHÔNG log secret TOTP, mật khẩu, JWT.

## 8. Tiêu chí hoàn thành

- [ ] Đăng nhập 2 bước (password + TOTP) hoạt động; thiết lập QR + backup codes.
- [ ] RolesGuard chặn đúng theo role; audit ghi hành động nhạy cảm.
- [ ] Rate-limit + khoá tạm khi sai nhiều; TOTP chống replay.
- [ ] Các module đọc/ghi qua API spec tương ứng, không truy cập DB service khác.

## 9. Câu hỏi mở (❓)

1. Có mấy tài khoản admin & vai trò cụ thể (chủ, quản lý ca, thu ngân)?
2. Ngoài TOTP, có cần OTP dự phòng qua Zalo/email khi mất thiết bị không?
3. Báo cáo cần chỉ số gì (doanh thu ngày/tháng, món bán chạy, tỉ lệ giao/tại quán, khách quay lại)?
4. Dashboard tự host hay Vercel? Có giới hạn IP nội bộ khi truy cập không?
