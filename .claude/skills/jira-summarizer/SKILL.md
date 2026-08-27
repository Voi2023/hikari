---
name: jira-summarizer
description: Tóm tắt ticket/yêu cầu nghiệp vụ thành spec actionable cho DMCL Super App — map sang service sở hữu dữ liệu, contract API + envelope v2, rủi ro định danh/hệ thống ngoài, và câu hỏi phải hỏi PM trước khi dev.
when:
  - User dán link/nội dung ticket (Jira, Linear, issue), hoặc mã ticket
  - User dán yêu cầu nghiệp vụ dạng thô ("cần thêm chức năng X")
  - User asks "tóm tắt ticket", "spec từ ticket này"
allowed-tools:
  - Read
  - Grep
  - Bash(codegraph explore:*)
  - WebFetch
---

# Ticket → Spec Summarizer — DMCL Super App

Biến ticket thành spec **đủ để dev bắt đầu**, hoặc chỉ ra chính xác chỗ còn thiếu. Không sao chép lại description.

⚠️ Repo này **chưa cấu hình MCP Jira/Linear**. Nếu chỉ có link, hãy yêu cầu user dán nội dung
(title, description, comment, ảnh) — đừng đoán nội dung ticket.

## Bước 1 — Map yêu cầu vào hệ thống (giá trị lớn nhất của skill này)

| Câu hỏi | Cách trả lời |
|---|---|
| **Service nào sở hữu dữ liệu?** | order (đơn hàng) · loyalty (hội viên/CRM) · identity (đăng nhập/OTP) · voucher · payment · tracking · service-mgmt · brand · ecom |
| **Dữ liệu ở đâu?** | DB của service · hệ thống ngoài (CRM `InforCustomer`, OrderWeb, API OTP) · cả hai (external + bản sao DB) |
| **Service đó có chạy ở prod chưa?** | Prod chỉ bật **identity · order · loyalty**; 6 service còn lại đang ẩn → cần bật kèm gateway conf |
| **Đã có endpoint/luồng tương tự chưa?** | `codegraph explore "<nghiệp vụ>"` + `docs/Codebase-Overview.md` + `bruno/<svc>/` |
| **Ai là người dùng?** | khách hàng app (định danh qua SSO `X-User-Phone`) hay **back-office** (cần `X-Admin-Token`) |

## Bước 2 — Output

```markdown
# <ID>: <title>

## TL;DR
<2-3 dòng: cần làm gì, cho ai, vì sao>

## Map vào hệ thống
- Service sở hữu: `<svc>` (prod: bật/ẩn)
- Nguồn dữ liệu: DB `<svc>` / external `<CRM|OrderWeb|OTP>` / cả hai
- Người dùng: khách app (SSO) | back-office (AdminGuard)
- Đã có sẵn: `<endpoint/luồng hiện có>` → nên mở rộng thay vì làm mới

## Acceptance Criteria (trích + chuẩn hoá)
✅ <AC rõ ràng>
✅ <AC rõ ràng>
⚠️ Chưa rõ: <điểm mơ hồ — đưa vào mục câu hỏi>

## Contract dự kiến
- `<METHOD> /api/v1/<resource>` — qua gateway: `/<svc>/api/v1/<resource>`
- Envelope v2: `{success, status, message, data, errors, meta{requestId,timestamp,version}}`
- Status: thành công 200/201 · list rỗng 200+`[]` · detail không có 404 · sai định dạng 400 ·
  thiếu field 422 · phone khác SSO 403 · lỗi hệ thống 502
- Bruno: cần thêm `bruno/<svc>/NN-<ten>.bru`

## Ảnh hưởng kỹ thuật
- DB: <bảng/cột/index mới → cần schema.sql hoặc Prisma>
- External: <API upstream nào, có mock chưa, timeout 3s>
- Cache: <key Redis, TTL, invalidate khi nào>
- Gateway: <cần prefix mới? public hay SSO?>
- Deploy: <env mới, service phải bật ở prod, migration>

## Rủi ro
- Định danh/IDOR: <user có thể xem dữ liệu người khác không?>
- Hệ thống ngoài lỗi/timeout → hành vi mong đợi (200 rỗng? 404? 502?)
- Race/idempotency: <hai request cùng lúc thì sao>
- PII: <field nhạy cảm, không được log>

## ❓ Questions cho PM (phải trả lời TRƯỚC khi dev)
1. ...
2. ...

## Next step
1. Gửi questions cho PM
2. Có câu trả lời → `ba` viết User Story + AC đầy đủ → `leader` phân rã task
3. Không cần chờ: <việc có thể làm song song, vd chuẩn bị schema/mock external>
```

## Câu hỏi hay thiếu trong ticket của hệ thống này (dùng làm gợi ý)

- Dữ liệu lấy từ **CRM/OrderWeb (external)** hay từ DB service? Nếu external chết thì user thấy gì —
  màn hình rỗng (200) hay báo lỗi (502)?
- Endpoint này **user tự xem dữ liệu của mình** hay **nhân viên tra cứu theo SĐT khách**?
  (quyết định SSO vs AdminGuard — sai là rò rỉ dữ liệu)
- Dữ liệu cần **realtime** hay cache được (TTL bao lâu)?
- Có phân trang không, mặc định `limit` bao nhiêu, trần bao nhiêu?
- Ghi dữ liệu: nếu external lỗi thì **lưu local chờ đồng bộ** (như `web_orders.synced=false`) hay **fail luôn**?
- Có cần ghi audit (ai sửa gì, khi nào)?
- Tiền tệ/số lượng: đơn vị, làm tròn, âm có hợp lệ không?
- Ticket có yêu cầu **bật service đang ẩn ở prod** không (kéo theo gateway conf + CI + env)?

## Nếu ticket viết quá sơ sài

```
⚠️ Ticket chưa đủ để dev. Cần bổ sung:
- Ai dùng (khách app / nhân viên)? Bao nhiêu lần/ngày?
- Dữ liệu nguồn ở đâu (CRM? DB nào?)
- Hành vi khi external lỗi / không tìm thấy dữ liệu?
- Field cụ thể cần trả về + ví dụ response mong muốn
- Tiêu chí nghiệm thu đo được

→ Gửi PM trước khi start. Trong lúc chờ có thể làm: <việc không phụ thuộc câu trả lời>
```

## Anti-patterns

- ❌ Tóm tắt = copy description (không thêm giá trị)
- ❌ Không map vào service/dữ liệu thật → dev lạc hướng
- ❌ Bỏ mục câu hỏi cho PM rồi tự đoán nghiệp vụ
- ❌ Estimate khi scope còn mơ hồ
- ❌ Bỏ qua rủi ro định danh (ticket hiếm khi nói, nhưng luôn tồn tại)
- ❌ Quên hỏi hành vi khi hệ thống ngoài lỗi (nguồn bug nhiều nhất của hệ thống)

## References

- `docs/Codebase-Overview.md` · `docs/SuperApp-DMCL.md` · `bruno/` (contract đang chạy)
- Agent tiếp nối: `ba` (User Story + AC) → `leader` (phân rã) → `dev-backend`/`dev-node`
