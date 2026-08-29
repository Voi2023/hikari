/* Hikari — danh sách chi nhánh (nguồn dùng chung cho prototype mini app và dashboard).
 *
 * Một file cho cả hai bên: chi nhánh mà mini app hiện khác với chi nhánh dashboard quản lý
 * thì duyệt xong vẫn sai. Thật thì đây là bảng `branches` (spec 09), mini app lấy qua
 * GET /api/v1/branches (chỉ chi nhánh đang nhận đơn), dashboard lấy qua GET /api/v1/admin/branches.
 *
 * ⚠️ Dữ liệu mẫu — giờ mở cửa, hotline, bán kính giao đều ❓ chờ chủ quán chốt.
 */
var BRANCHES = [
  {
    id: 'CN01',
    name: 'Hikari Thành Thái',
    address: '134/1 Đ. Thành Thái, Hòa Hưng, Hồ Chí Minh',
    district: 'Quận 10',
    lat: 10.7751709, lng: 106.664583,
    phone: '028 xxxx 1001',
    open: '07:00', close: '22:00',
    services: { dine: true, takeaway: true, delivery: true },
    radiusKm: 10,
    status: 'OPEN',            // OPEN = đang nhận đơn · PAUSED = tạm nghỉ (ẩn khỏi Mini App)
    pauseReason: '',
    pauseUntil: '',            // '' = nghỉ tới khi bật lại tay
    ordersToday: 27
  },
  {
    id: 'CN02',
    name: 'Hikari Nguyễn Trung Ngạn',
    address: '5/47 Nguyễn Trung Ngạn, Quận 1, Hồ Chí Minh',
    district: 'Quận 1',
    lat: 10.7797, lng: 106.7052,
    phone: '028 xxxx 1002',
    open: '08:00', close: '21:30',
    services: { dine: true, takeaway: true, delivery: true },
    radiusKm: 8,
    status: 'OPEN',
    pauseReason: '',
    pauseUntil: '',
    ordersToday: 15
  }
];

/* Giờ "HH:MM" → số phút, để so sánh với giờ hiện tại. */
function branchMinutes(hhmm) {
  var p = String(hhmm || '').split(':');
  return (+p[0] || 0) * 60 + (+p[1] || 0);
}

/* Chi nhánh có đang nhận đơn ngay lúc này không.
   Hai lý do đóng khác hẳn nhau, đừng gộp làm một:
     PAUSED  — người ở quán chủ động tắt (hết nguyên liệu, cúp điện, nghỉ lễ)
     CLOSED  — ngoài giờ mở cửa, tự động, mai lại mở
   Khách cần đọc đúng lý do mới biết nên chờ hay chọn chi nhánh khác. */
function branchState(b, now) {
  if (b.status === 'PAUSED') return 'PAUSED';
  var d = now || new Date();
  var m = d.getHours() * 60 + d.getMinutes();
  var o = branchMinutes(b.open), c = branchMinutes(b.close);
  var inHours = c > o ? (m >= o && m < c) : (m >= o || m < c);   // qua nửa đêm
  return inHours ? 'OPEN' : 'CLOSED';
}
function branchIsTakingOrders(b, now) { return branchState(b, now) === 'OPEN'; }

/* Khoảng cách đường chim bay (km) — chỉ để gợi ý chi nhánh gần khách.
   Phí và thời gian giao vẫn do đơn vị giao trả lời, app không tự tính. */
function branchDistanceKm(b, lat, lng) {
  var R = 6371, toRad = function (x) { return x * Math.PI / 180 };
  var dLat = toRad(lat - b.lat), dLng = toRad(lng - b.lng);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(b.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BRANCHES: BRANCHES };
