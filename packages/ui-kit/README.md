# @dmcl/ui-kit

Thư viện component dùng chung (Vue 3 + TS) cho `apps/internal-web` & `apps/partner-web`.
Component chỉ render **class từ `@dmcl/design-tokens`** (`tokens.css`) — đổi tone ở tokens là cả kit đổi theo.

> Rút ra từ prototype `docs/prototype`. Khi build FE thật: import và cắm vào, không copy-paste giữa 2 app (core.mdc §0, §4b).

## Cài đặt (monorepo)

```ts
// entry app (main.ts): nạp design-tokens một lần
import '@dmcl/ui-kit/tokens.css'
```

## Component

| Component | Dùng cho | Prop chính |
|-----------|----------|-----------|
| `AppShell` | Khung app: sidebar + topbar + slot `tabbar` + nội dung | `portalLabel`, `partner`, `logoSrc`, `title`; slots `nav/user/title/topbar-actions/tabbar` |
| `TabBar` + `useTabs` | Đa-tab bền qua refresh (sessionStorage) | `tabs`, `active`; emit `activate/close` |
| `BaseButton` | Nút | `variant` primary/outline/ghost/danger, `sm`, `icon` |
| `BaseBadge` | Nhãn màu | `color` blue/green/amber/red/gray |
| `StatusBadge` | Nhãn trạng thái đơn (nhãn từ `STATUS_META`) | `status`, `locale` |
| `BasePanel` | Khung `.panel` + tiêu đề | `title`; slots `title/actions` |
| `StatCard` | Thẻ KPI | `label`, `value`; slot `foot` |
| `Toolbar` | Thanh công cụ lọc/hành động | slot |
| `BaseModal` | Modal (440 / `lg` 720) | `v-model`, `title`, `sub`, `lg`, **`persistent`**; slot `actions` |
| `Timeline` | Dòng thời gian | `items: {status,meta,note}[]` |
| `Tabs` | Tab con trong 1 trang (segmented) | `v-model`, `tabs` |
| `FilterableCheckboxList` | Danh sách chọn nhiều CÓ LỌC (core.mdc §10) | `items`, `v-model`, `placeholder` |
| `BaseCombobox` | Select **có tìm kiếm** (single/multi) cho danh mục dài (chi nhánh, site, MC…) | `v-model`, `options[{value,label,meta}]`, `multiple`, `placeholder` |
| `Skeleton` / `ErrorState` | 3 trạng thái tải/lỗi/dữ liệu (rule FE §3d) | `variant` / `message`+emit `retry` |
| `FormField` | Một trường: nhãn + ô nhập + **gợi ý** + **lỗi**, hoặc **hiện chữ khi chỉ đọc** | `label`, `required`, `hint`, `error`, `readonly`+`value`+`readonlyReason`, `labelFor` |
| `FormSection` | Nhóm trường có tiêu đề nhỏ + lưới cột, tự về 1 cột dưới 720px | `title`, `desc`, `cols` 1/2/3, `warn`; slot `actions` |

## Helper

- `statusLabel(status, locale)`, `statusColor(status)`, `actionLabel(action, locale)` — nguồn `STATUS_META` / `ACTION_META` (đồng bộ `docs/specs/02` + backend `transitions.ts`). **CẤM tự viết nhãn trạng thái trong view.**
- `useTabs({ storageKey, initial })` → `{ tabs, active, open, activate, close, reset }` — đa-tab bền qua refresh.

### `BaseModal` — `persistent`

Bấm ra nền **không** đóng modal, và **hiện nút đóng `×`** ở góc phải hàng tiêu đề.
Mặc định `false` — hành vi lẫn giao diện cũ giữ nguyên hoàn toàn.

Bật cho modal có **nhập liệu**: bấm hụt ra nền rất dễ xảy ra, và khi modal đóng thì nội
dung đang gõ mất sạch — không cảnh báo, không hoàn tác. Người dùng thường không nhận ra
mình vừa bấm ra ngoài, nên họ đọc nó là "hệ thống tự nhiên xoá mất dữ liệu".

```vue
<BaseModal v-model="mo" persistent title="Tạo tài khoản">
  …form…
  <template #actions>
    <BaseButton variant="ghost" @click="mo = false">Huỷ</BaseButton>
    <BaseButton variant="primary" @click="luu">Tạo</BaseButton>
  </template>
</BaseModal>
```

Nút `×` đi **kèm** cờ này chứ không phải một prop riêng, vì hai thứ là một quyết định:
bỏ đường thoát bằng cách bấm nền thì phải trả lại một đường thoát nhìn thấy được. Tách làm
hai prop là mở ra tổ hợp *"persistent mà không có nút đóng"* — tức nhốt người dùng, và
không ai chọn tổ hợp đó một cách có chủ ý.

Vẫn nên có nút **Huỷ** trong slot `actions` cho thao tác có hậu quả. Lưu ý slot tên là
**`actions`** — khai nhầm `footer` thì Vue bỏ qua im lặng: nút không hiện và không có lỗi
nào báo.

### Form: hai component này giải quyết cái gì

`tokens.css` có `.field` (nhãn + ô nhập) nhưng không có chỗ cho **dấu bắt buộc**, **câu
gợi ý dưới ô** và **lỗi của riêng trường**. Thiếu ba thứ đó nên mỗi màn tự chế một kiểu —
chỗ `<small>`, chỗ `.field-hint`, chỗ nhét lời giải thích vào `placeholder` (mất luôn khi
người dùng gõ). Nhìn tổng thể thì form các màn lệch nhau, và đó là cảm giác "giao diện
luộm thuộm" mà khó chỉ đúng tên.

Hai điểm đáng chú ý khi dùng:

- **Trường chỉ đọc KHÔNG phải ô nhập bị khoá.** `readonly` render ra chữ trên nền gạch
  đứt, kèm `readonlyReason` nói vì sao. `<input disabled>` vẫn trông như thứ bấm được:
  người dùng bấm, không gõ được, rồi mất vài giây đoán vì sao — rất hay gặp ở hệ tích hợp
  nơi một số trường do hệ khác sở hữu.
- **`desc` của `FormSection` là chỗ nói ràng buộc của cả nhóm** (ví dụ "ERP sở hữu những
  trường này"), thay vì lặp câu đó ở từng trường.

```vue
<FormSection title="Định danh" desc="Mã SKU không đổi được sau khi tạo" :cols="2">
  <FormField label="Mã SKU" required hint="Chữ, số, gạch — không khoảng trắng">
    <input v-model="sku" class="mono" />
  </FormField>
  <FormField label="Tên hàng" required class="ui-rong">
    <input v-model="ten" />
  </FormField>
  <FormField label="Giá vốn" readonly :value="giaVon" readonly-reason="ERP sở hữu trường này" />
</FormSection>
```

`class="ui-rong"` trên một `FormField` cho nó chiếm cả hàng.

## Ví dụ

```vue
<script setup lang="ts">
import { AppShell, TabBar, useTabs, BaseButton, StatusBadge } from '@dmcl/ui-kit'
const { tabs, active, open, activate, close } = useTabs({
  initial: [{ key: 'dashboard', title: 'Bảng điều khiển', icon: 'ti-layout-dashboard' }],
})
</script>

<template>
  <AppShell portal-label="Cổng Nhân viên" logo-src="/logo.png" title="Bảng điều khiển">
    <template #nav>
      <a @click="open({ key: 'orders', title: 'Đơn chờ giao', icon: 'ti-package' })">Đơn chờ giao</a>
    </template>
    <template #tabbar>
      <TabBar :tabs="tabs" :active="active" @activate="activate" @close="close" />
    </template>

    <StatusBadge status="ON_ROUTE" />
    <BaseButton variant="primary" icon="ti-check">Lưu</BaseButton>
  </AppShell>
</template>
```

## Còn có thể bổ sung (khi FE cần)

`DataTable` (bảng + phân trang), `SlaBadge`, `TransitionModal` (render ô ngày giờ/ghi chú theo action def), `DebugConsole`, `BaseSelect`/`BaseInput`. Theo quy tắc: component tái dùng được → thêm vào kit, không để lạc trong `apps/*`.
