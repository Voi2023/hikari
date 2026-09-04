/* Hikari — PHẦN THÊM & GIỚI HẠN (spec 01 §"Topping thêm cho món cố định").
 * Nguồn dùng chung cho: mini app (menu.html — món cố định + Tô tự chọn) và dashboard
 * (admin/cai-dat-topping.html). Một bảng giá duy nhất: cùng một miếng đậu hủ không thể
 * chỗ này 5k chỗ kia 7k, và sửa giá một chỗ thì chỗ kia sẽ bị quên.
 *
 * Bản thật: bảng `menu_extra_groups` + `menu_extras` + `extra_limits` (theo chi nhánh),
 * đọc qua GET /api/v1/menu (khách) và /api/v1/admin/menu/extras (quản trị).
 *
 * ⚠️ Giá lấy từ ảnh menu chủ quán gửi (docs/assets/data/menu.json). Giới hạn số lượng là
 * ĐỀ XUẤT — chủ quán chỉnh trong dashboard.
 */

var EXTRAS_KEY = 'hikari_extras_cfg';

/* Nhóm phần thêm. `broth:true` = loại có 2 mức giá (1 phần / 1 chén) như trên menu in.
   maxPerItem = tối đa MỖI loại trong một tô · maxTotal = tối đa cả nhóm trong một tô. */
var EXTRA_GROUPS_DEFAULT = [
  { key:'noodle', title:'Thêm mì', maxPerItem:1, maxTotal:2, choices:[
    { name:'Mì Ramen', price:15000 },
    { name:'Mì Udon',  price:19000 } ]},
  { key:'broth', title:'Thêm nước dùng', broth:true, maxPerItem:1, maxTotal:2, choices:[
    { name:'Nước Ramen (Cashew Paitan)', serving:20000, bowl:10000 },
    { name:'Nước Spicy Tomyum',          serving:27000, bowl:17000 },
    { name:'Nước Miso',                  serving:17000, bowl:10000 },
    { name:'Nước Spicy Shoyu',           serving:22000, bowl:12000 } ]},
  { key:'topping', title:'Thêm topping', maxPerItem:3, maxTotal:6, choices:[
    { name:'Nấm kim châm chiên', price:9000 },
    { name:'Trứng (nửa trái)',   price:5000 },
    { name:'Đậu hủ (3 miếng)',   price:5000 },
    { name:'Chả chay',           price:5000 },
    { name:'Ngưu bàng chiên',    price:5000 } ]},
  { key:'veg', title:'Thêm rau', maxPerItem:2, maxTotal:4, choices:[
    { name:'Cải thìa luộc',      price:3000 },
    { name:'Bông cải luộc',      price:4000 },
    { name:'Nấm bào ngư luộc',   price:4000 } ]},
];

/* Trần chung cho cả tô — chặn kiểu "1 tô 30 phần thêm" mà từng nhóm vẫn trong hạn.
   0 = không giới hạn. Bếp làm không kịp mới là vấn đề thật, không phải tiền. */
var EXTRA_LIMITS_DEFAULT = { maxPerDish: 10 };

function extrasCfg() {
  try {
    var raw = localStorage.getItem(EXTRAS_KEY);
    if (!raw) return { groups: JSON.parse(JSON.stringify(EXTRA_GROUPS_DEFAULT)), limits: Object.assign({}, EXTRA_LIMITS_DEFAULT) };
    var c = JSON.parse(raw);
    if (!c.groups) c.groups = JSON.parse(JSON.stringify(EXTRA_GROUPS_DEFAULT));
    if (!c.limits) c.limits = Object.assign({}, EXTRA_LIMITS_DEFAULT);
    return c;
  } catch (e) {
    return { groups: JSON.parse(JSON.stringify(EXTRA_GROUPS_DEFAULT)), limits: Object.assign({}, EXTRA_LIMITS_DEFAULT) };
  }
}
function saveExtrasCfg(c) { try { localStorage.setItem(EXTRAS_KEY, JSON.stringify(c)); } catch (e) {} }
function resetExtrasCfg() { try { localStorage.removeItem(EXTRAS_KEY); } catch (e) {} }

/** Choices của một nhóm — để "Tô tự chọn" và "món cố định" dùng CHUNG một bảng giá. */
function extraChoices(key) {
  var g = extrasCfg().groups.filter(function (x) { return x.key === key; })[0];
  return g ? g.choices : [];
}
/** Đơn giá một lựa chọn. Nước dùng thêm vào món cố định tính theo **1 chén**
 *  (thêm cả 1 phần nước dùng vào tô đã có nước là không hợp lý). */
function extraPrice(group, choice) { return group.broth ? choice.bowl : choice.price; }
