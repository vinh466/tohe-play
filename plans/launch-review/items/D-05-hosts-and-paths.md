# D-05 — Host và path: giữ bố cục của ADR 0042, hay đổi gì trước launch?

- Status: **decided** — A, mặt phẳng game ở **L1** (owner, 2026-10-23, chat)
- Kind: decision
- Blocks: — · Blocked by: — · Đi cùng: [D-01](D-01-languages.md), [D-02](D-02-layout.md)
- Decided: owner, 2026-10-23, chat: "đến mức L1 th bởi game sẽ do tôi thêm vào repo th, người khác thì sẽ được qua tin tường và review của tôi (hiếm và siêu ít, gần chưa chưa tại bây giờ, tôi sẽ suy nghĩ nên lên L2 hay L3 khi có nucows đi này, nên nếu lên vấn đề này như 1 topic và nói tình hình hiện tại)"

## Why it matters

Owner (2026-10-22): "quay lai bai toan bo cuc chia trang xep sap subdomain hay path da hop ly chua, ban co the reseach hoc
hoi de review xem ta da toi uu chua". Đổi host trước khi có người ngoài là rẻ nhất.

## What is true today

Xem [R-04](../research/R-04-hosts-and-paths-review.md).

- Mọi quyết định lớn của ADR 0042 đều khớp cách các sản phẩm lớn làm và khớp hướng dẫn của Google: host theo ranh giới tin
  cậy, app cùng gốc, `docs.` riêng, `/en/` là thư mục con, một PWA.
- Điểm duy nhất lệch khỏi cách được khuyên là **game ở `games.`, cùng site với gốc và với `console.`** (vì `io.vn` nằm trong
  PSL). Hiện điểm này được che bởi sandbox, CSP của game, `SameOriginGuard` và cookie `__Host-`.
- Owner đã chọn một domain (ADR 0040, 2026-10-18).
- `console.` chưa bật Cloudflare Access (owner 2026-10-20: tuỳ chọn).

## Options

### A — Giữ bố cục; thêm namespace của D-01, D-02; mở lại câu domain của game khi có điều kiện *(đề xuất)*

- **Thêm vào ADR 0042**: namespace `/together`, `/en/…`, và luật bỏ redirect ở `/` (D-02).
- **Điều kiện mở lại**: Tò He nhận một game **không do repo này viết** thì game chuyển sang **domain riêng**, trước khi game
  đó lên. Ghi điều kiện này vào ADR.
- **Bật Cloudflare Access cho `console.`** là một dòng của Cổng (E-01, dòng 13).
- **Cái giá**: gần như không, vì đi cùng ADR của D-02.

### B — Chuyển game sang domain riêng ngay bây giờ

- **Làm gì**: một domain mới (ví dụ `toheplay-games.io.vn`, hoặc một gTLD rẻ) cùng zone Cloudflare; đổi giá trị chart ở
  `platform-infra`; `frame-src`, `img-src` của hub; một ADR sửa ADR 0040.
- **Được**: game khác site với hub và console; zone của hub được tự do chặn bot (ADR 0040 đã nêu).
- **Cái giá**: một PR, việc DNS của owner, một domain phải giữ.
- **Vì sao không vội**: URL của game không được index và không ai chia sẻ, nên chuyển sau không đắt hơn bao nhiêu.

## Recommendation

**A.** Bố cục hôm nay đã gần tối ưu. Cái đáng làm trước launch là bật Access cho console và ghi điều kiện mở lại câu domain
của game. Nếu owner muốn phòng thủ chiều sâu ngay (vì "gia rat re"), B cũng hợp lý. Đây là lựa chọn về độ chắc tay, không
phải sửa một lỗi.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | A hay B? | A |
| Q2 | Bật Cloudflare Access cho `console.` trước launch? | Có |

## Decision

**A — L1** (owner, 2026-10-23, chat): "đến mức L1 th bởi game sẽ do tôi thêm vào repo th, người khác thì sẽ được qua tin tường và review của tôi (hiếm và siêu ít, gần chưa chưa tại bây giờ, tôi sẽ suy nghĩ nên lên L2 hay L3 khi có nucows đi này, nên nếu lên vấn đề này như 1 topic và nói tình hình hiện tại)".

- Game do owner thêm vào repo; người khác chỉ qua niềm tin và review của owner — hôm nay chưa có ai.
- **Ghi thành một chủ đề trong spec** (ADR của D-02 và `docs/architecture/hosts-and-paths.md`): tình hình hôm nay (L1, ai
  viết game, các lớp phòng thủ) và **luật leo thang** — trước khi lên game đầu tiên không do owner thêm, owner quyết L2
  hay L3. Review của owner gồm cả PR thêm hay nâng thư viện của game (chuỗi cung ứng).
- Việc rẻ đi kèm, agent đề xuất, owner duyệt trong ADR: header `Origin-Agent-Cluster: ?1` trên `games.`; Cloudflare
  Access cho `console.` (Cổng E-01).

## Discussion

**agent** (2026-10-22): scout xếp `games.` cùng site là rủi ro "cao". Agent kiểm code và thấy phần lớn các việc scout đề
xuất đã có sẵn (`SameOriginGuard`, `__Host-`, `form-action 'none'`, `connect-src 'self'`). Phần còn lại là chiều sâu,
nên agent hạ xuống "chấp nhận được với game của Tò He".

**owner** (2026-10-22, chat): "D-05 explain cho tôi rõ rành sự cải thiệt và đánh đổi, tôi sẳn sàng tách ngay sạch từ đầu
luôn cũng đc nha" — và: "D-05 vậy các trang giới thiệu mang sang domain cha (cá nhân tôi) *.vinetic.io.vn được k".

**agent** (2026-10-22): với lời "sẵn sàng tách ngay", agent đổi đề xuất sang **B — game sang domain riêng ngay**: cái giá
nhỏ hơn đã ước (API ghép `entryUrl` từ cấu hình lúc trả lời — `RegistryModule.cs:109-117` — nên đổi domain chỉ là đổi
cấu hình, không migration). Về `*.vinetic.io.vn`:

- **Trang giới thiệu sang `vinetic.io.vn`: không nên.** (1) Nút "Chơi tiếp" của D-02 đọc localStorage của origin app — khác
  domain thì không biết máy đã chơi; (2) SEO tách khỏi domain thương hiệu mà người ta gõ và chia sẻ; `hreflang`, sitemap,
  đường nối hai chiều của D-02 đều cần cùng domain; (3) owner đã quyết rời `vinetic` (ADR 0040, 2026-10-18: "ta sẽ không
  dính tới vinetic nữa").
- **Game sang `*.vinetic.io.vn` (để khỏi mua domain): cũng không nên.** `vinetic.io.vn` chứa các app không phải của Tò He
  (`auth`, `platform`, `wiki`); code game sẽ cùng site với chúng — đúng điều ADR 0039 tránh ("game code never on a site
  with apps that are not Tò He's"). Domain riêng cho game là cách sạch.

**owner** (2026-10-23, chat): "về domain explain phat nữa lý do cho tôi, subdomain k giúp đc ta tách ư, 2 domain cho 1 sản
phẩm cũng tốn đó".

**agent** (2026-10-23): subdomain tách được **origin** (cookie riêng, lưu trữ riêng, game không đụng được hub — Tò He đã
có), nhưng không tách được **site**: trình duyệt tính site theo domain đăng ký được (theo PSL), và `toheplay.io.vn` là một
domain như thế, nên mọi subdomain của nó cùng site. Muốn subdomain thành site riêng thì phải đưa chính `toheplay.io.vn` vào
PSL — mất hàng tuần, dành cho nhà cung cấp hosting nhiều khách, và làm gốc của hub thành "public suffix" — không hợp. Với
game do repo này viết, phòng thủ hôm nay đã đủ; cộng thêm hai việc rẻ trong cùng domain: header `Origin-Agent-Cluster: ?1`
trên `games.` (trình duyệt cách ly theo origin thay vì theo site) **[chưa kiểm hỗ trợ hiện tại]** và Cloudflare Access cho
`console.`. **Đề xuất quay về A** vì cái giá của domain thứ hai; B khi có game không do repo viết.

**owner** (2026-10-23, chat): "D-01 tam chot v nhe / ve D-05 ta lật lại vấn đề tại sao cần isolate game plane nè, và có thể
ta thay đổi góc nhìn là nâng cấp luôn bố cục sản phẩm k".

**agent** (2026-10-23): **vì sao cách ly mặt phẳng game** — code game là code không tin tuyệt đối dù do repo viết:
(1) nó đóng gói thư viện bên thứ ba (Phaser 4 qua `@tohe/game-kit`; engine WASM) — chuỗi cung ứng; (2) nó cần CSP lỏng
(`'wasm-unsafe-eval'`, `style-src 'unsafe-inline'`, `blob:` — `packages/contract/src/csp.ts:9-19`) mà hub, nơi giữ phiên và
dữ liệu trẻ em, không được có; (3) nền tảng làm ra để agent thêm game nhanh — trình duyệt bắt luật của contract (không gọi
API, không lưu riêng, không mạng) thay vì tin người review; (4) game treo hay hỏng thì hub vẫn còn nút thoát. Không cách ly
(cùng origin), một thư viện game bị nhiễm độc chạy với toàn quyền của người chơi: gọi API, gửi lời mời, đọc hồ sơ trẻ.

**Thang cách ly**: L0 cùng origin (không) → **L1 origin riêng — Tò He hôm nay** (+ `SameOriginGuard`, `__Host-`, CSP) →
L2 site riêng (domain thứ hai) → L3 mỗi game một site (domain + PSL). Leo bậc theo **ai viết game**: repo này → L1 + hai
việc rẻ; người ngoài → L2 trước khi game lên; nhiều người ngoài, chợ game → L3.

**Góc nhìn "mặt phẳng"** (plane): ADR 0042 đã là mô hình này — mặt phẳng người chơi (`toheplay.io.vn`: hai vùng của D-02 +
API), mặt phẳng game (`games.`), mặt phẳng vận hành (`console.`), mặt phẳng nhà phát triển (`docs.`, sau này `studio.` cho
người làm game — tên đã giữ trong ADR 0042), dịch vụ rìa (`status.`, `notify.`). Nâng cấp đáng làm không phải dời host mà là
**viết rõ** mỗi mặt phẳng được làm gì, tin ai, và **luật leo thang** ở trên, để quyết định sau này thành cơ học — gộp vào ADR
"Hai vùng, một khung" của D-02.
