# 01 — Menu đồ ăn & nước

Trạng thái: 🎨 Prototype · Prototype: [`../prototype/menu.html`](../prototype/menu.html) · Dữ liệu: [`../assets/data/menu.json`](../assets/data/menu.json)

## 1. Mục tiêu & phạm vi

**Làm:** hiển thị menu (mì signature, tô tự chọn 4 bước, cà phê, latte/trà sữa, món nước nhà làm), cho khách
chọn món + topping/tuỳ chọn, thêm vào giỏ, xem tạm tính. **Nguồn dữ liệu**: `assets/data/menu.json` (giai đoạn
prototype) → về sau là bảng `menu_items` do dashboard quản lý.

**Không làm (ở spec này):** thanh toán, phí ship, tích điểm, đẩy Sapo — thuộc spec 02–06. Menu chỉ dừng ở
"chọn món → giỏ hàng → tạm tính".

## 2. Personas & user story

- **US-1** — *Là khách*, tôi muốn xem menu theo nhóm (đồ ăn/đồ uống) để chọn món nhanh.
  - Given menu có món còn/hết, When mở app, Then thấy danh sách nhóm, món hết hiển thị mờ + nhãn "Tạm hết", không thêm được.
- **US-2** — *Là khách*, tôi muốn đặt **Yaki Udon** và chọn sốt (Shoyu/Tomyum) vì món này bắt buộc chọn sốt.
  - Given món có nhóm tuỳ chọn bắt buộc, When bấm thêm mà chưa chọn, Then chặn + nhắc chọn.
- **US-3** — *Là khách*, tôi muốn **tự tạo tô** theo 4 bước (mì → topping → rau → nước dùng) và thấy giá cộng dồn.
  - Given chọn Mì Udon (19k) + Nước Miso 1 phần (17k) + Đậu hủ (5k), When xem, Then tạm tính = 41.000đ.
- **US-4** — *Là khách mang về*, tôi muốn biết có **phụ phí đóng gói +5.000đ** khi chọn "mang về".

## 3. Luồng nghiệp vụ

```text
Mở app → tải menu (JSON/API) → chọn nhóm → chọn món
   ├─ món thường: + vào giỏ
   ├─ món có tuỳ chọn (Yaki Udon: sốt): mở sheet chọn → + vào giỏ
   └─ tô tự chọn: wizard 4 bước → tính giá → + vào giỏ
→ Giỏ hàng: sửa số lượng / xoá → tạm tính (+ phụ phí đóng gói nếu mang về)
→ (chuyển tiếp sang luồng đặt hàng — spec sau)
```

## 4. Màn hình / UI

Xem prototype [`menu.html`](../prototype/menu.html). Gồm:
- Tab nhóm: **Mì** · **Tô tự chọn** · **Cà phê** · **Latte & trà sữa** · **Nước nhà làm**.
- Thẻ món: tên (VI + EN), giá, mô tả, topping kèm theo, nhãn 🌶️ cay / "Tạm hết".
- Sheet tuỳ chọn (Yaki Udon: chọn sốt).
- Wizard "Tô tự chọn" 4 bước, tính giá realtime.
- Giỏ hàng nổi + tạm tính, chọn hình thức: **Tại quán / Mang về / Giao hàng** (mang về +5.000đ).

## 5. API & dữ liệu

### REST (envelope chuẩn)

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/v1/menu` | Toàn bộ menu (nhóm + món + tuỳ chọn). Public (không cần login). |
| `GET` | `/api/v1/menu/:itemId` | Chi tiết 1 món. |

`data` của `GET /menu` theo shape `assets/data/menu.json` (categories → items/steps). List rỗng → `[]`.

### Model Prisma (dự kiến)

```prisma
model MenuCategory { id String @id; name String; nameEn String?; sortOrder Int; items MenuItem[] }
model MenuItem {
  id String @id            // slug: "tamago-ramen"
  categoryId String
  name String; nameEn String?
  price Int                // VND, integer — KHÔNG float
  description String?
  toppingsIncluded String[] // topping kèm sẵn
  spicy Boolean @default(false)
  available Boolean @default(true)
  options Json?            // nhóm tuỳ chọn (vd chọn sốt)
  category MenuCategory @relation(fields: [categoryId], references: [id])
  @@map("menu_items")
}
```
> "Tô tự chọn" (build-your-own) mô hình hoá bằng các `MenuItem` thành phần + nhóm `step` — hoặc bảng riêng
> `menu_build_steps`. ❓ chốt khi dashboard quản lý menu.

### DTO / contract (`@hikari/shared`)

`MenuCategoryDto`, `MenuItemDto`, `MenuOptionGroupDto`, `CartLineDto` — dùng zod, FE & BE cùng import.

### Giá tiền

- **Integer VND** (không dùng float). Tạm tính = Σ(giá món + tuỳ chọn) + phụ phí đóng gói (nếu mang về).
- Nước dùng ở "tô tự chọn" có 2 mức: **1 phần** vs **1 chén** — UI phải cho chọn rõ.

## 6. Tích hợp ngoài

Không có ở spec này (menu là dữ liệu nội bộ). Về sau menu do **dashboard** quản lý (bật/tắt món, đổi giá).

## 7. Edge case & bảo mật

- Món **hết** (`available: false`): hiển thị mờ + "Tạm hết", **không** thêm được vào giỏ.
- Tuỳ chọn **bắt buộc** chưa chọn → chặn thêm.
- Giá đổi giữa lúc khách xem: khi đặt hàng phải **tính lại giá ở server** (không tin giá client gửi).
- Menu là **public** (không cần đăng nhập để xem); giỏ hàng lưu local đến khi đặt.
- Diacritics tiếng Việt (NFC) hiển thị đúng: "Cà phê muối hồng", "Ngưu bàng chiên"...

## 8. Tiêu chí hoàn thành (Acceptance)

- [ ] Hiển thị đủ 5 nhóm với dữ liệu khớp `menu.json`.
- [ ] Món hết không thêm được; món bắt buộc tuỳ chọn phải chọn mới thêm.
- [ ] Tô tự chọn tính đúng giá cộng dồn (kiểm bằng ca US-3 = 41.000đ).
- [ ] Mang về cộng +5.000đ vào tạm tính.
- [ ] Server tính lại giá khi đặt (chống sửa giá phía client).

## 9. Câu hỏi mở (❓ cần chủ quán xác nhận)

1. **Giá & còn/hết**: dữ liệu lấy từ 2 ảnh (mì bản 3/2025, đồ uống bản 10/2024). Giá hiện tại có đúng không?
   Các món đánh dấu ✗ (Kombucha, Ginger Ale, Nước bổ huyết) còn bán không?
2. Có ảnh chụp **từng món** để hiển thị đẹp không? (hiện chỉ có ảnh menu in)
3. "Tô tự chọn" — nước dùng chọn **1 phần** hay **1 chén** là mặc định? Có bắt buộc chọn nước không?
4. Có phân biệt **size** hay **ghi chú món** (ít cay, không hành...) không?
