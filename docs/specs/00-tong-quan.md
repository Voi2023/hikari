# 00 — Tổng quan hệ thống

## Mục tiêu

Zalo Mini App giúp khách của **Hikari Vegetarian Cafe** (quán chay món Nhật, Q10 TP.HCM):
xem menu → đặt món (tại quán / mang về / giao hàng) → tích điểm → thanh toán (ZaloPay / chuyển khoản) →
nhận thông báo. Đơn được đẩy về **Sapo** để quán quản lý bán hàng. Một **dashboard** quản trị toàn bộ.

## Personas

| Persona | Định danh | Kênh |
|---|---|---|
| Khách hàng | Đăng nhập Zalo (`accessToken` → verify → JWT hikari); SĐT khi đồng ý `getPhoneNumber` | Mini App |
| Nhân viên/Quản lý quán | Tài khoản admin + **2FA** (JWT + role) | Dashboard |
| Hệ thống ngoài | Zalo Graph/OA, ZaloPay, BE giao hàng, Sapo | Server-to-server |

## Kiến trúc (mục tiêu)

```text
[Mini App React]  ─┐
                   ├─► [API NestJS] ─► [PostgreSQL] (Prisma)
[Admin Next.js]  ─┘         │        ─► [Redis] (cache + Socket.IO adapter)
                            ├─► Zalo Graph API   (verify login, getPhoneNumber)
                            ├─► Zalo OA / ZNS     (gửi thông báo)
                            ├─► ZaloPay           (thanh toán)
                            ├─► BE giao hàng       (tính phí ship)  ❓ nhà cung cấp chưa chốt
                            └─► Sapo Open API      (đẩy đơn)
   Realtime: Socket.IO (đơn đổi trạng thái, thông báo) — room user:{id}
```

- **Định danh**: lấy từ **JWT đã verify** (`req.user`), không tin body/query client. User chỉ thao tác dữ liệu của mình.
- **Envelope chuẩn** cho mọi `/api/v1/**` (6 khoá, dựng bởi interceptor + exception filter):
  `{ success, status, message, data, errors, meta{ requestId, timestamp, version } }`.
- Chi tiết kiến trúc code: xem `.claude/agents/leader.md`, `dev-backend.md`, `dev-frontend.md`.

## Thông tin quán (❓ cần chủ quán bổ sung)

| Mục | Giá trị |
|---|---|
| Tên | Hikari Vegetarian Cafe |
| Khu vực | Quận 10, TP.HCM |
| Toạ độ | 10.7751709, 106.664583 |
| Địa chỉ đường (số nhà) | ❓ CẦN XÁC NHẬN |
| Giờ mở cửa | ❓ CẦN XÁC NHẬN |
| Hotline / Zalo OA | ❓ CẦN XÁC NHẬN |

## Chức năng (tổng hợp)

Xem [`FEATURES.md`](FEATURES.md). Tính năng đầu tiên đã có spec + prototype: **Menu** ([01-menu.md](01-menu.md)).

## Điểm tích hợp cần chốt trước khi viết spec 02–08

1. **BE giao hàng** — dùng đối tác nào (GHN / GHTK / Ahamove / Grab / BE tự có)? Quán tự giao hay thuê ngoài?
2. **Thanh toán** — có ví/merchant **ZaloPay** chưa? Có cần hiển thị QR chuyển khoản ngân hàng (VietQR) không?
3. **Sapo** — đã có tài khoản + **Sapo Open API key** chưa? Đẩy đơn theo thời điểm nào (khi đặt / khi thanh toán)?
4. **2FA dashboard** — kiểu 2FA (TOTP app như Google Authenticator / OTP qua Zalo / email)?

> Các câu này quyết định nội dung spec 02–08 nên được xác nhận trước (tránh viết sai rồi sửa).
