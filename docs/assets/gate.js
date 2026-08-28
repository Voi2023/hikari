/* Hikari docs — khoá xem tài liệu bằng mật khẩu.
 *
 * ⚠️ ĐÂY KHÔNG PHẢI BẢO MẬT. Toàn bộ nội dung trang vẫn nằm trong file HTML: ai xem source,
 * tắt JavaScript, hay dùng `curl` đều đọc được mà không cần mật khẩu. Nó chỉ ngăn người
 * vô tình mở trúng — đúng mức "đừng đọc nếu không phải việc của bạn", không hơn.
 * Muốn kín thật thì phải để tài liệu sau một máy chủ có xác thực (repo private, Netlify/
 * Cloudflare Access, hoặc Basic Auth ở NGINX) — chỗ mà nội dung KHÔNG được gửi xuống
 * trình duyệt trước khi kiểm tra danh tính.
 *
 * Vì vậy ở đây chỉ lưu HASH của mật khẩu, không lưu chuỗi gốc: view-source sẽ không đọc
 * ra được mật khẩu để đi dùng ở chỗ khác (nhiều người dùng lại một mật khẩu cho nhiều nơi).
 *
 * Cách nhúng — thêm 2 dòng này vào <head> mỗi file HTML (sửa số cấp `../` cho đúng):
 *     <style id="hikari-gate">html{visibility:hidden!important}</style>
 *     <script src="../assets/gate.js"></script>
 *
 * Thẻ <style> đi kèm là cố ý: tắt JavaScript thì trang ở lại trạng thái ẩn thay vì hiện
 * hết nội dung ra.
 *
 * Đổi mật khẩu: chạy trong Console rồi thay giá trị PASS_HASH bên dưới:
 *     Gate.hash('hikari-docs|<mật khẩu mới>')
 */
(function () {
  'use strict'

  var SALT = 'hikari-docs'
  // sha256('hikari-docs|hikari@2026')
  var PASS_HASH = '22d7e64581b7da03df97c68f424e375e2f8423849c195d88f524f08b0732f34b'
  var STORE_KEY = 'hikari_docs_gate'

  /* ---- SHA-256 thuần JS ------------------------------------------------
     Không dùng crypto.subtle: nó vắng mặt ở vài trình duyệt khi mở file bằng
     giao thức file:// — mà mở thẳng file chính là cách các tài liệu này được xem. */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  function utf8Bytes(str) {
    var out = [], i, c
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i)
      if (c < 0x80) out.push(c)
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
      else { // cặp surrogate (emoji…)
        i++
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
      }
    }
    return out
  }

  function sha256(str) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
    var msg = utf8Bytes(str)
    var bitLen = msg.length * 8
    msg.push(0x80)
    while (msg.length % 64 !== 56) msg.push(0)
    // độ dài 64-bit big-endian (đủ dùng: mật khẩu không dài tới 2^32 bit)
    msg.push(0, 0, 0, 0, (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255)

    var w = new Array(64), i, j, a, b, c, d, e, f, g, hh, s0, s1, ch, maj, t1, t2
    function rr(x, n) { return (x >>> n) | (x << (32 - n)) }

    for (i = 0; i < msg.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = (msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) | (msg[i + j * 4 + 2] << 8) | msg[i + j * 4 + 3]
      }
      for (j = 16; j < 64; j++) {
        s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3)
        s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10)
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0
      }
      a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; g = h[6]; hh = h[7]
      for (j = 0; j < 64; j++) {
        s1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)
        ch = (e & f) ^ (~e & g)
        t1 = (hh + s1 + ch + K[j] + w[j]) | 0
        s0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)
        maj = (a & b) ^ (a & c) ^ (b & c)
        t2 = (s0 + maj) | 0
        hh = g; g = f; f = e; e = (d + t1) | 0
        d = c; c = b; b = a; a = (t1 + t2) | 0
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0
    }
    var out = ''
    for (i = 0; i < 8; i++) out += ('00000000' + (h[i] >>> 0).toString(16)).slice(-8)
    return out
  }

  /* ---- Lưu trạng thái đã mở khoá --------------------------------------
     localStorage trước (giữ được khi đóng tab), sessionStorage sau. Mở bằng file://
     ở một số trình duyệt chặn cả hai — khi đó đành nhập lại mỗi trang, thà vậy còn hơn
     vỡ trang vì một exception. */
  function store(op, val) {
    var boxes = []
    try { boxes.push(window.localStorage) } catch (e) { /* bỏ qua */ }
    try { boxes.push(window.sessionStorage) } catch (e) { /* bỏ qua */ }
    for (var i = 0; i < boxes.length; i++) {
      try {
        if (op === 'get') { var v = boxes[i].getItem(STORE_KEY); if (v) return v }
        else if (op === 'set') boxes[i].setItem(STORE_KEY, val)
        else boxes[i].removeItem(STORE_KEY)
      } catch (e) { /* bỏ qua */ }
    }
    return null
  }

  function unlock() {
    var s = document.getElementById('hikari-gate')
    if (s && s.parentNode) s.parentNode.removeChild(s)
    var ov = document.getElementById('hikari-gate-overlay')
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov)
    document.documentElement.style.visibility = ''
  }

  // Đã mở khoá trước đó? So bằng hash chứ không bằng cờ true/false: đổi mật khẩu là
  // mọi máy đang mở phải nhập lại, không thì đổi mật khẩu chẳng có tác dụng gì.
  if (store('get') === PASS_HASH) { document.addEventListener('DOMContentLoaded', unlock); unlock(); return }

  var CSS =
    '#hikari-gate-overlay{visibility:visible!important;position:fixed;inset:0;z-index:2147483647;' +
    'display:flex;align-items:center;justify-content:center;padding:20px;' +
    'background:radial-gradient(1200px 500px at 50% -10%,#E7EEDE,#FAF8F3);' +
    "font-family:'Be Vietnam Pro',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1C1B19}" +
    '#hikari-gate-overlay *{box-sizing:border-box;visibility:visible!important}' +
    '#hikari-gate-card{width:380px;max-width:100%;background:#fff;border:1px solid #E7E2D8;border-radius:20px;' +
    'box-shadow:0 2px 10px rgba(28,27,25,.06),0 12px 40px rgba(28,27,25,.10);padding:30px 28px;text-align:center}' +
    "#hikari-gate-card .hg-logo{font-family:'Caveat','Segoe Script',cursive;font-weight:700;font-size:42px;line-height:1}" +
    '#hikari-gate-card .hg-sub{color:#5F7A4A;font-weight:600;letter-spacing:2.5px;text-transform:lowercase;' +
    'font-size:11px;margin-bottom:22px}' +
    '#hikari-gate-card .hg-title{font-weight:700;font-size:15px;margin-bottom:4px}' +
    '#hikari-gate-card .hg-hint{color:#8A857C;font-size:13px;margin-bottom:18px;line-height:1.5}' +
    '#hikari-gate-card input{width:100%;font:inherit;font-size:15px;padding:12px 14px;border:1px solid #E7E2D8;' +
    'border-radius:11px;background:#FAF8F3;outline:none;text-align:center;letter-spacing:1px}' +
    '#hikari-gate-card input:focus{border-color:#5F7A4A;background:#fff;box-shadow:0 0 0 3px #EAF0E3}' +
    '#hikari-gate-card button{width:100%;margin-top:14px;font:inherit;font-weight:700;font-size:14px;' +
    'padding:12px;border:none;border-radius:11px;background:#5F7A4A;color:#fff;cursor:pointer}' +
    '#hikari-gate-card button:hover{background:#455936}' +
    '#hikari-gate-card .hg-err{color:#D9534F;font-size:13px;font-weight:600;min-height:20px;margin-top:10px}' +
    '#hikari-gate-card .hg-foot{color:#B3ADA2;font-size:11.5px;margin-top:16px;line-height:1.5}' +
    '@keyframes hg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}' +
    '.hg-shake{animation:hg-shake .28s}'

  function build() {
    var st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)

    var ov = document.createElement('div')
    ov.id = 'hikari-gate-overlay'
    ov.innerHTML =
      '<div id="hikari-gate-card">' +
        '<div class="hg-logo">Hikari</div><div class="hg-sub">vegetarian cafe</div>' +
        '<div class="hg-title">Tài liệu nội bộ</div>' +
        '<div class="hg-hint">Nhập mật khẩu để xem tài liệu &amp; prototype của dự án.</div>' +
        '<input id="hg-pass" type="password" autocomplete="current-password" placeholder="Mật khẩu" aria-label="Mật khẩu">' +
        '<button type="button" id="hg-go">Mở tài liệu</button>' +
        '<div class="hg-err" id="hg-err" role="alert"></div>' +
        '<div class="hg-foot">Chưa có mật khẩu? Hỏi người phụ trách dự án.</div>' +
      '</div>'
    document.body.appendChild(ov)

    var input = document.getElementById('hg-pass')
    var err = document.getElementById('hg-err')
    var card = document.getElementById('hikari-gate-card')
    input.focus()

    function submit() {
      var h = sha256(SALT + '|' + input.value)
      if (h === PASS_HASH) { store('set', h); unlock(); return }
      err.textContent = 'Mật khẩu không đúng.'
      input.value = ''
      card.classList.remove('hg-shake')
      void card.offsetWidth   // ép trình duyệt tính lại để animation chạy lại từ đầu
      card.classList.add('hg-shake')
      input.focus()
    }

    document.getElementById('hg-go').addEventListener('click', submit)
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit() })
    input.addEventListener('input', function () { err.textContent = '' })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build)
  else build()

  // Tiện cho việc đổi mật khẩu / khoá lại từ Console
  window.Gate = {
    hash: function (s) { return sha256(s) },
    hashPassword: function (pw) { return sha256(SALT + '|' + pw) },
    lock: function () { store('del'); location.reload() },
  }
})()
