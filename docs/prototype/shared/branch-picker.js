/* Hikari — màn chọn chi nhánh của Mini App (prototype).
 *
 * Khách phải chọn chi nhánh TRƯỚC khi xem menu: giờ mở cửa, vùng giao, món còn/hết
 * là của từng quán, không phải của "Hikari" nói chung.
 *
 * Dùng chung nguồn với dashboard: shared/branches.js (nạp trước file này).
 *   <script src="shared/branches.js"></script>
 *   <script src="shared/branch-picker.js"></script>
 *   BranchPicker.ensure(function (b) { ... })   // mở màn chọn nếu chưa chọn
 *   BranchPicker.open({ onPick: fn })           // đổi chi nhánh
 *   BranchPicker.current()                      // chi nhánh đang chọn (hoặc null)
 *
 * Thật thì danh sách lấy từ GET /api/v1/branches — server CHỈ trả chi nhánh đang nhận đơn
 * (đừng để client tự lọc: client cũ chưa cập nhật sẽ vẫn cho đặt vào quán đang nghỉ).
 */
(function (global) {
  'use strict';

  var KEY = 'hikari_branch';
  var root = null, onPick = null, dismissible = false, located = null;

  /* Toạ độ khách — chỉ có sau khi khách bấm "Tìm chi nhánh gần tôi" (mô phỏng getLocation) */
  var FAKE_CUSTOMER = { lat: 10.7869, lng: 106.6839 };   // đâu đó ở Quận 3

  function get() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }
  function set(id) {
    try { sessionStorage.setItem(KEY, id); } catch (e) {}
  }

  function current() {
    var id = get();
    if (!id) return null;
    var b = BRANCHES.filter(function (x) { return x.id === id; })[0];
    // Chi nhánh đang chọn có thể vừa bị tắt ở dashboard — lúc đó coi như chưa chọn.
    return b && branchIsTakingOrders(b) ? b : null;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function card(b) {
    var st = branchState(b);
    var open = st === 'OPEN';
    var badge = open
      ? '<span class="bp-badge open">Đang mở</span>'
      : st === 'PAUSED'
        ? '<span class="bp-badge pause">Tạm nghỉ</span>'
        : '<span class="bp-badge closed">Ngoài giờ mở cửa</span>';
    var why = open ? ''
      : st === 'PAUSED'
        ? '<div class="bp-why">' + esc(b.pauseReason || 'Quán tạm ngưng nhận đơn') +
          (b.pauseUntil ? ' · dự kiến mở lại ' + esc(b.pauseUntil) : '') + '</div>'
        : '<div class="bp-why">Mở cửa lúc ' + b.open + ' — bạn đặt trước được từ giờ đó.</div>';
    var dist = located ? '<span class="bp-dist">📏 ' + branchDistanceKm(b, located.lat, located.lng) + ' km</span>' : '';

    return '<div class="bp-card' + (open ? '' : ' off') + '"' +
      (open ? ' onclick="BranchPicker.pick(\'' + b.id + '\')"' : '') + '>' +
      '<div class="bp-top"><strong>' + esc(b.name) + '</strong>' + badge + '</div>' +
      '<div class="bp-addr">📍 ' + esc(b.address) + '</div>' +
      '<div class="bp-meta"><span>🕘 ' + b.open + ' – ' + b.close + '</span>' + dist +
      (b.services.delivery ? '<span>🛵 giao ' + b.radiusKm + ' km</span>' : '<span>không giao hàng</span>') + '</div>' +
      why + '</div>';
  }

  /* Không còn chi nhánh nào nhận đơn — nói rõ vì sao và bao giờ mở lại,
     đừng để khách bấm loanh quanh rồi tưởng app hỏng. */
  function allClosed() {
    var reasons = BRANCHES.map(function (b) {
      var st = branchState(b);
      return '<li><strong>' + esc(b.name) + '</strong> — ' +
        (st === 'PAUSED' ? esc(b.pauseReason || 'tạm nghỉ') : 'ngoài giờ, mở lúc ' + b.open) + '</li>';
    }).join('');
    return '<div class="bp-empty">' +
      '<div class="bp-ic">🍵</div>' +
      '<h3>Quán đang tạm nghỉ</h3>' +
      '<p class="bp-sub">Cả ' + BRANCHES.length + ' chi nhánh đều chưa nhận đơn lúc này.</p>' +
      '<ul class="bp-reasons">' + reasons + '</ul>' +
      '<button class="bp-btn" onclick="BranchPicker.render()">Thử lại</button>' +
      '</div>';
  }

  function render() {
    var anyOpen = BRANCHES.some(function (b) { return branchIsTakingOrders(b); });
    var list = BRANCHES.slice();
    if (located) {
      list.sort(function (x, y) {
        return branchDistanceKm(x, located.lat, located.lng) - branchDistanceKm(y, located.lat, located.lng);
      });
    }
    root.innerHTML =
      '<div class="bp-head">' +
        (dismissible ? '<button class="bp-close" onclick="BranchPicker.close()">‹</button>' : '<span class="bp-close" aria-hidden="true"></span>') +
        '<div><div class="bp-logo">Hikari</div><div class="bp-tag">vegetarian cafe</div></div>' +
        '<span class="bp-close" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="bp-body">' +
        (anyOpen
          ? '<h2 class="bp-title">Bạn đặt ở chi nhánh nào?</h2>' +
            '<p class="bp-sub">Giờ mở cửa, vùng giao và món còn hàng của mỗi chi nhánh một khác.</p>' +
            '<button class="bp-near" onclick="BranchPicker.locate()">' +
              (located ? '✓ Đã sắp xếp theo chi nhánh gần bạn' : '📍 Tìm chi nhánh gần tôi') + '</button>' +
            list.map(card).join('') +
            '<p class="bp-fine">Đổi chi nhánh bất cứ lúc nào ở đầu màn menu. ' +
            'Giỏ hàng tính theo từng chi nhánh nên khi đổi quán, giỏ sẽ được làm mới.</p>' +
            '<div class="bp-api">API: GET /api/v1/branches — server chỉ trả chi nhánh đang nhận đơn</div>'
          : allClosed()) +
      '</div>';
  }

  var BranchPicker = {
    current: current,
    render: render,

    open: function (opts) {
      opts = opts || {};
      onPick = opts.onPick || null;
      dismissible = opts.dismissible !== false;
      if (!root) {
        inject();
        root = document.createElement('div');
        root.className = 'bp-wrap';
        (document.querySelector('.phone') || document.body).appendChild(root);
      }
      root.classList.add('open');
      render();
    },

    /* Mở màn chọn nếu khách chưa chọn (hoặc chi nhánh đang chọn vừa bị tắt) */
    ensure: function (cb) {
      var b = current();
      if (b) { if (cb) cb(b); return b; }
      BranchPicker.open({ onPick: cb, dismissible: false });
      return null;
    },

    pick: function (id) {
      var b = BRANCHES.filter(function (x) { return x.id === id; })[0];
      if (!b || !branchIsTakingOrders(b)) return;
      set(id);
      root.classList.remove('open');
      if (onPick) onPick(b);
    },

    close: function () { if (dismissible) root.classList.remove('open'); },

    /* Mô phỏng zmp-sdk getLocation — thật thì SDK trả token, server đổi sang toạ độ. */
    locate: function () { located = FAKE_CUSTOMER; render(); }
  };

  function inject() {
    var css = [
      '.bp-wrap{position:absolute;top:26px;left:0;right:0;bottom:0;background:var(--paper,#FAF8F3);z-index:60;display:none;flex-direction:column;}',
      '.bp-wrap.open{display:flex;}',
      '.bp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 12px 10px;border-bottom:1px solid var(--line,#E7E2D8);text-align:center;}',
      '.bp-logo{font-family:var(--font-script,cursive);font-weight:700;font-size:1.6rem;line-height:1;}',
      '.bp-tag{color:var(--matcha,#5F7A4A);font-weight:600;letter-spacing:2px;text-transform:lowercase;font-size:.6rem;}',
      '.bp-close{width:28px;border:none;background:transparent;font-size:1.3rem;color:var(--ink,#1C1B19);cursor:pointer;padding:0;}',
      '.bp-body{flex:1;overflow-y:auto;padding:16px;}',
      '.bp-title{font-size:1.1rem;margin:0 0 4px;}',
      '.bp-sub{color:var(--muted,#8A857C);font-size:.8rem;margin:0 0 12px;}',
      '.bp-near{width:100%;border:1px dashed var(--line,#E7E2D8);background:#fff;border-radius:12px;padding:10px;font:inherit;font-size:.82rem;font-weight:600;color:var(--matcha,#5F7A4A);cursor:pointer;margin-bottom:12px;}',
      '.bp-card{background:#fff;border:1px solid var(--line,#E7E2D8);border-radius:14px;padding:12px;margin-bottom:10px;cursor:pointer;box-shadow:0 2px 10px rgba(28,27,25,.05);}',
      '.bp-card:active{transform:translateY(1px);}',
      '.bp-card.off{opacity:.75;cursor:not-allowed;background:#f6f4ee;}',
      '.bp-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;}',
      '.bp-badge{font-size:.66rem;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;}',
      '.bp-badge.open{background:var(--matcha-soft,#EAF0E3);color:var(--matcha,#5F7A4A);}',
      '.bp-badge.pause{background:#fbe9e8;color:var(--chili,#D9534F);}',
      '.bp-badge.closed{background:#eee;color:var(--muted,#8A857C);}',
      '.bp-addr{font-size:.8rem;color:var(--muted,#8A857C);}',
      '.bp-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:.72rem;color:var(--muted,#8A857C);}',
      '.bp-why{margin-top:8px;background:#fff8e6;border:1px solid #f0e2b8;border-radius:10px;padding:8px 10px;font-size:.75rem;}',
      '.bp-fine{font-size:.7rem;color:var(--muted,#8A857C);margin-top:14px;}',
      '.bp-api{font-family:ui-monospace,Menlo,monospace;font-size:.62rem;color:var(--muted,#8A857C);background:#f1ede3;border-radius:8px;padding:5px 8px;margin-top:8px;}',
      '.bp-empty{text-align:center;padding:30px 6px;}',
      '.bp-ic{font-size:2.6rem;}',
      '.bp-empty h3{margin:10px 0 4px;}',
      '.bp-reasons{text-align:left;display:inline-block;margin:14px 0 0;padding-left:18px;font-size:.82rem;color:var(--muted,#8A857C);}',
      '.bp-reasons strong{color:var(--ink,#1C1B19);}',
      '.bp-btn{margin-top:20px;border:none;border-radius:12px;background:var(--ink,#1C1B19);color:#fff;font:inherit;font-weight:700;padding:11px 22px;cursor:pointer;}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'hikari-branch-picker-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  global.BranchPicker = BranchPicker;
})(window);
