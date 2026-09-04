/* Hikari Vegetarian Cafe — luồng đặt hàng → thanh toán → giao hàng (prototype)
 *
 * Dùng ở docs/prototype/menu.html: khách bấm "Tiếp tục đặt hàng" trong giỏ.
 * Nối 3 spec lại thành 1 luồng liền mạch để duyệt UX với chủ quán:
 *   08 (đặt hàng) → 03 (phí giao hàng) → 04 (thanh toán ZaloPay) → 02/05/06 (điểm, thông báo, Sapo)
 *   → 11 (voucher — ô "Ưu đãi" ở màn thanh toán, MỖI ĐƠN CHỈ MỘT MÃ).
 *
 * ⚠️ TẤT CẢ ĐỀU MÔ PHỎNG — không gọi API, không gọi BE, không giao dịch ZaloPay thật.
 * Dòng chữ mono `API: ...` trên mỗi màn là endpoint tương ứng trong spec (bật/tắt bằng nút ⓘ).
 *
 * Cách dùng:
 *   <script src="shared/vouchers.js"></script>   (nạp TRƯỚC — checkout đọc bảng mã ở đây)
 *   <script src="shared/checkout.js"></script>
 *   Checkout.start({ lines, mode, subtotal, onDone })
 *     lines: [{ name, opt, price, qty }]  ·  mode: 'dine' | 'takeaway' | 'delivery'
 */
(function (global) {
  'use strict';

  /* ==== Quy tắc nghiệp vụ (con số giả định — ❓ chờ chủ quán chốt) ==== */
  var PACKAGING_FEE = 5000;      // phụ phí đóng gói khi mang về
  var POINT_BLOCK = 100;         // 100 điểm...
  var POINT_VALUE = 10000;       // ...= giảm 10.000đ (spec 02)
  var EARN_PER = 1000;           // 1 điểm / 1.000đ chi tiêu thực (không tính phí ship)
  var HOLD_MINUTES = 15;         // đơn chưa thanh toán tự huỷ sau 15 phút (spec 04)

  /* Sổ địa chỉ của khách. Ở prototype là dữ liệu mẫu trong bộ nhớ; thật thì là bảng `addresses`
     của user (GET/POST /api/v1/me/addresses) — khách tự thêm, sửa, chọn mặc định.
     a3 để xem ca ngoài vùng, a4 để xem ca đối tác giao lỗi. */
  var ADDRESSES = [
    { id: 'a1', label: 'Nhà', detail: '12 Nguyễn Tri Phương', district: 'Quận 10', km: 1.2, kind: 'ok' },
    { id: 'a2', label: 'Công ty', detail: '350 Lê Văn Sỹ', district: 'Quận 3', km: 3.8, kind: 'ok' },
    { id: 'a3', label: 'Nhà bạn', detail: '90 Nguyễn Bình', district: 'Nhà Bè', km: 14.5, kind: 'out' },
    { id: 'a4', label: 'Mô phỏng đối tác giao lỗi/timeout', detail: '1 Đường Test', district: 'Quận 10', km: 2.0, kind: 'error' }
  ];

  /* Khoảng cách ước lượng theo quận (từ quán ở Q10) — CHỈ để prototype có số mà hiển thị.
     Thật thì đơn vị giao tính từ toạ độ, app không tự đoán. */
  var DISTRICTS = {
    'Quận 10': 1.5, 'Quận 11': 2.5, 'Quận 5': 3.0, 'Quận 3': 3.5, 'Quận 1': 5.0,
    'Phú Nhuận': 5.5, 'Tân Bình': 6.0, 'Quận 4': 6.5, 'Bình Thạnh': 7.0, 'Gò Vấp': 8.5,
    'Quận 6': 5.5, 'Tân Phú': 7.5, 'Quận 8': 6.0, 'Quận 7': 11.0, 'TP Thủ Đức': 14.0, 'Nhà Bè': 15.0
  };
  var MAX_KM = 10;   // ❓ bán kính phục vụ — chờ chủ quán & đơn vị giao chốt

  var USER = { name: 'Minh Anh', points: 320, phone: '0903 *** 456', isFirstOrder: false };

  /* Phương thức thanh toán — `modes` là các hình thức nhận hàng dùng được.
     ĐƠN GIAO HÀNG CHỈ TRẢ TRƯỚC QUA ZALOPAY: tài xế là đối tác giao, không thu tiền hộ quán,
     nên không có COD/chuyển khoản cho đơn giao. Tại quán và mang về thì khách trả ở quầy được. */
  var METHODS = [
    { id: 'zalopay', name: 'ZaloPay', sub: 'Ví ZaloPay — quán đã có merchant', badge: 'Zalo<br>Pay',
      modes: ['dine', 'takeaway', 'delivery'] },
    { id: 'vietqr', name: 'Chuyển khoản', sub: 'VietQR — ❓ chờ chủ quán xác nhận', badge: 'QR',
      modes: ['dine', 'takeaway'] },
    { id: 'cod', name: 'Tiền mặt / COD', sub: 'Trả tại quầy khi nhận — ❓ chờ chủ quán xác nhận', badge: '₫',
      modes: ['dine', 'takeaway'] }
  ];
  function methodsFor(mode) {
    return METHODS.filter(function (m) { return m.modes.indexOf(mode) >= 0; });
  }
  /* Đổi hình thức nhận hàng có thể làm phương thức đang chọn hết hợp lệ (chọn COD rồi quay lại
     đổi sang giao hàng) — chuẩn hoá lại thay vì để đơn đi tiếp với phương thức không dùng được. */
  function normalizeMethod() {
    var ok = methodsFor(S.mode).some(function (m) { return m.id === S.method; });
    if (!ok) S.method = methodsFor(S.mode)[0].id;
  }

  /* Nhãn trạng thái — BẢN SAO của packages/ui-kit/src/meta/status-meta.ts (giống admin/assets/kit.js).
     Sửa một bên phải sửa cả hai: khách đọc nhãn trong app, nhân viên đọc nhãn trong dashboard —
     lệch chữ ở đây là hai bên gọi tên khác nhau cho cùng một đơn. */
  var STATUS_VI = {
    NEW: 'Đơn mới', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chế biến', READY: 'Sẵn sàng',
    DELIVERING: 'Đang giao', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã huỷ', REFUNDED: 'Đã hoàn tiền'
  };
  var PAYMENT_VI = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thanh toán lỗi' };

  /* Vòng đời đơn theo hình thức nhận hàng. Dòng phụ chỉ để khách dễ hiểu, KHÔNG thay nhãn chuẩn. */
  var TRACK = {
    delivery: [['CONFIRMED', ''], ['PREPARING', ''], ['READY', 'đang chờ tài xế đến lấy'],
               ['DELIVERING', 'tài xế đang trên đường'], ['COMPLETED', 'đã giao đến bạn']],
    takeaway: [['CONFIRMED', ''], ['PREPARING', ''], ['READY', 'mời bạn ghé lấy'], ['COMPLETED', '']],
    dine: [['CONFIRMED', ''], ['PREPARING', ''], ['READY', 'món đang ra bàn'], ['COMPLETED', '']]
  };
  var MODE_LABEL = { dine: '🍜 Tại quán', takeaway: '🥡 Mang về', delivery: '🛵 Giao hàng' };

  /* ==== State ==== */
  var S = null;
  var root = null;
  var timer = null;
  var lastStep = null;

  var vnd = function (n) { return n.toLocaleString('vi-VN') + 'đ'; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var el = function (id) { return document.getElementById(id); };

  /* ==== Tính tiền (prototype tính ở client; thật thì SERVER tính lại — spec 08 §6) ==== */
  function branchName() { return S.branch ? S.branch.name : 'Hikari Vegetarian Cafe'; }
  function packaging() { return S.mode === 'takeaway' ? PACKAGING_FEE : 0; }
  function ship() { return S.mode === 'delivery' && S.quote.state === 'ok' ? S.quote.fee : 0; }

  /* --- Voucher (spec 11) — MỘT MÃ CHO CẢ ĐƠN, giữ trong MỘT ô `S.voucherCode` ---
     Cố tình không dùng mảng: có mảng là sớm muộn ai đó push mã thứ hai vào. */
  function voucherCtx() {
    return {
      subtotal: S.subtotal, packaging: packaging(), ship: ship(),
      mode: S.mode, branchId: S.branch ? S.branch.id : null,
      isFirstOrder: USER.isFirstOrder, now: new Date()
    };
  }
  function curVoucher() { return S.voucherCode ? voucherByCode(S.voucherCode) : null; }
  /* Hai túi tiền tách bạch: `food` trừ vào tiền món, `ship` trừ vào phí giao.
     Gộp lại thành một số là cách chắc chắn nhất để giảm giá ăn nhầm sang phí ship. */
  function vOff() {
    var v = curVoucher();
    return v ? voucherDiscount(v, voucherCtx()) : { food: 0, ship: 0 };
  }
  /* Mã "sâu" (giảm 15% cả đơn) có thể cấm cộng dồn với đổi điểm — quán không muốn
     giảm hai lần trên cùng một đơn. Cấm thì phải nói ra ở màn điểm, không lặng lẽ bỏ qua. */
  function pointsBlockedByVoucher() {
    var v = curVoucher();
    return !!(v && v.stackPoints === false);
  }
  function maxPointsUsable() {
    if (pointsBlockedByVoucher()) return 0;
    var byPoint = Math.floor(USER.points / POINT_BLOCK);
    // Voucher trừ trước, điểm trừ trên phần còn lại — không cho đổi điểm quá số tiền còn phải trả.
    var byBill = Math.floor((S.subtotal + packaging() - vOff().food) / POINT_VALUE);
    return Math.max(0, Math.min(byPoint, byBill)) * POINT_BLOCK;
  }
  function discount() { return S.usePoints ? (maxPointsUsable() / POINT_BLOCK) * POINT_VALUE : 0; }
  function total() {
    var d = vOff();
    return Math.max(0, S.subtotal + packaging() + ship() - d.food - d.ship - discount());
  }
  /* Điểm cộng tính trên TIỀN THỰC TRẢ cho món (không tính phí ship, đã trừ mọi khuyến mãi):
     cộng điểm trên phần quán đã giảm cho khách là tự trả giá khuyến mãi hai lần. */
  function pointsEarned() {
    return Math.max(0, Math.floor((S.subtotal + packaging() - vOff().food - discount()) / EARN_PER));
  }

  /* Đơn đổi hình thức / đổi địa chỉ thì điều kiện mã có thể không còn đúng (mã miễn phí giao
     trên đơn tại quán, mã riêng chi nhánh khác…). Gỡ mã và NÓI RÕ vì sao — im lặng bỏ mã đi
     là kiểu lỗi khách chỉ phát hiện khi nhìn hoá đơn cuối cùng và mất lòng tin. */
  function syncVoucher() {
    var v = curVoucher();
    if (!v) return;
    // Đơn giao hàng chưa có báo giá thì phí giao đang là 0 — kiểm lúc này sẽ gỡ oan mã miễn phí giao.
    if (S.mode === 'delivery' && S.quote.state !== 'ok') return;
    var chk = voucherCheck(v, voucherCtx());
    if (!chk.ok) {
      S.voucherMsg = 'Đã gỡ mã ' + v.code + ': ' + chk.reason;
      S.voucherCode = null;
    }
    if (pointsBlockedByVoucher()) S.usePoints = false;
  }

  /* ==== Mô phỏng báo giá ship — thật là POST /api/v1/shipping/quote → đối tác giao trả về ==== */
  function requestQuote() {
    var a = ADDRESSES.filter(function (x) { return x.id === S.addressId; })[0];
    S.quote = { state: 'loading' };
    render();
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (a.kind === 'out') {
        S.quote = { state: 'out', km: a.km };
      } else if (a.kind === 'error') {
        S.quote = { state: 'error' };
      } else {
        // Phí & ETA là DO ĐƠN VỊ GIAO CUNG CẤP. Ở prototype mô phỏng theo bán kính cho có số để xem.
        S.quote = { state: 'ok', fee: Math.round((15000 + a.km * 5000) / 1000) * 1000, eta: Math.round(8 + a.km * 3), km: a.km };
      }
      syncVoucher();      // phí giao vừa đổi → mã miễn phí giao / đơn tối thiểu có thể hết hợp lệ
      render();
    }, 900);
  }

  /* ==== Khung màn hình ==== */
  function shell(title, body, foot, opts) {
    opts = opts || {};
    return '' +
      '<div class="co-head">' +
        '<button class="co-back" onclick="Checkout.' + (opts.back || 'close') + '()">‹</button>' +
        '<div class="co-title">' + title + '</div>' +
        '<button class="co-info" onclick="Checkout.toggleNotes()" title="Chú thích API">ⓘ</button>' +
      '</div>' +
      (opts.steps === false ? '' : stepper()) +
      '<div class="co-body">' + body + '</div>' +
      (foot ? '<div class="co-foot">' + foot + '</div>' : '');
  }

  function stepper() {
    var names = ['Thông tin', 'Thanh toán', 'Theo dõi'];
    var cur = (S.step === 'info' || S.step === 'addr') ? 0 : S.step === 'done' ? 2 : 1;   // gate/qr/fail/voucher vẫn thuộc bước thanh toán
    return '<div class="co-steps">' + names.map(function (n, i) {
      return '<span class="co-st ' + (i < cur ? 'done' : i === cur ? 'now' : '') + '">' +
             '<b>' + (i < cur ? '✓' : i + 1) + '</b>' + n + '</span>';
    }).join('<i></i>') + '</div>';
  }

  function note(txt) { return '<div class="co-note">API: ' + esc(txt) + '</div>'; }

  function sumRows(showShip) {
    var d = vOff();
    var h = '<div class="co-row"><span>Tạm tính món</span><b>' + vnd(S.subtotal) + '</b></div>';
    if (packaging()) h += '<div class="co-row"><span>Phụ phí đóng gói (mang về)</span><b>' + vnd(packaging()) + '</b></div>';
    if (showShip && S.mode === 'delivery') {
      h += '<div class="co-row"><span>Phí giao hàng <i class="co-hint">do đơn vị giao cung cấp</i></span><b>' +
           (S.quote.state === 'ok' ? vnd(S.quote.fee) : '—') + '</b></div>';
    }
    // Voucher hiện thành dòng riêng, ghi rõ trừ vào món hay trừ vào phí giao.
    if (d.food) h += '<div class="co-row disc"><span>Ưu đãi ' + esc(S.voucherCode) + '</span><b>−' + vnd(d.food) + '</b></div>';
    if (d.ship) h += '<div class="co-row disc"><span>Ưu đãi ' + esc(S.voucherCode) + ' (phí giao)</span><b>−' + vnd(d.ship) + '</b></div>';
    if (discount()) h += '<div class="co-row disc"><span>Giảm giá (' + maxPointsUsable() + ' điểm)</span><b>−' + vnd(discount()) + '</b></div>';
    h += '<div class="co-row tot"><span>Tổng cộng</span><b>' + vnd(total()) + '</b></div>';
    return h;
  }

  /* ==== Bước 1 — thông tin nhận hàng ==== */
  function viewInfo() {
    var body = '';

    body += '<div class="co-sec"><h4>Hình thức</h4><div class="co-modes">' +
      ['dine', 'takeaway', 'delivery'].map(function (m) {
        return '<button class="' + (S.mode === m ? 'on' : '') + '" onclick="Checkout.setMode(\'' + m + '\')">' + MODE_LABEL[m] + '</button>';
      }).join('') + '</div></div>';

    if (S.mode === 'delivery') {
      body += '<div class="co-sec"><h4>Địa chỉ giao</h4>' +
        ADDRESSES.map(function (a) {
          return '<div class="co-addr ' + (a.id === S.addressId ? 'on' : '') + '" onclick="Checkout.pickAddr(\'' + a.id + '\')">' +
            '<span class="pin">📍</span><div><div><strong>' + esc(a.label) + '</strong> — ' + esc(a.detail) + '</div>' +
            '<div class="co-sub">' + esc(a.district) + ' · ~' + a.km + ' km từ quán' +
            (a.note ? ' · ' + esc(a.note) : '') + '</div></div></div>';
        }).join('') +
        '<button class="co-addnew" onclick="Checkout.openAddr()">＋ Thêm địa chỉ mới</button>' +
        '<div class="co-quote">' + quoteBox() + '</div>' +
        (S.branch ? '<p class="co-fine">Tài xế lấy hàng ở <strong>' + esc(S.branch.name) + '</strong> — ' +
          esc(S.branch.address) + '. Phí giao tính từ chi nhánh này.</p>' : '') +
        note('GET /api/v1/me/addresses · POST /api/v1/shipping/quote { branchId }') + '</div>';
    } else {
      body += '<div class="co-sec"><h4>' + (S.mode === 'dine' ? 'Tại quán' : 'Đến lấy') + '</h4>' +
        '<div class="co-card">📍 <strong>' + esc(branchName()) + '</strong>' +
        (S.branch ? '<div class="co-sub">' + esc(S.branch.address) + ' · mở ' + S.branch.open + '–' + S.branch.close + '</div>' : '') +
        '<div class="co-sub">' + (S.mode === 'dine' ? 'Nhân viên phục vụ tại bàn khi món xong.' : 'Quán báo khi món sẵn sàng, bạn ghé lấy.') + '</div></div></div>';
    }

    body += '<div class="co-sec"><h4>Thời gian</h4><div class="co-modes sm">' +
      [['now', 'Càng sớm càng tốt'], ['later', 'Hẹn giờ']].map(function (t) {
        return '<button class="' + (S.time === t[0] ? 'on' : '') + '" onclick="Checkout.setTime(\'' + t[0] + '\')">' + t[1] + '</button>';
      }).join('') + '</div>' +
      (S.time === 'later' ? '<input class="co-input" type="time" value="' + S.at + '" onchange="Checkout.setAt(this.value)">' : '') +
      '</div>';

    body += '<div class="co-sec"><h4>Người nhận</h4>' +
      '<div class="co-card"><strong>' + USER.name + '</strong>' +
      (S.phoneShared
        ? '<div class="co-sub">' + USER.phone + ' · đã chia sẻ qua Zalo</div>'
        : '<div class="co-sub">Cần số điện thoại để quán/tài xế liên hệ.</div>' +
          '<button class="co-btn ghost sm" onclick="Checkout.sharePhone()">Chia sẻ số điện thoại qua Zalo</button>') +
      '</div>' + note('zmp-sdk getPhoneNumber → POST /api/v1/auth/phone (khách bấm đồng ý)') + '</div>';

    body += '<div class="co-sec"><h4>Ghi chú cho quán</h4>' +
      '<textarea class="co-input" rows="2" placeholder="Ít cay, không hành…" onchange="Checkout.setNote(this.value)">' + esc(S.note) + '</textarea></div>';

    body += '<div class="co-sec"><h4>Đơn của bạn</h4><div class="co-card">' +
      S.lines.map(function (l) {
        return '<div class="co-row"><span>' + l.qty + '× ' + esc(l.name) +
          (l.opt ? '<i class="co-hint">' + esc(l.opt) + '</i>' : '') + '</span><b>' + vnd(l.price * l.qty) + '</b></div>';
      }).join('') + sumRows(true) + '</div></div>';

    var blocked = blockReason();
    var foot = '<div class="co-total"><span>Tổng cộng</span><b>' + vnd(total()) + '</b></div>' +
      '<button class="co-btn" ' + (blocked ? 'disabled' : '') + ' onclick="Checkout.go(\'pay\')">' +
      (blocked || 'Tiếp tục · chọn thanh toán →') + '</button>';

    return shell('Xác nhận đơn', body, foot);
  }

  /* ==== Màn nhập địa chỉ mới ==== */
  function viewAddr() {
    var f = S.form;
    var districts = Object.keys(DISTRICTS);
    var body = '<div class="co-sec"><h4>Đặt tên cho địa chỉ</h4>' +
      '<div class="co-modes sm">' + ['Nhà', 'Công ty', 'Khác'].map(function (l) {
        return '<button class="' + (f.label === l ? 'on' : '') + '" onclick="Checkout.f(\'label\',\'' + l + '\',1)">' + l + '</button>';
      }).join('') + '</div></div>';

    body += '<div class="co-sec"><h4>Số nhà, tên đường <span class="co-req">*</span></h4>' +
      '<input class="co-input" value="' + esc(f.detail) + '" placeholder="VD: 12 Nguyễn Tri Phương" ' +
      'oninput="Checkout.f(\'detail\', this.value)">' +
      (S.formErr === 'detail' ? '<div class="co-err">Chưa nhập số nhà và tên đường.</div>' : '') + '</div>';

    body += '<div class="co-sec"><h4>Phường / Xã</h4>' +
      '<input class="co-input" value="' + esc(f.ward) + '" placeholder="VD: Phường 12" oninput="Checkout.f(\'ward\', this.value)"></div>';

    body += '<div class="co-sec"><h4>Quận / Huyện <span class="co-req">*</span></h4>' +
      '<select class="co-input" onchange="Checkout.f(\'district\', this.value, 1)">' +
      '<option value="">— Chọn quận/huyện —</option>' +
      districts.map(function (d) {
        return '<option value="' + d + '"' + (f.district === d ? ' selected' : '') + '>' + d + '</option>';
      }).join('') + '</select>' +
      (f.district
        ? (DISTRICTS[f.district] > MAX_KM
            ? '<div class="co-alert" style="margin-top:8px">😔 ' + f.district + ' cách quán ~' + DISTRICTS[f.district] +
              ' km, ngoài bán kính giao ' + MAX_KM + ' km. Vẫn lưu được để dùng khi quán mở rộng vùng giao.</div>'
            : '<div class="co-sub" style="margin-top:6px">~' + DISTRICTS[f.district] + ' km từ quán (ước lượng)</div>')
        : '') +
      (S.formErr === 'district' ? '<div class="co-err">Chưa chọn quận/huyện.</div>' : '') + '</div>';

    body += '<div class="co-sec"><h4>Ghi chú cho tài xế</h4>' +
      '<input class="co-input" value="' + esc(f.note) + '" placeholder="Toà B, tầng 3, gọi trước khi đến" oninput="Checkout.f(\'note\', this.value)"></div>';

    body += '<div class="co-sec">' +
      '<button class="co-btn ghost" onclick="Checkout.useLocation()">📍 ' +
      (f.located ? 'Đã ghim vị trí hiện tại' : 'Dùng vị trí hiện tại') + '</button>' +
      '<p class="co-fine">Toạ độ giúp tài xế tìm đúng nhà. Mini app xin quyền vị trí, khách bấm đồng ý mới lấy được — ' +
      'app đổi token sang toạ độ ở server, không tự đọc vị trí ngầm.</p>' +
      note('zmp-sdk getLocation → POST /api/v1/me/addresses') + '</div>';

    var far = f.district && DISTRICTS[f.district] > MAX_KM;
    var foot = '<button class="co-btn" onclick="Checkout.saveAddr()">' +
      (far ? 'Lưu địa chỉ (ngoài vùng giao)' : 'Lưu &amp; giao đến địa chỉ này') + '</button>' +
      '<button class="co-btn link" onclick="Checkout.backInfo()">Huỷ</button>';
    return shell('Địa chỉ mới', body, foot, { back: 'backInfo' });
  }

  function quoteBox() {
    var q = S.quote;
    if (q.state === 'idle') return '';
    if (q.state === 'loading') return '<div class="co-card co-loading"><span class="co-spin"></span>Đang hỏi phí giao từ đối tác…</div>';
    if (q.state === 'out') return '<div class="co-alert">😔 Ngoài vùng giao hàng (' + q.km + ' km). Chọn địa chỉ gần hơn, hoặc đổi sang mang về / tại quán.</div>';
    if (q.state === 'error') return '<div class="co-alert warn">⚠️ Chưa lấy được phí giao (đối tác lỗi/timeout). Thử lại, hoặc đổi hình thức nhận hàng.' +
      '<button class="co-btn ghost sm" onclick="Checkout.retryQuote()">Thử lại</button></div>';
    return '<div class="co-card co-fee"><div class="big">' + vnd(q.fee) + '<span class="co-sub"> phí giao</span></div>' +
      '<div class="co-meta"><span>🛵 ~' + q.eta + ' phút</span><span>📏 ' + q.km + ' km</span><span>đối tác giao</span></div></div>';
  }

  function blockReason() {
    if (S.mode === 'delivery' && S.quote.state !== 'ok') return 'Cần phí giao hợp lệ để tiếp tục';
    if (S.mode !== 'dine' && !S.phoneShared) return 'Cần số điện thoại để tiếp tục';
    return '';
  }

  /* ==== Ô "Ưu đãi" — MỘT ô cho cả đơn (spec 11) ====
     Cố ý chỉ có một ô: giao diện không cho chỗ nào để dán mã thứ hai, nên khách không kỳ vọng
     cộng dồn rồi thất vọng ở bước cuối. */
  function voucherRow() {
    var ctx = voucherCtx();
    var v = curVoucher();
    var d = vOff();
    var n = usableVoucherCount(ctx);

    var inner = v
      ? '<div class="co-vsel">' +
          '<span class="co-vtag">' + esc(v.code) + '</span>' +
          '<div class="co-vb"><div>' + esc(v.title) + '</div>' +
            '<div class="co-sub">' + (d.food + d.ship ? 'Giảm ' + vnd(d.food + d.ship) + ' cho đơn này' : esc(voucherValueLabel(v))) + '</div></div>' +
          '<button class="co-vx" onclick="Checkout.clearVoucher()" title="Bỏ mã">✕</button>' +
        '</div>' +
        '<button class="co-addnew" onclick="Checkout.openVoucher()">Đổi mã khác</button>'
      : '<button class="co-addnew" onclick="Checkout.openVoucher()">🎟️ ' +
        (n ? 'Có ' + n + ' mã dùng được — chọn ưu đãi' : 'Nhập / chọn mã ưu đãi') + '</button>';

    return '<div class="co-sec"><h4>Ưu đãi <span class="co-hint" style="display:inline">· mỗi đơn 1 mã</span></h4>' +
      (S.voucherMsg ? '<div class="co-alert warn" style="margin-bottom:8px">⚠️ ' + esc(S.voucherMsg) + '</div>' : '') +
      inner +
      note('GET /api/v1/vouchers/available?branchId&mode&subtotal · POST /api/v1/vouchers/validate') + '</div>';
  }

  /* ==== Màn chọn mã ==== */
  function viewVoucher() {
    var ctx = voucherCtx();
    var opts = voucherOptions(ctx);

    var body = '<div class="co-sec"><h4>Nhập mã</h4>' +
      '<div class="co-vform">' +
        '<input class="co-input" style="margin-top:0;text-transform:uppercase" placeholder="VD: HIKARI30" ' +
          'value="' + esc(S.codeInput) + '" oninput="Checkout.setCode(this.value)">' +
        '<button class="co-btn sm" onclick="Checkout.applyCode()">Áp dụng</button>' +
      '</div>' +
      (S.codeErr ? '<div class="co-err">' + esc(S.codeErr) + '</div>' : '') +
      '<p class="co-fine">Mã gửi riêng qua ZNS/tờ rơi không hiện sẵn trong kho — nhập đúng một lần là mã tự vào kho.</p></div>';

    body += '<div class="co-sec"><div class="co-alert warn">🎟️ <strong>Mỗi đơn chỉ dùng được một mã.</strong> ' +
      'Chọn mã khác là thay mã đang chọn, không cộng dồn.</div></div>';

    body += '<div class="co-sec"><h4>Kho ưu đãi của bạn</h4>' +
      (S.voucherCode
        ? '<button class="co-addnew" onclick="Checkout.clearVoucher(1)">Không dùng mã nào</button>'
        : '') +
      opts.map(function (o) {
        var on = o.v.code === S.voucherCode;
        return '<div class="co-vcard ' + (on ? 'on' : '') + (o.ok ? '' : ' off') + '"' +
          (o.ok ? ' onclick="Checkout.pickVoucher(\'' + o.v.code + '\')"' : '') + '>' +
          '<div class="co-vleft"><span class="co-vtag">' + esc(o.v.code) + '</span></div>' +
          '<div class="co-vb">' +
            '<div><strong>' + esc(o.v.title) + '</strong></div>' +
            '<div class="co-sub">' + esc(voucherCondLabel(o.v)) + '</div>' +
            '<div class="co-sub">HSD ' + dmyText(o.v.endAt) + (o.v.stackPoints === false ? ' · không cộng dồn với điểm' : '') + '</div>' +
            (o.ok
              ? '<div class="co-vok">Giảm ' + vnd(o.off) + ' cho đơn này</div>'
              : '<div class="co-vno">' + esc(o.reason) + '</div>') +
          '</div>' +
          '<span class="co-tick">' + (on ? '✓' : '') + '</span></div>';
      }).join('') +
      (opts.length ? '' : '<div class="co-card co-sub">Chưa có mã nào trong kho.</div>') +
      '</div>';

    var v = curVoucher();
    var foot = '<div class="co-total"><span>Tổng cộng sau ưu đãi</span><b>' + vnd(total()) + '</b></div>' +
      '<button class="co-btn" onclick="Checkout.backPay()">' +
      (v ? 'Dùng mã ' + esc(v.code) : 'Không dùng mã, tiếp tục') + '</button>';

    return shell('Chọn ưu đãi', body, foot, { back: 'backPay' });
  }

  /* ==== Bước 2 — thanh toán ==== */
  function viewPay() {
    var body = '<div class="co-sec"><h4>Đơn ' + S.code + '</h4><div class="co-card">' +
      '<div class="co-row"><span>Chi nhánh</span><b>' + esc(branchName()) + '</b></div>' +
      '<div class="co-row"><span>' + MODE_LABEL[S.mode] + '</span><b>' +
      (S.time === 'now' ? 'sớm nhất' : S.at) + '</b></div>' + sumRows(true) + '</div>' +
      '<p class="co-fine">Số tiền cuối do <strong>server tính lại</strong> từ đơn — app không tin giá client gửi.</p></div>';

    body += voucherRow();

    var usable = maxPointsUsable();
    body += '<div class="co-sec"><h4>Điểm thành viên</h4><div class="co-card">' +
      '<div class="co-row"><span>Điểm hiện có</span><b>' + USER.points + ' điểm</b></div>' +
      (pointsBlockedByVoucher()
        ? '<div class="co-sub">Mã <strong>' + esc(S.voucherCode) + '</strong> không cộng dồn với đổi điểm. ' +
          'Bỏ mã nếu muốn dùng điểm cho đơn này.</div>'
        : usable
          ? '<label class="co-check"><input type="checkbox" ' + (S.usePoints ? 'checked' : '') + ' onchange="Checkout.togglePoints()">' +
            ' Dùng ' + usable + ' điểm — giảm ' + vnd((usable / POINT_BLOCK) * POINT_VALUE) + '</label>'
          : '<div class="co-sub">Cần tối thiểu ' + POINT_BLOCK + ' điểm để đổi.</div>') +
      '</div>' + note('GET /api/v1/loyalty/me · POST /api/v1/loyalty/redeem') + '</div>';

    var methods = methodsFor(S.mode);
    body += '<div class="co-sec"><h4>Phương thức thanh toán</h4>' +
      (S.mode === 'delivery'
        ? '<p class="co-fine" style="margin:0 0 8px">Đơn <strong>giao hàng</strong> thanh toán trước qua ZaloPay — ' +
          'tài xế của đối tác giao không thu tiền hộ quán.</p>'
        : '') +
      methods.map(function (m) {
        return '<div class="co-pm ' + (S.method === m.id ? 'on' : '') + '" onclick="Checkout.setMethod(\'' + m.id + '\')">' +
          '<span class="co-logo ' + m.id + '">' + m.badge + '</span>' +
          '<div class="co-pmb"><div>' + m.name + '</div><div class="co-sub">' + m.sub + '</div></div>' +
          '<span class="co-tick">' + (S.method === m.id ? '✓' : '') + '</span></div>';
      }).join('') + note('POST /api/v1/orders { branchId, items[] } → POST /api/v1/payments/zalopay/create') + '</div>';

    var foot = '<div class="co-total"><span>Cần thanh toán</span><b>' + vnd(total()) + '</b></div>' +
      '<button class="co-btn pay-' + S.method + '" onclick="Checkout.pay()">' + payLabel() + '</button>';

    return shell('Thanh toán', body, foot, { back: 'backInfo' });
  }

  function payLabel() {
    if (S.method === 'zalopay') return 'Thanh toán ' + vnd(total()) + ' với ZaloPay';
    if (S.method === 'vietqr') return 'Hiện mã QR chuyển khoản';
    return 'Đặt đơn · trả khi nhận';
  }

  /* ==== Cổng ZaloPay mô phỏng ==== */
  function viewGate() {
    return '<div class="co-gate">' +
      '<div class="co-gh"><span>‹ ZaloPay</span><span>🔒 Bảo mật</span></div>' +
      '<div class="co-gb">' +
        '<div class="co-amt"><div class="co-sub">Số tiền thanh toán</div><div class="n">' + vnd(total()) + '</div></div>' +
        '<div class="co-mrc"><strong>Hikari Vegetarian Cafe</strong><div class="co-sub">Đơn ' + S.code + ' · app_trans_id: ' + S.appTransId + '</div></div>' +
        (S.paying
          ? '<div class="co-spin big"></div><p class="co-sub center">Đang xử lý giao dịch…</p>'
          : '<button class="co-btn zalo" onclick="Checkout.paySuccess()">Xác nhận thanh toán</button>' +
            '<button class="co-btn link" onclick="Checkout.payFail()">Huỷ / mô phỏng thất bại</button>') +
      '</div></div>';
  }

  /* ==== Màn VietQR mô phỏng ==== */
  function viewQr() {
    var body = '<div class="co-sec center">' +
      '<div class="co-qr">' + qrArt() + '</div>' +
      '<div class="co-amt"><div class="n">' + vnd(total()) + '</div></div>' +
      '<div class="co-card left"><div class="co-row"><span>Ngân hàng</span><b>❓ chờ chủ quán</b></div>' +
      '<div class="co-row"><span>Nội dung</span><b>' + S.code + '</b></div></div>' +
      '<p class="co-fine">Quán đối chiếu biến động số dư rồi xác nhận. Đơn giữ trạng thái <em>' + PAYMENT_VI.PENDING + '</em> tối đa ' + HOLD_MINUTES + ' phút.</p>' +
      note('POST /api/v1/orders (status=pending_payment) — đối soát thủ công ở dashboard') + '</div>';
    var foot = '<button class="co-btn" onclick="Checkout.qrDone()">Tôi đã chuyển khoản</button>' +
      '<button class="co-btn link" onclick="Checkout.go(\'pay\')">Đổi phương thức</button>';
    return shell('Chuyển khoản VietQR', body, foot, { back: 'backPay' });
  }

  /* Vẽ mã QR giả (chỉ để nhìn cho giống) — không mã hoá dữ liệu gì cả */
  function qrArt() {
    var n = 21, seed = 7, cells = '';
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var finder = (r < 7 && c < 7) || (r < 7 && c > n - 8) || (r > n - 8 && c < 7);
      var on;
      if (finder) {
        var rr = r > n - 8 ? r - (n - 7) : r, cc = c > n - 8 ? c - (n - 7) : c;
        var d = Math.max(Math.abs(rr - 3), Math.abs(cc - 3));
        on = d !== 2 && d <= 3;
      } else {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        on = (seed >> 7) % 3 !== 0;
      }
      cells += '<i' + (on ? ' class="on"' : '') + '></i>';
    }
    return '<div class="co-qrgrid">' + cells + '</div>';
  }

  /* ==== Bước 3 — kết quả + theo dõi ==== */
  function viewDone() {
    var steps = TRACK[S.mode];
    var body = '<div class="co-sec center">' +
      '<div class="co-ic ok">✅</div><h3>' + (S.paid ? 'Thanh toán thành công' : 'Đơn đã được ghi nhận') + '</h3>' +
      '<div class="co-badge ' + (S.paid ? 'paid' : 'pending') + '">' + (S.paid ? PAYMENT_VI.PAID : PAYMENT_VI.PENDING) + '</div>' +
      '<div class="co-sub">Đơn ' + S.code + ' · ' + MODE_LABEL[S.mode] + ' · ' + esc(branchName()) + '</div></div>';

    body += '<div class="co-sec"><div class="co-card">' + sumRows(true) +
      '<div class="co-row earn"><span>Điểm được cộng</span><b>+' + S.earned + ' điểm</b></div></div>' +
      '<p class="co-fine">' + (S.method === 'zalopay'
        ? 'Trạng thái "đã thanh toán" do <strong>callback ZaloPay về server</strong> xác nhận, không lấy từ máy khách.'
        : S.method === 'vietqr' ? 'Quán sẽ đối soát chuyển khoản rồi xác nhận đơn.'
        : 'Khách trả tiền khi nhận — quán xác nhận trên dashboard.') + '</p>' +
      note('POST /api/v1/webhooks/zalopay → order=paid → cộng điểm (02) · shipment (03) · Sapo (06) · ZNS (05)') + '</div>';

    body += '<div class="co-sec"><h4>Theo dõi đơn</h4><div class="co-card">' +
      steps.map(function (st, i) {
        var cls = i < S.trackAt ? 'done' : i === S.trackAt ? 'now' : 'wait';
        return '<div class="co-step ' + cls + '"><span class="dot"></span><span>' + STATUS_VI[st[0]] +
               (st[1] ? '<i class="co-hint">' + st[1] + '</i>' : '') + '</span></div>';
      }).join('') +
      (S.mode === 'delivery' && S.quote.state === 'ok' ? '<div class="co-sub">Dự kiến giao sau ~' + S.quote.eta + ' phút</div>' : '') +
      '</div>' + note('Socket.IO room user:{id} — order:updated · shipment:updated') + '</div>';

    var foot = '<button class="co-btn" onclick="Checkout.finish()">Về menu</button>';
    return shell('Đơn ' + S.code, body, foot, { back: 'finish' });
  }

  function viewFail() {
    var body = '<div class="co-sec center">' +
      '<div class="co-ic fail">⚠️</div><h3>Thanh toán chưa hoàn tất</h3>' +
      '<div class="co-sub">Đơn ' + S.code + ' giữ trạng thái <em>' + PAYMENT_VI.PENDING + '</em>, tự huỷ sau ' + HOLD_MINUTES + ' phút nếu không thanh toán.</div></div>' +
      '<div class="co-sec"><div class="co-card">' + sumRows(true) + '</div>' +
      note('GET /api/v1/payments/:orderId/status → pending') + '</div>';
    var foot = '<button class="co-btn" onclick="Checkout.pay()">Thử lại</button>' +
      '<button class="co-btn link" onclick="Checkout.go(\'pay\')">Đổi phương thức</button>';
    return shell('Thanh toán', body, foot, { back: 'backPay' });
  }

  /* ==== Render ==== */
  function render() {
    var v = S.step === 'info' ? viewInfo()
      : S.step === 'addr' ? viewAddr()
      : S.step === 'voucher' ? viewVoucher()
      : S.step === 'pay' ? viewPay()
      : S.step === 'gate' ? viewGate()
      : S.step === 'qr' ? viewQr()
      : S.step === 'fail' ? viewFail()
      : viewDone();
    // Giữ nguyên vị trí cuộn khi vẫn ở cùng một bước (timeline tự chạy sẽ re-render liên tục —
    // nhảy về đầu màn mỗi 1,8s thì không ai theo dõi được đơn).
    var prev = root.querySelector('.co-body');
    var keep = prev && lastStep === S.step ? prev.scrollTop : 0;
    root.innerHTML = v;
    var b = root.querySelector('.co-body');
    if (b) b.scrollTop = keep;
    lastStep = S.step;
  }

  /* ==== Hành động ==== */
  var Checkout = {
    start: function (opts) {
      var host = document.querySelector('.phone') || document.body;
      if (!root) {
        injectCss();
        root = document.createElement('div');
        root.className = 'co-wrap';
        host.appendChild(root);
      }
      var id = 'H' + (1000 + Math.floor(Math.random() * 9000));
      var d = new Date();
      var yy = String(d.getFullYear()).slice(2), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      S = {
        step: 'info',
        lines: opts.lines, mode: opts.mode || 'dine', subtotal: opts.subtotal,
        branch: opts.branch || null,
        addressId: 'a1', quote: { state: 'idle' },
        time: 'now', at: '18:30', note: '', phoneShared: opts.mode === 'dine',
        usePoints: false, method: 'zalopay',
        voucherCode: null,        // MỘT ô, một mã — luật "mỗi đơn một mã" (spec 11)
        voucherMsg: '',           // lý do mã vừa bị gỡ tự động, hiện cho khách đọc
        codeInput: '', codeErr: '',
        form: null, formErr: '',
        code: '#' + id, appTransId: yy + mm + dd + '_' + id,
        paying: false, paid: false, earned: 0, trackAt: 0,
        onDone: opts.onDone
      };
      root.classList.add('open');
      if (S.mode === 'delivery') requestQuote(); else render();
    },

    close: function () { root.classList.remove('open'); clearTimeout(timer); },
    finish: function () { Checkout.close(); if (S.onDone) S.onDone(S.paid || S.step === 'done'); },
    toggleNotes: function () { root.classList.toggle('notes'); },

    setMode: function (m) {
      S.mode = m;
      normalizeMethod();
      S.phoneShared = S.phoneShared || m === 'dine';
      if (m === 'delivery') { requestQuote(); } else { S.quote = { state: 'idle' }; syncVoucher(); render(); }
    },
    pickAddr: function (id) { S.addressId = id; requestQuote(); },

    /* --- thêm địa chỉ mới --- */
    openAddr: function () {
      S.form = { label: 'Nhà', detail: '', ward: '', district: '', note: '', located: false };
      S.formErr = '';
      S.step = 'addr';
      render();
    },
    f: function (key, val, rerender) {          // rerender=1 cho các ô cần vẽ lại (tránh mất con trỏ khi gõ)
      S.form[key] = val;
      S.formErr = '';
      if (rerender) render();
    },
    useLocation: function () {                  // mô phỏng zmp-sdk getLocation (thật: token → server đổi lấy toạ độ)
      S.form.located = true;
      if (!S.form.district) S.form.district = 'Quận 10';
      render();
    },
    saveAddr: function () {
      var f = S.form;
      if (!f.detail.trim()) { S.formErr = 'detail'; render(); return; }
      if (!f.district) { S.formErr = 'district'; render(); return; }
      var km = DISTRICTS[f.district];
      var a = {
        id: 'a' + Date.now(),
        label: f.label,
        detail: f.detail.trim() + (f.ward.trim() ? ', ' + f.ward.trim() : ''),
        district: f.district,
        km: km,
        note: f.note.trim(),
        kind: km > MAX_KM ? 'out' : 'ok'        // thật thì đơn vị giao trả lời có phục vụ hay không
      };
      ADDRESSES.unshift(a);
      S.addressId = a.id;
      S.step = 'info';
      requestQuote();
    },
    retryQuote: function () { requestQuote(); },
    setTime: function (t) { S.time = t; render(); },
    setAt: function (v) { S.at = v; },
    setNote: function (v) { S.note = v; },
    sharePhone: function () { S.phoneShared = true; render(); },

    go: function (step) { S.step = step; S.paying = false; if (step === 'pay') normalizeMethod(); render(); },
    backInfo: function () { S.step = 'info'; render(); },
    backPay: function () { S.step = 'pay'; S.paying = false; render(); },
    togglePoints: function () { S.usePoints = !S.usePoints; render(); },

    /* --- Ưu đãi (spec 11): mọi đường vào đều đi qua applyVoucher(), nên không có lối nào
           nhét được mã thứ hai vào đơn. Chọn mã mới = ghi đè ô cũ. --- */
    openVoucher: function () { S.step = 'voucher'; S.codeErr = ''; S.voucherMsg = ''; render(); },
    setCode: function (v) { S.codeInput = v; S.codeErr = ''; },
    applyCode: function () { Checkout.pickVoucher(S.codeInput); },
    pickVoucher: function (code) {
      var r = applyVoucher(code, voucherCtx());
      if (!r.ok) { S.codeErr = r.reason; render(); return; }
      S.voucherCode = r.code;                 // ghi đè: mã cũ (nếu có) rời đơn ngay tại đây
      S.codeInput = ''; S.codeErr = ''; S.voucherMsg = '';
      if (pointsBlockedByVoucher()) S.usePoints = false;
      render();
    },
    clearVoucher: function () { S.voucherCode = null; S.voucherMsg = ''; S.codeErr = ''; render(); },
    setMethod: function (m) { S.method = m; render(); },

    pay: function () {
      if (S.method === 'zalopay') { S.step = 'gate'; S.paying = false; render(); return; }
      if (S.method === 'vietqr') { S.step = 'qr'; render(); return; }
      S.paid = false; done();                       // COD: đơn xác nhận, thu tiền sau
    },
    paySuccess: function () {
      S.paying = true; render();
      clearTimeout(timer);
      timer = setTimeout(function () { S.paid = true; done(); }, 1600);  // chờ "callback" về server
    },
    payFail: function () { S.step = 'fail'; S.paying = false; render(); },
    qrDone: function () { S.paid = false; done(); }
  };

  /* Vào màn theo dõi + chạy timeline mô phỏng */
  function done() {
    // Lượt dùng chỉ ghi khi đơn đã được ghi nhận. Thật thì SERVER ghi vào voucher_redemptions
    // trong cùng transaction tạo đơn — trừ lượt ở client là chỗ để lách dùng mã nhiều lần.
    if (S.voucherCode) markVoucherUsed(S.voucherCode);
    S.earned = pointsEarned();
    S.step = 'done';
    S.trackAt = 0;
    render();
    var steps = TRACK[S.mode];
    clearTimeout(timer);
    (function tick() {
      timer = setTimeout(function () {
        if (S.step !== 'done' || S.trackAt >= steps.length - 1) return;
        S.trackAt++; render(); tick();
      }, 1800);
    })();
  }

  /* ==== CSS (nhúng 1 lần, dùng brand tokens của trang chủ) ==== */
  function injectCss() {
    var css = [
      '.co-wrap{position:absolute;top:26px;left:0;right:0;bottom:0;background:var(--paper,#FAF8F3);z-index:50;display:none;flex-direction:column;font-size:.88rem;}',
      '.co-wrap.open{display:flex;}',
      '.co-wrap .co-note{display:none;font-family:ui-monospace,Menlo,monospace;font-size:.64rem;color:var(--muted,#8A857C);background:#f1ede3;border-radius:8px;padding:5px 8px;margin-top:8px;word-break:break-word;}',
      '.co-wrap.notes .co-note{display:block;}',
      '.co-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line,#E7E2D8);background:var(--paper,#FAF8F3);}',
      '.co-title{flex:1;font-weight:700;}',
      '.co-back,.co-info{border:none;background:transparent;font:inherit;font-size:1.2rem;color:var(--ink,#1C1B19);cursor:pointer;padding:0 4px;line-height:1;}',
      '.co-info{font-size:1rem;color:var(--muted,#8A857C);}',
      '.co-steps{display:flex;align-items:center;gap:6px;padding:8px 14px;border-bottom:1px solid var(--line,#E7E2D8);background:#fff;font-size:.7rem;color:var(--muted,#8A857C);}',
      '.co-steps i{flex:1;height:1px;background:var(--line,#E7E2D8);}',
      '.co-st{display:flex;align-items:center;gap:5px;}',
      '.co-st b{width:17px;height:17px;border-radius:50%;background:var(--line,#E7E2D8);color:#fff;display:grid;place-items:center;font-size:.62rem;}',
      '.co-st.now{color:var(--ink,#1C1B19);font-weight:600;} .co-st.now b{background:var(--ink,#1C1B19);}',
      '.co-st.done b{background:var(--matcha,#5F7A4A);}',
      '.co-body{flex:1;overflow-y:auto;padding:4px 0 14px;}',
      '.co-sec{margin:14px 16px;} .co-sec.center{text-align:center;} .co-sec h4{margin:0 0 8px;font-size:.85rem;}',
      '.co-card{background:#fff;border:1px solid var(--line,#E7E2D8);border-radius:14px;padding:12px;} .co-card.left{text-align:left;}',
      '.co-sub{color:var(--muted,#8A857C);font-size:.75rem;} .co-sub.center{text-align:center;}',
      '.co-hint{display:block;color:var(--muted,#8A857C);font-size:.7rem;font-style:normal;}',
      '.co-fine{font-size:.7rem;color:var(--muted,#8A857C);margin:8px 2px 0;}',
      '.co-row{display:flex;justify-content:space-between;gap:10px;margin:5px 0;}',
      '.co-row.tot{border-top:1px solid var(--line,#E7E2D8);margin-top:8px;padding-top:8px;font-weight:700;font-size:1rem;}',
      '.co-row.disc b{color:var(--matcha,#5F7A4A);} .co-row.earn b{color:var(--matcha,#5F7A4A);}',
      '.co-modes{display:flex;gap:6px;} .co-modes button{flex:1;border:1px solid var(--line,#E7E2D8);background:#fff;border-radius:10px;padding:8px 4px;font:inherit;font-size:.78rem;font-weight:600;cursor:pointer;}',
      '.co-modes button.on{background:var(--matcha,#5F7A4A);color:#fff;border-color:var(--matcha,#5F7A4A);}',
      '.co-modes.sm button{font-size:.76rem;}',
      '.co-addr{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--line,#E7E2D8);border-radius:12px;padding:10px;margin-bottom:6px;cursor:pointer;}',
      '.co-addr.on{border-color:var(--matcha,#5F7A4A);background:var(--matcha-soft,#EAF0E3);}',
      '.co-quote{margin-top:8px;}',
      '.co-addnew{width:100%;border:1px dashed var(--line,#E7E2D8);background:#fff;border-radius:12px;padding:10px;font:inherit;font-size:.82rem;font-weight:600;color:var(--matcha,#5F7A4A);cursor:pointer;}',
      '.co-req{color:var(--chili,#D9534F);}',
      '.co-err{color:var(--chili,#D9534F);font-size:.75rem;margin-top:6px;}',
      'select.co-input{appearance:none;background-image:linear-gradient(45deg,transparent 50%,#8A857C 50%),linear-gradient(135deg,#8A857C 50%,transparent 50%);background-position:calc(100% - 16px) 55%,calc(100% - 11px) 55%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;}',
      '.co-fee .big{font-size:1.5rem;font-weight:700;} .co-fee .big .co-sub{font-size:.75rem;font-weight:400;}',
      '.co-meta{display:flex;gap:12px;margin-top:6px;font-size:.75rem;color:var(--muted,#8A857C);}',
      '.co-loading{display:flex;align-items:center;gap:10px;color:var(--muted,#8A857C);}',
      '.co-alert{background:#fbe9e8;color:var(--chili,#D9534F);border:1px solid #f3c9c7;border-radius:12px;padding:12px;font-size:.82rem;}',
      '.co-alert.warn{background:#fff8e6;color:var(--ink,#1C1B19);border-color:#f0e2b8;}',
      '.co-input{width:100%;font:inherit;font-size:.85rem;border:1px solid var(--line,#E7E2D8);border-radius:10px;padding:9px 10px;background:#fff;margin-top:8px;resize:none;}',
      '.co-check{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:.82rem;cursor:pointer;} .co-check input{accent-color:var(--matcha,#5F7A4A);}',
      '.co-pm{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid var(--line,#E7E2D8);border-radius:14px;padding:10px;margin-bottom:8px;cursor:pointer;}',
      '.co-pm.on{border-color:#0068FF;background:#f0f6ff;} .co-pmb{flex:1;font-weight:600;}',
      '.co-logo{width:38px;height:38px;border-radius:9px;display:grid;place-items:center;font-size:.58rem;line-height:1.1;text-align:center;font-weight:700;color:#fff;background:#0068FF;}',
      '.co-logo.vietqr{background:var(--ink,#1C1B19);} .co-logo.cod{background:var(--matcha,#5F7A4A);}',
      '.co-tick{color:#0068FF;font-weight:700;}',
      '.co-foot{border-top:1px solid var(--line,#E7E2D8);background:#fff;padding:10px 14px 14px;}',
      '.co-total{display:flex;justify-content:space-between;margin-bottom:8px;font-size:.9rem;} .co-total b{font-size:1.05rem;}',
      '.co-btn{width:100%;border:none;border-radius:12px;background:var(--ink,#1C1B19);color:#fff;font:inherit;font-weight:700;padding:12px;cursor:pointer;}',
      '.co-btn:disabled{background:#cfcabf;cursor:not-allowed;}',
      '.co-btn.pay-zalopay,.co-btn.zalo{background:#0068FF;} .co-btn.pay-cod{background:var(--matcha,#5F7A4A);}',
      '.co-btn.ghost{background:transparent;color:var(--ink,#1C1B19);border:1px solid var(--line,#E7E2D8);}',
      '.co-btn.link{background:transparent;color:var(--muted,#8A857C);font-weight:600;padding:8px;}',
      '.co-btn.sm{width:auto;padding:7px 12px;font-size:.78rem;margin-top:8px;}',
      '.co-gate{position:absolute;inset:0;background:#0068FF;display:flex;flex-direction:column;z-index:60;}',
      '.co-gh{display:flex;justify-content:space-between;padding:16px;color:#fff;font-weight:700;font-size:.85rem;}',
      '.co-gb{flex:1;background:#fff;border-radius:20px 20px 0 0;padding:20px 16px;}',
      '.co-amt{text-align:center;margin:6px 0 16px;} .co-amt .n{font-size:2rem;font-weight:700;color:#0068FF;}',
      '.co-mrc{background:var(--paper,#FAF8F3);border-radius:12px;padding:12px;margin-bottom:16px;}',
      '.co-spin{width:18px;height:18px;border:3px solid #e3ded2;border-top-color:var(--matcha,#5F7A4A);border-radius:50%;animation:cospin 1s linear infinite;display:inline-block;}',
      '.co-spin.big{width:42px;height:42px;border-width:4px;border-color:#cfe1ff;border-top-color:#0068FF;display:block;margin:26px auto;}',
      '@keyframes cospin{to{transform:rotate(360deg)}}',
      '.co-qrgrid{display:grid;grid-template-columns:repeat(21,7px);gap:0;justify-content:center;margin:6px auto 12px;padding:10px;background:#fff;border:1px solid var(--line,#E7E2D8);border-radius:12px;width:max-content;}',
      '.co-qrgrid i{width:7px;height:7px;} .co-qrgrid i.on{background:var(--ink,#1C1B19);}',
      '.co-ic{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;font-size:2.1rem;margin:6px auto 10px;background:var(--matcha-soft,#EAF0E3);}',
      '.co-ic.fail{background:#fbe9e8;}',
      '.co-badge{display:inline-block;margin-top:8px;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px;}',
      '.co-badge.paid{background:var(--matcha-soft,#EAF0E3);color:var(--matcha,#5F7A4A);} .co-badge.pending{background:#fff8e6;color:#8a6d1f;}',
      '.co-step{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:.84rem;}',
      '.co-step .dot{width:12px;height:12px;border-radius:50%;background:var(--line,#E7E2D8);flex:none;}',
      '.co-step.done .dot{background:var(--matcha,#5F7A4A);} .co-step.now .dot{background:var(--sun,#F2C94C);box-shadow:0 0 0 4px #f7e6a8;}',
      '.co-step.wait{color:var(--muted,#8A857C);}',
      /* Ưu đãi (spec 11) */
      '.co-vform{display:flex;gap:8px;align-items:center;} .co-vform .co-input{flex:1;}',
      '.co-vform .co-btn.sm{margin-top:0;flex:none;}',
      '.co-vsel{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid var(--matcha,#5F7A4A);background:var(--matcha-soft,#EAF0E3);border-radius:12px;padding:10px;margin-bottom:8px;}',
      '.co-vtag{font-family:ui-monospace,Menlo,monospace;font-size:.7rem;font-weight:700;background:var(--matcha,#5F7A4A);color:#fff;border-radius:6px;padding:4px 7px;white-space:nowrap;}',
      '.co-vb{flex:1;font-size:.84rem;}',
      '.co-vx{border:none;background:transparent;color:var(--muted,#8A857C);font:inherit;font-size:1rem;cursor:pointer;padding:0 4px;}',
      '.co-vcard{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line,#E7E2D8);border-radius:12px;padding:10px;margin-bottom:8px;cursor:pointer;}',
      '.co-vcard.on{border-color:var(--matcha,#5F7A4A);background:var(--matcha-soft,#EAF0E3);}',
      /* Mã không dùng được vẫn HIỆN kèm lý do: ẩn đi thì khách tưởng mã của mình bị mất. */
      '.co-vcard.off{opacity:.62;cursor:default;} .co-vcard.off .co-vtag{background:var(--muted,#8A857C);}',
      '.co-vok{color:var(--matcha,#5F7A4A);font-weight:700;font-size:.78rem;margin-top:3px;}',
      '.co-vno{color:var(--chili,#D9534F);font-size:.75rem;margin-top:3px;}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'hikari-checkout-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  global.Checkout = Checkout;
})(window);
