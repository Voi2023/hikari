# Bảng theo dõi chức năng — Hikari Vegetarian Cafe

> Cập nhật **đầu tiên** mỗi khi thêm/đổi chức năng. Trạng thái: `📝 Spec` → `🎨 Prototype` → `🚧 Đang code` → `✅ Xong`.

## Mini App (khách hàng)

| # | Chức năng | Trạng thái | Spec | Prototype |
|---|---|---|---|---|
| 01 | **Menu đồ ăn & nước** | 🎨 Prototype | [01-menu.md](01-menu.md) | [menu.html](../prototype/menu.html) |
| 02 | **Tích điểm khách hàng** (loyalty) | 🎨 Prototype | [02-tich-diem.md](02-tich-diem.md) | [tich-diem.html](../prototype/tich-diem.html) |
| 03 | **Phí giao hàng** (BE — be.com.vn) | 🎨 Prototype | [03-phi-giao-hang.md](03-phi-giao-hang.md) | [phi-giao-hang.html](../prototype/phi-giao-hang.html) |
| 04 | **Thanh toán ZaloPay** (đã có merchant) | 🎨 Prototype | [04-thanh-toan-zalopay.md](04-thanh-toan-zalopay.md) | [thanh-toan.html](../prototype/thanh-toan.html) |
| 05 | **Thông báo cho khách** (OA/ZNS + in-app) | 🎨 Prototype | [05-thong-bao.md](05-thong-bao.md) | [thong-bao.html](../prototype/thong-bao.html) |

## Tích hợp hệ thống

| # | Chức năng | Trạng thái | Spec | Prototype |
|---|---|---|---|---|
| 06 | **Đẩy đơn lên Sapo** (chưa có API key) | 🎨 Prototype | [06-day-don-sapo.md](06-day-don-sapo.md) | [sapo.html](../prototype/sapo.html) |

## Dashboard quản trị (admin)

| # | Chức năng | Trạng thái | Spec | Prototype |
|---|---|---|---|---|
| 07 | **Dashboard + đăng nhập 2FA (TOTP)** | 🎨 Prototype | [07-dashboard.md](07-dashboard.md) | [dashboard.html](../prototype/dashboard.html) |

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
