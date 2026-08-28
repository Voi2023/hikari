// Nguồn nhãn + màu trạng thái/hành động — đồng bộ với docs/specs/02 & backend transitions.ts.
// CẤM tự viết nhãn trạng thái trong view; luôn dùng statusLabel/actionLabel + StatusBadge.

export type BadgeColor = 'blue' | 'green' | 'amber' | 'red' | 'gray'
export type Locale = 'vi' | 'en'

export interface StatusMeta {
  color: BadgeColor
  vi: string
  en: string
}

// Trạng thái đơn giao (SELF) — khớp spec 02 §2
export const STATUS_META: Record<string, StatusMeta> = {
  NEW:          { color: 'gray',  vi: 'Mới',            en: 'New' },
  WAITING_HOLD: { color: 'amber', vi: 'Chờ giữ hàng',   en: 'Waiting hold' },
  READY:        { color: 'blue',  vi: 'Sẵn sàng',       en: 'Ready' },
  PLANNED:      { color: 'blue',  vi: 'Đã lên phiếu',   en: 'Planned' },
  ASSIGNED:     { color: 'blue',  vi: 'Đã gán',         en: 'Assigned' },
  ON_ROUTE:     { color: 'amber', vi: 'Đang giao',      en: 'On route' },
  DELIVERED:    { color: 'green', vi: 'Đã giao',        en: 'Delivered' },
  FAILED:       { color: 'red',   vi: 'Giao thất bại',  en: 'Failed' },
  RETURNED:     { color: 'gray',  vi: 'Đã trả hàng',    en: 'Returned' },
  CANCELLED:    { color: 'red',   vi: 'Đã huỷ',         en: 'Cancelled' },
  TO_3PL:       { color: 'blue',  vi: 'Chuyển 3PL',     en: 'To 3PL' },
}

// Nhãn hành động (động từ) — khớp spec 02 §4
export const ACTION_META: Record<string, { vi: string; en: string }> = {
  markHold:       { vi: 'Xác nhận giữ hàng', en: 'Mark held' },
  unhold:         { vi: 'Bỏ giữ hàng',        en: 'Unhold' },
  route3PL:       { vi: 'Chuyển GHTK',        en: 'Route to 3PL' },
  addToPlan:      { vi: 'Thêm vào phiếu',     en: 'Add to plan' },
  removeFromPlan: { vi: 'Gỡ khỏi phiếu',      en: 'Remove from plan' },
  assign:         { vi: 'Gán tài',            en: 'Assign' },
  unassign:       { vi: 'Huỷ gán',            en: 'Unassign' },
  startRoute:     { vi: 'Bắt đầu giao',       en: 'Start route' },
  deliver:        { vi: 'Giao thành công',    en: 'Deliver' },
  fail:           { vi: 'Giao thất bại',      en: 'Fail' },
  return:         { vi: 'Trả hàng',           en: 'Return' },
  rePlan:         { vi: 'Xếp tài lại',        en: 'Re-plan' },
  cancel:         { vi: 'Huỷ đơn',            en: 'Cancel' },
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

// ---- Module Bảo hành — khớp shared/warranty-state-machine (hai luồng đối tác CUSTOMER | STORE)
export const WARRANTY_STATUS_META: Record<string, StatusMeta> = {
  NEW:                    { color: 'blue',  vi: 'Mới tiếp nhận',                en: 'New' },
  PENDING_INSPECTION:     { color: 'blue',  vi: 'Chờ kiểm tra / phân công',     en: 'Pending inspection' },
  INSPECTING:             { color: 'blue',  vi: 'Đang kiểm tra (KTV)',          en: 'Inspecting' },
  DIAGNOSIS_REVIEW:       { color: 'amber', vi: 'Chờ điều phối quyết định',     en: 'Diagnosis review' },
  INTERNAL_REPAIRING:     { color: 'blue',  vi: 'Đang sửa (nội bộ)',            en: 'Repairing (internal)' },
  TRANSFERRED_TO_PARTNER: { color: 'amber', vi: 'Chờ đối tác tiếp nhận',        en: 'Awaiting acceptance' },
  // Luồng đối tác — chung
  ACCEPTED:               { color: 'blue',  vi: 'Đã tiếp nhận',                 en: 'Accepted' },
  REPAIRING:              { color: 'blue',  vi: 'Đang sửa chữa',                en: 'Repairing' },
  COST_APPROVAL_PENDING:  { color: 'amber', vi: 'Chờ duyệt chi phí phát sinh',  en: 'Cost approval pending' },
  ON_HOLD_PARTS:          { color: 'amber', vi: 'Chờ linh kiện',                en: 'On hold — awaiting parts' },
  WARRANTY_REJECTED:      { color: 'red',   vi: 'Từ chối bảo hành',             en: 'Warranty rejected' },
  REPAIR_COMPLETED:       { color: 'green', vi: 'Đã sửa xong',                  en: 'Repair completed' },
  // Luồng CUSTOMER
  HOME_VISIT_SCHEDULED:   { color: 'amber', vi: 'Hẹn đến nhà khách',            en: 'Home visit scheduled' },
  TECH_DISPATCHED:        { color: 'blue',  vi: 'Đã điều kỹ thuật',             en: 'Technician dispatched' },
  ARRIVED_AT_CUSTOMER:    { color: 'blue',  vi: 'Đã đến nhà khách',             en: 'Arrived at customer' },
  GOODS_COLLECTED:        { color: 'blue',  vi: 'Đã mang hàng về',              en: 'Goods collected' },
  CLOSED_COMPLETED:       { color: 'gray',  vi: 'Hoàn thành sửa chữa — đóng phiếu', en: 'Repair completed — closed' },
  CLOSED_UNREPAIRABLE:    { color: 'gray',  vi: 'Không thể sửa chữa — đóng phiếu', en: 'Unrepairable — closed' },
  // Luồng STORE
  PICKUP_SCHEDULED:       { color: 'amber', vi: 'Hẹn lấy hàng',                 en: 'Pickup scheduled' },
  PICKUP_DISPATCHED:      { color: 'blue',  vi: 'Đã điều người lấy hàng',       en: 'Pickup staff dispatched' },
  PICKED_UP:              { color: 'blue',  vi: 'Đã lấy hàng',                  en: 'Picked up' },
  RETURNED_TO_STORE:      { color: 'green', vi: 'Đã trả hàng cho store',        en: 'Returned to store' },
  CLOSED:                 { color: 'gray',  vi: 'Kết thúc bảo hành',            en: 'Warranty closed' },
  // Nội bộ / legacy
  PAID_REPAIR_CONFIRM:    { color: 'amber', vi: 'Chờ khách đồng ý sửa dịch vụ', en: 'Awaiting paid-repair consent' },
  RETURN_SCHEDULED:       { color: 'amber', vi: 'Đã hẹn trả hàng về Cty',       en: 'Return scheduled' },
  READY_FOR_RETURN:       { color: 'green', vi: 'Sẵn sàng trả khách',           en: 'Ready for return' },
  RETURNED_CLOSED:        { color: 'gray',  vi: 'Đã trả khách / đóng phiếu',    en: 'Returned / closed' },
  UNREPAIRABLE:           { color: 'gray',  vi: 'Không thể sửa chữa',           en: 'Unrepairable' },
  CANCELLED:              { color: 'gray',  vi: 'Khách hủy yêu cầu',            en: 'Cancelled' },
}

export const WARRANTY_ACTION_META: Record<string, { vi: string; en: string }> = {
  PENDING_INSPECTION:     { vi: 'Chuyển kiểm tra',                en: 'Send to inspection' },
  INSPECTING:             { vi: 'Phân công kiểm tra',            en: 'Assign inspection' },
  DIAGNOSIS_REVIEW:       { vi: 'Gửi kết quả chẩn đoán',         en: 'Submit diagnosis' },
  INTERNAL_REPAIRING:     { vi: 'Sửa nội bộ',                    en: 'Repair in-house' },
  TRANSFERRED_TO_PARTNER: { vi: 'Chuyển đối tác',                en: 'Transfer to partner' },
  ACCEPTED:               { vi: 'Tiếp nhận',                     en: 'Accept' },
  HOME_VISIT_SCHEDULED:   { vi: 'Hẹn đến nhà khách',             en: 'Schedule home visit' },
  TECH_DISPATCHED:        { vi: 'Điều kỹ thuật',                 en: 'Dispatch technician' },
  ARRIVED_AT_CUSTOMER:    { vi: 'Đã đến nhà khách',              en: 'Arrived at customer' },
  GOODS_COLLECTED:        { vi: 'Xác nhận đã mang hàng về',      en: 'Confirm goods collected' },
  PICKUP_SCHEDULED:       { vi: 'Hẹn lấy hàng',                  en: 'Schedule pickup' },
  PICKUP_DISPATCHED:      { vi: 'Điều người lấy hàng',           en: 'Dispatch pickup staff' },
  PICKED_UP:              { vi: 'Xác nhận đã lấy hàng',          en: 'Confirm pickup' },
  REPAIRING:              { vi: 'Bắt đầu sửa chữa',              en: 'Start repair' },
  COST_APPROVAL_PENDING:  { vi: 'Gửi báo giá chi phí',           en: 'Submit cost report' },
  ON_HOLD_PARTS:          { vi: 'Tạm giữ — chờ linh kiện',       en: 'Put on hold (parts)' },
  WARRANTY_REJECTED:      { vi: 'Từ chối bảo hành',              en: 'Reject warranty' },
  PAID_REPAIR_CONFIRM:    { vi: 'Chuyển sửa dịch vụ (tính phí)', en: 'Move to paid repair' },
  REPAIR_COMPLETED:       { vi: 'Báo sửa xong',                  en: 'Mark repair completed' },
  RETURNED_TO_STORE:      { vi: 'Đã trả hàng cho store',         en: 'Returned to store' },
  CLOSED:                 { vi: 'Kết thúc bảo hành',             en: 'End warranty' },
  CLOSED_COMPLETED:       { vi: 'Hoàn thành sửa chữa — đóng phiếu', en: 'Complete repair — close' },
  CLOSED_UNREPAIRABLE:    { vi: 'Không thể sửa chữa — đóng phiếu', en: 'Unrepairable — close' },
  RETURN_SCHEDULED:       { vi: 'Hẹn trả về Cty',                en: 'Schedule return' },
  READY_FOR_RETURN:       { vi: 'Sẵn sàng trả khách',            en: 'Mark ready for return' },
  RETURNED_CLOSED:        { vi: 'Trả khách & đóng phiếu',        en: 'Return & close' },
  UNREPAIRABLE:           { vi: 'Báo không sửa được',            en: 'Mark unrepairable' },
  CANCELLED:              { vi: 'Huỷ phiếu',                     en: 'Cancel ticket' },
}

export const WARRANTY_PRIORITY_META: Record<string, StatusMeta> = {
  URGENT: { color: 'red',   vi: 'Khẩn cấp',     en: 'Urgent' },
  HIGH:   { color: 'amber', vi: 'Cao',          en: 'High' },
  NORMAL: { color: 'blue',  vi: 'Bình thường',  en: 'Normal' },
}

export function warrantyStatusLabel(status: string, locale: Locale = 'vi'): string {
  const m = WARRANTY_STATUS_META[status]
  return m ? m[locale] : status
}
export function warrantyStatusColor(status: string): BadgeColor {
  return WARRANTY_STATUS_META[status]?.color ?? 'gray'
}
export function warrantyActionLabel(status: string, locale: Locale = 'vi'): string {
  const m = WARRANTY_ACTION_META[status]
  return m ? m[locale] : warrantyStatusLabel(status, locale)
}
export function warrantySlaBadge(t: { slaStatus?: string; slaDueAt?: string | null }, locale: Locale = 'vi') {
  if (t.slaStatus === 'PAUSED') return { label: locale === 'en' ? 'Paused' : 'Tạm dừng', color: 'gray' as BadgeColor }
  if (!t.slaDueAt) return { label: '—', color: 'gray' as BadgeColor }
  const h = Math.round((new Date(t.slaDueAt).getTime() - Date.now()) / 3600_000)
  if (h < 0) return { label: locale === 'en' ? `Overdue ${-h}h` : `Trễ ${-h}h`, color: 'red' as BadgeColor }
  if (h <= 6) return { label: locale === 'en' ? `${h}h left` : `Còn ${h}h`, color: 'amber' as BadgeColor }
  return { label: locale === 'en' ? 'On track' : 'Đúng hẹn', color: 'blue' as BadgeColor }
}
