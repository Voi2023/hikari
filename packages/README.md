# `packages/` — UI kit dùng chung của Hikari

Hai package này là **bản fork của UI kit DMCL** (repo [`dmcl-shared`](https://github.com/danhquyen/dmcl-shared)),
đưa vào Hikari dưới dạng **source copy** — **không** cài qua npm/GitHub Packages.

| Thư mục | Tên package | Nội dung |
|---|---|---|
| [`design-tokens/`](design-tokens/) | `@hikari/design-tokens` | `tokens.css` — biến CSS + class dựng sẵn. **Nguồn chân lý giao diện.** |
| [`ui-kit/`](ui-kit/) | `@hikari/ui-kit` | Component Vue 3 + TS (AppShell, Base*, StatusBadge, Form*…) |

> ⚠️ **Chưa cài dependency, chưa chạy `pnpm install`.** Hai `package.json` ở đây mới chỉ *khai báo*
> để sau này nối vào pnpm workspace. Hiện tại kit được tiêu thụ **trực tiếp bằng CSS** trong
> [`docs/prototype/admin/`](../docs/prototype/admin/) — mở file HTML bằng trình duyệt là chạy, không build.

---

## 1. Vì sao fork mà không cài từ registry

`@danhquyen/*` nằm trên GitHub Packages **private**, cài được thì phải có PAT `read:packages` trên
máy dev, CI và máy chủ. Với một quán ăn một chi nhánh, ràng buộc đó đắt hơn thứ nó mua về.
Fork source đổi lại: mất khả năng `npm update` để nhận bản vá của DMCL (xem §4).

Hikari cũng **đổi nghĩa** hai thứ so với bản gốc, nên dù có cài từ registry thì vẫn phải override:

- **Bảng màu** — DMCL là xanh dương doanh nghiệp `#005BAC`; Hikari là matcha `#5F7A4A` + vàng
  sticky-note `#F2C94C` trên nền giấy kem, rút từ logo và 2 tấm menu in.
- **Bảng trạng thái** — DMCL là domain giao vận (`ON_ROUTE`, `TO_3PL`, bảo hành…);
  Hikari là F&B (`PREPARING`, `READY`, đồng bộ Sapo, ZNS…).

## 2. Cái gì đã đổi (và cái gì cố tình giữ nguyên)

**Giữ nguyên 100%** — tên class CSS, tên component, tên prop, cấu trúc thư mục, kiến trúc token
(ANCHOR → DERIVED → COMPONENT). Nhờ vậy mọi ví dụ trong README của DMCL vẫn đúng với Hikari,
và một người từng làm dự án DMCL đọc code này không phải học lại gì.

**Đã đổi:**

| File | Đổi gì |
|---|---|
| `design-tokens/tokens.css` | Khối **ANCHOR** sang màu Hikari; thêm token `--font-script`, `--sidebar-bg`, `--sidebar-line`; thêm khối class riêng của quán (`.brand-logo`, `.price`, `.tag-*`, `.phone`) — **additive**, không sửa class cũ |
| `ui-kit/src/meta/status-meta.ts` | **Viết lại** cho domain quán: `STATUS_META` (đơn), `PAYMENT_META`, `SHIPMENT_META`, `SYNC_META`, `NOTIFY_META`, `FULFILMENT_META`, `TIER_META`, `ROLE_META` + hàm tra chung `meta(kind, code)` |
| `ui-kit/src/components/StatusBadge.vue` | Thêm prop `kind` — cùng mã `FAILED` mang nghĩa khác nhau ở thanh toán / giao hàng / Sapo |
| `ui-kit/src/components/AppShell.vue` | Ký hiệu thu gọn `D` → `H` (font viết tay); khoá sessionStorage `dmcl_nav_rail` → `hikari_nav_rail` |
| `ui-kit/src/composables/useTabs.ts` | Khoá sessionStorage `dmcl_tabs` → `hikari_tabs` |
| cả hai `package.json` | Scope `@danhquyen` → `@hikari`, `private: true`, bỏ `publishConfig` |

Đổi khoá sessionStorage là bắt buộc chứ không phải cho gọn: hai app cùng mở trên `localhost` sẽ
**dùng chung** khoá đó và ghi đè trạng thái tab của nhau.

## 3. Đổi tone màu ở đâu

Chỉ sửa khối `ANCHOR` đầu file [`design-tokens/tokens.css`](design-tokens/tokens.css).
`--brand-dark`, `--brand-deeper`, `--brand-tint`, `--sidebar-bg` **suy tự động** bằng `color-mix()`
— sửa `--brand` một chỗ là sidebar, nút, timeline, focus ring, màn đăng nhập đổi theo.

```css
--brand:#5F7A4A;   /* matcha  — 1 núm kéo theo cả họ brand */
--accent:#F2C94C;  /* vàng sticky-note */
```

**Không hard-code màu trong component hay trong view** — luôn `var(--…)`. Đây là điều khiến bản
đổi tone này gọn được như vậy, và cũng là điều duy nhất giữ cho nó tiếp tục gọn.

## 4. Khi DMCL nâng cấp kit gốc

Không có `npm update` để nhận bản vá. Cách làm khi muốn lấy một thay đổi từ `dmcl-shared`:

```bash
diff -ru ../../dmcl-shared/ui-kit/src packages/ui-kit/src   # xem lệch chỗ nào
```

Chép **từng component** cần lấy, rồi kiểm ba điểm đã liệt kê ở §2 — đó là toàn bộ chỗ hai bên
lệch nhau. Đừng chép đè cả thư mục: `status-meta.ts` sẽ mất sạch bảng trạng thái của quán.

Chiều ngược lại — sửa gì ở đây mà **DMCL cũng nên có** (sửa lỗi component, thêm prop chung) thì
gửi PR về `dmcl-shared` thay vì để hai bên trôi xa nhau.
