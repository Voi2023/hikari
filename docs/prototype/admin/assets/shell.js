/* Khung app dùng chung cho 9 trang admin — bản HTML thuần của <AppShell> trong
   packages/ui-kit. Cùng tên class (.app-shell/.app-sidebar/.app-topbar…), nên khi dựng
   FE thật chỉ việc thay bằng component Vue, giao diện không đổi một pixel.

   Dựng nav ở MỘT chỗ: thêm một trang mà phải sửa 9 file HTML thì sớm muộn có file bị bỏ sót,
   và menu lệch nhau giữa các trang là lỗi rất khó thấy khi tự bấm thử. */
const NAV = [
  { group: 'Vận hành', items: [
    { page: 'tong-quan', icon: 'ti-layout-dashboard', label: 'Tổng quan' },
    { page: 'don-hang',  icon: 'ti-receipt',          label: 'Đơn hàng', badge: () => ORDERS.filter(o => o.status === 'NEW').length },
    { page: 'giao-hang', icon: 'ti-truck-delivery',   label: 'Giao hàng' },
  ]},
  { group: 'Kinh doanh', items: [
    { page: 'menu',       icon: 'ti-soup',      label: 'Menu & giá',  perm: 'menu' },
    { page: 'cai-dat-topping', icon: 'ti-tools-kitchen-2', label: 'Topping & phần thêm', perm: 'menu' },
    { page: 'khach-diem', icon: 'ti-users',     label: 'Khách & điểm', perm: 'points' },
    { page: 'thong-bao',  icon: 'ti-bell',      label: 'Thông báo',   perm: 'notify' },
    { page: 'bao-cao',    icon: 'ti-chart-bar', label: 'Báo cáo',     perm: 'report' },
  ]},
  { group: 'Hệ thống', items: [
    { page: 'chi-nhanh', icon: 'ti-building-store',  label: 'Chi nhánh',     perm: 'branch',
      badge: () => BRANCHES.filter(b => b.status === 'PAUSED').length },
    { page: 'cai-dat-giao-hang', icon: 'ti-settings-bolt', label: 'Cài đặt giao hàng', perm: 'ship' },
    { page: 'sapo',      icon: 'ti-plug-connected', label: 'Đồng bộ Sapo', perm: 'sapo' },
    { page: 'tai-khoan', icon: 'ti-shield-lock',    label: 'Tài khoản & nhật ký', perm: 'admin' },
  ]},
]

const Shell = {
  mount({ page, title, sub = '', actions = '' }) {
    const u = USERS[role()]
    const main = document.getElementById('page')
    const content = main ? main.innerHTML : ''

    document.body.insertAdjacentHTML('afterbegin', `
      <div class="app-shell">
        <aside class="app-sidebar" id="sidebar">
          <div class="app-brand">
            <div class="brand-row">
              <div style="cursor:pointer" onclick="location.href='tong-quan.html'">
                <div class="brand-logo" style="font-size:30px;color:#fff">Hikari</div>
                <div class="brand-sub">vegetarian cafe</div>
              </div>
              <span class="brand-mark" aria-hidden="true">H</span>
              <button class="rail-btn" type="button" title="Thu gọn menu" onclick="Shell.rail()">
                <i class="ti ti-chevron-left"></i></button>
            </div>
            <span class="portal-pill"><span class="dot"></span> Cổng quản trị</span>
          </div>
          <nav class="app-nav">${NAV.map(g => Shell.group(g, page)).join('')}</nav>
          <div class="app-user">
            <span class="avatar">${u.name.split(' ').pop()[0]}</span>
            <button class="who who-link" onclick="Shell.roleSwitcher()">
              <b>${u.name}</b><span>${meta('role', role()).label} · đổi vai trò</span>
            </button>
            <button title="Đăng xuất" onclick="location.href='dang-nhap.html'"><i class="ti ti-logout"></i></button>
          </div>
        </aside>
        <div class="app-main">
          <header class="app-topbar">
            <div style="display:flex;align-items:center;gap:12px">
              <button class="menu-btn" onclick="document.getElementById('sidebar').classList.toggle('open')">
                <i class="ti ti-menu-2"></i></button>
              <div><h1>${title}</h1>${sub ? `<div class="muted" style="font-size:12.5px">${sub}</div>` : ''}</div>
            </div>
            <div class="row-flex">${actions}</div>
          </header>
          <div class="app-content" id="app-content">${content}</div>
        </div>
      </div>`)
    if (main) main.remove()
    try { if (sessionStorage.getItem('hikari_nav_rail') === '1') Shell.rail(true) } catch {}

    /* Chế độ giao hàng (spec 10) đổi màu nền CẢ dashboard — người trực quán nhìn lướt là biết
       đang tự động hay tự giao. Trang nào chưa nạp cờ thì nạp ở đây, để không phải sửa từng file. */
    if (window.applyShipTheme) applyShipTheme()
    else if (!document.querySelector('script[data-ship-mode]')) {
      const s = document.createElement('script')
      s.src = '../shared/shipping-mode.js'; s.dataset.shipMode = '1'
      document.head.appendChild(s)
    }
  },

  group(g, page) {
    const items = g.items.map(it => {
      const n = it.badge ? it.badge() : 0
      // Mục ngoài quyền vẫn HIỆN nhưng mờ + khoá: ẩn hẳn thì nhân viên tưởng hệ thống thiếu
      // chức năng và đi hỏi vòng quanh, thay vì biết là mình không đủ quyền.
      const locked = it.perm && !can(it.perm)
      return `<a href="${locked ? 'javascript:void(0)' : it.page + '.html'}"
         class="${page === it.page ? 'router-link-active' : ''}"
         ${locked ? `style="opacity:.45" title="Vai trò hiện tại không có quyền" onclick="toast('<i class=\\'ti ti-lock\\'></i> Không đủ quyền — đổi vai trò ở góc dưới trái')"` : ''}>
        <i class="ti ${it.icon}"></i><span>${it.label}</span>
        ${locked ? '<i class="ti ti-lock" style="margin-left:auto;font-size:13px"></i>'
                 : (n ? `<span class="badge red" style="margin-left:auto;padding:1px 8px">${n}</span>` : '')}
      </a>`
    }).join('')
    return `<button class="app-nav-group" onclick="Shell.toggleGroup(this)"><span>${g.group}</span>
      <i class="ti ti-chevron-down nav-chev"></i></button><div class="app-nav-items">${items}</div>`
  },

  toggleGroup(btn) {
    btn.classList.toggle('collapsed')
    const box = btn.nextElementSibling
    box.style.display = btn.classList.contains('collapsed') ? 'none' : ''
  },

  rail(force) {
    const sb = document.getElementById('sidebar')
    const on = force === true ? true : !sb.classList.contains('collapsed')
    sb.classList.toggle('collapsed', on)
    sb.querySelector('.rail-btn i').className = 'ti ' + (on ? 'ti-chevron-right' : 'ti-chevron-left')
    try { sessionStorage.setItem('hikari_nav_rail', on ? '1' : '0') } catch {}
  },

  /* Đổi vai trò để duyệt RBAC (spec 07 §3) — chỉ có trong prototype, KHÔNG có ở bản thật. */
  roleSwitcher() {
    const rows = Object.keys(ROLE_CAN).map(r => `
      <label class="pick-item" style="align-items:flex-start">
        <input type="radio" name="role" value="${r}" ${r === role() ? 'checked' : ''} style="margin-top:4px">
        <div><b>${USERS[r].name}</b> ${badge('role', r)}
          <div class="meta">${USERS[r].email} · ${ROLE_CAN[r].length}/${PERM_TOTAL} nhóm quyền</div></div>
      </label>`).join('')
    const ov = modal({
      title: 'Đổi vai trò đang mô phỏng',
      sub: 'Chỉ có trong prototype — để duyệt xem mỗi vai trò nhìn thấy và bấm được gì (spec 07 §3).',
      body: `<div class="pick-list" style="max-height:none">${rows}</div>`,
      actions: `<button class="btn btn-outline" data-close>Đóng</button>
                <button class="btn btn-primary" onclick="Shell.applyRole()">Áp dụng</button>`,
    })
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal))
  },
  applyRole() {
    const r = document.querySelector('input[name=role]:checked')
    if (r) setRole(r.value)
  },
}

/* Ngày hôm nay dạng "Thứ Năm, 28/08/2026" cho dòng phụ ở topbar */
function todayLabel() {
  return new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
}
