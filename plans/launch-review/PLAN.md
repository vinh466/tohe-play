# Plan — Review trước launch

- Goal: bề mặt sản phẩm hoàn chỉnh trước launch chính thức — **đợt 1**: bố cục và UX của người chơi, bề mặt giới thiệu,
  SEO, GEO và cách nó mở rộng, thiết kế xong rồi build; **đợt 2**: rà màn, luồng, câu chữ, Điều khoản, Cổng. Sau đó tập
  trung làm game.
- Phase: **Graduate — đợt 1** ([process](../README.md#phases)) — brief đã xác nhận, mọi quyết định của đợt 1 đã chốt
  (2026-10-22); đợt 2 còn ở *Map*.
- Started: 2026-10-21 · Branch: `plan/launch-review` · PR: [tohe-play#109](https://github.com/vinh466/tohe-play/pull/109) (draft)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (bức tranh đầy đủ) · Log: [log.md](log.md)
- Research: [R-01 trang và lối vào](research/R-01-pages-and-ways-in.md) · [R-02 bố cục hiện đại](research/R-02-layout-prior-art.md) ·
  [R-03 quay lại, app đã cài](research/R-03-coming-back.md) · [R-04 host và path](research/R-04-hosts-and-paths-review.md) ·
  [R-05 học từ miniblox](research/R-05-learning-from-peers.md) · [R-06 SEO, GEO, mở rộng](research/R-06-seo-geo-scale.md)
- Trước đó: [`product-surface`](../product-surface/PLAN.md) (Phase 1, Close 2026-10-21) · Ý ngoài phạm vi:
  `docs/roadmap/product-backlog.md` (PR #110)

## Next — one item

**Owner duyệt và merge G0 [#111](https://github.com/vinh466/tohe-play/pull/111)** (ADR 0046, 0047, `surfaces.md`) rồi **G1
[#112](https://github.com/vinh466/tohe-play/pull/112)** (xếp trên #111). Trong ADR có các điểm *(agent)* chờ owner duyệt, và
một câu **mở**: mô tả game theo ngôn ngữ (quyết ở G3). Sau đó: G2a ∥ G3.

## Waiting on the owner

1. **Duyệt G0** khi agent báo sẵn sàng.
2. **Merge PR #110** (backlog sản phẩm) khi tiện.
3. Thuộc Cổng (E-01), từ Phase 1:
   - **Alertmanager trên prod** (Telegram): token bot vào Infisical `platform/prod` `/monitoring`, khoá `telegram-bot-token`,
     gửi chat id — agent mở PR `platform-infra`.
   - **Cloudflare**: AI Crawl Control cho phép bot tìm kiếm (D-06); Bot Fight Mode / Under Attack / WAF challenge tắt; chọn
     dịch vụ `status.`; **Access cho `console.`** (D-05).
   - Thư thử tới `hello@`, `security@`; Resend `notify.` ([guide](../../docs/guides/mail-and-status.md)).
   - Khi chốt ngày launch: thử khôi phục bản sao lưu DB prod một lần.
4. Merge bằng `! gh pr merge <n> --repo vinh466/tohe-play --merge` khi agent báo "sẵn sàng" — PR draft là chưa sẵn sàng.

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
| **G0** | Spec | **ADR 0046** "Bề mặt người chơi: hai vùng, một khung" (D-02, D-04, mặt phẳng và luật leo thang của D-05; sửa ADR 0042: `/together`, bỏ redirect ở `/`). **ADR 0047** "Hai ngôn ngữ và bề mặt giới thiệu lớn theo số game" (D-01, D-06; sửa ADR 0042: `/en/`, `/promise/`). Trang **`docs/architecture/surfaces.md`** có sơ đồ; cập nhật `hosts-and-paths.md` | D-01, D-02, D-04, D-05, D-06 | — | — |
| **G1** | Crawler, header | `robots.txt`: nhóm bot tìm kiếm của AI (lặp lại luật, RFC 9309), nhóm bot/token chỉ để huấn luyện `Disallow: /`; `Origin-Agent-Cluster: ?1` ở `Caddyfile.games`. **Namespace** `/en/`, `/promise/`, `/together` **đi cùng trang của chúng** (G2a, G2b, G4) — namespace được index mà chưa có trang thì sitemap và `check-build` hỏng | D-05, D-06 | G0 | — |
| **G2a** | Trang công khai hai ngôn ngữ | namespace `/en/…`; Astro i18n routing; `/en/` cho mọi trang; `hreflang` trong sitemap, `x-default` → `/en/`; VI \| EN và gợi ý; luật mới của `check-build.ts`; viết nội dung tiếng Anh | D-01 | G1 | G3 |
| **G3** | Tên game (Game Contract) | **ADR 0048**: `name` là tên chuẩn, `names.<ngôn ngữ>` tuỳ chọn; contract, SDK, registry (migration thêm cột), hub hiện tên theo ngôn ngữ, conformance; bốn game đổi `game.json` | D-01 | G1 | G2a |
| **G2b** | Một nguồn cho mỗi game | namespace `/promise/`; `games/<id>/page/{vi,en}.md` + `facts.json`; sự thật từ `game.json`; ảnh OG từng game; trang game có bảng sự thật; trang chủ danh mục trước; `/promise/`; "Chơi tiếp" thay redirect; `/new-game` viết trang | D-06, D-02 | G2a, G3 | G4 |
| **G4** | Khung app | namespace `/together`; layout route; thanh dưới / rail; Trò chơi · Chơi cùng (`/together`) · Tôi; bỏ menu sheet; bố cục máy tính; bỏ khoá màn dọc; lịch sử cho nút back; cài đặt ngôn ngữ và thứ tự chọn; mã quản lý cho link ra ngoài của hồ sơ trẻ | D-02, D-01 | G1, G3 | G2b |
| **G5** | Mở lại app | màn đầu "đang dở" (bàn, lời mời cho cả hồ sơ máy, chơi tiếp, gần đây); "Ai đang chơi?" 30 phút; phiên hết hạn; cập nhật êm (+ test hai bản build, PB-17); `launch_handler`; `persist()`; đếm lần quay lại; "Đã cài app?" trên trang lối vào | D-04 | G4 | G6 |
| **G6** | Ngôn ngữ của link | API lưu ngôn ngữ của link (migration thêm cột); thẻ xem trước `/s`, `/r` vi và en | D-01 | G1 | G5 |
| **G7** | Thử thật | UAT → prod khi owner nói; owner thử trên máy thật (Android, iPhone + app đã cài, Zalo, Messenger, máy tính) | — | G2b, G4, G5, G6 | — |

Thứ tự: G0 → G1 → (G2a ∥ G3) → (G2b ∥ G4) → (G5 ∥ G6) → G7. Migration EF ở G3 và G6 merge lần lượt (chung snapshot).

## Graduation list — đợt 2

Lập khi G7 xong: E-02 (cách rà theo brief Q3) → E-03 → E-04 → E-05 → E-01.
