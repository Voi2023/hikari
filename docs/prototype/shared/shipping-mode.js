/* Hikari — CHẾ ĐỘ GIAO HÀNG (spec 10). Nguồn dùng chung cho dashboard và mini app.
 *
 * Quán chạy được ở MỘT trong hai chế độ, đổi bằng cờ trong dashboard:
 *
 *   AUTO   — nối API đối tác (Grab/Ahamove/BE…). Khách chọn chi nhánh + nhập địa chỉ
 *            → đối tác trả phí thật → đặt tài xế tự động đến lấy hàng.
 *   MANUAL — quán tự giao. Phí tra theo BẢNG PHÍ PHƯỜNG do quán nhập.
 *            Không có tài xế đối tác ⇒ trạng thái đơn do người ở quán bấm tay trong dashboard.
 *
 * Vì sao phải là cờ chứ không phải "cứ gọi API, lỗi thì fallback":
 *   hai chế độ khác nhau ở AI CHỊU TRÁCH NHIỆM GIAO, không chỉ khác cách tính tiền.
 *   Tự động rơi sang thủ công giữa giờ cao điểm = đơn nằm chờ mà không ai biết mình phải đi giao.
 *   Đổi chế độ phải là hành động có chủ ý, có ghi nhật ký.
 *
 * Prototype lưu bằng localStorage để giữ nguyên khi chuyển trang; bản thật là bảng
 * `shipping_settings` (một dòng / chi nhánh) đọc qua GET /api/v1/admin/shipping/settings.
 */

var SHIP_MODE_KEY = 'hikari_ship_mode';
var SHIP_CFG_KEY = 'hikari_ship_cfg';

/* ---- Đối tác giao (chế độ AUTO) ----
   Danh sách MỞ RỘNG ĐƯỢC: thêm đối tác mới = thêm một dòng ở đây (bản thật là bảng
   `shipping_providers`), không phải sửa code nghiệp vụ — chỗ gọi chỉ biết interface
   quote()/createShipment() (spec 03 §5).
   ⚠️ secret KHÔNG bao giờ hiện đầy đủ lại trên màn hình, kể cả cho chủ quán:
   nhập xong chỉ còn 4 ký tự cuối. Muốn đổi thì nhập lại cái mới. */
var SHIP_PROVIDERS_DEFAULT = [
  { id: 'grab',    name: 'Grab Express',  env: 'sandbox', key: 'grab_live_8f21c7', secretTail: '9d4a', connected: true,  note: 'Giao đồ ăn nội thành, có API đối tác' },
  { id: 'ahamove', name: 'Ahamove',       env: 'sandbox', key: '',                 secretTail: '',     connected: false, note: 'Có Open API công khai — dự phòng' },
  { id: 'be',      name: 'BE (be.com.vn)', env: 'sandbox', key: '',                secretTail: '',     connected: false, note: '❓ Đang hỏi BE có API đối tác cho quán không' },
];

/* ---- Bảng phí theo phường (chế độ MANUAL) ----
   ⚠️ Tên phường theo địa giới TP.HCM sau sáp nhập 2025 — CẦN chủ quán đối chiếu lại,
   và phí dưới đây là GIẢ ĐỊNH để duyệt giao diện. */
var WARD_FEES_DEFAULT = [
  { ward: 'Hòa Hưng',   area: 'Quận 10 (cũ)', fee: 15000, eta: 15 },
  { ward: 'Vườn Lài',   area: 'Quận 10 (cũ)', fee: 15000, eta: 15 },
  { ward: 'Diên Hồng',  area: 'Quận 10 (cũ)', fee: 18000, eta: 20 },
  { ward: 'Bàn Cờ',     area: 'Quận 3 (cũ)',  fee: 22000, eta: 25 },
  { ward: 'Nhiêu Lộc',  area: 'Quận 3 (cũ)',  fee: 25000, eta: 28 },
  { ward: 'Phú Thọ',    area: 'Quận 11 (cũ)', fee: 25000, eta: 30 },
  { ward: 'Chợ Quán',   area: 'Quận 5 (cũ)',  fee: 30000, eta: 35 },
];

var SHIP_CFG_DEFAULT = {
  providers: SHIP_PROVIDERS_DEFAULT,
  activeProvider: 'grab',
  autoBookAt: 'READY',      // PAID = đặt tài xế ngay khi thanh toán · READY = khi bếp làm xong
  wards: WARD_FEES_DEFAULT,
  freeFrom: 0,              // 0 = không miễn phí ship theo giá trị đơn
  outOfAreaText: 'Ngoài vùng giao — vui lòng đặt mang về hoặc gọi quán',
};

function shipMode() {
  try { return localStorage.getItem(SHIP_MODE_KEY) || 'AUTO'; } catch (e) { return 'AUTO'; }
}
function shipCfg() {
  try {
    var raw = localStorage.getItem(SHIP_CFG_KEY);
    if (!raw) return JSON.parse(JSON.stringify(SHIP_CFG_DEFAULT));
    var c = JSON.parse(raw);
    // Vá khoá thiếu khi cấu hình cũ lưu từ bản trước — tránh undefined làm trắng màn hình.
    for (var k in SHIP_CFG_DEFAULT) if (!(k in c)) c[k] = SHIP_CFG_DEFAULT[k];
    return c;
  } catch (e) { return JSON.parse(JSON.stringify(SHIP_CFG_DEFAULT)); }
}
function saveShipCfg(c) { try { localStorage.setItem(SHIP_CFG_KEY, JSON.stringify(c)); } catch (e) {} }
function setShipMode(m) {
  try { localStorage.setItem(SHIP_MODE_KEY, m); } catch (e) {}
  applyShipTheme();
}

function shipModeMeta(m) {
  return m === 'MANUAL'
    ? { label: 'Giao thủ công', short: 'Thủ công', icon: 'ti-writing',
        desc: 'Quán tự giao · phí tra theo bảng phường · trạng thái bấm tay' }
    : { label: 'Giao tự động qua đối tác', short: 'Tự động', icon: 'ti-plug-connected',
        desc: 'Đối tác trả phí thật · tự đặt tài xế · trạng thái theo webhook' };
}

/* ---- Đổi màu dashboard theo chế độ ----
   Người trực quán nhìn lướt là phải biết mình đang ở chế độ nào, vì thao tác khác hẳn:
   chế độ thủ công thì KHÔNG ai đến lấy hàng nếu không tự gọi shipper.
   Nền thủ công đậm hơn một tông (vẫn cùng tông giấy kem, không phải theme khác) —
   đủ để nhận ra, không tới mức thành hai bộ giao diện. */
function applyShipTheme() {
  var m = shipMode();
  var root = document.documentElement;
  root.setAttribute('data-ship-mode', m);
  if (!document.getElementById('ship-mode-style')) {
    var st = document.createElement('style');
    st.id = 'ship-mode-style';
    st.textContent = [
      'html[data-ship-mode="MANUAL"]{--bg:#EAE3D3;--gray-bg:#DFD7C4;--border:#DAD2C0}',
      'html[data-ship-mode="MANUAL"] .app-topbar{background:#F3EEE2;border-bottom-color:#DAD2C0}',
      '.ship-ribbon{display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:12.8px;',
      '  font-weight:700;border-radius:9px;margin-bottom:16px;border:1px solid transparent}',
      'html[data-ship-mode="AUTO"] .ship-ribbon{background:var(--info-bg);color:var(--info);border-color:#cfe0f7}',
      'html[data-ship-mode="MANUAL"] .ship-ribbon{background:#F6EBD2;color:#8A6212;border-color:#E7D5A8}',
      '.ship-ribbon a{margin-left:auto;text-decoration:underline;font-weight:600;opacity:.9}',
    ].join('\n');
    document.head.appendChild(st);
  }
  document.querySelectorAll('[data-ship-ribbon]').forEach(function (el) {
    el.className = 'ship-ribbon';
    el.innerHTML = shipRibbonHtml();
  });
}

function shipRibbonHtml(link) {
  var m = shipModeMeta(shipMode());
  var cfg = shipCfg();
  var extra = shipMode() === 'AUTO'
    ? (function () { var p = cfg.providers.filter(function (x) { return x.id === cfg.activeProvider; })[0];
        return p ? ' · đối tác: ' + p.name + (p.env === 'sandbox' ? ' (thử nghiệm)' : '') : ''; })()
    : ' · ' + cfg.wards.length + ' phường đã khai phí';
  return '<i class="ti ' + m.icon + '"></i> Chế độ giao hàng: <u>' + m.label + '</u>' + extra +
    (link === false ? '' : '<a href="cai-dat-giao-hang.html">Đổi chế độ</a>');
}

/* ---- Báo giá ---- */
/** AUTO: phí do ĐỐI TÁC trả về. Công thức dưới đây chỉ là mô phỏng cho prototype —
 *  bản thật gọi POST /api/v1/shipping/quote → provider. App không tự nghĩ ra giá. */
function quoteAuto(km) {
  if (km > 10) return { state: 'out', km: km };
  return { state: 'ok', fee: Math.round((15000 + km * 5000) / 1000) * 1000, eta: Math.round(8 + km * 3), km: km, src: 'partner' };
}
/** MANUAL: tra bảng phường. Phường chưa khai → KHÔNG đoán giá, báo ngoài vùng để người
 *  ở quán chủ động gọi lại khách, thay vì lỡ báo rẻ rồi phải bù. */
function quoteManual(ward, cfg) {
  cfg = cfg || shipCfg();
  var row = cfg.wards.filter(function (w) { return w.ward === ward; })[0];
  if (!row) return { state: 'out', ward: ward };
  return { state: 'ok', fee: row.fee, eta: row.eta, ward: ward, src: 'ward-table' };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyShipTheme);
else applyShipTheme();
