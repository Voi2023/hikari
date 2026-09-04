/* Hikari — VOUCHER / MÃ ƯU ĐÃI (spec 11). Nguồn dùng chung cho:
 *   · mini app  — kho ưu đãi (voucher.html) và màn chọn mã trong checkout (shared/checkout.js)
 *   · dashboard — màn tạo/sửa/tạm dừng mã (admin/voucher.html)
 *
 * LUẬT LỚN NHẤT, đừng để lạc mất khi code thật:
 *   ❗ MỖI ĐƠN CHỈ DÙNG ĐƯỢC MỘT MÃ. Chọn mã khác là THAY mã đang chọn, không cộng dồn.
 *      Giống Grab: một ô "Ưu đãi" duy nhất trong đơn, không có chỗ cho mã thứ hai.
 *      Ở prototype luật này nằm trong `applyVoucher()`; bản thật phải chốt ở SERVER lúc
 *      POST /api/v1/orders — client chỉ là bước chọn cho khách dễ nhìn, không phải chốt chặn.
 *
 * Bản thật: bảng `vouchers` + `voucher_redemptions` (spec 11 §6). Mini app đọc qua
 * GET /api/v1/vouchers/available?branchId&mode&subtotal, dashboard qua /api/v1/admin/vouchers.
 *
 * ⚠️ Mọi con số (giá trị giảm, đơn tối thiểu, hạn mức, số lượt) là DỮ LIỆU MẪU để duyệt UX —
 *    ❓ chờ chủ quán chốt từng chương trình.
 */

var VOUCHER_KEY = 'hikari_vouchers_cfg';    // bảng mã (dashboard sửa)
var VOUCHER_WALLET_KEY = 'hikari_voucher_wallet';  // mã bí mật khách đã lưu vào kho
var VOUCHER_USED_KEY = 'hikari_voucher_used';      // số lượt khách đã dùng, theo mã

/* ==== Kiểu mã ====
   PERCENT — giảm % trên tiền món, PHẢI có trần (maxDiscount) nếu không một đơn to là lỗ.
   AMOUNT  — giảm số tiền cố định trên tiền món.
   FREESHIP— giảm phí giao, tối đa `value` (0 = miễn phí toàn bộ). Chỉ có nghĩa với đơn giao hàng. */
var VOUCHER_TYPE_LABEL = { PERCENT: 'Giảm %', AMOUNT: 'Giảm tiền', FREESHIP: 'Miễn phí giao' };
var VOUCHER_MODE_LABEL = { dine: 'Tại quán', takeaway: 'Mang về', delivery: 'Giao hàng' };

/* Ngày tương đối → 'YYYY-MM-DD'. Prototype mở lúc nào cũng phải còn mã đang chạy:
   ghi ngày cứng thì vài tuần nữa mở ra thấy mọi mã đều hết hạn, tưởng hỏng. */
function vDate(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ==== Danh mục mã mẫu ====
   visibility PUBLIC = tự hiện trong kho ưu đãi của mọi khách
              SECRET = chỉ ai có mã (in trên tờ rơi, gửi ZNS riêng) nhập tay mới thấy
   stackPoints = có được dùng CHUNG với đổi điểm (spec 02) hay không. Mặc định cho phép;
                 chương trình sâu (giảm 15% cả đơn) thì tắt, để không chồng hai lần giảm. */
function voucherDefaults() {
  return [
    {
      code: 'HIKARI30', title: 'Giảm 30% tối đa 30.000đ', desc: 'Mừng Mini App Hikari — áp dụng mọi hình thức nhận hàng.',
      type: 'PERCENT', value: 30, maxDiscount: 30000, minOrder: 100000,
      modes: ['dine', 'takeaway', 'delivery'], branchIds: [], hours: null,
      startAt: vDate(-7), endAt: vDate(21),
      quota: 500, used: 213, perUser: 2, firstOrderOnly: false,
      stackPoints: true, visibility: 'PUBLIC', status: 'ACTIVE'
    },
    {
      code: 'FREESHIP20', title: 'Miễn phí giao tối đa 20.000đ', desc: 'Đơn giao hàng từ 120.000đ, trong bán kính phục vụ.',
      type: 'FREESHIP', value: 20000, maxDiscount: 20000, minOrder: 120000,
      modes: ['delivery'], branchIds: [], hours: null,
      startAt: vDate(-3), endAt: vDate(14),
      quota: 300, used: 96, perUser: 4, firstOrderOnly: false,
      stackPoints: true, visibility: 'PUBLIC', status: 'ACTIVE'
    },
    {
      code: 'TRUA20', title: 'Giảm 20.000đ khung giờ vắng', desc: 'Chỉ từ 14:00 đến 17:00 — kéo khách vào giờ bếp rảnh.',
      type: 'AMOUNT', value: 20000, maxDiscount: 20000, minOrder: 80000,
      modes: ['dine', 'takeaway'], branchIds: [], hours: { from: '14:00', to: '17:00' },
      startAt: vDate(-10), endAt: vDate(30),
      quota: 0, used: 148, perUser: 8, firstOrderOnly: false,
      stackPoints: true, visibility: 'PUBLIC', status: 'ACTIVE'
    },
    {
      code: 'CHAOBAN50', title: 'Giảm 50.000đ cho đơn đầu tiên', desc: 'Chỉ dùng một lần, cho khách chưa từng đặt đơn nào.',
      type: 'AMOUNT', value: 50000, maxDiscount: 50000, minOrder: 150000,
      modes: ['dine', 'takeaway', 'delivery'], branchIds: [], hours: null,
      startAt: vDate(-30), endAt: vDate(60),
      quota: 1000, used: 402, perUser: 1, firstOrderOnly: true,
      stackPoints: true, visibility: 'SECRET', status: 'ACTIVE'
    },
    {
      code: 'HIKARIVIP', title: 'Giảm 35.000đ cho khách thân thiết', desc: 'Mã gửi riêng qua ZNS — khách nhập tay mới thấy.',
      type: 'AMOUNT', value: 35000, maxDiscount: 35000, minOrder: 100000,
      modes: ['dine', 'takeaway', 'delivery'], branchIds: [], hours: null,
      startAt: vDate(-4), endAt: vDate(20),
      quota: 120, used: 38, perUser: 1, firstOrderOnly: false,
      stackPoints: true, visibility: 'SECRET', status: 'ACTIVE'
    },
    {
      code: 'THANHTHAI15', title: 'Giảm 15% tại Thành Thái', desc: 'Riêng chi nhánh Thành Thái — không cộng dồn với đổi điểm.',
      type: 'PERCENT', value: 15, maxDiscount: 25000, minOrder: 0,
      modes: ['dine', 'takeaway', 'delivery'], branchIds: ['CN01'], hours: null,
      startAt: vDate(-2), endAt: vDate(10),
      quota: 200, used: 41, perUser: 3, firstOrderOnly: false,
      stackPoints: false, visibility: 'PUBLIC', status: 'ACTIVE'
    },
    {
      code: 'TET2026', title: 'Giảm 40.000đ mừng năm mới', desc: 'Chương trình đã kết thúc — giữ lại để xem báo cáo.',
      type: 'AMOUNT', value: 40000, maxDiscount: 40000, minOrder: 200000,
      modes: ['dine', 'takeaway', 'delivery'], branchIds: [], hours: null,
      startAt: vDate(-60), endAt: vDate(-5),
      quota: 400, used: 400, perUser: 1, firstOrderOnly: false,
      stackPoints: true, visibility: 'PUBLIC', status: 'ACTIVE'
    },
    {
      code: 'SAPCHAY', title: 'Giảm 25.000đ — đang tạm dừng', desc: 'Quán tắt tay vì bếp quá tải; bật lại khi sẵn sàng.',
      type: 'AMOUNT', value: 25000, maxDiscount: 25000, minOrder: 90000,
      modes: ['dine', 'takeaway', 'delivery'], branchIds: [], hours: null,
      startAt: vDate(-5), endAt: vDate(25),
      quota: 150, used: 12, perUser: 2, firstOrderOnly: false,
      stackPoints: true, visibility: 'PUBLIC', status: 'PAUSED'
    }
  ];
}

/* ==== Đọc / ghi bảng mã ==== */
function vouchersAll() {
  try {
    var raw = localStorage.getItem(VOUCHER_KEY);
    if (!raw) return voucherDefaults();
    var list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : voucherDefaults();
  } catch (e) { return voucherDefaults(); }
}
function saveVouchers(list) { try { localStorage.setItem(VOUCHER_KEY, JSON.stringify(list)); } catch (e) {} }
function resetVouchers() { try { localStorage.removeItem(VOUCHER_KEY); } catch (e) {} }
function voucherByCode(code) {
  var c = String(code || '').trim().toUpperCase();
  return vouchersAll().filter(function (v) { return v.code === c; })[0] || null;
}

/* ==== Kho của khách ====
   Mã PUBLIC ai cũng thấy. Mã SECRET chỉ vào kho khi khách nhập đúng — nhập đúng một lần
   là lưu lại, lần sau khỏi nhớ (đúng như Grab). */
function walletCodes() {
  try { return JSON.parse(localStorage.getItem(VOUCHER_WALLET_KEY) || '[]'); } catch (e) { return []; }
}
function saveWallet(codes) { try { localStorage.setItem(VOUCHER_WALLET_KEY, JSON.stringify(codes)); } catch (e) {} }
function addToWallet(code) {
  var c = String(code || '').trim().toUpperCase();
  var w = walletCodes();
  if (w.indexOf(c) < 0) { w.push(c); saveWallet(w); }
}
function myVouchers() {
  var w = walletCodes();
  return vouchersAll().filter(function (v) {
    return v.visibility === 'PUBLIC' || w.indexOf(v.code) >= 0;
  });
}

/* Số lượt khách đã dùng từng mã (thật thì đếm ở bảng voucher_redemptions, KHÔNG tin client). */
function voucherUsedByMe(code) {
  try { return (JSON.parse(localStorage.getItem(VOUCHER_USED_KEY) || '{}'))[code] || 0; } catch (e) { return 0; }
}
/* Chỉ dùng cho prototype: trả kho và số lượt về như mới, để duyệt lại luồng từ đầu.
   Bản thật KHÔNG có hàm này — lượt dùng là dữ liệu đối soát, không ai xoá được từ máy khách. */
function resetVoucherUsage() {
  try { localStorage.removeItem(VOUCHER_WALLET_KEY); localStorage.removeItem(VOUCHER_USED_KEY); } catch (e) {}
}
function markVoucherUsed(code) {
  try {
    var m = JSON.parse(localStorage.getItem(VOUCHER_USED_KEY) || '{}');
    m[code] = (m[code] || 0) + 1;
    localStorage.setItem(VOUCHER_USED_KEY, JSON.stringify(m));
  } catch (e) {}
}

/* ==== Trạng thái một mã (tính ra tại thời điểm hỏi, không lưu sẵn cờ rồi chạy cron đi sửa) ====
     PAUSED    — quán tắt tay
     SCHEDULED — chưa tới ngày bắt đầu
     EXPIRED   — quá ngày kết thúc
     USED_UP   — hết lượt của cả chương trình
     ACTIVE    — đang chạy */
function voucherState(v, now) {
  if (v.status === 'PAUSED') return 'PAUSED';
  var d = now || new Date();
  var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (v.startAt && today < v.startAt) return 'SCHEDULED';
  if (v.endAt && today > v.endAt) return 'EXPIRED';
  if (v.quota && v.used >= v.quota) return 'USED_UP';
  return 'ACTIVE';
}

function vMinutes(hhmm) {
  var p = String(hhmm || '').split(':');
  return (+p[0] || 0) * 60 + (+p[1] || 0);
}
function inHours(h, now) {
  if (!h || !h.from || !h.to) return true;
  var d = now || new Date();
  var m = d.getHours() * 60 + d.getMinutes();
  var f = vMinutes(h.from), t = vMinutes(h.to);
  return t > f ? (m >= f && m < t) : (m >= f || m < t);   // qua nửa đêm
}
function vndText(n) { return (n || 0).toLocaleString('vi-VN') + 'đ'; }
function dmyText(iso) {
  if (!iso) return '—';
  var p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

/* ==== Kiểm một mã có dùng được cho ĐƠN NÀY không ====
   ctx = { subtotal, packaging, ship, mode, branchId, isFirstOrder, now }
   Trả { ok, reason } — `reason` là câu khách đọc hiểu và biết phải làm gì, không phải mã lỗi.
   Nói "còn thiếu 32.000đ" khác hẳn "không đủ điều kiện": một câu bán thêm được món, câu kia thì không. */
function voucherCheck(v, ctx) {
  ctx = ctx || {};
  var st = voucherState(v, ctx.now);
  if (st === 'PAUSED') return { ok: false, reason: 'Chương trình đang tạm dừng' };
  if (st === 'SCHEDULED') return { ok: false, reason: 'Bắt đầu từ ' + dmyText(v.startAt) };
  if (st === 'EXPIRED') return { ok: false, reason: 'Đã hết hạn ' + dmyText(v.endAt) };
  if (st === 'USED_UP') return { ok: false, reason: 'Chương trình đã hết lượt' };

  if (v.perUser && voucherUsedByMe(v.code) >= v.perUser) {
    return { ok: false, reason: 'Bạn đã dùng hết ' + v.perUser + ' lượt của mã này' };
  }
  if (v.firstOrderOnly && ctx.isFirstOrder === false) {
    return { ok: false, reason: 'Chỉ dành cho đơn đầu tiên' };
  }
  if (v.modes && v.modes.length && v.modes.indexOf(ctx.mode) < 0) {
    return { ok: false, reason: 'Chỉ áp dụng cho đơn ' + v.modes.map(function (m) { return VOUCHER_MODE_LABEL[m].toLowerCase(); }).join(' / ') };
  }
  if (v.branchIds && v.branchIds.length && v.branchIds.indexOf(ctx.branchId) < 0) {
    return { ok: false, reason: 'Chỉ áp dụng tại ' + v.branchIds.map(voucherBranchName).join(', ') };
  }
  if (!inHours(v.hours, ctx.now)) {
    return { ok: false, reason: 'Chỉ áp dụng khung giờ ' + v.hours.from + '–' + v.hours.to };
  }
  var base = (ctx.subtotal || 0) + (ctx.packaging || 0);
  if (v.minOrder && base < v.minOrder) {
    return { ok: false, reason: 'Đơn tối thiểu ' + vndText(v.minOrder) + ' — còn thiếu ' + vndText(v.minOrder - base) };
  }
  if (v.type === 'FREESHIP' && !(ctx.ship > 0)) {
    return { ok: false, reason: 'Chưa có phí giao để giảm' };
  }
  return { ok: true, reason: '' };
}

/* Tên chi nhánh cho câu điều kiện. shared/branches.js có thể chưa nạp (trang admin nào đó
   quên thẻ script) — khi đó hiện mã chi nhánh còn hơn hiện "undefined". */
function voucherBranchName(id) {
  if (typeof BRANCHES === 'undefined') return id;
  var b = BRANCHES.filter(function (x) { return x.id === id; })[0];
  return b ? b.name : id;
}

/* ==== Tính tiền giảm ====
   Tách hẳn hai túi tiền: `food` giảm trên tiền món, `ship` giảm trên phí giao.
   Gộp một số rồi trừ vào tổng là chỗ đẻ ra lỗi "giảm giá ăn cả phí ship" — quán chịu
   phần phí giao đó mà không ai thấy trên hoá đơn.
   Giảm % làm tròn XUỐNG nghìn cho hoá đơn dễ đọc. */
function voucherDiscount(v, ctx) {
  var zero = { food: 0, ship: 0 };
  if (!v) return zero;
  if (!voucherCheck(v, ctx).ok) return zero;
  var subtotal = ctx.subtotal || 0;
  var ship = ctx.ship || 0;

  if (v.type === 'FREESHIP') {
    return { food: 0, ship: Math.min(ship, v.value ? v.value : ship) };
  }
  if (v.type === 'PERCENT') {
    var raw = Math.floor(subtotal * v.value / 100 / 1000) * 1000;
    if (v.maxDiscount) raw = Math.min(raw, v.maxDiscount);
    return { food: Math.min(raw, subtotal), ship: 0 };
  }
  return { food: Math.min(v.value, subtotal), ship: 0 };     // AMOUNT
}
function voucherTotalOff(v, ctx) { var d = voucherDiscount(v, ctx); return d.food + d.ship; }

/* ==== MỘT MÃ / MỘT ĐƠN ====
   Hàm chọn mã cho đơn. Trả về mã mới — chứ KHÔNG thêm vào danh sách nào cả: chỗ giữ mã
   trong đơn là một ô đơn (`order.voucherCode`), không phải mảng. Muốn đổi mã thì gọi lại
   hàm này, mã cũ tự rời đi. Đây là chỗ luật "mỗi đơn một mã" được thực thi ở prototype.
   Trả { ok, code, reason } để chỗ gọi hiện thẳng lý do khi mã không dùng được. */
function applyVoucher(code, ctx) {
  var v = voucherByCode(code);
  if (!v) return { ok: false, code: null, reason: 'Mã không tồn tại' };
  if (v.visibility === 'SECRET') {
    // Nhập đúng mã bí mật thì lưu vào kho, lần sau khỏi gõ lại.
    var chk0 = voucherCheck(v, ctx);
    if (chk0.ok) addToWallet(v.code);
  }
  var chk = voucherCheck(v, ctx);
  if (!chk.ok) return { ok: false, code: null, reason: chk.reason };
  return { ok: true, code: v.code, reason: '' };
}

/* Danh sách mã cho MÀN CHỌN của khách: dùng được lên trước (giảm nhiều nhất trước),
   không dùng được vẫn hiện nhưng mờ + kèm lý do — ẩn đi thì khách tưởng mã bị mất. */
function voucherOptions(ctx) {
  return myVouchers().map(function (v) {
    var chk = voucherCheck(v, ctx);
    return { v: v, ok: chk.ok, reason: chk.reason, off: chk.ok ? voucherTotalOff(v, ctx) : 0 };
  }).sort(function (a, b) {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return b.off - a.off;
  });
}
function usableVoucherCount(ctx) {
  return voucherOptions(ctx).filter(function (o) { return o.ok; }).length;
}

/* Nhãn ngắn cho thẻ voucher (kho ưu đãi, màn chọn, dashboard). */
function voucherValueLabel(v) {
  if (v.type === 'PERCENT') return 'Giảm ' + v.value + '%' + (v.maxDiscount ? ' tối đa ' + vndText(v.maxDiscount) : '');
  if (v.type === 'FREESHIP') return v.value ? 'Giảm phí giao tới ' + vndText(v.value) : 'Miễn phí giao';
  return 'Giảm ' + vndText(v.value);
}
function voucherCondLabel(v) {
  var parts = [];
  parts.push(v.minOrder ? 'Đơn từ ' + vndText(v.minOrder) : 'Không cần đơn tối thiểu');
  if (v.modes && v.modes.length < 3) parts.push(v.modes.map(function (m) { return VOUCHER_MODE_LABEL[m]; }).join(' · '));
  if (v.branchIds && v.branchIds.length) parts.push(v.branchIds.map(voucherBranchName).join(', '));
  if (v.hours) parts.push(v.hours.from + '–' + v.hours.to);
  if (v.firstOrderOnly) parts.push('đơn đầu tiên');
  return parts.join(' · ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { vouchersAll: vouchersAll, voucherCheck: voucherCheck, voucherDiscount: voucherDiscount };
}
