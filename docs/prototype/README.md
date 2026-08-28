# Prototype — Hikari Vegetarian Cafe

Prototype HTML **chạy được bằng cách mở trực tiếp trong trình duyệt** (không cần server, không cần build).
Vừa là bản demo UX để duyệt với chủ quán, vừa là **bảng kiểm thử trực quan** cho từng chức năng.

## Cách dùng

- Mở [`index.html`](index.html) — trang tổng, liệt kê mọi prototype + trạng thái.
- **Mật khẩu mở tài liệu: `hikari@2026`** (hỏi một lần cho cả trình duyệt).
  Đây chỉ là rào cản cho người xem tình cờ, không phải bảo mật — xem [README §6.1](../../README.md#61-khoá-xem-tài-liệu-docs).
- Dashboard quản trị: [`admin/dang-nhap.html`](admin/dang-nhap.html) — mã 2FA mô phỏng là **`123456`**
  (khác với mật khẩu mở tài liệu ở trên).

## Quy ước

- Mỗi chức năng trong [`../specs/`](../specs/) có prototype tương ứng ở đây.
- **Nguồn giao diện duy nhất** là UI kit dùng chung: [`../../packages/design-tokens/tokens.css`](../../packages/design-tokens/tokens.css)
  (fork từ ui-kit DMCL, đổi tone theo logo Hikari — xem [`../../packages/README.md`](../../packages/README.md)).
  Đổi màu cả hệ thống = sửa `--brand` một chỗ.
- Dữ liệu mẫu nhúng sẵn để chạy offline; **nguồn thật** của món là [`../assets/data/menu.json`](../assets/data/menu.json).
- Prototype **không** gọi API/secret thật — chỉ mô phỏng luồng & giao diện.

## Mini App (khách hàng)

| Prototype | Chức năng |
|---|---|
| [menu.html](menu.html) | 01 — Menu đồ ăn & nước |
| [tich-diem.html](tich-diem.html) | 02 — Tích điểm khách hàng |
| [phi-giao-hang.html](phi-giao-hang.html) | 03 — Phí giao hàng (BE) |
| [thanh-toan.html](thanh-toan.html) | 04 — Thanh toán ZaloPay |
| [thong-bao.html](thong-bao.html) | 05 — Thông báo cho khách |
| [sapo.html](sapo.html) | 06 — Đẩy đơn lên Sapo |
| [menu.html](menu.html) → nút *Tiếp tục đặt hàng* | 08 — Đặt hàng: thông tin nhận hàng → phí giao → thanh toán → theo dõi đơn (dùng [`shared/checkout.js`](shared/checkout.js)) |

## Dashboard quản trị — [`admin/`](admin/)

Dựng bằng chính UI kit dùng chung, cùng tên class với component Vue trong `packages/ui-kit`,
nên khi code FE thật chỉ việc thay markup bằng component — giao diện không đổi.

| Màn | Nội dung |
|---|---|
| [admin/dang-nhap.html](admin/dang-nhap.html) | Đăng nhập 2 bước (mật khẩu → TOTP), thiết lập 2FA lần đầu (QR + 8 mã dự phòng), khoá tạm khi sai nhiều |
| [admin/tong-quan.html](admin/tong-quan.html) | KPI ngày, đơn cần xử lý (mô phỏng realtime), doanh thu 7 ngày, cảnh báo cần can thiệp, món bán chạy |
| [admin/don-hang.html](admin/don-hang.html) | Lọc theo trạng thái/hình thức/thanh toán, chi tiết đơn + timeline, chuyển trạng thái theo máy trạng thái |
| [admin/giao-hang.html](admin/giao-hang.html) | Chuyến giao của BE, gán tài xế, đặt lại chuyến lỗi, mô phỏng webhook trạng thái |
| [admin/menu.html](admin/menu.html) | Bật/tắt món còn–hết, sửa giá, đổi thứ tự hiển thị, thêm món |
| [admin/khach-diem.html](admin/khach-diem.html) | Danh sách khách, hạng & tiến độ lên hạng, chỉnh điểm **bắt buộc nhập lý do** |
| [admin/thong-bao.html](admin/thong-bao.html) | Soạn ZNS/OA/in-app, chọn đối tượng, xem trước trên điện thoại, ước tính chi phí, lịch sử gửi |
| [admin/sapo.html](admin/sapo.html) | Trạng thái kết nối, nhật ký đồng bộ, thử lại đơn lỗi (kèm lý do lỗi thật) |
| [admin/bao-cao.html](admin/bao-cao.html) | Doanh thu theo ngày, món bán chạy, khách hàng, kênh & cách thanh toán |
| [admin/tai-khoan.html](admin/tai-khoan.html) | Tài khoản admin, ma trận RBAC, reset 2FA, nhật ký thao tác |

### Mẹo khi duyệt

- **Đổi vai trò**: bấm tên người dùng ở góc dưới trái sidebar → chọn chủ quán / quản lý / nhân viên.
  Mục ngoài quyền **không bị ẩn** mà bị khoá kèm lý do — ẩn hẳn thì người dùng tưởng hệ thống thiếu chức năng.
- **Mô phỏng realtime**: nút *Mô phỏng đơn mới* ở Tổng quan, *Mô phỏng webhook BE* ở Giao hàng.
- Đơn `#H1039` ở màn Sapo **cố tình thử lại vẫn lỗi** — để thấy loại lỗi mà bấm "thử lại" không cứu được
  (món chưa khai mã hàng bên Sapo).

### Cấu trúc thư mục `admin/`

```text
admin/
├─ assets/kit.js     # nhãn trạng thái, định dạng tiền/giờ, toast, modal, mô phỏng RBAC
├─ assets/data.js    # dữ liệu mẫu dùng chung (đơn, menu, khách, thông báo, nhật ký)
├─ assets/shell.js   # sidebar + topbar dựng một chỗ cho cả 9 màn
└─ *.html            # mỗi màn một file, chỉ chứa markup + phần JS riêng của màn đó
```

> `assets/kit.js` chứa **bản sao** bảng nhãn trạng thái của `packages/ui-kit/src/meta/status-meta.ts`.
> Sửa một bên phải sửa cả hai — prototype là thứ đem đi duyệt, lệch nhãn ở đây là duyệt sai.
