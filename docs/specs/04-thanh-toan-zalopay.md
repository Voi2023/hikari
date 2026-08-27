# 04 — Thanh toán ZaloPay

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/thanh-toan.html`](../prototype/thanh-toan.html)

## 1. Mục tiêu & phạm vi

**Làm:** khách thanh toán đơn bằng **ZaloPay** (đã có merchant) ngay trong mini app; server xác nhận qua callback và
cập nhật đơn "đã thanh toán". **Không làm (spec này):** cộng điểm/đẩy Sapo/tạo shipment — chỉ **kích hoạt** chúng
sau khi thanh toán thành công (các spec 02, 06, 03).

## 2. Luồng thanh toán

```text
Khách bấm "Thanh toán" (giỏ đã có món + ship)
 → BE POST ZaloPay Create Order (app_id + app_trans_id + amount + mac HMAC-SHA256 key1)
 → nhận zp_trans_token / order_url
 → Mini app mở cổng ZaloPay (zmp-sdk Payment.createOrder / order_url)
 → Khách thanh toán trong ZaloPay
 → ZaloPay gọi CALLBACK về BE (verify mac key2) → BE set đơn = "paid"  ← nguồn sự thật
 → BE kích hoạt: cộng điểm (02) + tạo shipment (03) + đẩy Sapo (06)
 → Mini app poll GET /payments/:orderId/status → hiện kết quả
```

> ⚠️ **Callback ZaloPay là nguồn xác nhận thanh toán**, KHÔNG dựa vào kết quả trả về phía client (client có thể giả).

## 3. Personas & user story

- **US-1** — *Là khách*, tôi chọn ZaloPay và hoàn tất thanh toán mà không rời mini app.
- **US-2** — *Là khách*, thanh toán xong tôi thấy màn **thành công** + mã đơn; nếu thất bại/huỷ, đơn giữ trạng thái
  "chờ thanh toán" và tôi thử lại được.
- **US-3** — *Là hệ thống*, đơn chỉ chuyển "paid" khi **callback ZaloPay hợp lệ** (đúng mac + đúng số tiền).

## 4. Màn hình / UI

Prototype [`thanh-toan.html`](../prototype/thanh-toan.html): tóm tắt đơn + chọn phương thức (ZaloPay) → mô phỏng cổng
ZaloPay → màn kết quả (thành công/thất bại + thử lại).

## 5. API & dữ liệu

### REST (envelope chuẩn)

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/api/v1/payments/zalopay/create` | Tạo giao dịch cho đơn `{ orderId }` → `{ zpTransToken, orderUrl, appTransId }` (JWT) |
| `POST` | `/api/v1/webhooks/zalopay` | Callback ZaloPay (public, **verify mac key2**, idempotent) |
| `GET` | `/api/v1/payments/:orderId/status` | Trạng thái thanh toán (JWT) — client poll |

### Model Prisma (dự kiến)

```prisma
model Payment {
  id String @id @default(cuid())
  orderId String @unique
  provider String @default("zalopay")
  appTransId String @unique      // yymmdd_<orderId> theo chuẩn ZaloPay
  amount Int                       // VND, integer — số tiền server tính, KHÔNG tin client
  status String @default("pending") // pending | paid | failed | canceled
  zpTransId String?                // mã giao dịch ZaloPay khi thành công
  paidAt DateTime?
  createdAt DateTime @default(now())
  @@map("payments")
}
```

### Env (backend, secret)

`ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_CALLBACK_URL`, `ZALOPAY_ENDPOINT` (sandbox/prod).

## 6. Edge case & bảo mật

- **Số tiền tính ở server** từ đơn (món + ship + đóng gói − giảm giá) — KHÔNG nhận `amount` từ client.
- Callback: **verify `mac` bằng key2** + kiểm `app_trans_id` khớp Payment; **idempotent** (ZaloPay có thể gọi lại) —
  đã `paid` thì trả OK, không cộng điểm/đẩy Sapo lần 2.
- Trả về ZaloPay đúng format `{ return_code, return_message }` để nó ngừng retry khi đã nhận.
- Đơn "pending" quá hạn (vd 15 phút) → tự huỷ giao dịch, cho đặt lại.
- KHÔNG log `key1/key2`, token; log `appTransId` để trace là đủ.
- Realtime: `paid` → emit `order:updated` tới room `user:{id}`.

## 7. Tiêu chí hoàn thành

- [ ] Tạo giao dịch với số tiền server, mở cổng ZaloPay trong mini app.
- [ ] Chỉ set "paid" khi callback đúng mac + đúng tiền; idempotent.
- [ ] Thất bại/huỷ → đơn giữ "chờ thanh toán", thử lại được.
- [ ] Thanh toán thành công kích hoạt đúng 1 lần: cộng điểm + shipment + đẩy Sapo.

## 8. Câu hỏi mở (❓)

1. Có cho phép **thanh toán tại quán / COD** song song ZaloPay không?
2. Có cần **VietQR/chuyển khoản thủ công** làm phương án dự phòng (khi ZaloPay lỗi) không?
3. Chính sách hoàn tiền khi huỷ đơn đã thanh toán (tự động qua ZaloPay Refund API hay xử lý tay)?
4. Ngưỡng tự huỷ đơn chưa thanh toán (15 phút? 30 phút?).
