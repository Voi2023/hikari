# 03 — Phí giao hàng (liên kết BE — be.com.vn)

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/phi-giao-hang.html`](../prototype/phi-giao-hang.html)

## 1. Mục tiêu & phạm vi

**Làm:** khi khách chọn hình thức **Giao hàng**, app lấy **phí ship** và **thời gian dự kiến** dựa trên địa chỉ
giao, hiển thị vào giỏ; khi đặt, tạo yêu cầu giao với **BE (be.com.vn)** và theo dõi trạng thái tài xế.
**Không làm (spec này):** thanh toán (spec 04), điểm (spec 02).

## 2. ❗ Lưu ý tích hợp BE (❓ CẦN XÁC NHẬN — CHƯA CHẮC)

BE (beGroup — beDelivery/beFood) **không công bố rộng rãi Open API tự phục vụ** như một số hãng khác. Việc gọi API
đặt giao/tính phí thường cần **hợp đồng đối tác B2B + tài liệu API riêng + API key do BE cấp**. Vì vậy spec thiết kế
theo **interface trừu tượng `ShippingProvider`** — adapter BE cắm vào khi có tài liệu thật; nếu BE không hỗ trợ API,
có thể chuyển sang phương án dự phòng (Ahamove/GrabExpress hoặc bảng phí tự quản) **mà không đổi phần còn lại**.

> 👉 Cần chủ quán cung cấp: hợp đồng/đầu mối đối tác BE, tài liệu API (endpoint tính phí + tạo đơn + webhook trạng thái),
> `BE_API_KEY`. Trước khi có, dùng **mock** theo bán kính từ quán.

## 3. Personas & user story

- **US-1** — *Là khách chọn Giao hàng*, tôi nhập/chọn địa chỉ và thấy ngay **phí ship + thời gian dự kiến**.
  - Given địa chỉ nằm trong vùng phục vụ, When chọn xong, Then hiện phí + ETA; ngoài vùng → báo "ngoài vùng giao".
- **US-2** — *Là khách*, tổng tiền cuối = tạm tính món + **phí ship** (đóng gói nếu có), rõ ràng từng dòng.
- **US-3** — *Là khách sau khi đặt*, tôi theo dõi **trạng thái giao** (đang tìm tài xế → đã lấy hàng → đang giao → đã giao).

## 4. Màn hình / UI

Prototype [`phi-giao-hang.html`](../prototype/phi-giao-hang.html): chọn địa chỉ (gợi ý), thẻ **phí ship + ETA + khoảng cách**,
dòng tổng tiền, và **timeline trạng thái tài xế** (mô phỏng).

## 5. API & dữ liệu

### REST (envelope chuẩn, cần JWT)

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/api/v1/shipping/quote` | Báo giá ship `{ address, lat, lng }` → `{ fee, etaMinutes, distanceKm, serviceable }` |
| `POST` | `/api/v1/shipping/shipments` *(nội bộ, sau khi đặt+thanh toán)* | Tạo yêu cầu giao cho đơn → gọi BE |
| `GET` | `/api/v1/shipping/shipments/:orderId` | Trạng thái giao hiện tại |
| `POST` | `/api/v1/webhooks/be` *(public, verify chữ ký)* | BE gọi lại khi trạng thái đổi |

### Interface backend (`src/external/shipping`)

```ts
interface ShippingProvider {
  quote(input: { lat: number; lng: number; address: string }): Promise<{ fee: number; etaMinutes: number; distanceKm: number; serviceable: boolean }>;
  createShipment(order: OrderForShipping): Promise<{ providerRef: string; status: string }>;
  parseWebhook(payload: unknown, signature: string): { orderId: string; status: ShipStatus };
}
// Adapter: BeShippingProvider (thật) · MockShippingProvider (dev: phí theo bán kính từ 10.7751709,106.664583)
```

- Trạng thái chuẩn hoá: `finding_driver | picked_up | delivering | delivered | canceled`.
- Quán gốc toạ độ **10.7751709, 106.664583** (Q10) — dùng tính khoảng cách ở mock.

### Model Prisma (dự kiến)

```prisma
model Shipment {
  orderId String @id
  provider String            // "be"
  providerRef String?
  fee Int
  etaMinutes Int?
  status String @default("finding_driver")
  updatedAt DateTime @updatedAt
  @@map("shipments")
}
```

## 6. Edge case & bảo mật

- **Không tin phí ship client gửi** — luôn báo giá lại ở server khi đặt (giá client chỉ để hiển thị).
- Ngoài vùng phục vụ / BE trả lỗi → báo rõ cho khách, **không** để đặt giao; phân biệt "ngoài vùng" (nghiệp vụ)
  vs "BE timeout/5xx" (lỗi hệ thống → 502 + alert).
- Webhook BE: **verify chữ ký** + idempotent theo `providerRef`/`orderId` (BE có thể gọi lại nhiều lần).
- Timeout gọi BE (mặc định 5s); lỗi liên kết → log + Telegram.
- Realtime: đổi trạng thái → emit `shipment:updated` tới room `user:{id}`.

## 7. Tiêu chí hoàn thành

- [ ] Báo giá đúng theo địa chỉ; ngoài vùng báo rõ.
- [ ] Tổng tiền = món + ship (+ đóng gói), tính lại ở server khi đặt.
- [ ] Tạo shipment + nhận webhook cập nhật trạng thái (idempotent, verify chữ ký).
- [ ] Provider thay được (BE ↔ mock ↔ hãng khác) không đổi code nghiệp vụ.

## 8. Câu hỏi mở (❓)

1. BE có API đối tác cho quán không? Nếu chưa, dùng hãng dự phòng nào (Ahamove/Grab) hay bảng phí tự quản?
2. Vùng phục vụ (bán kính tối đa, các quận) & khung phí (theo km? phụ phí giờ cao điểm)?
3. Ai chịu phí ship (khách trả toàn bộ / quán trợ giá theo giá trị đơn)?
4. Có freeship theo ngưỡng đơn (vd ≥ 200.000đ) không?
