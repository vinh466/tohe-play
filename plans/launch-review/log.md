# Log — Review trước launch

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

## 2026-10-24 (owner thử máy thật; bề mặt vòng 2 tới `proposed`) — agent, phiên "ToHe Surface"

- Owner thử máy thật: G7 "các mục này ổn r nha"; màn, câu chữ "nhìn chung ổn"; "về luồng và UI thì cần cải thiện cho xịn
  hơn nữa" → D-08–D-10, E-08; owner duyệt kế hoạch [R-10](research/R-10-surface-round-2-plan.md): "duyệt, kế hoạch ổn, làm đi".
- [R-11](research/R-11-surface-today-and-evaluation.md) (10 điểm đau), [R-12](research/R-12-peers-front-door-and-first-run.md)
  (tiền lệ) → D-08 A, D-09 A + D giữ domain/path, D-10 A, E-08 `proposed`; chờ owner quyết, D-10 Q1, Q2.
- Owner: tạm gác UAT, thử trên prod, dữ liệu prod chưa cần giữ — brief sửa; ADR cho luồng release chờ owner.
- Vẫn mở: HUD Tiến Lên cắt chữ ở 360–390 px; chữ canvas của kit còn `system-ui`; beacon Cloudflare vẫn bị CSP chặn.

## 2026-10-24 (D-07, E-07 chốt; S2, E-07, G5+ lên prod) — agent

- Owner: "chốt theo đề xuất nha, bạn triển nghiêm túc đi", "hoàn thành và lên prod luôn". ADR 0049 (#132, #133 sửa
  front matter — #132 lỡ merge khi CI đỏ), ADR 0046 tinh chỉnh; brief cho hoạ sĩ.
- #136 API (mã bàn, cổng phụ huynh phía server + DELETE), #137 hub (cập nhật khi khuất, splash, "bàn"), #138 + #142 S2,
  #139 hub follow-up → `prod-2026-10-24.1`. Phiên "tohe-play studio" chạy song song: ADR 0050–0053 của họ, nhắn nhau trước mỗi tag.
- Mở: thanh HUD bàn online Tiến Lên cắt "Bàn online" ở 360–390 px; chữ trên canvas chưa dùng font mới.

## 2026-10-23 (F1, F2, S1 lên prod) — agent

- Owner: "ổn thì tiến hành merge PRs và deploy xong prod luôn … sáng mai tôi review 1 thể". F1 #127, F2 #128 →
  `uat-2026-10-23.1` / `prod-2026-10-23.1`; S1b #129 + S1a #130 → `uat-2026-10-23.2` / `prod-2026-10-23.2`.
- CI: e2e chờ `/play?lang=vi`; job Updates lên 20 phút (mirror apt chậm); nút header trên `brand-strong` (AA).
- S1 theo đề xuất D-07 khi owner chưa trả lời: Be Vietnam Pro, Phosphor, voice-and-look; app nhớ ngôn ngữ của trang
  dẫn vào. Mở: "bàn"/"phòng"; S2, S3 chờ D-07.

## 2026-10-23 (khảo sát, research, F1 ∥ F2) — agent

- Owner: review toàn bộ surface + khảo sát; rồi "bớt AI style", "quay lại và PWA có thoải mái chưa". Khảo sát prod bốn
  lượt (Playwright + axe, chỉ đọc) + reviewer + hai scout → R-07, R-08, R-09; D-07, E-07 proposed.
- Lỗi chức năng đi thẳng vào F1, F2 (hai builder Opus · high). Hai câu owner chưa trả lời (link ra ngoài khi mở từ app;
  *Chơi tiếp* sau game đầu) agent tạm theo đề xuất. Cloudflare Web Analytics: owner tắt.

## 2026-10-22 (lên prod) — agent

- Owner: "lên prod đi" → `prod-2026-10-22.1` trên f1a091a (= `uat-2026-10-22.4`), GitHub Release, platform-infra #246
  (chỉ `targetRevision`, agent merge), Argo CD ~2 phút, `check:prod` 23/23. Hai migration chỉ thêm cột.

## 2026-10-22 (G2b, G4, G5, G6 merged; UAT) — agent

- **G4** #119 khung app; **G2b** #120 (master đổi: ảnh OG từng game vẽ bằng `generate:og` và commit cạnh trang, có stamp —
  không Chromium trong CI/image; câu offline chỉ nói điều đúng); **G6** #121 (migration `LinkAndTableLanguages`);
  **G5** #122 (cập nhật êm + test hai bản build trong CI; master bỏ namespace `/registerSW.js` đã chết).
- UAT `uat-2026-10-22.2` (G2b+G4), `.3` (G6), `uat-2026-10-22.4` (G5). Còn lại của G5: mã bàn trên Trò chơi, PIN khi trẻ lên người
  lớn mới ở hub (API chưa kiểm) — PR sau. G7 chờ owner thử máy thật rồi "lên prod".

## 2026-10-22 (merge, UAT, G2b ∥ G4) — agent

- Owner: ADR 0048 "bạn đề xuất và xử đi" → giữ đề xuất, status Accepted; điểm 2 "triệt để bỏ đi, làm như mới, prod hiện
  chỉ có tôi dùng thôi" → bỏ cả 301 của đường cũ; "ổn thì merge … deploy giúp t … tiếp tục" → agent merge + deploy UAT.
- **#114, #115, #116, #117 merged**; **#118** (master): `/together` vào map trước trang của nó, bỏ `hubRedirects` và kiểu
  `redirect` → merged. UAT `uat-2026-10-22.1` trên 949ccae (G0–G3, không kèm #118). Builder G2b ∥ G4 (Opus · high) từ c56758c.

## 2026-10-22 (G2a, G3 PR) — agent

- **G2a** #116: `/en/…`, `hreflang` trong sitemap, VI | EN, khoá `tohe:language`, `?lang=en`; điều khoản chỉ vi tới E-05.
  Verify xanh (builder + master), CI xanh. **G3** #117 (trên #116): ADR 0048; master làm gọn — `description` tiếng Anh,
  `descriptions.vi`, bỏ đoán tên tiếng Việt theo dấu; gộp G2a, mỗi trang công khai đọc tên theo ngôn ngữ. Verify xanh.
- Ghi nhận: `apps/web` không có `typecheck` trong `pnpm verify`; thứ tự danh mục theo tên chuẩn → sửa ở G4.

## 2026-10-22 (merge G0 G1, G2a ∥ G3) — agent

- Owner: Access đã bật (điểm 1); điểm 3–13 "ổn, theo đề xuất"; điểm 2 muốn xem toàn bộ route → [routes.md](routes.md);
  "merge giúp" → **#110, #111, #112 merged** (quyết định ghi vào ADR 0042/0046/0047 trong #112). Không điểm nào tách.
- **G2a ∥ G3**: hai builder (Opus · high) chạy từ `main`. B (Dependabot) → PB-20, #115. Status: **Better Stack** (miễn
  phí, domain riêng, 3 phút), #114. Chat id để ở Infisical được (template). Mail thử nhận được; Resend `notify.` chưa.

## 2026-10-22 (G1, CI) — agent

- CI của #112 đỏ ở E2E (smoke), bước "bảng xếp hạng trên game", hai lần liên tiếp; `main` xanh. Bỏ header
  `Origin-Agent-Cluster` khỏi origin game → CI xanh hết → header là nguyên nhân. ADR 0046 ghi "để sau, cần hiểu trước";
  PB-13 ghi phát hiện. G0 merge vào G1 (không force-push); nhánh cũ `feat/g1-routes` đã xoá (chưa có PR).

## 2026-10-22 (G0, G1) — agent

- Owner: "ok làm G0 G1 đi". **G0** #111: ADR 0046, 0047, `surfaces.md`; reviewer (Opus · high) 0 blocker, 4 major, 17 minor
  — đã sửa (Access và cập nhật êm là đề xuất; thứ tự ngôn ngữ trong app hết tự mâu thuẫn; sitemap ở `@tohe/routes`;
  `facts.json`; mô tả game để mở). **G1** #112 (xếp trên #111): crawler theo tên, `Origin-Agent-Cluster`; namespace dời
  sang G2a/G2b/G4. `pnpm verify` xanh. Chờ owner duyệt.

## 2026-10-22 (sửa ngày) — agent

- Các mục ghi "2026-10-23" là ngày agent tự ghi sai — hệ thống chỉ báo đổi ngày một lần, sang 2026-10-22. Đã sửa
  mọi ngày đó về 2026-10-22 trong plan; nhãn trong ngoặc của các mục log giữ thứ tự.

## 2026-10-22 (gom gọn) — agent

- Owner: "rất hợp lý, theo đề xuât tôi chốt nha" → **D-06 decided** (B); brief **confirmed**; plan gom gọn: mỗi item có
  *Kết luận* ở đầu, D-01 viết lại theo quyết định cuối, `design.md` v1 ghép mọi quyết định, `map.md` và `PLAN.md` viết lại.
- Phase **Graduate — đợt 1**: G0 (ADR 0046, 0047 + `surfaces.md`) → G1 → G2a ∥ G3 → G2b ∥ G4 → G5 ∥ G6 → G7. Tiếp: G0.

## 2026-10-22 (đêm) — agent

- Backlog sản phẩm: `docs/roadmap/product-backlog.md`, PB-01…PB-19, PR #110.
- R-06 + **D-06 proposed** (B: nội dung game trong `games/<id>/page/{vi,en}.md`, sự thật từ `game.json`, build sinh trang,
  `hreflang`, JSON-LD, ảnh OG từng game; bộ sưu tập từ ~8 game; cho phép rõ bot tìm kiếm của AI). Chờ owner Q1–Q4.

## 2026-10-22 (khuya, sau) — agent

- Owner: ý hay vào backlog có tracking; ưu tiên chốt thiết kế bề mặt (bố cục, UX, giới thiệu, SEO, GEO, mở rộng), rồi build,
  rồi game → plan chia **đợt 1 / đợt 2**; D-03 **deferred** → `docs/roadmap/product-backlog.md` (PR riêng); **D-06** mở,
  scout đang nghiên cứu SEO, GEO, mở rộng.

## 2026-10-22 (khuya) — agent

- Owner: D-05 ở **L1** (game do owner thêm; luật leo thang thành chủ đề trong spec) → **D-05 decided**.
- Owner: học từ miniblox.io và sản phẩm tương tự, đề xuất mạnh → hai scout → R-05, **D-03 proposed** (bậc 1: 7 mục trước
  launch, gồm thử thách hôm nay và bàn của gia đình; bậc 2: màn hình chung, bàn theo lượt, mùa Tết, thẻ kết quả).

## 2026-10-22 (tối) — agent

- Owner: D-01 tạm chốt (`x-default` → `/en/`). D-05: vì sao cách ly game, đổi góc nhìn → giải thích thang cách ly L0–L3,
  mô hình mặt phẳng (ADR 0042 đã là nó); đề xuất viết rõ mặt phẳng + luật leo thang vào ADR của D-02.

## 2026-10-22 (sau) — agent

- Owner: Q3 hợp lý (bản vi gốc); **đổi lại mặt chính sang tiếng Việt**, en hỗ trợ người nước ngoài, tên riêng và thuật ngữ
  giữ tiếng Anh → D-01 cập nhật (`/` vi, `/en/` en, `x-default` → `/en/` chờ duyệt).
- Owner: subdomain không tách được ư, hai domain tốn → giải thích origin vs site (PSL); D-05 quay về đề xuất A.

## 2026-10-22 — agent

- Owner: **D-01 decided** — Q1 B; Q2 tên game tiếng Anh bắt buộc + tên theo ngôn ngữ tuỳ chọn (đổi Game Contract); Q4
  **tiếng Anh mặc định** (`/` en, `/vi/`), gợi ý vi khi trình duyệt đặt vi. Q3: agent gợi ý vi là bản gốc theo Luật BVQLNTD
  2023 Điều 23 (bản có lợi hơn cho người dùng được áp dụng khi lệch) — chờ owner.
- D-05: owner sẵn sàng tách ngay → agent đổi đề xuất sang B; trang giới thiệu hay game sang `vinetic.io.vn`: không nên.

## 2026-10-22 (khuya, sau) — agent

- Builder tái hiện rủi ro cập nhật bằng test hai bản build (Chromium) → **không có màn lỗi**: HTTP cache giữ file cũ; khi
  mất cache, TanStack Router tự nạp lại một lần. Agent đã đánh giá sai (chưa đọc code thư viện). D-04 §4 về *proposed*,
  không PR riêng; test giữ ở worktree `agent-a8048e1129181a666` (chưa commit). Safari/iOS chưa thử.

## 2026-10-22 (khuya) — agent

- Owner: "ok sửa rủi ro cập nhật trước đi, D-02 D-04 chọn B" → **D-02, D-04 decided** (B). Sửa cập nhật an toàn: PR riêng
  từ `main`, builder (Opus · high), tái hiện bằng test trước khi sửa.
- Owner: review lại chia host/subdomain/path đã tối ưu chưa → scout + kiểm code → R-04, **D-05 proposed** (A: giữ;
  game sang domain riêng khi có game không do repo viết; Access cho console trước launch).

## 2026-10-22 (tối) — agent

- Owner hỏi đã khảo sát việc quay lại / app đã cài chưa → chưa (chỉ lần mở đầu ở Phase 1). Hai scout → R-03, **D-04 proposed**.
- Phát hiện: `autoUpdate` + `skipWaiting` + xoá cache cũ, không bắt lỗi nạp lười → **rủi ro màn lỗi sau mỗi deploy**
  (chưa tái hiện); đề xuất PR riêng làm ngay. `rooms.mine()` có mà không màn nào dùng; lời mời chỉ cho account.

## 2026-10-22 (chiều) — agent

- Owner: nghiên cứu sâu bố cục, "1 giai phap hien dai … gia rat re" → hai scout (Opus): kiểm kê màn trong code, tiền lệ
  trên web → R-02; **D-02 proposed** (B: hai vùng Khám phá/Chơi, khung app ba mục, `/` danh mục trước, bỏ redirect).
- **D-01 proposed** (B: `/en/` + hreflang trong sitemap cho trang công khai; ngôn ngữ là cài đặt trong app; link không
  mang ngôn ngữ). Chờ owner: D-02 Q1–Q5, D-01 Q1–Q4.

## 2026-10-22 — agent

- Owner trả lời Q1 (rà toàn bộ cái đang có), Q4 (vi + en mọi chỗ của người chơi, trang giới thiệu có SEO, console chỉ
  tiếng Anh, Điều khoản + Quyền riêng tư hai ngôn ngữ), Q5 (không đặt ngày launch) → brief, map (9 item nháp).
- Owner hỏi "trang giới thiệu vào từ đâu" → R-01: chỉ người lần đầu tới `/`; app không có đường ra trang công khai.
- Chờ owner: Q2, Q3, xác nhận brief.

## 2026-10-21 — agent

- Owner: "ok mở plan launch-review và viết brief đi" → plan mở ở *Frame*; brief nháp với Q1–Q5; map nháp 7 item.
- `product-surface` E-05 (Cổng) chuyển sang đây thành E-01 (`git mv`, link đã sửa); *Waiting on the owner* chuyển theo.
- Chờ owner: chốt brief, Q1 (phạm vi so với Phase 2/3) trước tiên.
