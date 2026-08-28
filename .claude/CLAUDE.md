<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Tài liệu specs

`docs/specs/` **chỉ dùng HTML** (`.html`) — không tạo file Markdown trong thư mục này.
Spec mới: copy khung của một spec sẵn có (brand tokens inline + topbar điều hướng), đặt tên `NN-ten.html`,
rồi cập nhật `docs/specs/FEATURES.html`.
