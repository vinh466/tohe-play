# Plan — Review trước launch

- Goal: bề mặt sản phẩm hoàn chỉnh trước launch chính thức — **đợt 1**: bố cục và UX của người chơi, bề mặt giới thiệu,
  SEO, GEO và cách nó mở rộng, thiết kế xong rồi build; **đợt 2**: rà màn, luồng, câu chữ, Điều khoản, Cổng. Sau đó tập
  trung làm game.
- Phase: **Graduate — đợt 1** ([process](../README.md#phases)) — brief đã xác nhận, mọi quyết định của đợt 1 đã chốt
  (2026-10-22); đợt 2 còn ở *Map*.
- Started: 2026-10-21 · Branch: `plan/launch-review` · PR: [tohe-play#109](https://github.com/vinh466/tohe-play/pull/109) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (bức tranh đầy đủ) · **Route: [routes.md](routes.md)** · Log: [log.md](log.md)
- Research: [R-01 trang và lối vào](research/R-01-pages-and-ways-in.md) · [R-02 bố cục hiện đại](research/R-02-layout-prior-art.md) ·
  [R-03 quay lại, app đã cài](research/R-03-coming-back.md) · [R-04 host và path](research/R-04-hosts-and-paths-review.md) ·
  [R-05 học từ miniblox](research/R-05-learning-from-peers.md) · [R-06 SEO, GEO, mở rộng](research/R-06-seo-geo-scale.md)
- Trước đó: [`product-surface`](../product-surface/PLAN.md) (Phase 1, Close 2026-10-21) · Ý ngoài phạm vi:
  `docs/roadmap/product-backlog.md` (#110, đã merge)

## Next — one item

**G2b ∥ G4 đang build** (hai builder Opus · high, từ `main` c56758c). Master review diff, verify, mở PR, merge khi CI
xanh rồi deploy UAT (owner 2026-10-22: "nếu ổn thì merge và deploy giúp t luôn"). Sau đó: G5 ∥ G6.

## Waiting on the owner

1. **"lên prod"** khi muốn đưa đợt 1 lên prod — UAT đang chạy `uat-2026-10-22.1` (G0–G3); theo plan, prod ở G7 sau khi đủ G2b…G6
   và owner thử trên máy thật.
2. Đọc chữ của G2b (trang game, trang chủ, `/promise/`) khi PR mở — chữ do agent viết, owner sửa thẳng trong PR.
3. Thuộc Cổng (E-01):
   - **Better Stack** theo #114: đăng ký, bốn monitor, status page với domain `status.toheplay.io.vn`, `CNAME` `status`
     → `statuspage.betteruptime.com` (DNS only). Xong thì báo — agent đổi host `status` sang `serving`, thêm kiểm tra.
   - **Alertmanager trên prod** (Telegram): Infisical `platform/prod` `/monitoring`, khoá `telegram-bot-token` **và**
     `telegram-chat-id` (chat id để ở Infisical được: Secret dựng bằng template như
     `platform-infra/apps/platform/base/ghcr-secret.yaml`). Báo agent → agent mở PR `platform-infra`.
   - **Resend `notify.`** ([guide](../../docs/guides/mail-and-status.md)): 2026-10-22 DNS chưa có
     `resend._domainkey.notify`, `send.notify`.
   - **Khôi phục bản sao lưu DB prod** một lần: khi owner báo launch "chín".
4. Phiên 2026-10-22: owner cho agent merge PR đã ổn và deploy UAT; ngoài phiên đó vẫn là
   `! gh pr merge <n> --repo vinh466/tohe-play --merge` khi agent báo "sẵn sàng".

Xong (2026-10-22): Cloudflare Access trước `console.` (kiểm từ ngoài: 302 sang `vinh466.cloudflareaccess.com`);
Cloudflare: AI Crawl Control, Bot Fight Mode / Under Attack / WAF challenge; thư thử `hello@`, `security@` nhận được.
Điểm 2 chốt: **bỏ hẳn** — "triệt để bỏ đi, làm như mới, prod hiện chỉ có tôi dùng thôi" (bỏ cả 301 của đường cũ, #118).
ADR 0048: owner giao agent ("bạn đề xuất và xử đi") → giữ nguyên đề xuất. #114, #115, #116, #117, #118 merged;
UAT `uat-2026-10-22.1`.

## Board

**Đợt 1 — thiết kế bề mặt: đã quyết, đang graduate**

| ID | Item | Status |
|---|---|---|
| D-05 | [Host và path: mặt phẳng, game ở L1](items/D-05-hosts-and-paths.md) | **decided** — A (2026-10-22) |
| D-02 | [Bố cục: hai vùng, khung app ba mục](items/D-02-layout.md) | **decided** — B (2026-10-22) |
| D-04 | [Mở lại app](items/D-04-coming-back.md) | **decided** — B (2026-10-22); "cập nhật êm" duyệt trong ADR |
| D-01 | [Hai ngôn ngữ: tiếng Việt là mặt chính](items/D-01-languages.md) | **decided** (2026-10-22) |
| D-06 | [Bề mặt giới thiệu: một nguồn cho mỗi game](items/D-06-introduction-surface.md) | **decided** — B (2026-10-22) |

**Đợt 2 — trước launch: sau khi đợt 1 lên prod**

| ID | Item | Status |
|---|---|---|
| E-02 | Rà từng màn (brief Q3: cách rà) | open |
| E-03 | Luồng đầu–cuối, e2e | open |
| E-04 | Câu chữ vi + en | open |
| E-05 | Điều khoản + Quyền riêng tư, vi gốc + en | open |
| E-01 | [Cổng trước khi mời người ngoài](items/E-01-gate-before-outsiders.md) | open |

**Sang backlog sản phẩm** (owner 2026-10-22): [D-03](items/D-03-features-before-launch.md) (deferred), E-06 → PB-12.

## Graduation list — đợt 1

Mỗi PR một mục đích, spec trước, `pnpm verify` xanh; builder Opus · high, tối đa hai builder cùng lúc, không chung khu vực.

| Phase | PR | Nội dung | Từ | Cần trước | Song song với |
|---|---|---|---|---|---|
| **G0** ✓ [#111](https://github.com/vinh466/tohe-play/pull/111) | Spec | **ADR 0046** "Bề mặt người chơi: hai vùng, một khung" (D-02, D-04, mặt phẳng và luật leo thang của D-05; sửa ADR 0042: `/together`, bỏ redirect ở `/`). **ADR 0047** "Hai ngôn ngữ và bề mặt giới thiệu lớn theo số game" (D-01, D-06; sửa ADR 0042: `/en/`, `/promise/`). Trang **`docs/architecture/surfaces.md`** có sơ đồ; cập nhật `hosts-and-paths.md` | D-01, D-02, D-04, D-05, D-06 | — | — |
| **G1** ✓ [#112](https://github.com/vinh466/tohe-play/pull/112) | Crawler | `robots.txt`: nhóm bot tìm kiếm của AI (lặp lại luật, RFC 9309), nhóm bot/token chỉ để huấn luyện `Disallow: /`; `Origin-Agent-Cluster: ?1` ở `Caddyfile.games`. **Namespace** `/en/`, `/promise/`, `/together` **đi cùng trang của chúng** (G2a, G2b, G4) — namespace được index mà chưa có trang thì sitemap và `check-build` hỏng | D-05, D-06 | G0 | — |
| **G2a** ✓ [#116](https://github.com/vinh466/tohe-play/pull/116) | Trang công khai hai ngôn ngữ | namespace `/en/…`; Astro i18n routing; `/en/` cho mọi trang; `hreflang` trong sitemap, `x-default` → `/en/`; VI \| EN và gợi ý; luật mới của `check-build.ts`; viết nội dung tiếng Anh | D-01 | G1 | G3 |
| **G3** ✓ [#117](https://github.com/vinh466/tohe-play/pull/117) | Tên game (Game Contract) | **ADR 0048**: `name` là tên chuẩn, `names.<ngôn ngữ>` tuỳ chọn; contract, SDK, registry (migration thêm cột), hub hiện tên theo ngôn ngữ, conformance; bốn game đổi `game.json` | D-01 | G1 | G2a |
| **G2b** · đang build | Một nguồn cho mỗi game | namespace `/promise/`; `games/<id>/page/{vi,en}.md` + `facts.json`; sự thật từ `game.json`; ảnh OG từng game; trang game có bảng sự thật; trang chủ danh mục trước; `/promise/`; "Chơi tiếp" thay redirect; `/new-game` viết trang | D-06, D-02 | G2a, G3 | G4 |
| **G4** · đang build | Khung app | namespace `/together` (đã vào map ở [#118](https://github.com/vinh466/tohe-play/pull/118), để G4 không đụng file generated); layout route; thanh dưới / rail; Trò chơi · Chơi cùng (`/together`) · Tôi; bỏ menu sheet; bố cục máy tính; bỏ khoá màn dọc; lịch sử cho nút back; cài đặt ngôn ngữ và thứ tự chọn; mã quản lý cho link ra ngoài của hồ sơ trẻ | D-02, D-01 | G1, G3 | G2b |
| **G5** | Mở lại app | màn đầu "đang dở" (bàn, lời mời cho cả hồ sơ máy, chơi tiếp, gần đây); "Ai đang chơi?" 30 phút; phiên hết hạn; cập nhật êm (+ test hai bản build, PB-17); `launch_handler`; `persist()`; đếm lần quay lại; "Đã cài app?" trên trang lối vào | D-04 | G4 | G6 |
| **G6** | Ngôn ngữ của link | API lưu ngôn ngữ của link (migration thêm cột); thẻ xem trước `/s`, `/r` vi và en | D-01 | G1 | G5 |
| **G7** | Thử thật | UAT → prod khi owner nói; owner thử trên máy thật (Android, iPhone + app đã cài, Zalo, Messenger, máy tính) | — | G2b, G4, G5, G6 | — |

Thứ tự: G0 → G1 → (G2a ∥ G3) → (G2b ∥ G4) → (G5 ∥ G6) → G7. Migration EF ở G3 và G6 merge lần lượt (chung snapshot).

**Các điểm *(agent)* owner đã duyệt (2026-10-22) — xếp vào đâu.** Owner: "ổn nha, theo đề xuất … sắp xếp vào backlog
nếu tách được, không thì gom làm một lần". Không điểm nào đáng tách: mỗi điểm là một phần nhỏ của đúng màn mà PR đó
dựng, tách ra là sửa cùng màn hai lần.

| # | Điểm | Vào |
|---|---|---|
| 1 | Cloudflare Access trước `console.` | **xong** (owner bật) |
| 2 | Bỏ redirect ở `/`, nút *Chơi tiếp* | **chốt: bỏ hẳn**; 301 của đường cũ bỏ ở #118, `/` + *Chơi tiếp* ở G2b |
| 3, 4, 5 | Tên ba tab; ô nhập mã ở màn đầu; bỏ khoá màn dọc | G4 |
| 6 | Hồ sơ trẻ hỏi PIN khi bấm link ra ngoài | G4 (link ra ngoài xuất hiện cùng Tôi, nên đi cùng) |
| 11 | Thứ tự ngôn ngữ của app | G2a ghi khoá + `?lang=`, G4 đọc |
| 7, 9 | "Ai đang chơi?" sau 30 phút; cập nhật êm (+ PB-17) | G5 |
| 12, 13 | "Chơi offline" chỉ khi mọi game; `facts.json` | G2b |
| 8, 10 | Lời mời cho hồ sơ có ID; chưa làm push/badge | không có việc (đúng sẵn; đã ở backlog) |

## Graduation list — đợt 2

Lập khi G7 xong: E-02 (cách rà theo brief Q3) → E-03 → E-04 → E-05 → E-01.
