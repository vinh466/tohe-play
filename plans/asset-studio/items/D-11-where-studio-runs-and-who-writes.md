# D-11 — Studio chạy ở đâu, và người, agent, CI mỗi bên được làm gì?

- Status: **proposed** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-05, E-07 · Blocked by: D-06
- Decided: —

## Why it matters

D-06 đặt state của Studio trong DB và file trong object storage, nên duyệt không còn đi qua PR. Pilot (E-07) cần một
chỗ để agent gửi bản nháp và một chỗ để owner duyệt, **trước** khi có asset nào dùng được. Đồng thời, luật hiện hành
không cho agent ghi vào production.

## What is true today

- `AGENTS.md:42`: "Production (toheplay.io.vn): read it from outside only; never write to its cluster."
- Console ở `console.toheplay.io.vn`, sau Cloudflare Access, có đăng nhập riêng với TOTP
  (`docs/architecture/admin.md:17`, `:188`). API có các route console tại `/api/admin` (ADR 0027, 0042).
- ADR 0042 giữ chỗ `studio.` cho "tools for making games, if they need permissions players do not have"
  (`packages/routes/src/map.ts:65`).
- D-06: build chỉ đọc bucket (manifest và file đã duyệt, đọc công khai), không gọi API.

## Options

### A — Module `Studio` trong API của Tò He; owner duyệt trong console; agent chỉ được tạo bản nháp bằng token hẹp

- **Người (owner):** xem, duyệt, ngừng dùng pack trong console. Đây là nơi có xác thực mạnh nhất (Access + TOTP). Sau
  này có upload trong console.
- **Agent:** một token chỉ có quyền `studio:draft`: tạo và sửa bản nháp, tải file lên vùng nháp. **Không** duyệt được,
  không đọc được dữ liệu người chơi. Owner cấp và thu hồi token trong console. MCP `tohe-studio` (D-10) chỉ là một client
  của token này.
- **CI:** chỉ đọc bucket, không cần token (D-06).
- **Chi phí:** một **ngoại lệ hẹp** cho `AGENTS.md:42`: agent được gọi API Studio của prod bằng token nháp, vẫn không
  bao giờ chạm cluster. Chỉ owner mở được ngoại lệ này. Request từ máy tới host console phải qua Access, nên cần một
  service token của Access, hoặc đặt endpoint nháp ở một host khác (chốt khi graduate, theo `@tohe/routes`).

### B — Studio là một deployment riêng tại `studio.`, có DB riêng

Agent ghi tự do vì đó không phải prod. Đổi lại phải thêm một deployment, một DB, một lần đăng nhập và một UI duyệt
riêng. Nặng hơn A nhiều, chỉ để né một ngoại lệ.

### C — Agent không ghi vào Studio; bản nháp đi qua PR, CI tải lên sau khi merge

Giữ nguyên luật. Nhưng state lại tách đôi giữa PR và DB, trong khi owner đã chọn state trong DB (D-06). Duyệt cũng
thành hai lần (PR rồi console).

## Recommendation

**A.** Một chỗ duyệt duy nhất, đặt nơi xác thực mạnh nhất. Agent chỉ có quyền "đề nghị", nên rào 3 của D-02 ("chỉ dùng
asset đã duyệt") do server giữ, không dựa vào lòng tin. Ngoại lệ hẹp và thu hồi được.

Chi phí chấp nhận:

- Sửa một dòng trong `AGENTS.md` (ngoại lệ có tên).
- Phải xử lý chuyện Access cho token máy.
- UAT và dev có Studio riêng chỉ để thử. Registry thật là một (D-06).

## Decision

—

Owner cần trả lời: có mở ngoại lệ "agent tạo bản nháp trong Studio prod bằng token `studio:draft`" không?

## Discussion

**agent** (2026-10-22): token nháp không đọc được gì ngoài các pack nháp của chính nó, và mọi thao tác đều có nhật ký
(ai, khi nào, file nào). Nếu một token bị lộ thì tệ nhất là có rác nằm trong vùng nháp. Vùng nháp nên có hạn mức dung
lượng và tự dọn sau N ngày không ai duyệt.
