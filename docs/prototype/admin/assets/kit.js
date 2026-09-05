/* Hikari admin prototype — lớp mỏng trên @hikari/design-tokens.
   Không framework: prototype phải mở được bằng cách bấm đúp file HTML (file://), nên
   dùng script cổ điển, không dùng ES module (Chrome chặn module qua file://).

   Bảng nghĩa dưới đây là BẢN SAO của packages/ui-kit/src/meta/status-meta.ts.
   Sửa một bên thì sửa cả hai — prototype là thứ đem đi duyệt với chủ quán, lệch nhãn
   ở đây nghĩa là duyệt sai. */
const META = {
  order: {
    NEW:        ['amber', 'Đơn mới'],
    CONFIRMED:  ['blue',  'Đã xác nhận'],
    PREPARING:  ['blue',  'Đang chế biến'],
    READY:      ['blue',  'Sẵn sàng'],
    DELIVERING: ['amber', 'Đang giao'],
    COMPLETED:  ['green', 'Hoàn tất'],
    CANCELLED:  ['red',   'Đã huỷ'],
    REFUNDED:   ['gray',  'Đã hoàn tiền'],
  },
  fulfilment: {
    DINE_IN:  ['gray',  'Tại quán'],
    TAKEAWAY: ['blue',  'Mang về'],
    DELIVERY: ['amber', 'Giao hàng'],
  },
  payment: {
    UNPAID:   ['gray',  'Chưa thanh toán'],
    PENDING:  ['amber', 'Chờ thanh toán'],
    PAID:     ['green', 'Đã thanh toán'],
    FAILED:   ['red',   'Thanh toán lỗi'],
    REFUNDED: ['gray',  'Đã hoàn tiền'],
  },
  method: { COD: ['gray', 'Tiền mặt / COD'], ZALOPAY: ['blue', 'ZaloPay'], BANK_TRANSFER: ['gray', 'Chuyển khoản'] },
  shipment: {
    PENDING:   ['gray',  'Chờ tìm tài xế'],
    ASSIGNED:  ['blue',  'Đã có tài xế'],
    PICKING:   ['blue',  'Đang đến lấy'],
    ON_ROUTE:  ['amber', 'Đang giao'],
    DELIVERED: ['green', 'Đã giao'],
    FAILED:    ['red',   'Giao thất bại'],
    CANCELLED: ['gray',  'Đã huỷ chuyến'],
  },
  sync: {
    PENDING:  ['gray',  'Chờ đồng bộ'],
    RETRYING: ['amber', 'Đang thử lại'],
    SYNCED:   ['green', 'Đã đồng bộ'],
    FAILED:   ['red',   'Lỗi đồng bộ'],
    SKIPPED:  ['gray',  'Bỏ qua'],
    // Đơn đã vào Sapo bằng TAY (nhập file hoặc gõ lại). Phải là một trạng thái riêng, không
    // gộp vào "đã đồng bộ": ngày bật API lên mà đẩy lại mấy đơn này là nhân đôi doanh thu bên Sapo.
    MANUAL:   ['blue',  'Đã nhập tay'],
  },
  notify: {
    DRAFT:     ['gray',  'Nháp'],
    SCHEDULED: ['blue',  'Đã hẹn giờ'],
    SENDING:   ['amber', 'Đang gửi'],
    SENT:      ['green', 'Đã gửi'],
    FAILED:    ['red',   'Gửi lỗi'],
  },
  channel: { ZNS: ['blue', 'ZNS (Zalo)'], OA: ['blue', 'Zalo OA'], IN_APP: ['gray', 'Trong Mini App'] },
  tier: { MEMBER: ['gray', 'Thành viên'], SILVER: ['blue', 'Bạc'], GOLD: ['amber', 'Vàng'] },
  role: { owner: ['amber', 'Chủ quán'], manager: ['blue', 'Quản lý'], staff: ['gray', 'Nhân viên'] },
  // Chi nhánh (spec 09): PAUSED do người ở quán tắt, CLOSED là ngoài giờ mở cửa — hai chuyện khác nhau.
  branch: { OPEN: ['green', 'Đang nhận đơn'], CLOSED: ['gray', 'Ngoài giờ mở cửa'], PAUSED: ['red', 'Tạm nghỉ'] },
  // Voucher (spec 11): bốn kiểu "không dùng được" có cách xử lý khác hẳn nhau —
  // hết lượt thì nâng hạn mức, hết hạn thì gia hạn, tạm dừng thì bật lại, chưa tới ngày thì chờ.
  // Máy in (spec 12): ba kiểu "không in được" cần ba hành động khác nhau —
  // mất kết nối thì cắm lại dây, hết giấy thì thay cuộn, tắt là do người chủ động tắt.
  printer: {
    ONLINE:   ['green', 'Sẵn sàng'],
    OFFLINE:  ['red',   'Mất kết nối'],
    NO_PAPER: ['amber', 'Hết giấy'],
    DISABLED: ['gray',  'Đang tắt'],
  },
  voucher: {
    ACTIVE:    ['green', 'Đang chạy'],
    SCHEDULED: ['blue',  'Chưa tới ngày'],
    PAUSED:    ['red',   'Tạm dừng'],
    EXPIRED:   ['gray',  'Hết hạn'],
    USED_UP:   ['amber', 'Hết lượt'],
  },
}

/** Nhãn + màu badge cho một mã trạng thái. `kind` bắt buộc: cùng mã FAILED mang nghĩa
 *  khác nhau ở thanh toán / giao hàng / đồng bộ Sapo. */
function meta(kind, code) {
  const m = (META[kind] || {})[code]
  return { color: m ? m[0] : 'gray', label: m ? m[1] : code }
}
function badge(kind, code) {
  const m = meta(kind, code)
  return `<span class="badge ${m.color}">${m.label}</span>`
}
function optionsOf(kind, selected) {
  return Object.keys(META[kind]).map(k =>
    `<option value="${k}"${k === selected ? ' selected' : ''}>${META[kind][k][1]}</option>`).join('')
}

/* ---- Định dạng ---- */
const vnd = n => (n || 0).toLocaleString('vi-VN')
const money = n => `<span class="price">${vnd(n)}</span>`
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}
const hhmm = iso => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const dmy = iso => new Date(iso).toLocaleDateString('vi-VN')

/* ---- Toast + Modal (dùng class .toast/.modal-overlay của tokens.css) ---- */
let toastTimer
function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach(t => t.remove())
  const el = document.createElement('div')
  el.className = 'toast'
  el.innerHTML = msg
  document.body.appendChild(el)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.remove(), ms)
}

/** Modal. `persistent` = bấm ra nền KHÔNG đóng (dùng cho form có nhập liệu — bấm hụt
 *  ra ngoài làm mất sạch nội dung đang gõ mà không cảnh báo), đổi lại luôn hiện nút ×. */
function modal({ title, sub, body, actions = '', lg = false, persistent = false }) {
  closeModal()
  const ov = document.createElement('div')
  ov.className = 'modal-overlay'
  ov.innerHTML = `
    <div class="modal ${lg ? 'modal-lg' : ''}" role="dialog" aria-modal="true">
      <div class="row-flex" style="justify-content:space-between;align-items:flex-start">
        <h3>${title}</h3>
        ${persistent ? '<button class="btn btn-ghost btn-sm" data-close aria-label="Đóng" style="margin:-6px -6px 0 0"><i class="ti ti-x"></i></button>' : ''}
      </div>
      ${sub ? `<p class="sub">${sub}</p>` : ''}
      ${body}
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>`
  ov.addEventListener('click', e => { if (e.target === ov && !persistent) closeModal() })
  ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal))
  document.body.appendChild(ov)
  return ov
}
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()) }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

/* ---- Vai trò đang đăng nhập (mô phỏng RBAC spec 07 §3) ----
   Bền qua chuyển trang bằng sessionStorage để duyệt được luồng "staff thấy gì / owner thấy gì". */
const ROLE_KEY = 'hikari_proto_role'
// 'admin' ở đây là quyền MỞ màn tài khoản/nhật ký. Quản lý xem được nhật ký (cần cho
// đối soát ca), nhưng tạo tài khoản và reset 2FA vẫn chỉ chủ quán — khoá trong chính màn đó.
// 'print' là quyền SỬA MẪU IN. Bấm in phiếu/hoá đơn thì đi theo quyền 'orders' — thu ngân
// phải in được hoá đơn cho khách, chỉ không được đổi mẫu.
const ROLE_CAN = {
  owner:   ['orders', 'menu', 'points', 'notify', 'ship', 'sapo', 'report', 'admin', 'branch', 'promo', 'print'],
  manager: ['orders', 'menu', 'points', 'notify', 'ship', 'sapo', 'report', 'admin', 'branch', 'promo', 'print'],
  staff:   ['orders', 'ship'],
}
// Tổng số nhóm quyền — tính ra thay vì viết số cứng, thêm quyền mới không phải nhớ sửa chỗ hiển thị.
const PERM_TOTAL = ROLE_CAN.owner.length
const USERS = {
  owner:   { name: 'Cô Hạnh',  email: 'chuquan@hikari.vn' },
  manager: { name: 'Minh Anh', email: 'quanly@hikari.vn' },
  staff:   { name: 'Bảo Trân', email: 'thungan@hikari.vn' },
}
function role() { try { return sessionStorage.getItem(ROLE_KEY) || 'manager' } catch { return 'manager' } }
function setRole(r) { try { sessionStorage.setItem(ROLE_KEY, r) } catch {} location.reload() }
function can(perm) { return ROLE_CAN[role()].includes(perm) }
/** Chặn thao tác ngoài quyền — và nói RÕ vì sao, thay vì chỉ làm nút xám.
 *  Nút xám không lý do là thứ khiến nhân viên tưởng hệ thống hỏng. */
function guard(perm, fn) {
  return function (...a) {
    if (!can(perm)) return toast(`<i class="ti ti-lock"></i> Vai trò <b>${meta('role', role()).label}</b> không có quyền này`)
    return fn.apply(this, a)
  }
}
