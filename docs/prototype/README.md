# Prototype — Hikari Vegetarian Cafe

Prototype HTML **chạy được bằng cách mở trực tiếp trong trình duyệt** (không cần server, không cần build).
Đây vừa là bản demo UX để duyệt với chủ quán, vừa là **bảng kiểm thử trực quan** cho từng chức năng.

## Cách dùng

- Mở [`index.html`](index.html) — trang tổng, liệt kê mọi prototype + trạng thái + checklist kiểm thử.
- Hoặc mở thẳng file từng chức năng, ví dụ [`menu.html`](menu.html).

## Quy ước

- Mỗi chức năng trong [`../specs/`](../specs/) có **1 file prototype** tương ứng ở đây.
- Dùng chung brand: [`shared/brand.css`](shared/brand.css) (màu/typography theo `../assets/brand/brand.md`).
- Dữ liệu mẫu nhúng sẵn trong file để chạy offline; **nguồn thật** là [`../assets/data/menu.json`](../assets/data/menu.json).
- Prototype **không** gọi API/secret thật — chỉ mô phỏng luồng & giao diện.

## Danh sách

| Prototype | Chức năng | Trạng thái |
|---|---|---|
| [menu.html](menu.html) | 01 — Menu đồ ăn & nước | 🎨 Sẵn sàng duyệt |
| _(sắp)_ | 02–08 | Chờ xác nhận điểm tích hợp |
