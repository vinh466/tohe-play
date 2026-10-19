# D-13 — Games origin trên domain riêng

- Status: **decided** (2026-10-18, chat) — Q1 = B; Q2: owner đã mua **`toheplay.io.vn`** ("toheplay.io.vn, tôi đã mua
  r, chưa trỏ về")
- Decided: 2026-10-18 — [#67](https://github.com/vinh466/tohe-play/pull/67) (ADR 0039, merged); 2026-10-19 — mọi host
  dưới `toheplay.io.vn`: [#69](https://github.com/vinh466/tohe-play/pull/69) (ADR 0040, merged)
- Kind: decision — đổi hostname production của games origin (ADR 0002) là quyết định về origin → ADR khi chốt
- Blocks: E-10 (checklist ra mắt), F4 · Blocked by: —

## Vì sao

Game có thể do AI viết, và chạy code trên một origin của mình. ADR 0002 đã tách game ra **origin** riêng để game không
chạm được cookie, storage hay API của hub. Câu hỏi còn lại: games origin có nên nằm trên **site** (registrable domain)
riêng không — vì trình duyệt coi mọi subdomain của cùng một site là "cùng phe" ở vài chỗ quan trọng.

## Hiện trạng

Sự thật (2026-10-18):
- Games origin production là `tohe-games.vinetic.io.vn`, hub là một host khác dưới `vinetic.io.vn`, hostname phẳng vì
  chứng chỉ miễn phí của Cloudflare chỉ phủ một tầng subdomain (ADR 0002).
- `io.vn` nằm trong Public Suffix List (publicsuffix.org, mục `vn`, kiểm 2026-10-18) → `vinetic.io.vn` là **một site**.
  Hub và games origin là hai origin nhưng **cùng site**.
- Cùng site đó còn có (`platform-infra`, 2026-10-18): `platform`, `platform-dev`, **`auth`**, `wiki` (Outline),
  `storybook` `.vinetic.io.vn`. Địa chỉ gửi thư cũng là `vinetic.io.vn` (`docs/guides/uat.md`), account Resend dùng
  chung với `platform` và Outline (E-02).
- Cùng site nghĩa là code trên games origin có thể:
  - đặt cookie `Domain=vinetic.io.vn` mà mọi host kia nhận được (cookie tossing);
  - gửi request tới các host kia **kèm cookie `SameSite=Lax/Strict` của chúng** — SameSite không ngăn request cùng site.
- **Tò He đã tự che mình:** cookie phiên trên HTTPS là `__Host-tohe.session` — host khác không đặt được, không che được
  (`IdentityModule.cs`, ADR 0021). `SameOriginGuard` từ chối mọi request đổi trạng thái tới `/api` có `Sec-Fetch-Site`
  khác `same-origin`. Các app khác trên `vinetic.io.vn` có làm vậy không thì tuỳ từng app — agent chưa kiểm.
- Sandbox nằm trên iframe của hub. Mở thẳng file game trong một tab thì game chạy không sandbox, chỉ còn CSP: CSP của
  game (`packages/contract/src/csp.ts`) có `connect-src 'self'` nhưng không có `form-action`, nên trang đó vẫn gửi form
  POST đi nơi khác được.
- Game không giữ dữ liệu của riêng mình (contract: mọi thứ qua `save()` của hub) → đổi games origin về sau không phải
  chuyển gì. Chỉ đổi `publicUrls.games` của chart (CSP `frame-src` của hub và `frame-ancestors` của game sinh từ cấu
  hình), DNS và host ở `platform-infra`.

## Phương án

| | Cách | Giá |
|---|---|---|
| **A** | **Giữ `tohe-games.vinetic.io.vn`** (ADR 0002 như hiện tại). | Không tốn gì. Game vẫn cùng site với `auth`, `platform`, `wiki`: một game lỗi hoặc một dependency bị nhiễm có thể ném cookie và gửi request cùng site tới các app đó. Uy tín cũng dùng chung: nếu Safe Browsing gắn cờ trang game, cờ có thể lan ra cả `vinetic.io.vn`, kể cả domain gửi thư. |
| **B** | **Một registrable domain riêng chỉ cho game** — ví dụ một tên `.io.vn` khác (khác site, vì `io.vn` là public suffix) hoặc `.com`. Hub, API, console giữ nguyên. | Một domain mỗi năm (owner mua); một zone Cloudflare (gói Free được); một host ở `platform-infra`; `publicUrls.games`; một ADR sửa hostname của ADR 0002. **Không đổi code.** Phải thử lại trên domain mới: spike S1 (offline) và S2 (âm thanh iOS) trong iframe khác site. Storage của iframe khác site bị partition, nhưng game vốn không dùng storage. |
| **C** | **Cả Tò He sang domain riêng**: hub một domain, game một domain khác nữa. | Hai domain. Đổi địa chỉ gửi thư, redirect URI của OAuth, link đã chia sẻ. Chỉ đáng làm khi Tò He cần thương hiệu riêng. |

Bổ sung cho phương án nào cũng được: thêm `form-action 'none'` vào CSP của game, để trang game mở thẳng trong tab không
gửi được form đi đâu. Đây là thay đổi contract nên cần ADR, docs và conformance cùng PR.

## Đề xuất của agent

**B, xong trước F4 (ra mắt).** Cách này rẻ: một domain mỗi năm và vài dòng cấu hình, không đổi code. Nó gỡ hẳn một lớp
rủi ro cho những app nhạy cảm hơn Tò He đang chung site — nhất là `auth.vinetic.io.vn`. Uy tín (Safe Browsing, domain
gửi thư) cũng được tách riêng. Passkey sau này cũng hết phải lo về RP ID. Đây cũng là cách các nơi chạy code của người
khác vẫn làm: itch.io để game HTML ở `itch.zone`, GitHub để nội dung người dùng ở `githubusercontent.com`.

Trong giai đoạn gia đình (UAT, chưa có prod), cứ giữ như hiện tại — chưa có người lạ, game do agent của owner viết.

Nếu owner chưa muốn mua domain: A vẫn chấp nhận được cho ngày ra mắt, vì Tò He đã tự che mình, và đổi sang B lúc nào
cũng được mà không phải chuyển dữ liệu. Khi đó nên làm `form-action 'none'` trước.

## Câu hỏi cho owner

1. **Q1:** B (domain riêng cho game, trước F4) hay A (giữ `tohe-games.vinetic.io.vn`)?
2. **Q2** (nếu B): owner chọn và mua tên nào? Agent không chọn, không mua thay. Khi có tên, agent viết ADR và đổi
   cấu hình; host ở `platform-infra` là một draft PR riêng.

## Tìm tên (2026-10-18)

**`.io.vn` dùng được.** `io.vn` nằm trong Public Suffix List, nên `<tên>.io.vn` là một site riêng, khác site với
`vinetic.io.vn`. Theo bài tổng hợp ngày 31/07/2025 ([runsystem](https://runsystem.net/en/node/230)), `.io.vn` do VNNIC quản
lý và "open to all individuals and organizations, no restrictions apply". Phí duy trì nhà nước 20.000đ/năm theo
Thông tư 10/2025/TT-BTC (trích qua thuvienphapluat; agent chưa đọc được văn bản gốc); giá bán lẻ tuỳ nhà đăng ký.
Cloudflare nhận được zone `.io.vn`: `vinetic.io.vn` đang chạy trên đó.

Tình trạng DNS ngày 2026-10-18, hỏi qua DNS-over-HTTPS: NXDOMAIN là chưa ai trỏ DNS, nhiều khả năng còn trống, nhưng
ô tìm kiếm của nhà đăng ký mới là câu trả lời chắc chắn.

| Tên | DNS | Nhận xét |
|---|---|---|
| **`toheplay.io.vn`** | NXDOMAIN | **Gợi ý.** Trùng tên dự án (`tohe-play` trên GitHub và GHCR). Nhìn là biết của Tò He, "play" nói rõ đây là chỗ chạy game. Một từ, không gạch nối, không dấu — dễ đọc qua điện thoại. |
| `tohebox.io.vn` | NXDOMAIN | Dự phòng: "box" gợi chiếc hộp đồ chơi, và cái sandbox game chạy bên trong. |
| `tohegames.io.vn` | NXDOMAIN | Rõ nghĩa nhưng dài hơn, và là số nhiều tiếng Anh. |
| `tohe-play.io.vn`, `tohe-games.io.vn` | NXDOMAIN | Gạch nối dễ bị quên khi đọc cho nhau nghe. |
| `tohezone.io.vn`, `choitohe.io.vn` | NXDOMAIN | "zone" không có nghĩa với người Việt; "choi" không dấu đọc thành nhiều chữ. |
| `tohe.io.vn` | **đã có người dùng** (NS `vclouddns.com`) | Không lấy được. |

Tiền lệ cho việc tách domain: GitHub chuyển Pages sang `github.io` năm 2013 vì cookie tossing
([Yummy cookies across domains](https://github.blog/2013-04-09-yummy-cookies-across-domains/)); itch.io chạy game HTML
trên `html-classic.itch.zone`.

Khi owner mua xong:
1. **Owner:** trỏ nameserver về Cloudflare (zone mới, gói Free) — như `vinetic.io.vn`. Dùng thẳng tên gốc làm games
   origin: `https://toheplay.io.vn`. Cả domain chỉ dành cho game.
2. **Agent:** viết một ADR (sửa hostname production của ADR 0002) và cập nhật docs. Đặt `publicUrls.games` cho chart.
   Cho trang gốc của games origin chuyển về hub — hiện nó trả 404, mà một tên dễ gõ thì sẽ có người gõ.
3. **A4 (`platform-infra`):** thêm host vào ingress và DNS. Thử lại spike S1 (offline) và S2 (âm thanh iOS) trên domain
   mới. UAT không đổi: ở UAT, games origin là địa chỉ IP với cổng riêng.
4. **Mua sớm, kể cả khi chưa ra mắt.** Một số bộ lọc DNS chặn domain mới đăng ký — ví dụ NextDNS có tuỳ chọn "Block
   Newly Registered Domains" cho domain đăng ký chưa tới 30 ngày
   ([diễn đàn NextDNS](https://help.nextdns.io/t/35yz3m6/is-there-a-way-to-block-newly-active-domains)). Ai bật tuỳ chọn
   này sẽ không tải được game trong những tuần đầu.

## Rà soát (2026-10-18)

Owner: "bạn hãy rà soát toàn bộ để chúng ta có thể làm games origin đúng nhé (t nghĩ cũng configable đc hết mà
nhỉ)". Đúng: mọi chỗ trình duyệt và API dùng games origin đều lấy từ một giá trị, `publicUrls.games` của chart —
CSP của hub và console (`GAMES_ORIGIN`), `Games:PublicOrigin` của API (hub và console tin `postMessage` theo nó),
`frame-ancestors` của game (`HUB_ORIGINS`), host của Ingress. Chỉ file mẫu production
`deploy/helm/tohe/ci/platform-infra.yaml` ghi tên cũ. [#67](https://github.com/vinh466/tohe-play/pull/67) sửa nó, cho `/` của games origin chuyển về hub (không
cache), thêm `X-Robots-Tag: noindex`, viết ADR 0039 và docs.

Khác site với hub không đổi gì cho game: game không dùng storage riêng, không cookie, iframe đã có
`allow="autoplay; fullscreen"`, games origin không có service worker. Còn lại ngoài repo: zone Cloudflare (bật
"Always Use HTTPS", SSL/TLS như `vinetic.io.vn`; **tắt** challenge chống bot, Hotlink Protection, Rocket Loader, Web
Analytics tự chèn, Email Obfuscation) và A4 (DNS `toheplay.io.vn` → IP production, proxied; Ingress).

## Thảo luận

**owner** (2026-10-18, chat): "chắc tôi sẽ mua 1 domain mới, mà .io.vn vẫn được chứ, research cho tôi 1 name gợi ý đi"
→ Q1 = B. **agent:** `.io.vn` được; gợi ý `toheplay.io.vn`, dự phòng `tohebox.io.vn` (bảng trên).

**owner** (2026-10-18, chat): "tôi muốn các subdomain sang nằm dưới toheplay.io.vn hết được không, ta sẽ không dính tới
vinetic nữa, cho tôi review và subdomain hay". **agent:** được, mọi host đều từ `publicUrls.*`. Đề xuất (chờ owner duyệt):
**1** — một domain: `toheplay.io.vn` = hub, `games.` = game, `docs.` = site, `www.` → apex; game cùng site với hub
(đúng như local/UAT): Tò He tự che (`__Host-`, `SameOriginGuard`, sandbox, CSP), thêm `form-action 'none'` vào CSP game
(Game Contract → ADR + conformance); Bot Fight Mode phải tắt cả zone. **2** — hai domain: hub + site như trên, game trên
một domain thứ hai (`tohebox.io.vn` còn trống DNS) — tách hẳn như ADR 0039. Agent nghiêng về 1. Chọn xong: ADR 0040
(sửa 0039), profile chart, #239, bản ghi Cloudflare.

**owner** (2026-10-19, chat): "phương án 1, hãy giúp tôi làm tận gốc nhé" → ADR 0040 ([#69](https://github.com/vinh466/tohe-play/pull/69)): hub `toheplay.io.vn`,
game `games.toheplay.io.vn`, site `docs.toheplay.io.vn`, `www` → gốc; CSP game thêm `form-action 'none'`. Cùng PR: test
bảng tuần hỏng mỗi thứ Hai 00:00–00:30, và CI chạy conformance riêng, tuần tự (flake `tap-merge` do 4 nhân CI quá tải).
Cloudflare (owner, kiểm 2026-10-19): `games`, `docs`, `www` có, `www` → gốc 301; còn thiếu `_dmarc`.
