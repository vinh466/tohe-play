# D-07 — Nhận license nào, ghi nguồn gốc ra sao, asset do AI tạo thì thế nào?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-09, D-10 · Blocked by: —
- Decided: owner, chat 2026-10-22: "chốt B nhé"; license asset Tò He để sau (2026-10-23)

## Why it matters

Repo public. Một asset sai license đưa vào là phân phối trái phép ngay lập tức. Backlog đã ghi RPG "would benefit from an
ADR on asset licensing" (`docs/roadmap/game-backlog.md:115`).

## What is true today

- Repo **chưa có LICENSE** (`gh repo view`, 2026-10-22). Asset do Tò He tự làm chưa có license nào.
- Pack Kenney là CC0. Ludii dataset là CC BY 4.0. Simon Tatham's Puzzles là MIT (R-01, R-02).
- US Copyright Office, Part 2 (2025-01-29): output thuần AI chỉ được bảo hộ khi có phần biểu đạt do người tạo ra; prompt
  không đủ (R-01). Luật Việt Nam chưa được tra.
- Điều khoản của từng vendor AI (PixelLab, Scenario…) về quyền dùng thương mại và phân phối lại chưa được tra.

## Options

### A — Chỉ CC0

Đơn giản nhất, không cần ghi công. Nhưng loại bỏ nhiều pack CC-BY tốt và font OFL.

### B — Danh sách cho phép, có ghi công tự động

- **Nhận:** CC0, CC-BY 4.0, OFL 1.1 (font), MIT/BSD/Apache-2.0.
- **Từng trường hợp, owner quyết:** CC-BY-SA.
- **Không nhận:** NC, ND (không đổi palette được), "free for personal use", license không rõ.
- **Asset do AI tạo:** được nhận khi có đủ nguồn gốc (vendor, model, prompt, seed, ngày, gói dịch vụ) **và** điều khoản
  vendor cho dùng thương mại và phân phối lại. Bắt buộc người duyệt (D-09). Chấp nhận rằng bản thuần AI có thể không có
  bản quyền, nên người khác chép được. Với một nền tảng gia đình, điều này chấp nhận được.
- **Ghi công:** màn credits của mỗi game được sinh từ lock (*Done when* 4).
- **Asset của Tò He** (người hay AI làm cho Tò He): phát hành dưới một license chung. Owner chọn, ví dụ CC-BY 4.0, hoặc
  giữ mọi quyền.

### C — Không giới hạn, ghi chú từng asset

Linh hoạt, nhưng rủi ro cao trên repo public và không máy kiểm nào kiểm được.

## Recommendation

**B.** Máy kiểm được: SPDX nằm trong danh sách cho phép, `source` đủ trường, AI thì phải có vendor nằm trong danh sách
đã tra điều khoản.

Chi phí chấp nhận: phải tra điều khoản từng vendor trước khi dùng (một mục trong D-10), và có thêm màn credits trong kit
shell.

## Decision

**B**, owner: "chốt B nhé" (2026-10-22).

- **Nhận:** CC0, CC-BY 4.0, OFL 1.1, MIT/BSD/Apache-2.0.
- **CC-BY-SA:** owner quyết từng trường hợp, như trong B.
- **Không nhận:** NC, ND, "free for personal use", license không rõ.
- **Asset AI:** nhận khi có đủ nguồn gốc, điều khoản vendor cho phép, và có người duyệt.
- **Credits:** sinh từ lock.

**License cho asset Tò He tự làm: để sau** (owner, chat 2026-10-23: "ok chốt theo đề xuất ổn"). Mở lại khi chọn
LICENSE cho code. Trong lúc chờ, metadata ghi `LicenseRef-Tohe-Internal`, nghĩa là chỉ dùng trong game của Tò He. Máy
kiểm của D-09 nhận giá trị này cho pack có `source` là `ai`, `code` hay `upload` của Tò He.

**Hệ quả:**

- D-09: máy kiểm SPDX theo danh sách trên.
- D-10: tra điều khoản từng vendor trước khi dùng.
- E-03: màn credits trong kit shell.

## Discussion

**agent** (2026-10-22): đây là ý kiến kỹ thuật, không phải tư vấn pháp lý. LICENSE cho **code** của repo nằm ngoài plan
(xem brief, *Not this plan*), nhưng câu 2 ở trên nên được trả lời cùng lúc với nó.
