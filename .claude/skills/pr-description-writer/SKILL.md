---
name: pr-description-writer
description: Viết commit message Conventional Commits và mô tả thay đổi (change summary / PR description khi được yêu cầu) cho DMCL Super App — dựa trên git diff, nêu rõ service ảnh hưởng, breaking change contract, migration, Bruno/doc đã cập nhật.
when:
  - User asks "viết commit message", "mô tả thay đổi", "viết PR", "tóm tắt diff"
  - User vừa xong một việc và chuẩn bị commit + push
  - User cần mô tả release lên branch production
allowed-tools:
  - Read
  - Grep
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git status:*)
  - Bash(git branch:*)
---

# Change / PR Description Writer — DMCL Super App

⚠️ **Quy trình của repo này**: commit + push **ngay** lên branch đang làm sau mỗi việc;
**KHÔNG tạo Pull Request trừ khi user yêu cầu rõ**. Vì vậy đầu ra mặc định của skill là
**commit message + change summary**, chỉ sinh PR description khi được yêu cầu (thường là gộp lên `production`).

## 1. Thu thập dữ kiện

```bash
git branch --show-current
git status --short
git diff --stat
git diff --name-only | sed 's|/[^/]*$||' | sort -u    # service/thư mục nào bị đụng
git log --oneline -10
```

Phân loại thay đổi theo **service** (`services/<svc>`), **gateway**, **compose/CI**, **bruno**, **docs**.

## 2. Commit message — Conventional Commits (theo `docs/Naming-Convention.md` mục 8)

```
<type>(<scope>): <mô tả ngắn, tiếng Việt, không dấu chấm cuối>
```

- `type`: `feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `ci` · `perf`
- `scope`: tên service hoặc thành phần — `order`, `loyalty`, `identity`, `ecom`, `gateway`, `compose`, `ci`, `docs`
- Ví dụ thật trong repo:
  - `feat(order): thêm 2 API admin đồng bộ lại đơn OrderWeb`
  - `fix(identity): tách mã lỗi internal (500) khỏi otp_invalid (400)`
  - `ci: chỉ test + build-push 3 service đang chạy (identity/order/loyalty)`
  - `prod: certbot docker — tự cấp + gia hạn cert Let's Encrypt cho nginx`

Body (khi thay đổi đáng kể) — 3 dòng, mỗi dòng 1 ý: **cái gì · vì sao · hệ quả vận hành**.
Nêu `BREAKING CHANGE:` nếu đổi contract API đang chạy.

## 3. Change summary (mặc định — dán vào chat/report cho leader)

```markdown
## Thay đổi
- **order-service**: thêm `GET /api/v1/orders/web/unsynced` — liệt kê đơn `synced=false` để re-sync
- **bruno**: `bruno/order/admin/01-unsynced-orders.bru`
- **docs**: `docs/Codebase-Overview.md` mục 5 (+ ngày cập nhật)

## Checks
- gofmt -l . : CLEAN · go vet : PASS · go build : PASS · go test -race : PASS (14 tests)

## Ảnh hưởng
- Contract: **thêm mới**, không phá endpoint cũ
- Envelope: v2 (`status`/`errors`/`meta`) — endpoint cũ vẫn v1
- DB: thêm index partial `idx_web_orders_unsynced` → cần chạy schema khi deploy
- Bảo mật: endpoint back-office → yêu cầu `X-Admin-Token`
- Prod: order-service đang bật ở prod ⇒ cần deploy

## Việc chưa làm
- Chưa migrate endpoint list cũ sang envelope v2 (chờ leader duyệt)
```

## 4. PR description (chỉ khi user yêu cầu)

```markdown
## Summary
<1-3 dòng: VÌ SAO cần thay đổi này, không kể lại diff>

## Changes
### Service
- feat(order): ...
### Gateway / Compose / CI
- ...
### Bruno / Docs
- ...

## Test plan
- [x] `go test ./... -race` — n/n pass
- [x] `gofmt -l .` clean · `go vet ./...` pass
- [x] Smoke qua gateway không token → 401
- [x] Smoke qua gateway có token → 200 + envelope đúng
- [x] Manual: <ca nghiệp vụ chính>

## Breaking changes
<None | endpoint/field nào đổi + client nào bị ảnh hưởng + cách chuyển tiếp>

## Migration / deploy notes
- Schema: <câu lệnh cần chạy, thời gian lock dự kiến>
- Env mới: `<VAR>` — cần provision ở `.env.production` / Vault trước khi deploy
- Service bị restart: <danh sách> · Rollback: <cách>

## Bảo mật
- Định danh: <lấy từ X-User-Phone? có AdminGuard?>
- Secret: không commit · log không chứa PII/token

## Linked
- Ticket: <ID> (nếu có)
```

## 5. Checklist trước khi commit (bám quy ước repo)

- [ ] Đã `git pull` branch đang làm trước khi bắt đầu
- [ ] Checks của service PASS (Go: gofmt/vet/build/test -race · loyalty: pnpm typecheck/test/build · ecom: npm test)
- [ ] Endpoint mới/đổi → **đã thêm/sửa request Bruno**
- [ ] Thay đổi có ý nghĩa kiến trúc → **đã ghi `docs/Codebase-Overview.md`** (+ doc service) **trong cùng commit**
- [ ] Không commit secret (`.env*.local`, cert, token) — `git status` không có file lạ
- [ ] Commit message đúng `<type>(<scope>): <mô tả>`
- [ ] Push ngay lên branch đang làm; **không tạo PR** nếu không được yêu cầu

## Anti-patterns

- ❌ `update code` / `fix bug` / `wip` làm commit message
- ❌ Commit code mà tách doc/Bruno sang commit khác (repo yêu cầu cùng commit)
- ❌ Mô tả kể lại diff thay vì nêu lý do và hệ quả
- ❌ Bỏ mục breaking change khi đã đổi field/status của endpoint đang chạy
- ❌ Ghi "đã test" mà không nêu lệnh + kết quả
- ❌ Tự tạo PR khi user chỉ nói "xong thì push"

## References

- `docs/Naming-Convention.md` (mục 8 — Git) · `CLAUDE.md` (quy trình git bắt buộc)
- `docs/Codebase-Overview.md` (mục 11–12 — quy ước phát triển & cập nhật doc)
- Conventional Commits: https://www.conventionalcommits.org
