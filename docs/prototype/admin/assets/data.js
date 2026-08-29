/* Dữ liệu mẫu dùng chung cho mọi trang admin prototype.
   Món & giá lấy từ docs/assets/data/menu.json (nguồn thật, trích từ ảnh menu chủ quán gửi).
   Mọi con số vận hành (đơn, khách, doanh thu) là GIẢ ĐỊNH để duyệt giao diện. */

const TODAY = new Date()
// Lùi n phút từ hiện tại. Đơn & nhật ký dùng cái này chứ không dùng giờ cố định:
// mở prototype lúc 9h sáng mà đơn ghi 11:42 thì mọi dòng "x phút trước" đều sai.
const ago = n => new Date(Date.now() - n * 60000).toISOString()
const daysAgo = (n, h = 12) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString() }

/* ---- Menu (đồng bộ docs/assets/data/menu.json) ---- */
const MENU = [
  { id: 'signature-noodles', name: 'Mì signature', items: [
    { id: 'tamago-ramen',     name: 'Tamago Ramen',     price: 50000, spicy: false, available: true,  sold: 38 },
    { id: 'spicy-tomyum',     name: 'Spicy Tomyum',     price: 53000, spicy: true,  available: true,  sold: 26 },
    { id: 'yaki-udon',        name: 'Yaki Udon',        price: 55000, spicy: false, available: true,  sold: 31 },
    { id: 'miso-udon',        name: 'Miso Udon',        price: 55000, spicy: false, available: true,  sold: 19 },
    { id: 'spicy-shoyu-udon', name: 'Spicy Shoyu Udon', price: 55000, spicy: true,  available: false, sold: 12 },
  ]},
  { id: 'build-your-own', name: 'Tô tự chọn', items: [
    { id: 'byo-bowl', name: 'Tô tự chọn (topping tuỳ chọn)', price: 45000, spicy: false, available: true, sold: 22 },
  ]},
  { id: 'coffee', name: 'Cà phê', items: [
    { id: 'ca-phe-den',       name: 'Cà phê đen',       price: 25000, spicy: false, available: true, sold: 44 },
    { id: 'ca-phe-sua',       name: 'Cà phê sữa',       price: 29000, spicy: false, available: true, sold: 51 },
    { id: 'bac-xiu',          name: 'Bạc xỉu',          price: 29000, spicy: false, available: true, sold: 27 },
    { id: 'ca-phe-muoi-hong', name: 'Cà phê muối hồng', price: 29000, spicy: false, available: true, sold: 63 },
    { id: 'ca-phe-hat-phi',   name: 'Cà phê hạt phỉ',   price: 39000, spicy: false, available: true, sold: 14 },
    { id: 'ca-phe-hat-de',    name: 'Cà phê hạt dẻ',    price: 39000, spicy: false, available: true, sold: 11 },
  ]},
  { id: 'latte-milktea', name: 'Latte và trà sữa', items: [
    { id: 'tra-sua-an-do',    name: 'Trà sữa Ấn Độ',                price: 42000, spicy: false, available: true, sold: 18 },
    { id: 'matcha-latte',     name: 'Trà xanh Nhật, sữa hạt',       price: 45000, spicy: false, available: true, sold: 47 },
    { id: 'genmaicha-latte',  name: 'Trà xanh gạo lứt Nhật, sữa hạt', price: 45000, spicy: false, available: true, sold: 21 },
    { id: 'houjicha-latte',   name: 'Trà xanh rang Nhật, sữa hạt',  price: 45000, spicy: false, available: true, sold: 16 },
  ]},
  { id: 'specialty-detox', name: 'Món nước nhà làm', items: [
    { id: 'kombucha-hibiscus', name: 'Trà Olong lên men, atiso đỏ',   price: 39000, spicy: false, available: false, sold: 9 },
    { id: 'ginger-ale',        name: 'Soda & syrup gừng thảo mộc',    price: 39000, spicy: false, available: false, sold: 7 },
    { id: 'herbal-cola',       name: 'Soda & syrup cola thảo mộc',    price: 39000, spicy: false, available: true,  sold: 13 },
    { id: 'black-bean-chia',   name: 'Nước đậu đen, hạt chia, hà thủ ô', price: 20000, spicy: false, available: true, sold: 29 },
    { id: 'perilla-drink',     name: 'Nước tía tô đẹp da',            price: 20000, spicy: false, available: true,  sold: 24 },
    { id: 'blood-herbal',      name: 'Nước thảo mộc bổ huyết',        price: 20000, spicy: false, available: false, sold: 6 },
  ]},
]
const PACKAGING_FEE = 5000   // phí hộp mang về — menu.json._meta.packaging_fee_takeaway

/* ---- Đơn hàng ----
   Quy tắc (spec 08 §5): đơn DELIVERY chỉ có method ZALOPAY — trả trước, tài xế không thu tiền hộ.
   COD / BANK_TRANSFER chỉ dùng cho DINE_IN và TAKEAWAY. */
const ORDERS = [
  { code: 'H1043', at: ago(4), customer: 'Minh Anh', phone: '0903 xxx 412', tier: 'GOLD',
    items: [['Tamago Ramen', 1, 50000], ['Cà phê muối hồng', 1, 29000]], ship: 27000,
    fulfilment: 'DELIVERY', status: 'NEW', payment: 'PAID', method: 'ZALOPAY',
    shipment: 'PENDING', driver: null, sync: 'PENDING', note: 'Không hành, giao trước 12h15' },
  { code: 'H1042', at: ago(18), customer: 'Khách vãng lai', phone: '—', tier: null,
    items: [['Trà xanh Nhật, sữa hạt', 2, 45000]], ship: 0,
    fulfilment: 'DINE_IN', status: 'PREPARING', payment: 'PAID', method: 'COD',
    shipment: null, driver: null, sync: 'SYNCED', note: '' },
  { code: 'H1041', at: ago(31), customer: 'Thanh Nguyên', phone: '0938 xxx 771', tier: 'SILVER',
    items: [['Yaki Udon', 1, 55000]], ship: 0, packaging: PACKAGING_FEE,
    fulfilment: 'TAKEAWAY', status: 'READY', payment: 'PAID', method: 'ZALOPAY',
    shipment: null, driver: null, sync: 'SYNCED', note: 'Sốt Shoyu' },
  { code: 'H1040', at: ago(48), customer: 'Hồng Vân', phone: '0907 xxx 233', tier: 'MEMBER',
    items: [['Tô tự chọn', 1, 45000], ['Nước tía tô đẹp da', 1, 20000]], ship: 22000,
    fulfilment: 'DELIVERY', status: 'DELIVERING', payment: 'PAID', method: 'ZALOPAY',
    shipment: 'ON_ROUTE', driver: 'Trần V. Sơn · 59H1-234.56', sync: 'SYNCED', note: '' },
  { code: 'H1039', at: ago(75), customer: 'Đức Huy', phone: '0912 xxx 108', tier: 'MEMBER',
    items: [['Spicy Tomyum', 1, 53000], ['Cà phê sữa', 1, 29000]], ship: 25000,
    fulfilment: 'DELIVERY', status: 'COMPLETED', payment: 'PAID', method: 'ZALOPAY',
    shipment: 'DELIVERED', driver: 'Lê T. Bình · 59P2-901.34', sync: 'FAILED', note: '' },
  { code: 'H1038', at: ago(94), customer: 'Ngọc Trâm', phone: '0977 xxx 640', tier: 'GOLD',
    items: [['Miso Udon', 2, 55000]], ship: 0,
    fulfilment: 'DINE_IN', status: 'COMPLETED', payment: 'PAID', method: 'BANK_TRANSFER',
    shipment: null, driver: null, sync: 'SYNCED', note: '' },
  { code: 'H1037', at: ago(108), customer: 'Khách vãng lai', phone: '—', tier: null,
    items: [['Bạc xỉu', 1, 29000]], ship: 0,
    fulfilment: 'DINE_IN', status: 'COMPLETED', payment: 'PAID', method: 'COD',
    shipment: null, driver: null, sync: 'SYNCED', note: '' },
  { code: 'H1036', at: ago(126), customer: 'Phương Linh', phone: '0965 xxx 519', tier: 'SILVER',
    items: [['Trà xanh rang Nhật, sữa hạt', 1, 45000], ['Cà phê đen', 1, 25000]], ship: 24000,
    fulfilment: 'DELIVERY', status: 'CANCELLED', payment: 'REFUNDED', method: 'ZALOPAY',
    shipment: 'FAILED', driver: 'Phạm Q. Duy · 59X3-118.72', sync: 'SKIPPED',
    note: 'Tài xế không liên lạc được với khách — đã hoàn tiền' },
  { code: 'H1035', at: ago(144), customer: 'Gia Bảo', phone: '0901 xxx 383', tier: 'MEMBER',
    items: [['Tamago Ramen', 1, 50000]], ship: 0, packaging: PACKAGING_FEE,
    fulfilment: 'TAKEAWAY', status: 'COMPLETED', payment: 'PAID', method: 'COD',
    shipment: null, driver: null, sync: 'SYNCED', note: '' },
  { code: 'H1034', at: ago(169), customer: 'Mỹ Duyên', phone: '0934 xxx 265', tier: 'GOLD',
    items: [['Cà phê muối hồng', 2, 29000], ['Nước đậu đen, hạt chia', 1, 20000]], ship: 21000,
    fulfilment: 'DELIVERY', status: 'COMPLETED', payment: 'PAID', method: 'ZALOPAY',
    shipment: 'DELIVERED', driver: 'Trần V. Sơn · 59H1-234.56', sync: 'SYNCED', note: '' },
  { code: 'H1033', at: ago(184), customer: 'Khách vãng lai', phone: '—', tier: null,
    items: [['Cà phê sữa', 1, 29000]], ship: 0,
    fulfilment: 'DINE_IN', status: 'COMPLETED', payment: 'FAILED', method: 'ZALOPAY',
    shipment: null, driver: null, sync: 'FAILED',
    note: 'ZaloPay báo lỗi, khách trả tiền mặt tại quầy — cần đối soát' },
  { code: 'H1032', at: ago(199), customer: 'Anh Khoa', phone: '0983 xxx 447', tier: 'MEMBER',
    items: [['Spicy Shoyu Udon', 1, 55000]], ship: 26000,
    fulfilment: 'DELIVERY', status: 'REFUNDED', payment: 'REFUNDED', method: 'ZALOPAY',
    shipment: 'CANCELLED', driver: null, sync: 'SKIPPED', note: 'Hết món — hoàn tiền toàn phần' },
]

/** Tổng tiền một đơn: món + ship + hộp mang về. Tính một chỗ để bảng, chi tiết đơn
 *  và báo cáo không ra ba con số khác nhau cho cùng một đơn. */
function orderTotal(o) {
  return o.items.reduce((s, [, q, p]) => s + q * p, 0) + (o.ship || 0) + (o.packaging || 0)
}
const itemsText = o => o.items.map(([n, q]) => `${n}${q > 1 ? ` ×${q}` : ''}`).join(', ')

/* ---- Khách hàng & điểm (spec 02) ---- */
const CUSTOMERS = [
  { id: 'KH0012', name: 'Minh Anh',    zalo: 'minhanh.tr',  phone: '0903 xxx 412', tier: 'GOLD',   points: 1840, spent: 4120000, orders: 46, last: daysAgo(0, 11) },
  { id: 'KH0008', name: 'Ngọc Trâm',   zalo: 'tramnk',      phone: '0977 xxx 640', tier: 'GOLD',   points: 1520, spent: 3380000, orders: 39, last: daysAgo(0, 10) },
  { id: 'KH0031', name: 'Mỹ Duyên',    zalo: 'duyenmy',     phone: '0934 xxx 265', tier: 'GOLD',   points: 1205, spent: 2710000, orders: 31, last: daysAgo(0, 8) },
  { id: 'KH0044', name: 'Thanh Nguyên', zalo: 'nguyenthanh', phone: '0938 xxx 771', tier: 'SILVER', points: 720,  spent: 1640000, orders: 22, last: daysAgo(0, 11) },
  { id: 'KH0057', name: 'Phương Linh', zalo: 'linhph',      phone: '0965 xxx 519', tier: 'SILVER', points: 615,  spent: 1390000, orders: 18, last: daysAgo(0, 9) },
  { id: 'KH0063', name: 'Đức Huy',     zalo: 'huyduc',      phone: '0912 xxx 108', tier: 'MEMBER', points: 340,  spent: 780000,  orders: 11, last: daysAgo(0, 10) },
  { id: 'KH0071', name: 'Hồng Vân',    zalo: 'vanhong',     phone: '0907 xxx 233', tier: 'MEMBER', points: 285,  spent: 640000,  orders: 9,  last: daysAgo(0, 10) },
  { id: 'KH0080', name: 'Gia Bảo',     zalo: 'baogia',      phone: '0901 xxx 383', tier: 'MEMBER', points: 150,  spent: 355000,  orders: 6,  last: daysAgo(1) },
  { id: 'KH0084', name: 'Anh Khoa',    zalo: 'khoanguyen',  phone: '0983 xxx 447', tier: 'MEMBER', points: 95,   spent: 210000,  orders: 4,  last: daysAgo(2) },
]
const TIER_RULE = [
  { tier: 'MEMBER', from: 0,    perk: 'Tích 1 điểm / 1.000đ' },
  { tier: 'SILVER', from: 500,  perk: '+5% điểm · sinh nhật giảm 10%' },
  { tier: 'GOLD',   from: 1200, perk: '+10% điểm · free 1 nước / tháng' },
]

/* ---- Thông báo đã gửi (spec 05) ---- */
const CAMPAIGNS = [
  { id: 'TB-104', title: 'Ưu đãi trưa T2–T6: giảm 15% mì signature', channel: 'ZNS', audience: 'Khách hạng Bạc trở lên', to: 412, sent: 405, failed: 7, status: 'SENT', at: daysAgo(1, 9) },
  { id: 'TB-103', title: 'Món mới: Soda syrup cola thảo mộc', channel: 'OA', audience: 'Tất cả khách đã theo dõi OA', to: 1284, sent: 1284, failed: 0, status: 'SENT', at: daysAgo(3, 15) },
  { id: 'TB-102', title: 'Nhắc: điểm của bạn sắp hết hạn', channel: 'IN_APP', audience: 'Khách có điểm hết hạn trong 30 ngày', to: 96, sent: 96, failed: 0, status: 'SENT', at: daysAgo(6, 10) },
  { id: 'TB-105', title: 'Khai trương góc detox — tặng nước tía tô', channel: 'ZNS', audience: 'Khách trong bán kính 3km', to: 260, sent: 0, failed: 0, status: 'SCHEDULED', at: daysAgo(-1, 9) },
  { id: 'TB-101', title: 'Cảm ơn khách hàng thân thiết tháng 7', channel: 'ZNS', audience: 'Khách hạng Vàng', to: 58, sent: 41, failed: 17, status: 'FAILED', at: daysAgo(12, 16) },
  { id: 'TB-106', title: '(nháp) Combo mì + cà phê buổi sáng', channel: 'OA', audience: '—', to: 0, sent: 0, failed: 0, status: 'DRAFT', at: daysAgo(0, 8) },
]

/* ---- Tài khoản admin & nhật ký (spec 07 §3, §7) ---- */
const ADMINS = [
  { id: 'AD01', name: 'Cô Hạnh',  email: 'chuquan@hikari.vn', role: 'owner',   totp: true,  backup: 6, last: ago(43) },
  { id: 'AD02', name: 'Minh Anh', email: 'quanly@hikari.vn',  role: 'manager', totp: true,  backup: 8, last: ago(92) },
  { id: 'AD03', name: 'Bảo Trân', email: 'thungan@hikari.vn', role: 'staff',   totp: true,  backup: 8, last: ago(168) },
  { id: 'AD04', name: 'Quốc Anh', email: 'bep@hikari.vn',     role: 'staff',   totp: false, backup: 0, last: null },
]
const AUDIT = [
  { at: ago(2), who: 'Minh Anh', role: 'manager', action: 'Xác nhận đơn', target: 'H1043', ip: '113.161.x.24' },
  { at: ago(26), who: 'Bảo Trân', role: 'staff',   action: 'Đổi trạng thái → Đang chế biến', target: 'H1042', ip: '192.168.1.15' },
  { at: ago(60), who: 'Minh Anh', role: 'manager', action: 'Tắt món (hết hàng)', target: 'Spicy Shoyu Udon', ip: '113.161.x.24' },
  { at: ago(104), who: 'Cô Hạnh',  role: 'owner',   action: 'Điều chỉnh điểm +200', target: 'KH0012 · Minh Anh', ip: '113.161.x.9' },
  { at: ago(135),  who: 'Minh Anh', role: 'manager', action: 'Hoàn tiền đơn', target: 'H1032', ip: '113.161.x.24' },
  { at: ago(161),  who: 'Cô Hạnh',  role: 'owner',   action: 'Đổi giá món 50.000 → 53.000', target: 'Spicy Tomyum', ip: '113.161.x.9' },
  { at: ago(214),  who: 'Minh Anh', role: 'manager', action: 'Đăng nhập (2FA thành công)', target: '—', ip: '113.161.x.24' },
  { at: ago(217),  who: 'Minh Anh', role: 'manager', action: 'Đăng nhập thất bại (sai mã TOTP)', target: '—', ip: '113.161.x.24' },
  { at: ago(250),  who: 'Cô Hạnh',  role: 'owner',   action: 'Reset 2FA cho tài khoản', target: 'AD04 · Quốc Anh', ip: '113.161.x.9' },
  { at: ago(295),  who: 'Bảo Trân', role: 'staff',   action: 'Đăng nhập (2FA thành công)', target: '—', ip: '192.168.1.15' },
]

/* ---- Doanh thu 7 ngày (báo cáo + biểu đồ tổng quan) ---- */
const REVENUE_7D = [
  { d: daysAgo(6), label: 'T4', revenue: 2740000, orders: 36 },
  { d: daysAgo(5), label: 'T5', revenue: 2980000, orders: 39 },
  { d: daysAgo(4), label: 'T6', revenue: 3520000, orders: 47 },
  { d: daysAgo(3), label: 'T7', revenue: 4310000, orders: 58 },
  { d: daysAgo(2), label: 'CN', revenue: 4050000, orders: 54 },
  { d: daysAgo(1), label: 'T2', revenue: 2610000, orders: 34 },
  { d: daysAgo(0), label: 'Nay', revenue: 3180000, orders: 42 },
]
