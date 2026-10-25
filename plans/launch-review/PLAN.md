# Plan — Review trước launch

- Goal: bề mặt sản phẩm hoàn chỉnh trước launch chính thức — **đợt 1**: bố cục và UX của người chơi, bề mặt giới thiệu,
  SEO, GEO và cách nó mở rộng, thiết kế xong rồi build; **đợt 2**: rà màn, luồng, câu chữ, Điều khoản, Cổng. Sau đó tập
  trung làm game.
- Phase: **đợt 1 Close** (G0–G7; owner thử máy thật 2026-10-24: "các mục này ổn r nha") · **đợt 2 Graduate một phần**
  (F1, F2, S1, S2, E-07, G5+ trên prod) · **đợt 2b — bề mặt vòng 2: Graduate** (D-08–D-10, E-08 **decided** 2026-10-25;
  V0 = ADR 0055) ([process](../README.md#phases))
- Started: 2026-10-21 · Branch: `plan/launch-review` (#109, merged 2026-10-22); cập nhật là PR nhỏ, lần này
  `docs/surfaces-v0` (cùng V0)
- Brief: [brief.md](brief.md) · Map: [map.md](map.md) · **Design: [design.md](design.md)** (bức tranh đầy đủ) · **Route: [routes.md](routes.md)** · Log: [log.md](log.md)
- Research: [R-01 trang và lối vào](research/R-01-pages-and-ways-in.md) · [R-02 bố cục hiện đại](research/R-02-layout-prior-art.md) ·
  [R-03 quay lại, app đã cài](research/R-03-coming-back.md) · [R-04 host và path](research/R-04-hosts-and-paths-review.md) ·
  [R-05 học từ miniblox](research/R-05-learning-from-peers.md) · [R-06 SEO, GEO, mở rộng](research/R-06-seo-geo-scale.md) ·
  [R-07 bớt "AI style"](research/R-07-ai-style.md) · [R-08 app đã cài, quay lại](research/R-08-installed-app-and-return.md) ·
  [R-09 khảo sát prod 2026-10-23](research/R-09-survey-2026-10-23.md) ·
  **[R-10 bề mặt vòng 2: kế hoạch](research/R-10-surface-round-2-plan.md)** ·
  **[R-11 bề mặt hôm nay: luồng, đánh giá](research/R-11-surface-today-and-evaluation.md)** ·
  **[R-12 tiền lệ: trang chủ, cửa, lần đầu](research/R-12-peers-front-door-and-first-run.md)**
- Trước đó: [`product-surface`](../product-surface/PLAN.md) (Phase 1, Close 2026-10-21) · Ý ngoài phạm vi:
  `docs/roadmap/product-backlog.md` (#110, đã merge)

## Next — one item

**Owner thử V1 + V2 trên máy thật** (trang chủ mới, thẻ chào, màn chào lần đầu) trên `prod-2026-10-25.4`; rồi V3 (bố cục khung tablet, máy tính). S3 vẫn chờ tranh.

## Waiting on the owner

1. **Thử trên máy thật** trang chủ mới, thẻ chào (sau khi chơi một game rồi mở lại `toheplay.io.vn`) và màn chào lần đầu (máy mới, hoặc xoá dữ liệu trang).
2. **Thuê hoạ sĩ** theo [illustrator-brief.md](illustrator-brief.md) (16 avatar tò he, 4 ảnh bìa, linh vật 4 tư thế, sáng
   + tối). Có tranh là agent làm S3.
3. **Tắt Cloudflare Web Analytics** cho `toheplay.io.vn`: kiểm lại 2026-10-24 với `Accept: text/html`, beacon vẫn được
   chèn vào `/`, `/play` và bị CSP chặn (lỗi console mọi trang).
4. Thuộc Cổng (E-01): Better Stack + CNAME `status` và DKIM của Resend `notify.` (kiểm 2026-10-24: cả hai chưa có bản ghi);
   Alertmanager Telegram trong Infisical; thử khôi phục bản sao lưu DB prod.

Xong 2026-10-24: thử máy thật 12 bước R-08 §3.

## Board

**Đợt 1 — thiết kế bề mặt: xong.** D-01, D-02, D-05, D-06 **decided** (2026-10-22); D-04 **decided** B. D-06 và D-04 mở
lại một phần ở D-08, D-09.

**Đợt 2 — trước launch**

| ID | Item | Status |
|---|---|---|
| D-07 | [Trông và nói thế nào để không như máy làm](items/D-07-visual-direction-and-voice.md) | **decided** — A; S1, S2 trên prod; S3 chờ tranh |
| E-07 | [App đã cài và lúc quay lại](items/E-07-installed-app-and-return.md) | **decided**; trên prod |
| E-02 | Rà từng màn ([R-09](research/R-09-survey-2026-10-23.md), checklist [R-07 §5](research/R-07-ai-style.md#5-checklist-cho-mỗi-lần-rà-màn)) | lượt 1 xong — owner 2026-10-24: "nhìn chung ổn"; còn 2 lỗi ở log; lượt 2 trong E-08 |
| E-04 | Câu chữ vi + en | owner 2026-10-24: "nhìn chung ổn"; trang chủ viết lại ở D-08 |
| E-03 | Luồng đầu–cuối, e2e | owner 2026-10-24: chức năng không lỗi; e2e theo luồng mới sau E-08 |
| E-05 | Điều khoản + Quyền riêng tư, vi gốc + en | open |
| E-01 | [Cổng trước khi mời người ngoài](items/E-01-gate-before-outsiders.md) | open |

**Đợt 2b — bề mặt vòng 2** (owner 2026-10-24: "về luồng và UI thì cần cải thiện cho xịn hơn nữa")

| ID | Item | Status |
|---|---|---|
| D-08 | [Trang chủ giới thiệu theo section, không lặp danh sách game](items/D-08-landing-introduces.md) | **decided** — A (2026-10-25) |
| D-09 | [Người quay lại gõ domain: vào hub một chạm, có đổi domain/path?](items/D-09-the-way-back-in.md) | **decided** — A + D, giữ domain/path (2026-10-25) |
| D-10 | [Vào hub khi chưa đăng nhập: hỏi đăng nhập hay chơi ngay](items/D-10-entering-the-hub.md) | **decided** — A; Q1 cho chọn, Q2 không (2026-10-25) |
| E-08 | [Bố cục từng màn và luồng dễ chịu, hiểu cách vận hành](items/E-08-screens-layouts-and-flows.md) | **decided** (2026-10-25) — graduation đợt 2b |

**Sang backlog sản phẩm** (owner 2026-10-22): [D-03](items/D-03-features-before-launch.md) (deferred), E-06 → PB-12.

## Graduation list — đợt 1 (xong)

G0 ADR 0046, 0047 + `surfaces.md` ([#111](https://github.com/vinh466/tohe-play/pull/111)) → G1 crawler
([#112](https://github.com/vinh466/tohe-play/pull/112)) → G2a trang hai ngôn ngữ ([#116](https://github.com/vinh466/tohe-play/pull/116))
∥ G3 tên game, ADR 0048 ([#117](https://github.com/vinh466/tohe-play/pull/117)) → G2b một nguồn cho mỗi game
([#120](https://github.com/vinh466/tohe-play/pull/120)) ∥ G4 khung app ([#119](https://github.com/vinh466/tohe-play/pull/119))
→ G5 mở lại app ([#122](https://github.com/vinh466/tohe-play/pull/122)) ∥ G6 ngôn ngữ của link
([#121](https://github.com/vinh466/tohe-play/pull/121)) → G7 owner thử máy thật (2026-10-24, ổn). Bảng chi tiết và các
điểm *(agent)* owner duyệt 2026-10-22: lịch sử git của file này.

## Graduation list — đợt 2

| PR | Nội dung | Từ | Trạng thái |
|---|---|---|---|
| **F1** ✓ [#127](https://github.com/vinh466/tohe-play/pull/127) | Sửa lỗi bề mặt từ R-09 và R-08 (`?lang=`, header, link ra ngoài, not-found, lịch sử tab, mất mạng, 404 hai thứ tiếng…) | R-09, R-08 | prod `prod-2026-10-23.1` |
| **F2** ✓ [#128](https://github.com/vinh466/tohe-play/pull/128) | Xoay ngang, icon maskable, shortcuts, skeleton `/me`, safe-area, hướng dẫn cài iOS/iPad | R-08 | prod `prod-2026-10-23.1` |
| **S1** ✓ [#129](https://github.com/vinh466/tohe-play/pull/129) + [#130](https://github.com/vinh466/tohe-play/pull/130) | `voice-and-look.md`, viết lại câu chữ, icon SVG, Be Vietnam Pro | D-07 | prod `prod-2026-10-23.2` |
| **S2** ✓ [#138](https://github.com/vinh466/tohe-play/pull/138) + [#142](https://github.com/vinh466/tohe-play/pull/142) | Menu trong game (`game-kit` 0.3.0), logo vẽ của game, font trong kit | D-07 | prod `prod-2026-10-24.1` |
| **S3** | Xưởng tò he: avatar, ảnh bìa, linh vật, màu nhuộm, chuyển động/âm thanh, ảnh khởi động iOS | D-07 Q2 | chờ tranh |
| **E-07** ✓ [#137](https://github.com/vinh466/tohe-play/pull/137) · **G5+** ✓ [#136](https://github.com/vinh466/tohe-play/pull/136), [#139](https://github.com/vinh466/tohe-play/pull/139) | Cập nhật khi app khuất, splash, "bàn"; mã bàn, cổng phụ huynh phía server | E-07, G5 | prod |

## Graduation list — đợt 2b

| PR | Nội dung | Từ | Cần trước | Trạng thái |
|---|---|---|---|---|
| **V0** ✓ [#168](https://github.com/vinh466/tohe-play/pull/168) | ADR 0055 (sửa 0046, 0047, ghi chú 0043); `surfaces.md`, `identity.md`, `overview.md` | D-08–D-10 | — | merged |
| **V1** ✓ [#171](https://github.com/vinh466/tohe-play/pull/171) | `apps/web`: hero + 6 section vi/en, thẻ chào đọc `tohe:greeting`, `check-build` (`/games/` giữ `CollectionPage`) | D-08, D-09 | V0 | prod `prod-2026-10-25.4` |
| **V2** ✓ [#170](https://github.com/vinh466/tohe-play/pull/170) | `apps/hub`: màn chào lần đầu, "Chơi thử trên máy này", ghi/xoá `tohe:greeting`, chip "Trên máy này", e2e | D-09, D-10 | V0 | prod `prod-2026-10-25.3` (cùng đợt của phiên Studio) |
| **V3** | Bố cục khung trên tablet và máy tính, nút dính đáy ở `/r/`, đo tải lạnh danh mục | E-08 | V2 | — |

V1 ∥ V2 (`apps/web` và `apps/hub`, không chung khu vực). Sau V3: owner thử máy thật → E-03 → E-05 → E-01.
