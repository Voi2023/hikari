/* Hikari — IN PHIẾU (spec 12). Hai mẫu, hai mục đích khác hẳn nhau:
 *
 *   1. PHIẾU BẾP  — cho người làm món. KHÔNG CÓ TIỀN, chữ to, ghi đủ mức đường/đá/topping
 *                   và ghi chú. Bếp không cần biết khách trả bao nhiêu; in giá lên đó chỉ
 *                   tổ tốn giấy và làm phiếu khó đọc trong lúc cao điểm.
 *   2. HOÁ ĐƠN    — cho thu ngân và khách. Đủ tiền, giảm giá, tiền khách đưa, tiền thừa.
 *                   KHÔNG cần công thức pha chế, nhưng vẫn ghi topping vì topping có tiền.
 *
 * Cùng một đơn, hai bản in, hai lúc khác nhau:
 *   xác nhận đơn → in phiếu bếp (tự động)     ·     khách thanh toán → in hoá đơn
 *
 * QUÁN CÓ HAI MÁY IN (chốt với chủ quán):
 *   P1 — đặt trong BẾP          → nhận phiếu bếp (cả món bếp lẫn món pha chế)
 *   P2 — đặt ở QUẦY THU NGÂN    → nhận hoá đơn
 * Khổ giấy thuộc về TỪNG MÁY, không phải một cấu hình chung: mỗi máy nạp sẵn một cuộn,
 * đổi khổ ở màn hình không làm cuộn giấy trong máy hẹp lại.
 *
 * Bản prototype in bằng trình duyệt (window.print + @page). Bản thật xem spec 12 §8 —
 * in qua agent ESC/POS là đường đúng, vì hộp thoại in của trình duyệt không dùng được
 * ở quầy lúc đông khách và không chọn được máy nào in.
 */

/* ==== Cấu hình in (dashboard sửa, lưu ở localStorage như các cấu hình prototype khác) ==== */
const PRINT_KEY = 'hikari_print_cfg'

const PRINT_DEFAULT = {
  paper: '80',                 // khổ mặc định khi thêm máy mới — khổ THẬT nằm ở từng máy in
  copies: 2,                   // số liên hoá đơn: 1 = chỉ khách · 2 = khách + lưu quầy
  autoKitchen: true,           // tự in phiếu bếp khi xác nhận đơn
  splitStation: true,          // tách phiếu bếp và phiếu quầy pha chế
  showWifi: true,
  footer: 'Cảm ơn quý khách và hẹn gặp lại',
  wifiName: 'HIKARI VEGETARIAN COFFEE',
  wifiPass: 'Hikarilaanhsang',
}

function printCfg() {
  try {
    const raw = localStorage.getItem(PRINT_KEY)
    return raw ? Object.assign({}, PRINT_DEFAULT, JSON.parse(raw)) : Object.assign({}, PRINT_DEFAULT)
  } catch { return Object.assign({}, PRINT_DEFAULT) }
}
function savePrintCfg(c) { try { localStorage.setItem(PRINT_KEY, JSON.stringify(c)) } catch {} }
function resetPrintCfg() { try { localStorage.removeItem(PRINT_KEY) } catch {} }

/* ==== MÁY IN ====
   Máy in thuộc về MỘT CHI NHÁNH: đơn của Thành Thái không thể in ra máy đặt ở Nguyễn Trung Ngạn.
   `status` ở prototype là để bấm thử tình huống; bản thật do agent tại quán báo về
   (spec 12 §8) — và phải báo về thật, vì máy in bếp chết trong im lặng là lỗi tệ nhất ở đây. */
const PRINTERS_KEY = 'hikari_printers'
const ROUTES_KEY = 'hikari_print_routes'

const PRINTERS_DEFAULT = [
  { id: 'P1', name: 'Máy in bếp', branchId: 'CN01', place: 'Trong bếp',
    kind: 'ESC_POS_LAN', address: '192.168.1.51:9100', paper: '80', enabled: true, status: 'ONLINE' },
  { id: 'P2', name: 'Máy in quầy thu ngân', branchId: 'CN01', place: 'Quầy thu ngân',
    kind: 'ESC_POS_USB', address: 'USB001', paper: '80', enabled: true, status: 'ONLINE' },
]
const PRINTER_KIND_LABEL = { ESC_POS_LAN: 'Mạng LAN (IP)', ESC_POS_USB: 'USB' }

/* Định tuyến: mỗi loại bản in ra máy nào. Ba tuyến vì phiếu bếp có hai trạm —
   quán hai máy thì cả hai trạm cùng về máy bếp, nhưng vẫn để tách được khi có máy thứ ba. */
const ROUTES_DEFAULT = { KITCHEN_BEP: 'P1', KITCHEN_BAR: 'P1', RECEIPT: 'P2' }
const ROUTE_LABEL = {
  KITCHEN_BEP: 'Phiếu bếp — món bếp (mì, cơm)',
  KITCHEN_BAR: 'Phiếu bếp — món pha chế (cà phê, trà)',
  RECEIPT: 'Hoá đơn thanh toán',
}

function printers() {
  try {
    const raw = localStorage.getItem(PRINTERS_KEY)
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(PRINTERS_DEFAULT))
  } catch { return JSON.parse(JSON.stringify(PRINTERS_DEFAULT)) }
}
function savePrinters(list) { try { localStorage.setItem(PRINTERS_KEY, JSON.stringify(list)) } catch {} }
function printRoutes() {
  try {
    const raw = localStorage.getItem(ROUTES_KEY)
    return raw ? Object.assign({}, ROUTES_DEFAULT, JSON.parse(raw)) : Object.assign({}, ROUTES_DEFAULT)
  } catch { return Object.assign({}, ROUTES_DEFAULT) }
}
function savePrintRoutes(r) { try { localStorage.setItem(ROUTES_KEY, JSON.stringify(r)) } catch {} }
function resetPrinters() {
  try { localStorage.removeItem(PRINTERS_KEY); localStorage.removeItem(ROUTES_KEY) } catch {}
}
const printerById = id => printers().find(p => p.id === id) || null
const printerReady = p => !!p && p.enabled && p.status === 'ONLINE'

/* Tuyến của một bản in: 'KITCHEN_BEP' | 'KITCHEN_BAR' | 'RECEIPT'. */
function routeKey(kind, station) {
  return kind === 'RECEIPT' ? 'RECEIPT' : (station === 'BAR' ? 'KITCHEN_BAR' : 'KITCHEN_BEP')
}

/* Chọn máy in cho một bản in, KÈM đường dự phòng.
   Máy được gán mà hỏng thì thà in nhầm chỗ còn hơn không in: một phiếu bếp không ra tờ nào
   nghĩa là khách ngồi chờ món chưa ai làm, và không ai biết cho tới lúc khách hỏi.
   Trả { printer, fallbackFrom, reason } — `fallbackFrom` khác null nghĩa là đã đổi máy,
   chỗ gọi PHẢI nói ra cho người bấm biết. */
function resolvePrinter(o, kind, station) {
  const key = routeKey(kind, station)
  const wanted = printerById(printRoutes()[key])
  if (printerReady(wanted) && wanted.branchId === o.branchId) {
    return { printer: wanted, fallbackFrom: null, reason: '' }
  }
  const why = !wanted ? 'chưa gán máy'
    : wanted.branchId !== o.branchId ? `máy “${wanted.name}” thuộc chi nhánh khác`
    : !wanted.enabled ? `máy “${wanted.name}” đang tắt`
    : wanted.status === 'NO_PAPER' ? `máy “${wanted.name}” hết giấy`
    : `máy “${wanted.name}” mất kết nối`
  // Dự phòng: bất kỳ máy nào còn sống của ĐÚNG chi nhánh đó.
  const alt = printers().find(p => p.branchId === o.branchId && printerReady(p))
  return alt
    ? { printer: alt, fallbackFrom: wanted || { name: 'chưa gán' }, reason: why }
    : { printer: null, fallbackFrom: null, reason: why + ' — không còn máy nào của chi nhánh này' }
}

/* Khổ giấy của một bản in = khổ của máy sẽ in ra nó. */
function paperFor(o, kind, station) {
  const r = resolvePrinter(o, kind, station)
  return r.printer ? r.printer.paper : printCfg().paper
}

/* ==== Trạm làm món ====
   Quán có hai nơi làm: BẾP (mì, cơm) và QUẦY PHA CHẾ (cà phê, trà). In chung một phiếu
   thì barista phải đọc qua món mì để tìm ly trà của mình — và ngược lại. Tách theo nhóm
   món trong MENU, món lạ thì về bếp (thà bếp hỏi lại còn hơn phiếu rơi vào khoảng không). */
const BAR_CATEGORIES = ['coffee', 'latte-milktea', 'specialty-detox']
const STATION_LABEL = { BEP: 'Bếp', BAR: 'Quầy pha chế' }

function stationOf(itemName) {
  const cat = MENU.find(c => c.items.some(i => i.name === itemName))
  return cat && BAR_CATEGORIES.includes(cat.id) ? 'BAR' : 'BEP'
}
/** Đơn vị tính hiện trên phiếu bếp — "1 Cốc" đọc nhanh hơn "1". */
function unitOf(itemName) {
  if (stationOf(itemName) === 'BAR') return 'Cốc'
  return /ramen|udon|tô/i.test(itemName) ? 'Tô' : 'Phần'
}
/** Chia món của một đơn theo trạm. Trả về [{ station, items }] — chỉ trạm CÓ món. */
function splitByStation(o) {
  const cfg = printCfg()
  if (!cfg.splitStation) return [{ station: 'BEP', items: o.items, all: true }]
  return ['BEP', 'BAR']
    .map(st => ({ station: st, items: o.items.filter(it => stationOf(it[0]) === st) }))
    .filter(g => g.items.length)
}

/* ==== Số lần in ====
   Phiếu bếp in lại phải ĐÓNG DẤU "IN LẠI". Một phiếu giống hệt rơi vào bếp lần hai là
   hai tô mì — quán chịu tiền tô thừa đó. Prototype đếm trong bộ nhớ; bản thật lưu ở
   bảng `order_prints` (ai in, lúc nào, lần thứ mấy) để còn truy được. */
const PRINT_COUNT = {}
const printCountOf = (code, kind) => PRINT_COUNT[code + ':' + kind] || 0
function markPrinted(code, kind) { PRINT_COUNT[code + ':' + kind] = printCountOf(code, kind) + 1 }

/* ==== Tiện ích hiển thị ==== */
const pEsc = s => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
const pMoney = n => (n || 0).toLocaleString('vi-VN')
const pTime = d => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const pDate = d => new Date(d).toLocaleDateString('vi-VN')
const pDateTime = d => `${pTime(d)} ${pDate(d)}`
const FUL_PRINT = { DINE_IN: 'TẠI QUÁN', TAKEAWAY: 'MANG VỀ', DELIVERY: 'GIAO HÀNG' }
const METHOD_PRINT = { COD: 'Tiền mặt', ZALOPAY: 'ZaloPay', BANK_TRANSFER: 'Chuyển khoản' }

function branchOf(o) {
  return BRANCHES.find(b => b.id === o.branchId) || BRANCHES[0]
}
/** Nơi nhận hàng ghi trên phiếu: bàn (tại quán), hoặc chính là hình thức nhận. */
function whereText(o) {
  if (o.fulfilment === 'DINE_IN') return o.table ? `(Bàn) ${o.table}` : '(Bàn) Chưa gán bàn'
  if (o.fulfilment === 'TAKEAWAY') return 'Khách đến lấy'
  return `Giao hàng · ${o.customer}`
}

/* ==== MẪU 1 — PHIẾU BẾP ====
   `opts.kind`:  'FULL' phiếu thường · 'ADD' phiếu bổ sung (chỉ món mới) · 'VOID' phiếu huỷ món.
   Ba loại phải nhìn khác nhau từ xa một mét, vì người bếp liếc chứ không đọc. */
function kitchenTicketHtml(o, group, opts = {}) {
  const paper = opts.paper || paperFor(o, 'KITCHEN', group.station)
  const kind = opts.kind || 'FULL'
  const again = opts.reprint || 0
  const stLabel = group.all ? 'Bếp & quầy' : STATION_LABEL[group.station]

  const rows = group.items.map(it => {
    const [name, qty] = it
    const opsHtml = itemOptions(it).map(op =>
      `<div class="k-op">+ ${pEsc(op[0])}${op[2] > 1 ? ` (x${op[2]})` : ''}</div>`).join('')
    const noteHtml = itemNote(it) ? `<div class="k-note">* ${pEsc(itemNote(it))}</div>` : ''
    return `<tr>
      <td><div class="k-name">${pEsc(name)}</div>${opsHtml}${noteHtml}</td>
      <td class="k-unit">${unitOf(name)}</td>
      <td class="k-qty">${qty}</td></tr>`
  }).join('')

  return `<div class="pr pr-${paper}">
    ${opts.dest ? `<div class="pr-dest">→ ${pEsc(opts.dest)}</div>` : ''}
    ${kind === 'VOID' ? '<div class="k-stamp void">PHIẾU HUỶ MÓN</div>' : ''}
    ${kind === 'ADD' ? '<div class="k-stamp add">PHIẾU BỔ SUNG</div>' : ''}
    ${again > 0 ? `<div class="k-stamp again">IN LẠI · LẦN ${again + 1}</div>` : ''}
    <div class="k-top"><span>${pDateTime(o.at)}</span><span>${pEsc(stLabel)}</span></div>
    <div class="k-code">#${pEsc(o.code)}
      <span class="k-ful ${o.fulfilment === 'DINE_IN' ? '' : 'hot'}">${FUL_PRINT[o.fulfilment]}</span></div>
    <div class="k-where">${pEsc(whereText(o))}</div>
    <div class="k-staff">Nhân viên: ${pEsc(o.cashier || '—')}</div>
    ${o.note ? `<div class="k-note big">* G/chú: ${pEsc(o.note)}</div>` : ''}
    <table class="k-tb">
      <thead><tr><th>Mặt hàng</th><th class="k-unit">Đ.vị</th><th class="k-qty">SL</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${o.fulfilment !== 'DINE_IN'
      ? '<div class="k-pack">→ Đóng gói mang đi · kèm muỗng/đũa</div>' : ''}
  </div>`
}

/* ==== MẪU 2 — HOÁ ĐƠN THANH TOÁN ====
   Số hoá đơn KHÁC mã đơn: mã đơn là của hệ thống, số hoá đơn là thứ khách đọc khi khiếu nại
   và kế toán dò khi đối soát. `opts.copy` = liên thứ mấy (1 khách giữ, 2 quầy lưu). */
function receiptHtml(o, opts = {}) {
  const cfg = printCfg()
  const paper = opts.paper || paperFor(o, 'RECEIPT')
  const b = branchOf(o)
  const copy = opts.copy || 1
  const now = opts.at || Date.now()
  const sub = orderSubtotal(o)
  const disc = orderDiscount(o)
  const total = orderTotal(o)
  const cash = o.cash || 0

  const rows = o.items.map(it => {
    const [name, qty, price] = it
    const ops = itemOptions(it).map(op => `<tr class="r-op">
        <td>+ ${pEsc(op[0])}${op[1] ? ' - ' + pMoney(op[1]) : ''}</td>
        <td class="c">${optionQty(op, qty)}</td>
        <td class="r">${optionTotal(op, qty) ? pMoney(optionTotal(op, qty)) : 0}</td></tr>`).join('')
    const note = itemNote(it)
      ? `<tr class="r-note"><td colspan="3">* G/chú: ${pEsc(itemNote(it))}</td></tr>` : ''
    return `<tr class="r-item">
        <td><b>${pEsc(name)} - ${pMoney(price)}</b></td>
        <td class="c">${qty}</td><td class="r"><b>${pMoney(qty * price)}</b></td>
      </tr>${ops}${note}`
  }).join('')

  return `<div class="pr pr-${paper}">
    ${opts.dest ? `<div class="pr-dest">→ ${pEsc(opts.dest)}</div>` : ''}
    <div class="r-shop">${pEsc(b.name.toUpperCase())}</div>
    <div class="r-addr">${pEsc(b.address)}</div>
    <div class="r-addr">SĐT: ${pEsc(b.phone)}</div>
    <div class="r-title">HOÁ ĐƠN THANH TOÁN</div>
    <div class="r-no">Số: <b>${pEsc(receiptNo(o))}</b> – Liên ${copy}/${cfg.copies}</div>
    <div class="r-sep"></div>
    <div class="r-kv"><span>${FUL_PRINT[o.fulfilment] === 'TẠI QUÁN' ? 'Tại bàn' : 'Hình thức'}</span>
      <b>${o.fulfilment === 'DINE_IN' ? pEsc(o.table || 'Chưa gán bàn') : FUL_PRINT[o.fulfilment]}</b></div>
    <div class="r-kv"><span>Giờ vào: <b>${pDateTime(o.at)}</b></span><span>Giờ in: <b>${pTime(now)}</b></span></div>
    <div class="r-kv"><span>Thu ngân</span><span>${pEsc(o.cashier || '—')}</span></div>
    <div class="r-kv"><span>Khách hàng</span><span>${pEsc(o.customer)}</span></div>
    <div class="r-sep"></div>
    <table class="r-tb">
      <thead><tr><th>Mặt hàng</th><th class="c">SL</th><th class="r">T.Tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="r-kv"><span>Tiền hàng</span><b>${pMoney(sub)}</b></div>
    ${o.packaging ? `<div class="r-kv"><span>Hộp mang về</span><b>${pMoney(o.packaging)}</b></div>` : ''}
    ${o.ship ? `<div class="r-kv"><span>Phí giao hàng</span><b>${pMoney(o.ship)}</b></div>` : ''}
    ${disc ? `<div class="r-kv"><span>Tổng giảm giá</span><b>- ${pMoney(disc)}</b></div>` +
      (o.discounts || []).map(d => `<div class="r-kv sm"><span>+ ${pEsc(d.label)}</span><span>${pMoney(d.amount)}</span></div>`).join('')
      : ''}
    <div class="r-sep"></div>
    <div class="r-total"><span>THANH TOÁN</span><b>${pMoney(total)}đ</b></div>
    <div class="r-kv"><span>${METHOD_PRINT[o.method] || o.method}</span><b>${pMoney(total)}đ</b></div>
    ${o.method === 'COD' && cash ? `
      <div class="r-kv"><span>Tiền khách đưa</span><span>${pMoney(cash)}</span></div>
      <div class="r-kv"><span>Tiền thừa</span><span>${pMoney(Math.max(0, cash - total))}</span></div>` : ''}
    ${o.payment !== 'PAID' ? `<div class="r-warn">** ${meta('payment', o.payment).label.toUpperCase()} **</div>` : ''}
    ${o.tier ? `<div class="r-kv sm"><span>Điểm cộng đơn này</span><span>+${Math.floor((sub - disc) / 1000)} điểm</span></div>` : ''}
    <div class="r-sep dash"></div>
    <div class="r-foot">${pEsc(cfg.footer)}</div>
    ${cfg.showWifi ? `<div class="r-foot"><b>Wifi: ${pEsc(cfg.wifiName)}</b><br><b>Pass: ${pEsc(cfg.wifiPass)}</b></div>` : ''}
  </div>`
}

/** Số hoá đơn: ngày + mã đơn. Đủ để tra ngược ra đơn mà không lộ số đơn quán bán mỗi ngày
 *  cho người cầm hoá đơn. Bản thật cấp theo dãy liên tục của từng chi nhánh (spec 12 §7). */
function receiptNo(o) {
  const d = new Date(o.at)
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${o.code.replace(/\D/g, '')}`
}

/* ==== CSS chung cho cả hai mẫu ====
   Khổ giấy tính bằng mm để bản xem trước đúng bằng bản in ra. In sai khổ thì chữ bị cắt
   mất cột SL bên phải — lỗi chỉ lộ ra khi giấy đã chạy. */
function printCss() {
  return `
  .pr{font-family:"Be Vietnam Pro",system-ui,sans-serif;color:#000;background:#fff;
      padding:4mm 3mm;line-height:1.35;box-sizing:border-box;}
  .pr-80{width:80mm;font-size:12px;}
  .pr-58{width:58mm;font-size:10.5px;}
  .pr table{width:100%;border-collapse:collapse;}
  /* Dòng "máy nào in tờ này" — chỉ để người duyệt đối chiếu định tuyến, in thật thì bỏ đi được */
  .pr-dest{font-size:.8em;color:#555;border-bottom:1px dotted #999;margin-bottom:3px;padding-bottom:2px;}
  .pr .c{text-align:center;} .pr .r{text-align:right;}

  /* --- Phiếu bếp --- */
  .k-top{display:flex;justify-content:space-between;font-size:.95em;}
  .k-code{font-size:1.5em;font-weight:800;margin-top:2px;display:flex;justify-content:space-between;align-items:center;gap:6px;}
  .k-ful{font-size:.55em;font-weight:800;border:1.5px solid #000;border-radius:4px;padding:1px 5px;}
  .k-ful.hot{background:#000;color:#fff;}
  .k-where{font-weight:800;font-size:1.15em;margin-top:2px;}
  .k-staff{font-size:.95em;}
  .k-note{font-style:italic;font-size:.95em;}
  .k-note.big{font-weight:700;font-style:italic;margin:2px 0;}
  .k-tb{margin-top:6px;border:1px solid #000;}
  .k-tb th,.k-tb td{border:1px solid #000;padding:3px 4px;vertical-align:top;text-align:left;}
  .k-tb th{font-size:1.05em;}
  .k-name{font-weight:800;font-size:1.15em;}
  .k-op{font-size:1em;}
  .k-unit{width:34px;text-align:center;}
  .k-qty{width:26px;text-align:center;font-weight:800;font-size:1.2em;}
  .k-pack{margin-top:6px;font-weight:800;text-align:center;border:1px dashed #000;padding:3px;}
  /* Dấu đóng: to, đen, không thể lướt qua */
  .k-stamp{text-align:center;font-weight:800;letter-spacing:1px;border:2px solid #000;
           padding:3px;margin-bottom:4px;font-size:1.15em;}
  .k-stamp.void{background:#000;color:#fff;}
  .k-stamp.add{border-style:dashed;}
  .k-stamp.again{border-width:1px;font-size:1em;}

  /* --- Hoá đơn --- */
  .r-shop{text-align:center;font-weight:800;font-size:1.35em;}
  .r-addr{text-align:center;font-size:.95em;}
  .r-title{text-align:center;font-weight:800;font-size:1.25em;margin-top:6px;}
  .r-no{text-align:center;font-size:.95em;}
  .r-sep{border-top:1px dashed #000;margin:6px 0;}
  .r-sep.dash{margin:8px 0 6px;}
  .r-kv{display:flex;justify-content:space-between;gap:8px;margin:2px 0;}
  .r-kv.sm{font-size:.9em;}
  .r-tb{margin:6px 0;border:1px solid #000;}
  .r-tb th,.r-tb td{border:1px solid #000;padding:3px 4px;vertical-align:top;text-align:left;}
  .r-tb .r-op td,.r-tb .r-note td{font-size:.92em;}
  .r-tb .r-note td{font-style:italic;}
  .r-total{display:flex;justify-content:space-between;font-weight:800;font-size:1.2em;margin:4px 0;}
  .r-warn{text-align:center;font-weight:800;border:2px solid #000;padding:3px;margin-top:4px;}
  .r-foot{text-align:center;margin-top:6px;font-size:.95em;}`
}

/* ==== Gửi lệnh in ====
   Dùng iframe ẩn thay vì window.open: cửa sổ bật lên bị trình duyệt chặn mặc định, và
   nhân viên ở quầy sẽ không hiểu vì sao "bấm in mà không ra gì". */
function sendToPrinter(html, title, paper) {
  const old = document.getElementById('hikari-print-frame')
  if (old) old.remove()
  const f = document.createElement('iframe')
  f.id = 'hikari-print-frame'
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(f)
  const doc = f.contentWindow.document
  doc.open()
  doc.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${pEsc(title || 'In')}</title>
    <style>
      @page{size:${paper || printCfg().paper}mm auto;margin:0;}
      html,body{margin:0;padding:0;background:#fff;}
      /* Mỗi liên / mỗi trạm là một tờ riêng — dính nhau thì phải cắt tay giữa ca đông khách. */
      .pr{page-break-after:always;}
      .pr:last-child{page-break-after:auto;}
      ${printCss()}
    </style></head><body>${html}</body></html>`)
  doc.close()
  f.contentWindow.focus()
  f.contentWindow.print()
}

/* ==== API cho các màn dùng ====
   Mỗi hàm trả về BÁO CÁO chứ không chỉ số tờ: người bấm phải biết giấy ra ở máy nào, và
   biết ngay khi bản in phải đi đường dự phòng hoặc không in được. Nút bấm im lặng "thành công"
   trong khi bếp không nhận được gì là kiểu hỏng tệ nhất của tính năng in. */
const Print = {
  /** In phiếu bếp — mỗi trạm một tờ, gộp theo MÁY IN sẽ nhận.
   *  Trả { sheets, jobs:[{printer, sheets, fallbackFrom, reason}], failed:[...] } */
  kitchen(code, opts = {}) {
    const o = ORDERS.find(x => x.code === code)
    if (!o) return { sheets: 0, jobs: [], failed: [] }
    const again = printCountOf(code, 'kitchen')
    const jobs = new Map()      // printerId → { printer, html, sheets, fallbackFrom, reason }
    const failed = []

    splitByStation(o).forEach(g => {
      const r = resolvePrinter(o, 'KITCHEN', g.station)
      if (!r.printer) { failed.push({ station: g.station, reason: r.reason }); return }
      const tk = kitchenTicketHtml(o, g, Object.assign(
        { reprint: again, paper: r.printer.paper, dest: r.printer.name }, opts))
      const cur = jobs.get(r.printer.id)
      if (cur) { cur.html += tk; cur.sheets++ }
      else jobs.set(r.printer.id, { printer: r.printer, html: tk, sheets: 1, fallbackFrom: r.fallbackFrom, reason: r.reason })
    })

    // Bản thật: mỗi job là một lệnh ESC/POS gửi riêng tới từng máy. Prototype in bằng trình duyệt
    // nên gộp làm một tài liệu, mỗi tờ ghi rõ máy nhận ở dòng đầu.
    const list = [...jobs.values()]
    if (list.length) {
      sendToPrinter(list.map(j => j.html).join(''), `Phiếu bếp #${code}`, list[0].printer.paper)
      markPrinted(code, 'kitchen')
    }
    return { sheets: list.reduce((n, j) => n + j.sheets, 0), jobs: list, failed }
  },

  /** In hoá đơn — đủ số liên đã cấu hình, ra máy của tuyến RECEIPT. */
  receipt(code, opts = {}) {
    const o = ORDERS.find(x => x.code === code)
    if (!o) return { sheets: 0, jobs: [], failed: [] }
    const r = resolvePrinter(o, 'RECEIPT')
    if (!r.printer) return { sheets: 0, jobs: [], failed: [{ station: 'RECEIPT', reason: r.reason }] }
    const n = printCfg().copies
    const html = Array.from({ length: n }, (_, i) => receiptHtml(o, Object.assign(
      { copy: i + 1, paper: r.printer.paper, dest: r.printer.name }, opts))).join('')
    sendToPrinter(html, `Hoá đơn #${code}`, r.printer.paper)
    markPrinted(code, 'receipt')
    return { sheets: n, jobs: [{ printer: r.printer, sheets: n, fallbackFrom: r.fallbackFrom, reason: r.reason }], failed: [] }
  },

  /** In thử một máy — để biết máy còn sống và nạp đúng khổ giấy, trước khi vào ca. */
  test(printerId) {
    const p = printerById(printerId)
    if (!printerReady(p)) return false
    sendToPrinter(`<div class="pr pr-${p.paper}">
      <div class="r-title">PHIẾU IN THỬ</div>
      <div class="r-kv"><span>Máy in</span><b>${pEsc(p.name)}</b></div>
      <div class="r-kv"><span>Vị trí</span><span>${pEsc(p.place)}</span></div>
      <div class="r-kv"><span>Kết nối</span><span>${PRINTER_KIND_LABEL[p.kind]} · ${pEsc(p.address || '—')}</span></div>
      <div class="r-kv"><span>Khổ giấy</span><b>${p.paper}mm</b></div>
      <div class="r-sep dash"></div>
      <div class="r-foot">Tiếng Việt có dấu: Trà sữa ô long, mì Ramen, đậu hủ</div>
      <div class="r-foot">${pDateTime(Date.now())}</div>
    </div>`, `In thử ${p.name}`, p.paper)
    return true
  },

  countOf: printCountOf,
  kitchenTicketHtml, receiptHtml, splitByStation, printCss, printCfg, savePrintCfg, resetPrintCfg,
  printers, savePrinters, printRoutes, savePrintRoutes, resetPrinters, resolvePrinter, paperFor,
}
