# Bảng theo dõi chức năng — Hikari Vegetarian Cafe

> Cập nhật **đầu tiên** mỗi khi thêm/đổi chức năng. Trạng thái: `📝 Spec` → `🎨 Prototype` → `🚧 Đang code` → `✅ Xong`.

## Mini App (khách hàng)

| # | Chức năng | Trạng thái | Spec | Prototype |
|---|---|---|---|---|
| 01 | **Menu đồ ăn & nước** | 🎨 Prototype | [01-menu.md](01-menu.md) | [menu.html](../prototype/menu.html) |
| 02 | **Tích điểm khách hàng** (loyalty) | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |
| 03 | **Phí giao hàng** (liên kết BE giao hàng) | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |
| 04 | **Thanh toán ZaloPay / chuyển khoản** | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |
| 05 | **Thông báo cho khách** (OA/ZNS) | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |

## Tích hợp hệ thống

| # | Chức năng | Trạng thái | Spec | Prototype |
|---|---|---|---|---|
| 06 | **Đẩy đơn lên Sapo** | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |

## Dashboard quản trị (admin)

| # | Chức năng | Trạng thái | Spec | Prototype |
|---|---|---|---|---|
| 07 | **Đăng nhập 2FA** | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |
| 08 | **Quản lý menu / đơn / điểm / thông báo / giao hàng / Sapo** | 📝 Chờ xác nhận | _(sắp)_ | _(sắp)_ |

## Nền tảng (đã dựng)

| Hạng mục | Trạng thái |
|---|---|
| Cấu trúc `docs/{specs,prototype,assets}` | ✅ Xong |
| README deploy dev/production | ✅ Xong |
| Dữ liệu menu trích từ ảnh (`assets/data/menu.json`) | ✅ Xong (❓ chờ chủ quán duyệt giá) |
| Brand tokens (`assets/brand/brand.md` + `prototype/shared/brand.css`) | ✅ Xong |

---

### Nhật ký thay đổi

- **2026-08-27** — Khởi tạo dự án Hikari Vegetarian Cafe: cấu trúc docs, README deploy, trích menu từ ảnh,
  spec + prototype tính năng **Menu**. Các tính năng 02–08 chờ xác nhận điểm tích hợp trước khi viết spec.
