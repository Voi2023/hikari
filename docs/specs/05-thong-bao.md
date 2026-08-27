# 05 — Thông báo cho khách (Zalo OA/ZNS + in-app)

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/thong-bao.html`](../prototype/thong-bao.html)

## 1. Mục tiêu & phạm vi

**Làm:** quán gửi thông báo/khuyến mãi cho khách qua 2 kênh — **Zalo OA/ZNS** (đẩy vào Zalo, cả khi không mở app) và
**in-app** (danh sách thông báo trong mini app + badge realtime). Dashboard soạn & gửi theo đối tượng.
**Không làm (spec này):** thông báo giao dịch tự động (đơn đổi trạng thái) đã nằm ở realtime của spec 03/04 — ở đây là
**thông báo chủ động do quán soạn**.

## 2. Kênh gửi (đặc điểm & ràng buộc)

| Kênh | Dùng khi | Ràng buộc (❓ xác nhận với Zalo OA của quán) |
|---|---|---|
| **ZNS** (Zalo Notification Service) | Thông báo có cấu trúc theo **template đã duyệt** (đơn, điểm, nhắc lịch) | Cần template duyệt trước; tính phí theo tin; gửi theo SĐT đã quan tâm OA |
| **OA broadcast** | Tin khuyến mãi hàng loạt | Giới hạn số tin/tháng, đối tượng là người **quan tâm OA** |
| **In-app** | Mọi thông báo trong app + badge | Không tốn phí; chỉ thấy khi mở app; kèm **realtime** Socket.IO |

> Đề xuất: **in-app luôn có** (rẻ, kiểm soát được), ZNS/OA dùng cho tin quan trọng/khuyến mãi. Chi tiết phí & template
> phụ thuộc OA của quán — cần xác nhận.

## 3. Personas & user story

- **US-1** — *Là khách*, tôi thấy **badge số thông báo chưa đọc**; mở ra là danh sách (khuyến mãi, tích điểm, đơn).
- **US-2** — *Là khách đang mở app*, khi quán gửi tin, tôi nhận **realtime** (không cần tải lại).
- **US-3** — *Là quản lý (dashboard)*, tôi soạn thông báo, chọn **đối tượng** (tất cả / theo hạng / một khách), chọn
  **kênh** (in-app / ZNS / OA), xem trước rồi gửi.
- **US-4** — *Là khách*, tôi có thể **tắt** nhận tin khuyến mãi (tôn trọng lựa chọn — chống spam).

## 4. Màn hình / UI

Prototype [`thong-bao.html`](../prototype/thong-bao.html): trung tâm thông báo trong mini app (tabs: Tất cả / Khuyến mãi /
Đơn hàng), badge chưa đọc, đánh dấu đã đọc, nút mô phỏng "nhận tin mới" (realtime).

## 5. API & dữ liệu

### REST (envelope chuẩn)

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/v1/notifications` | Thông báo của tôi (phân trang, có `unreadCount`) — JWT |
| `POST` | `/api/v1/notifications/:id/read` | Đánh dấu đã đọc — JWT |
| `POST` | `/api/v1/notifications/read-all` | Đánh dấu tất cả đã đọc — JWT |
| `PATCH` | `/api/v1/me/preferences` | Bật/tắt nhận tin khuyến mãi — JWT |
| `POST` | `/api/v1/admin/notifications` | *(admin)* Soạn & gửi: `{ title, body, audience, channels, deeplink }` |

### Realtime

- Event `notification:new` tới room `user:{id}` (cá nhân) hoặc broadcast (tin chung) → client tăng badge + chèn vào đầu list.

### Model Prisma (dự kiến)

```prisma
model Notification {
  id String @id @default(cuid())
  title String; body String
  type String                 // promo | order | loyalty | system
  audience Json               // { kind: "all" | "tier" | "user", value?: string }
  channels String[]           // ["inapp","zns","oa"]
  deeplink String?
  createdAt DateTime @default(now())
  @@map("notifications")
}
model UserNotification {
  id String @id @default(cuid())
  userId String; notificationId String
  readAt DateTime?
  @@index([userId, readAt])
  @@map("user_notifications")
}
```

## 6. Edge case & bảo mật

- Gửi thông báo là **endpoint admin** (AdminGuard + role) — khách KHÔNG tự gửi.
- Tôn trọng **preferences**: khách tắt khuyến mãi → không gửi tin `promo` (vẫn gửi tin `order`).
- ZNS/OA gọi ngoài: timeout + retry có kiểm soát; lỗi → log + Telegram; **không** để 1 người lỗi làm hỏng cả batch.
- Gửi hàng loạt: chạy nền theo lô (queue), idempotent theo `(notificationId,userId)` tránh gửi trùng.
- Không đưa PII/nội dung nhạy cảm vào deeplink/log.

## 7. Tiêu chí hoàn thành

- [ ] Badge + danh sách + đánh dấu đã đọc hoạt động; realtime chèn tin mới.
- [ ] Dashboard gửi theo đối tượng + kênh; xem trước trước khi gửi.
- [ ] Tôn trọng tắt khuyến mãi; gửi hàng loạt idempotent, lỗi lẻ không chặn batch.

## 8. Câu hỏi mở (❓)

1. OA của quán đã có chưa? Đã đăng ký ZNS + có template nào duyệt sẵn?
2. Loại tin ưu tiên (khuyến mãi định kỳ, nhắc điểm sắp hết hạn, sinh nhật, món mới)?
3. Tần suất tối đa để tránh làm phiền khách (vd ≤ 2 tin khuyến mãi/tuần)?
