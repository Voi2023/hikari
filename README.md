# Hikari Vegetarian Cafe — Zalo Mini App

> Zalo Mini App đặt món cho **Hikari Vegetarian Cafe** (quán chay món Nhật — ramen/udon, cà phê, trà, detox)
> tại **Quận 10, TP.HCM**. Gồm mini app cho khách, backend API, và dashboard quản trị.

- 📍 Vị trí: 10.7751709, 106.664583 — [Google Maps](https://maps.google.com/?q=10.7751709,106.664583) · Quận 10, TP.HCM
- 🎯 Định vị: đặt món tại quán / mang về / giao hàng · tích điểm · thanh toán ZaloPay/chuyển khoản · thông báo khuyến mãi
- 📄 Tài liệu: [`docs/specs/`](docs/specs/) · Prototype: [`docs/prototype/`](docs/prototype/) · Chức năng: [`docs/specs/FEATURES.html`](docs/specs/FEATURES.html)
- 🔒 Mọi trang HTML trong `docs/` hỏi mật khẩu khi mở: **`hikari@2026`** (xem [§6.1](#61-khoá-xem-tài-liệu-docs))

---

## 1. Kiến trúc & thư mục

Monorepo **pnpm workspace**, thuần TypeScript.

```text
hikari/
├─ apps/
│  ├─ mini-app/     # Zalo Mini App — React 18 + Vite + zmp-sdk/zmp-ui + Tailwind (khách hàng)
│  ├─ admin/        # Dashboard quản trị — Next.js 14 + Tailwind (đăng nhập 2FA)
│  └─ api/          # Backend — NestJS 10 + Prisma + PostgreSQL + Redis + Socket.IO
├─ packages/
│  ├─ shared/          # @hikari/shared — DTO/zod, envelope, contract dùng chung FE ↔ BE
│  ├─ ui-kit/          # @hikari/ui-kit — component Vue dùng chung (fork từ ui-kit DMCL)
│  └─ design-tokens/   # @hikari/design-tokens — tokens.css, nguồn chân lý giao diện
└─ docs/
   ├─ specs/        # Tài liệu & quy trình (mỗi chức năng 1 spec)
   ├─ prototype/    # Prototype HTML chạy được cho từng chức năng (bảng kiểm thử trực quan)
   └─ assets/       # Logo, ảnh menu, dữ liệu menu (menu.json), brand tokens
```

> ⚠️ Thư mục `apps/*` và `packages/shared` **chưa được khởi tạo code** — hiện dự án đang ở giai đoạn
> **specs + prototype** (xem `docs/`). README này mô tả quy trình deploy mục tiêu để chuẩn bị hạ tầng.
>
> `packages/ui-kit` và `packages/design-tokens` **đã có source** (fork từ UI kit DMCL, đổi tone theo
> logo Hikari) nhưng **chưa cài dependency** — prototype dùng thẳng file CSS, không qua npm.
> Xem [`packages/README.md`](packages/README.md).

**Tích hợp ngoài:** Zalo (đăng nhập Mini App, ZaloPay, OA gửi thông báo) · đơn vị giao hàng (BE giao hàng) ·
[Sapo](https://sapo.vn) (đẩy đơn quản lý bán hàng).

---

## 2. Yêu cầu môi trường

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | ≥ 20 LTS | |
| pnpm | ≥ 9 | `corepack enable` |
| Docker + Docker Compose | mới nhất | chạy PostgreSQL + Redis |
| Zalo Mini App CLI | mới nhất | `pnpm i -g zmp-cli` — build/deploy mini app |
| Tài khoản Zalo Developers | — | đăng ký Mini App tại [mini.zalo.me](https://mini.zalo.me), có **App ID** |

---

## 3. Chạy DEV (local)

### 3.1. Cài đặt

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env          # điền DATABASE_URL, REDIS_URL, JWT_SECRET, ZALO_*, ...
cp apps/mini-app/.env.example apps/mini-app/.env # VITE_API_URL, VITE_ZALO_APP_ID (chỉ biến public)
cp apps/admin/.env.example apps/admin/.env       # NEXT_PUBLIC_API_URL, ...
```

### 3.2. Hạ tầng (Postgres + Redis)

```bash
docker compose up -d postgres redis
pnpm --filter @hikari/api prisma migrate dev     # tạo schema + seed dev
```

### 3.3. Backend API

```bash
pnpm --filter @hikari/api start:dev              # http://localhost:3000 (REST + Socket.IO)
```

### 3.4. Mini App (Zalo)

```bash
pnpm --filter @hikari/mini-app dev               # dev server local (xem nhanh trên trình duyệt)
# hoặc chạy trong khung Zalo:
pnpm --filter @hikari/mini-app start             # zmp start — mở Zalo Mini App Studio, quét QR bằng Zalo
```

> Để test trong app Zalo thật: khai báo **App ID** ở `zmp-cli` (`zmp login`), rồi `zmp deploy` bản *development*
> → quét QR trong nhóm dev. Cần bật "Chế độ phát triển" cho Mini App trên portal Zalo.

### 3.5. Dashboard admin

```bash
pnpm --filter @hikari/admin dev                  # http://localhost:3001
```

---

## 4. Deploy PRODUCTION

Ba phần deploy **ba đường khác nhau** — đừng gộp:

### 4.1. Mini App → Zalo

Tự động qua [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

| Push nhánh | Environment | Mini App | Kết quả |
|---|---|---|---|
| `staging` | `uat` | Mini App UAT | bản **Testing** — tester quét QR dùng ngay |
| `production` | `production` | Mini App chính | bản **Testing** trên app thật — **còn phải gửi duyệt tay** |

> ⚠️ **CLI không đẩy được thẳng lên production.** `zmp-cli` chỉ có 2 bậc phiên bản
> (`versionStatus = { DEVELOPMENT: 0, TESTING: 2 }`) và không có lệnh gửi duyệt.
> Đây là chỗ hay hiểu nhầm nhất: CI xanh, cả nhóm tưởng đã lên, khách vẫn dùng bản tuần trước.

Sau khi workflow của nhánh `production` chạy xong, **vẫn còn một bước người làm**:
[mini.zalo.me](https://mini.zalo.me) → Quản lý phiên bản → chọn bản vừa đẩy → **Gửi duyệt** →
Zalo review → **Publish**. Yêu cầu: liên kết **OA (Official Account)**, khai báo domain API vào
whitelist, cấu hình quyền (`getPhoneNumber`, ZaloPay...).

**Vì sao 2 Mini App:** trong một Mini App, bản Testing và bản chính thức nằm chung một danh sách
phiên bản — đẩy UAT vào đó là trộn bản thử nghiệm với bản đang chờ duyệt.

**Secret khai theo từng environment** (Settings → Environments → `uat` / `production`), **không**
khai ở mức repo — khai mức repo là hai môi trường dùng chung `MINI_APP_ID` và bản UAT sẽ nằm nhầm
trong Mini App của khách:

| Secret | Lấy ở đâu |
|---|---|
| `ZALO_APP_ID`, `ZALO_APP_SECRET` | developers.zalo.me |
| `ZALO_REFRESH_TOKEN` | developers.zalo.me → Công cụ → API Explorer — **workflow tự xoay** sau mỗi lần chạy |
| `MINI_APP_ID` | mini.zalo.me — **khác** `ZALO_APP_ID`, rất hay khai nhầm |
| `ZALO_SECRET_ROTATOR_PAT` *(mức repo)* | PAT ghi được secrets của repo, để xoay refresh token |

Nên bật **Required reviewers** cho environment `production` — đó là chốt duyệt thật sự có tác dụng,
vì bản thân lệnh deploy không có bậc nào để chặn.

Chạy tay khi cần (`workflow_dispatch` cho phép chọn `uat`/`production`, nhưng deploy production
bắt buộc đứng ở nhánh `production`):

```bash
pnpm --filter @hikari/mini-app build
cd apps/mini-app
zmp login --app-id <MINI_APP_ID> --token <ACCESS_TOKEN>   # hoặc `zmp login` rồi quét QR
zmp deploy --passive --testing --desc "mô tả version"     # bản TESTING (đánh số, lưu lại)
zmp deploy --passive --desc "..."                         # bản DEVELOPMENT (nháp, bị ghi đè)
```

### 4.2. Backend API → Docker (VPS)

```bash
docker build -t hikari-api -f apps/api/Dockerfile .
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
pnpm --filter @hikari/api prisma migrate deploy   # chạy migration trên prod (có kiểm soát)
```

- Đứng sau reverse proxy (NGINX/Caddy) terminate **TLS (HTTPS)** — Zalo yêu cầu HTTPS cho API mini app.
- Mở đúng cấu hình **WebSocket upgrade** cho Socket.IO.
- Postgres/Redis chạy Docker, dữ liệu bền qua volume, **không** publish port ra ngoài.

### 4.3. Dashboard admin → Next.js

- Tự host: `pnpm --filter @hikari/admin build && pnpm --filter @hikari/admin start` (sau reverse proxy + TLS), hoặc
- Vercel: import repo, set root `apps/admin`, khai báo `NEXT_PUBLIC_*`.
- Bắt buộc **HTTPS** + đăng nhập **2FA** (chi tiết ở spec dashboard).

---

## 5. Biến môi trường (3 lớp — đừng nhầm)

| Lớp | File | Ghi chú |
|---|---|---|
| Mini App / Admin (public) | `apps/mini-app/.env`, `apps/admin/.env` | chỉ `VITE_*` / `NEXT_PUBLIC_*` — **nằm trong bundle, KHÔNG để secret** |
| API (secret) | `apps/api/.env` (dev), `apps/api/.env.production.local` (**gitignored**) | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ZALO_APP_ID`, `ZALO_OA_SECRET`, `ZALOPAY_*`, `SAPO_*`, `SHIPPING_*`, `TELEGRAM_*` |
| Compose | `.env` (dev), `.env.production` (prod) | interpolation `${VAR}` cho docker-compose |

> **Secret KHÔNG commit** (kể cả `.env.example`, `.env.production`). Lộ ⇒ rotate ngay, đặc biệt `ZALO_OA_SECRET`,
> `ZALOPAY_KEY`, `JWT_SECRET`.

---

## 6. Quy trình phát triển

- **Mỗi chức năng mới**: viết **spec HTML** (`docs/specs/NN-ten.html`) + **prototype HTML** (`docs/prototype/ten.html`)
  **trước khi code**, và ghi vào [`docs/specs/FEATURES.html`](docs/specs/FEATURES.html). (Xem [`docs/specs/README.html`](docs/specs/README.html).)
- Contract FE ↔ BE để ở `packages/shared` (một nguồn).
- Git: làm trên nhánh **`dev`**, commit + push sau mỗi việc.
- Luồng phát hành: **`dev`** (code hằng ngày, không deploy) → merge sang **`staging`** (tự deploy UAT)
  → merge sang **`production`** (tự đẩy bản chờ duyệt lên Mini App chính). Xem [§4.1](#41-mini-app--zalo).

### 6.1. Khoá xem tài liệu (`docs/`)

Mọi file HTML trong `docs/` hỏi mật khẩu trước khi hiện nội dung. Mật khẩu hiện tại: **`hikari@2026`**.
Nhập một lần là dùng được cho mọi trang trên cùng trình duyệt (lưu ở `localStorage`).

> ⚠️ **Đây không phải bảo mật.** Nội dung vẫn nằm nguyên trong file HTML — xem source, tắt JavaScript
> hoặc `curl` là đọc được mà không cần mật khẩu. Nó chỉ ngăn người vô tình mở trúng khi link bị
> chuyển tay. **Đừng dựa vào nó để chứa thứ thật sự nhạy cảm** (khoá API, dữ liệu khách hàng thật).
> Muốn kín thật thì phải để sau máy chủ có xác thực — repo private, Cloudflare Access, hoặc Basic Auth
> ở NGINX — tức chỗ mà nội dung **không được gửi xuống trình duyệt** trước khi kiểm tra danh tính.

Cơ chế: [`docs/assets/gate.js`](docs/assets/gate.js) + 2 dòng trong `<head>` mỗi file
(thẻ `<style id="hikari-gate">` giữ trang ẩn khi JS bị tắt). File chỉ lưu **hash SHA-256** của mật khẩu,
không lưu chuỗi gốc.

**Đổi mật khẩu:** mở bất kỳ trang docs nào → Console:

```js
Gate.hashPassword('mật khẩu mới')   // copy chuỗi hash in ra
```

rồi thay vào `PASS_HASH` trong [`docs/assets/gate.js`](docs/assets/gate.js). Mọi máy đang mở sẽ phải
nhập lại (trạng thái mở khoá được so theo hash, không phải cờ bật/tắt).

**Khoá lại trên máy mình:** Console → `Gate.lock()`.

**Thêm trang docs mới:** nhớ chèn 2 dòng gate vào `<head>` — nếu quên, trang đó mở tự do trong khi
mọi trang khác vẫn hỏi mật khẩu, và sẽ không ai phát hiện ra.

## 7. Trạng thái hiện tại

Xem [`docs/specs/FEATURES.html`](docs/specs/FEATURES.html) — bảng theo dõi 9 chức năng + dashboard, kèm link spec & prototype.
