# 02 — Tích điểm khách hàng (Loyalty)

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/tich-diem.html`](../prototype/tich-diem.html)

## 1. Mục tiêu & phạm vi

**Làm:** khách tích điểm theo chi tiêu, xem thẻ thành viên + hạng + lịch sử điểm, đổi điểm lấy ưu đãi/giảm giá.
**Không làm (spec này):** cộng điểm tự động lúc thanh toán — chỉ định nghĩa quy tắc; việc gọi cộng điểm nằm ở
luồng hoàn tất đơn (spec 04). Ưu đãi cụ thể do dashboard quản lý (spec 07).

## 2. Quy tắc điểm (❓ CẦN CHỦ QUÁN CHỐT)

| Quy tắc | Giá trị đề xuất (giả định) |
|---|---|
| Tỷ lệ tích | **1 điểm / 1.000đ** chi tiêu thực (sau giảm giá, không tính phí ship) |
| Thời điểm cộng | Khi đơn **hoàn tất** (đã thanh toán / đã nhận), KHÔNG cộng lúc đặt |
| Hoàn điểm khi huỷ | Đơn huỷ/hoàn tiền → trừ lại điểm đã cộng |
| Hạn dùng điểm | ❓ (đề xuất: điểm hết hạn sau 12 tháng không phát sinh giao dịch) |
| Đổi điểm | **100 điểm = giảm 10.000đ** (tỷ lệ 1 điểm = 100đ) hoặc đổi món/ưu đãi cố định |
| Hạng thành viên | Đồng (0đ) · Bạc (≥ 1.000.000đ tích luỹ) · Vàng (≥ 3.000.000đ) — ❓ mốc & quyền lợi |

> Toàn bộ con số trên là **đề xuất để chủ quán duyệt**, chưa phải chốt.

## 3. Personas & user story

- **US-1** — *Là khách đã đăng nhập*, tôi thấy **thẻ thành viên** (tên, hạng, số điểm hiện có) ngay khi mở mục Tích điểm.
- **US-2** — *Là khách*, sau khi đơn hoàn tất tôi được **cộng điểm** và thấy trong lịch sử (+ số điểm, tên đơn, thời gian).
- **US-3** — *Là khách*, tôi **đổi 100 điểm lấy voucher giảm 10.000đ** để dùng cho đơn kế tiếp.
  - Given tôi có ≥ 100 điểm, When bấm đổi, Then trừ 100 điểm + tạo voucher; nếu không đủ điểm → chặn + báo thiếu.
- **US-4** — *Là khách*, tôi thấy **tiến trình lên hạng** (còn bao nhiêu chi tiêu nữa lên Bạc/Vàng).

## 4. Màn hình / UI

Prototype [`tich-diem.html`](../prototype/tich-diem.html): thẻ thành viên (điểm lớn + hạng + mã QR định danh),
thanh tiến trình lên hạng, danh sách **ưu đãi đổi điểm**, **lịch sử điểm** (cộng/trừ).

## 5. API & dữ liệu

### REST (envelope chuẩn, đều cần JWT)

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/v1/loyalty/me` | Thẻ thành viên của tôi: điểm, hạng, tổng tích luỹ |
| `GET` | `/api/v1/loyalty/me/transactions` | Lịch sử điểm (phân trang) |
| `GET` | `/api/v1/loyalty/rewards` | Danh sách ưu đãi đổi điểm đang mở |
| `POST` | `/api/v1/loyalty/redeem` | Đổi điểm lấy ưu đãi `{ rewardId }` → trả voucher |
| `POST` | `/api/v1/loyalty/earn` *(nội bộ)* | Cộng điểm cho đơn `{ orderId }` — **chỉ gọi từ server** (luồng hoàn tất đơn), không mở ra client |

### Model Prisma (dự kiến)

```prisma
model LoyaltyAccount {
  userId String @id
  points Int @default(0)          // điểm khả dụng
  lifetimePoints Int @default(0)  // tổng tích luỹ (xét hạng)
  tier String @default("bronze")  // bronze | silver | gold
  updatedAt DateTime @updatedAt
  @@map("loyalty_accounts")
}
model LoyaltyTransaction {
  id String @id @default(cuid())
  userId String
  type String        // earn | redeem | revoke | expire
  points Int         // + cộng, − trừ
  orderId String?
  note String?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@map("loyalty_transactions")
}
```

### DTO (`@hikari/shared`)

`LoyaltyAccountDto`, `LoyaltyTransactionDto`, `RewardDto`, `RedeemRequestDto`.

## 6. Edge case & bảo mật

- **Định danh từ JWT** (`req.user.id`) — KHÔNG nhận `userId` từ client; khách chỉ xem/đổi điểm của **chính mình**.
- Cộng/trừ điểm phải **idempotent theo `orderId`** (một đơn chỉ cộng 1 lần — chống double-earn khi callback lặp).
- Đổi điểm: kiểm tra đủ điểm **ở server** trong transaction (khoá tránh race khi bấm nhiều lần).
- Điểm là **integer**, không âm; mọi thay đổi ghi 1 dòng `loyalty_transactions` (audit).
- Realtime (tuỳ chọn): cộng điểm xong → emit `loyalty:updated` tới room `user:{id}` để cập nhật thẻ.

## 7. Tiêu chí hoàn thành

- [ ] Thẻ thành viên hiển thị đúng điểm/hạng/tổng tích luỹ.
- [ ] Cộng điểm idempotent theo đơn; huỷ đơn → trừ lại.
- [ ] Đổi điểm trừ đúng, tạo voucher, chặn khi thiếu điểm; an toàn khi bấm nhiều lần.
- [ ] Mọi biến động điểm có dòng lịch sử.

## 8. Câu hỏi mở (❓)

1. Tỷ lệ tích & tỷ lệ đổi điểm cuối cùng? Có hạn dùng điểm không?
2. Mốc & quyền lợi từng hạng (Bạc/Vàng được gì: giảm giá, ưu tiên, quà sinh nhật...)?
3. Đổi điểm ra **voucher giảm giá** hay ra **món tặng** (hay cả hai)?
4. Có tích điểm cho đơn tại quán (không qua app) bằng cách quét QR thành viên không?
