// Nguồn chân lý NHÃN + MÀU trạng thái của Hikari — dùng chung mini-app / admin / api.
// Fork từ DMCL ui-kit (domain giao vận) → thay bằng domain F&B của quán.
//
// CẤM tự viết nhãn trạng thái trong view. Luôn dùng statusLabel/…Label + <StatusBadge>.
// Lý do: nhãn xuất hiện ở ≥3 nơi (bảng đơn admin, màn theo dõi đơn của khách, ZNS gửi khách).
// Viết tay từng chỗ thì khách đọc "Đang làm" trong app còn nhân viên thấy "Đang chế biến" —
// cùng một đơn, hai cách gọi, và không ai biết bên nào là đúng khi đối soát.

export type BadgeColor = 'blue' | 'green' | 'amber' | 'red' | 'gray'
export type Locale = 'vi' | 'en'

export interface StatusMeta {
  color: BadgeColor
  vi: string
  en: string
}

// ---- Trạng thái ĐƠN HÀNG (vòng đời chính) --------------------------------
// NEW → CONFIRMED → PREPARING → READY → (DELIVERING) → COMPLETED
//                                     ↘ CANCELLED / REFUNDED
export const STATUS_META: Record<string, StatusMeta> = {
  NEW:        { color: 'amber', vi: 'Đơn mới',        en: 'New' },
  CONFIRMED:  { color: 'blue',  vi: 'Đã xác nhận',    en: 'Confirmed' },
  PREPARING:  { color: 'blue',  vi: 'Đang chế biến',  en: 'Preparing' },
  READY:      { color: 'blue',  vi: 'Sẵn sàng',       en: 'Ready' },
  DELIVERING: { color: 'amber', vi: 'Đang giao',      en: 'Delivering' },
  COMPLETED:  { color: 'green', vi: 'Hoàn tất',       en: 'Completed' },
  CANCELLED:  { color: 'red',   vi: 'Đã huỷ',         en: 'Cancelled' },
  REFUNDED:   { color: 'gray',  vi: 'Đã hoàn tiền',   en: 'Refunded' },
}

// Nhãn HÀNH ĐỘNG (động từ trên nút) — tách khỏi nhãn trạng thái vì nút là "làm gì tiếp",
// không phải "đang ở đâu": nút ghi "Xác nhận" chứ không phải "Đã xác nhận".
export const ACTION_META: Record<string, { vi: string; en: string }> = {
  confirm:        { vi: 'Xác nhận đơn',      en: 'Confirm' },
  startPreparing: { vi: 'Bắt đầu chế biến',  en: 'Start preparing' },
  markReady:      { vi: 'Báo món xong',      en: 'Mark ready' },
  startDelivery:  { vi: 'Giao cho tài xế',   en: 'Hand to driver' },
  complete:       { vi: 'Hoàn tất đơn',      en: 'Complete' },
  cancel:         { vi: 'Huỷ đơn',           en: 'Cancel' },
  refund:         { vi: 'Hoàn tiền',         en: 'Refund' },
  retrySync:      { vi: 'Đồng bộ lại Sapo',  en: 'Retry Sapo sync' },
  resendNotify:   { vi: 'Gửi lại thông báo', en: 'Resend notification' },
}

export function statusLabel(status: string, locale: Locale = 'vi'): string {
  const m = STATUS_META[status]
  return m ? m[locale] : status
}

export function statusColor(status: string): BadgeColor {
  return STATUS_META[status]?.color ?? 'gray'
}

export function actionLabel(action: string, locale: Locale = 'vi'): string {
  const m = ACTION_META[action]
  return m ? m[locale] : action
}

// ---- Hình thức nhận hàng (spec 01/03) ------------------------------------
export const FULFILMENT_META: Record<string, StatusMeta> = {
  DINE_IN:  { color: 'gray',  vi: 'Tại quán',   en: 'Dine-in' },
  TAKEAWAY: { color: 'blue',  vi: 'Mang về',    en: 'Takeaway' },
  DELIVERY: { color: 'amber', vi: 'Giao hàng',  en: 'Delivery' },
}

// ---- Thanh toán (spec 04 — ZaloPay / COD / chuyển khoản) -----------------
export const PAYMENT_META: Record<string, StatusMeta> = {
  UNPAID:   { color: 'gray',  vi: 'Chưa thanh toán',  en: 'Unpaid' },
  PENDING:  { color: 'amber', vi: 'Chờ thanh toán',   en: 'Pending' },
  PAID:     { color: 'green', vi: 'Đã thanh toán',    en: 'Paid' },
  FAILED:   { color: 'red',   vi: 'Thanh toán lỗi',   en: 'Failed' },
  REFUNDED: { color: 'gray',  vi: 'Đã hoàn tiền',     en: 'Refunded' },
}

export const PAYMENT_METHOD_META: Record<string, { vi: string; en: string }> = {
  COD:           { vi: 'Tiền mặt / COD',  en: 'Cash / COD' },
  ZALOPAY:       { vi: 'ZaloPay',         en: 'ZaloPay' },
  BANK_TRANSFER: { vi: 'Chuyển khoản',    en: 'Bank transfer' },
}

// ---- Giao hàng (spec 03 — đối tác BE) ------------------------------------
export const SHIPMENT_META: Record<string, StatusMeta> = {
  PENDING:   { color: 'gray',  vi: 'Chờ tìm tài xế',  en: 'Finding driver' },
  ASSIGNED:  { color: 'blue',  vi: 'Đã có tài xế',    en: 'Driver assigned' },
  PICKING:   { color: 'blue',  vi: 'Đang đến lấy',    en: 'Picking up' },
  ON_ROUTE:  { color: 'amber', vi: 'Đang giao',       en: 'On route' },
  DELIVERED: { color: 'green', vi: 'Đã giao',         en: 'Delivered' },
  FAILED:    { color: 'red',   vi: 'Giao thất bại',   en: 'Failed' },
  CANCELLED: { color: 'gray',  vi: 'Đã huỷ chuyến',   en: 'Cancelled' },
}

// ---- Đồng bộ Sapo (spec 06) ----------------------------------------------
export const SYNC_META: Record<string, StatusMeta> = {
  PENDING:  { color: 'gray',  vi: 'Chờ đồng bộ',   en: 'Pending' },
  RETRYING: { color: 'amber', vi: 'Đang thử lại',  en: 'Retrying' },
  SYNCED:   { color: 'green', vi: 'Đã đồng bộ',    en: 'Synced' },
  FAILED:   { color: 'red',   vi: 'Lỗi đồng bộ',   en: 'Failed' },
  SKIPPED:  { color: 'gray',  vi: 'Bỏ qua',        en: 'Skipped' },
}

// ---- Thông báo cho khách (spec 05) ---------------------------------------
export const NOTIFY_META: Record<string, StatusMeta> = {
  DRAFT:     { color: 'gray',  vi: 'Nháp',        en: 'Draft' },
  SCHEDULED: { color: 'blue',  vi: 'Đã hẹn giờ',  en: 'Scheduled' },
  SENDING:   { color: 'amber', vi: 'Đang gửi',    en: 'Sending' },
  SENT:      { color: 'green', vi: 'Đã gửi',      en: 'Sent' },
  FAILED:    { color: 'red',   vi: 'Gửi lỗi',     en: 'Failed' },
}

export const CHANNEL_META: Record<string, { vi: string; en: string }> = {
  ZNS:    { vi: 'ZNS (Zalo)',    en: 'ZNS (Zalo)' },
  OA:     { vi: 'Zalo OA',       en: 'Zalo OA' },
  IN_APP: { vi: 'Trong Mini App', en: 'In-app' },
}

// ---- Hạng khách & điểm (spec 02) -----------------------------------------
export const TIER_META: Record<string, StatusMeta> = {
  MEMBER: { color: 'gray',  vi: 'Thành viên', en: 'Member' },
  SILVER: { color: 'blue',  vi: 'Bạc',        en: 'Silver' },
  GOLD:   { color: 'amber', vi: 'Vàng',       en: 'Gold' },
}

// ---- Vai trò admin (spec 07 §3 RBAC) -------------------------------------
export const ROLE_META: Record<string, StatusMeta> = {
  owner:   { color: 'amber', vi: 'Chủ quán',     en: 'Owner' },
  manager: { color: 'blue',  vi: 'Quản lý',      en: 'Manager' },
  staff:   { color: 'gray',  vi: 'Nhân viên',    en: 'Staff' },
}

// ---- Tra cứu chung -------------------------------------------------------
// Một hàm cho mọi bảng thay vì 8 cặp label/color gần như y hệt. Trả về cả nhãn lẫn màu
// vì chỗ nào cần nhãn thì hầu như luôn cần màu badge đi kèm.
const REGISTRY: Record<string, Record<string, StatusMeta>> = {
  order: STATUS_META,
  fulfilment: FULFILMENT_META,
  payment: PAYMENT_META,
  shipment: SHIPMENT_META,
  sync: SYNC_META,
  notify: NOTIFY_META,
  tier: TIER_META,
  role: ROLE_META,
}

export type MetaKind = keyof typeof REGISTRY

export function meta(kind: MetaKind, code: string, locale: Locale = 'vi'): { label: string; color: BadgeColor } {
  const m = REGISTRY[kind]?.[code]
  return { label: m ? m[locale] : code, color: m?.color ?? 'gray' }
}
