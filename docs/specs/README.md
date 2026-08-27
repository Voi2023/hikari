# Specs & quy trình — Hikari Vegetarian Cafe

Thư mục này chứa **tài liệu và quy trình** của dự án. Nguyên tắc bắt buộc của dự án:

> **Mỗi chức năng mới = 1 spec (ở đây) + 1 prototype HTML (`docs/prototype/`), viết TRƯỚC khi code,
> và ghi vào [`FEATURES.md`](FEATURES.md).**

## Cấu trúc

| File | Nội dung |
|---|---|
| [`FEATURES.md`](FEATURES.md) | **Bảng theo dõi mọi chức năng** — trạng thái, link spec + prototype. Luôn cập nhật đầu tiên. |
| [`00-tong-quan.md`](00-tong-quan.md) | Kiến trúc, personas, luồng chung, tích hợp ngoài, quy ước envelope |
| `NN-ten-chuc-nang.md` | Spec từng chức năng (đánh số) |

## Mẫu 1 spec chức năng

Mỗi spec theo bố cục:

1. **Mục tiêu & phạm vi** — làm gì, không làm gì
2. **Personas & user story** — ai dùng, để làm gì (Given/When/Then)
3. **Luồng nghiệp vụ** — các bước, sơ đồ nếu cần
4. **Màn hình / UI** — link tới prototype tương ứng
5. **API & dữ liệu** — endpoint REST (envelope), event realtime, model Prisma, DTO ở `@hikari/shared`
6. **Tích hợp ngoài** — Zalo / giao hàng / ZaloPay / Sapo (nếu có)
7. **Edge case & bảo mật** — định danh, ownership, lỗi external, PII
8. **Tiêu chí hoàn thành (Acceptance)** — checklist nghiệm thu
9. **Câu hỏi mở** — điều chưa chắc, cần chủ quán / PM xác nhận

## Quy trình khi thêm chức năng

1. Thêm dòng vào `FEATURES.md` (trạng thái `📝 Spec`).
2. Viết `docs/specs/NN-ten.md` theo mẫu trên.
3. Dựng `docs/prototype/ten.html` (dùng brand `prototype/shared/brand.css`) để duyệt UX với chủ quán.
4. Cập nhật `FEATURES.md` (`🎨 Prototype` → `🚧 Đang code` → `✅ Xong`).
5. Khi code: contract để ở `packages/shared`; cập nhật spec nếu thực tế khác thiết kế.

## Đánh dấu độ chắc chắn

- Điều **chắc chắn** (trích từ ảnh menu, yêu cầu rõ của chủ quán) → ghi thẳng.
- Điều **giả định / chưa chắc** → gắn nhãn `❓ CẦN XÁC NHẬN` để không nhầm là chốt.
