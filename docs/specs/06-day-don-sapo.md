# 06 — Đẩy đơn lên Sapo (quản lý bán hàng)

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/sapo.html`](../prototype/sapo.html)

## 1. Mục tiêu & phạm vi

**Làm:** khi đơn trong hikari được **xác nhận/thanh toán**, tạo đơn tương ứng trên **Sapo** (Sapo Open API) để quán quản
lý bán hàng, tồn kho, doanh thu tại một nơi. Theo dõi trạng thái đồng bộ + thử lại khi lỗi.
**Không làm (spec này):** đồng bộ ngược tồn kho/menu từ Sapo (❓ để cân nhắc sau — xem câu hỏi mở).

## 2. ❗ Trạng thái tích hợp (❓ CẦN LÀM TRƯỚC)

Quán **đã có tài khoản Sapo** nhưng **chưa có Open API key**. Cần:
1. Đăng ký ứng dụng trên **Sapo Developer** (apps.sapo.vn) → lấy `client_id`/`client_secret` (OAuth) hoặc **API key** của cửa hàng.
2. Xác định `SAPO_STORE` (subdomain `*.mysapo.net`) + quyền (scope) cho **đơn hàng, sản phẩm, khách hàng**.
3. Lấy `access_token` (OAuth) và cơ chế refresh.

> Trước khi có key: dùng **mock SapoClient** để chạy luồng & prototype; adapter thật cắm vào sau.

## 3. Personas & user story

- **US-1** — *Là hệ thống*, khi đơn `paid`, tôi **đẩy đơn sang Sapo** kèm món/số lượng/giá/khách/hình thức nhận.
- **US-2** — *Là quản lý (dashboard)*, tôi xem **trạng thái đồng bộ** từng đơn (đã đẩy / đang chờ / lỗi) và **thử lại** đơn lỗi.
- **US-3** — *Là hệ thống*, nếu Sapo lỗi tạm thời, tôi **tự thử lại** (backoff) và cảnh báo nếu vẫn thất bại.

## 4. Màn hình / UI

Prototype [`sapo.html`](../prototype/sapo.html): bảng **hàng đợi đồng bộ Sapo** (mã đơn, thời gian, tiền,
trạng thái đồng bộ, nút thử lại), thẻ tổng quan (đã đồng bộ / đang chờ / lỗi). *(Đây là màn hình trong dashboard admin.)*

## 5. API & dữ liệu

### Kích hoạt

- Không phải endpoint mở ra client. Được gọi **nội bộ** trong luồng "đơn paid" (spec 04) → `SapoSyncService.push(orderId)`.
- Chạy nền qua **hàng đợi** (job) để không chặn phản hồi thanh toán.

### REST (admin, envelope chuẩn)

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/v1/admin/sapo/sync` | Danh sách trạng thái đồng bộ (phân trang, lọc theo trạng thái) |
| `POST` | `/api/v1/admin/sapo/sync/:orderId/retry` | Thử đẩy lại 1 đơn lỗi |

### Interface backend (`src/external/sapo`)

```ts
interface SapoClient {
  createOrder(order: SapoOrderInput): Promise<{ sapoOrderId: string }>;
}
// Adapter: SapoHttpClient (Open API, OAuth) · MockSapoClient (dev)
```

### Model Prisma (dự kiến)

```prisma
model SapoSync {
  orderId String @id
  sapoOrderId String?
  status String @default("pending")  // pending | synced | failed
  attempts Int @default(0)
  lastError String?
  syncedAt DateTime?
  updatedAt DateTime @updatedAt
  @@map("sapo_syncs")
}
```

### Env (backend, secret)

`SAPO_STORE`, `SAPO_CLIENT_ID`, `SAPO_CLIENT_SECRET` (hoặc `SAPO_API_KEY`), `SAPO_ACCESS_TOKEN`.

## 6. Edge case & bảo mật

- **Idempotent theo `orderId`**: đơn đã `synced` không đẩy lại (tránh nhân đôi đơn/ doanh thu trên Sapo).
- Retry có **giới hạn + backoff**; quá số lần → `failed` + Telegram để người xử lý tay (nút retry ở dashboard).
- Map dữ liệu cẩn thận: **giá integer VND**, đúng số lượng, đúng khách (SĐT nếu có), ghi rõ kênh "Zalo Mini App".
- Token Sapo hết hạn → refresh tự động; lỗi auth → cảnh báo (không nuốt).
- KHÔNG log `client_secret`/token.

## 7. Tiêu chí hoàn thành

- [ ] Đơn `paid` tạo đúng 1 đơn Sapo (idempotent), lưu `sapoOrderId`.
- [ ] Lỗi tạm thời tự retry; lỗi bền → `failed` + alert + retry tay ở dashboard.
- [ ] Map đúng món/giá/số lượng/khách/kênh.
- [ ] Adapter Sapo thay bằng mock được (chạy khi chưa có API key).

## 8. Câu hỏi mở (❓)

1. **Menu là nguồn nào**: quản lý trong hikari (dashboard) hay đồng bộ từ **sản phẩm Sapo**? (ảnh hưởng cách map món → sản phẩm Sapo)
2. Đẩy đơn ở thời điểm nào: khi **đặt** hay khi **thanh toán thành công**? (đề xuất: khi paid)
3. Có cần đồng bộ **tồn kho/hết món** từ Sapo về app không?
4. Khách trên Sapo định danh theo SĐT — với khách chưa cấp SĐT thì map thế nào (khách vãng lai)?
