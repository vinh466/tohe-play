# D-14 — Studio nằm chung console, hay là một app độc lập?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-05, E-07 · Blocked by: D-11
- Decided: owner, chat 2026-10-23: "ổn đó"

## Why it matters

Owner hỏi (2026-10-22): "studio sẽ chung console hả, nên tách riêng k, nên xem đây là 1 dạng app độc lập k". Câu trả lời
quyết định ai cần quyền gì để duyệt asset, và Studio có kéo theo các quyền vận hành nền tảng hay không.

## What is true today

- **Console** (`docs/architecture/admin.md`):
  - Host riêng `console.`, sau Cloudflare Access; app `apps/console`, được build vào image của hub và phục vụ bởi site
    thứ hai của Caddy (cổng 8081).
  - Chỉ proxy `/api/admin/*`. Có session và cookie riêng.
  - Người vào được là tài khoản Tò He có **platform role** (`owner`, `admin`, `moderator`, `viewer`; mỗi tài khoản tối
    đa một role) **và** bật 2FA.
  - Code kiểm *permission*, không kiểm tên role (`AdminPermissions`). Có audit log.
- **ADR 0042** "hosts by trust": `studio.` được giữ chỗ cho "tools for making games, if they need permissions players do
  not have". Đổi một host từ giữ chỗ sang dùng thật thì cần ADR (`packages/routes/src/map.ts:4`).
- API là modular monolith. Module có schema riêng và tài liệu OpenAPI riêng (như `admin`).

## Options

### A — Một khu Studio trong console

Rẻ nhất lúc đầu, vì dùng lại host, session và layout của console. Nhưng ai muốn duyệt hay góp asset cũng phải có
platform role, tức là quyền vận hành nền tảng. Console phình ra, và một lỗi trong trang Studio có thể hành động bằng
session của operator. Tách ra về sau sẽ đổi URL và session.

### B — App độc lập ở `studio.`, chung API và chung DB

- **Frontend, host, session, quyền: riêng.** `apps/studio` (React như console), host `studio.toheplay.io.vn`, site thứ ba
  của Caddy trong image của hub, chỉ proxy `/api/studio/*`, cookie `__Host-tohe.studio`, CSP riêng.
- **Đăng nhập:** tài khoản Tò He + **studio role** (claim riêng, không phải platform role): `viewer`, `contributor`
  (gửi bản nháp), `reviewer` (duyệt). Duyệt phải có 2FA, như console. Owner giữ `reviewer`.
- **Backend: chung.** Module `Studio` trong cùng API process, schema `studio`, tài liệu OpenAPI riêng. Về sau muốn tách
  thành service riêng thì Caddy proxy theo tiền tố `/api/studio/`, URL không đổi.
- **Console vẫn là nơi điều khiển:** cấp và thu hồi studio role, cấp và thu hồi token của agent (D-15), xem audit log.
  Console quản *ai* được làm; Studio là nơi *làm*.

### C — Service riêng, DB riêng

Tách hoàn toàn, nhưng phải thêm deployment, DB và luồng định danh. Chưa có lý do gì cần tới mức này.

## Recommendation

**B.** Ba lý do:

1. **Mức tin cậy khác nhau.** Operator, người góp asset và agent không cùng một mức. Đây đúng là nguyên tắc "hosts by
   trust" của ADR 0042, và `studio.` đã được giữ chỗ cho việc này.
2. **Ít quyền nhất.** Lộ một session hay token của Studio thì cũng không lấy được quyền vận hành nền tảng.
3. **Nhịp thay đổi khác nhau.** Studio sẽ đổi nhanh (gallery, generator, MCP), còn console nên ổn định và nhỏ.

Chi phí chấp nhận:

- Một app nữa: copy cấu trúc của `apps/console`, P0 chỉ có gallery và màn duyệt.
- Một host nữa: ADR, DNS, ingress (owner và `platform-infra`), một entry trong `@tohe/routes`.
- Một claim nữa trong identity.
- Mọi thứ khác (API, DB, deploy, image) dùng chung.

## Decision

**B**, owner: "ổn đó" (2026-10-23).

**Hệ quả:**

- `apps/studio` ở `studio.`. Host này chuyển từ giữ chỗ sang dùng thật: cần ADR; DNS và ingress do owner và
  `platform-infra` làm.
- Studio role là claim riêng, không phải platform role.
- Console cấp role, cấp token và xem audit.
- Duyệt bắt buộc 2FA.
- Chi tiết route chốt khi graduate, theo `@tohe/routes`.

## Discussion

**agent** (2026-10-22): owner cũng hình dung sau này agent cùng vận hành nền tảng (monitoring, cập nhật tự động). Phần
đó thuộc console, vì đó là vận hành, và nên là một plan riêng. Điểm chung với Studio chỉ là **cơ chế token cho agent**,
nên token được tách thành D-15 để cả hai dùng chung.
