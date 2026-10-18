# Log — Public launch

Mới nhất ở trên. Mỗi phiên một mục: cái gì đã chuyển, đang chờ ai. Tối đa 5 dòng mỗi mục.

## 2026-10-18 (đêm, sau cùng) — agent

- Owner muốn mọi host dưới `toheplay.io.vn`, không dính `vinetic`. Đề xuất hai phương án (D-13, Thảo luận); chưa
  sửa gì — #239 chưa merge nên đổi host còn rẻ. Chờ owner chọn phương án và tên.

## 2026-10-18 (đêm, tiếp) — agent

- Owner: email gửi từ `toheplay.io.vn`, key Resend của domain đó. #239 đổi người gửi sang `no-reply@toheplay.io.vn`;
  tohe-play#68 sửa ví dụ UAT. DNS mail đủ cho Resend, thiếu DMARC — đề xuất owner thêm.

## 2026-10-18 (đêm) — agent

- Owner: Cloudflare xong; "merge giúp"; email + mật khẩu trước, "làm A4"; "deploy uat luôn". #66, #67 merged;
  `main` = `c49746c`, CI xanh, publish GHCR. UAT deploy `c49746c` — lần đầu kéo image GHCR; mọi kiểm OK, backup trước.
- A4: [platform-infra#239](https://github.com/vinetic-spaces/platform-infra/pull/239) (draft) — values, InfisicalStaticSecret `/tohe`, ApplicationSet wave 3, repo OCI công khai, role `tohe`
  ở overlay production. Chờ owner: `02-role-secret.sh tohe`, `/tohe` trong Infisical, merge.

## 2026-10-18 (khuya, sau cùng) — agent

- Owner: "domain đã sẵn sàng, đã trỏ về server prod". Kiểm từ ngoài: ba host tới Traefik prod qua Cloudflare (`404`,
  chưa có Ingress); "Always Use HTTPS" chưa bật. Gửi owner checklist việc tiếp theo (PLAN → Waiting on the owner).

## 2026-10-18 (khuya, cuối) — agent

- Owner đã mua `toheplay.io.vn` → D-13 decided. Rà soát: mọi thứ đi theo `publicUrls.games`; chỉ file mẫu production
  ghi tên cũ. [#67](https://github.com/vinh466/tohe-play/pull/67) (ADR 0039): tên mới, `/` → hub, `noindex`, docs; `pnpm verify` xanh.
- Chờ owner: review #66, #67; zone Cloudflare cho `toheplay.io.vn` (thiết lập trong item D-13).
- Flaky: conformance shell của `tap-merge` (menu khi tạm dừng / Back) đỏ ngẫu nhiên trên CI — cả nhánh chỉ có docs; chạy lại
  thì xanh. Việc của agent: làm nó ổn định, không nới phép kiểm.

## 2026-10-18 (khuya, tiếp) — agent

- Owner: "chắc tôi sẽ mua 1 domain mới, mà .io.vn vẫn được chứ" → D-13 Q1 = B.
- `.io.vn` được: public suffix nên là site riêng, mở cho mọi cá nhân/tổ chức. Tên gợi ý `toheplay.io.vn` (DNS còn
  trống), dự phòng `tohebox.io.vn`; `tohe.io.vn` đã có người dùng ([tìm tên](items/D-13-games-origin-domain.md#tìm-tên-2026-10-18)).
- Chờ owner: mua tên, trỏ về Cloudflare; rồi agent viết ADR (sửa 0002) + cấu hình.

## 2026-10-18 (khuya) — agent

- Owner: "#62 đồng ý", namespace `monitoring` đúng, E-02 Q2 Free, E-08 Q2 email, E-07 Q7 → xoá chờ admin; "chốt hiện tại,
  merge giúp tôi các PR". Cả 23 PR #43–#65 đã merge (chuỗi chính rồi dòng chart); `main` = `ad83c45`.
- F1c: [#66](https://github.com/vinh466/tohe-play/pull/66) (ADR 0038) — hết 7 ngày account chờ admin xoá trong console;
  `pnpm verify` xanh; chưa merge, chưa lên UAT.
- D-13: owner hỏi gợi ý → [proposed](items/D-13-games-origin-domain.md): B, một domain riêng cho game trước F4.
- CI `main` xanh, publish lần đầu lên GHCR: 5 package đã public. Chờ owner: review #66, D-13 Q1/Q2, API key Resend
  cho UAT, receiver email ở `platform-infra`.

## 2026-10-18 (tối, cuối) — agent

- F1–F3 xây xong, CI xanh: #61 xoá (ADR 0034), #62 kiểm duyệt tên (0035), #63 metrics (0036), #64 chart, #65
  proof-of-work (0037). F1a chạy thử migration trên dump UAT trước.
- UAT: #61 → #62 → #63 → #65 lên lần lượt, mỗi bước kiểm; UAT chạy `a42810dd9f0b`. Đã báo owner verify.
- Chờ owner: verify, duyệt danh sách từ (#62), namespace `monitoring` (#64), E-02 Q2, E-07 Q7, E-08 Q2, D-13.

## 2026-10-18 (tối, tiếp) — agent

- E-01: migration chạy thử trên dump UAT mới nhất — dữ liệu của nhà giữ nguyên ([kết quả](items/E-01-uat-migration.md#kết-quả-2026-10-18)).
- UAT: #43 → #60 lên lần lượt, mỗi bước kiểm; UAT chạy `15b69300f831`. Migration đã lên UAT không sửa nữa.
- Đang xây F1a (xoá account/hồ sơ, ADR 0034); tiếp F1b, F2, F3.

## 2026-10-18 (tối) — agent

- Owner: "ok như bạn đề xuất, làm đi, và deploy uat tuần tự + kiểm tra, sau khi hoàn thành thì báo tôi verify". E-07,
  E-08, E-09 → `decided` theo đề xuất (E-07 Q7 pháp lý và E-08 Q2 kênh cảnh báo vẫn mở); giả định của C5 được nhận.
- Tiếp: chạy thử migration trên dump UAT, deploy #43 → #60 tuần tự, xây F1–F3, deploy, báo owner verify.

## 2026-10-18 (chiều, tiếp) — agent

- C5 #60 sửa cho khớp design §3.15 ("lời mời luôn hỏi xác nhận kèm thẻ"): tra ID (`GET /api/profiles/by-id`) → thẻ →
  "Mời {tên}" → lời mời; 20 lần tra/giờ, 20 lời mời sang account khác/giờ, 10 chờ; mã từ chối `invites_closed`.
- E-07, E-08, E-09 → `proposed`, mỗi item có sự thật từ code, phương án, giá, đề xuất và câu hỏi. Chờ owner: review
  #43–#60, quyết E-07/E-08/E-09.

## 2026-10-18 (chiều) — agent

- E3b #59 CI xanh. C5 #60 (ADR 0033): mời bằng ID 12 số trong phòng; "ai được mời tôi" (mọi người · từng chơi cùng ·
  trong account; trẻ em luôn trong account, ID trẻ em tra từ ngoài là "không tìm thấy"); 20 lần tra ID/giờ, 10 lời mời
  chờ. Giả định chờ owner xác nhận: người lớn mặc định "Mọi người có ID". Smoke e2e theo tên mới của hộp thoại mời.
- Mọi PR code đã mở; việc tiếp theo là đề xuất cho E-07/E-08/E-09. Chờ owner: review #43–#60.

## 2026-10-18 (trưa) — agent

- E3a #58 CI xanh. E3b #59 (ADR 0032, đổi Game Contract): `init.rankedReplay`, SDK 0.9.0, conformance — game xếp hạng
  chiếu lại run, không ghi gì; Ghép Khối 1.10.0 có màn xem lại (◀ ⏸ ▶, ×1/×4/×20, thanh trượt); admin nhúng đúng bản
  đã chơi run (CSP admin thêm `frame-src` games origin). Thử thật: console làm host cho game thật, mock `/api`.
- Chờ owner: review #43–#59; quyết E-07/E-08/E-09 cho F1–F3. Agent tiếp: C5 (mời bằng ID).

## 2026-10-18 (sáng, 07:40) — agent

- E2 #57 CI xanh. E3 tách đôi: E3a #58 (ADR 0031) — "Chờ xem xét" + "Đã quyết" trong admin, duyệt / từ chối / mở lại
  sau xác thực lại, không ai quyết kết quả của chính mình, kiểm duyệt viên cũng xem xét; ẩn hồ sơ khỏi bảng công khai
  (hub báo chủ). Tự review bắt được lỗ: run đã duyệt vẫn tăng điểm khi báo lại — giờ giữ nguyên (test đỏ khi bỏ fix).
- Chờ owner: review #43–#58. Agent tiếp: E3b (xem lại run bằng chính game, đổi Game Contract), xếp trên E3a.

## 2026-10-18 (sáng, tiếp) — agent

- E1a #55 và E1b #56 CI xanh. E1b: bảng cộng đồng + toàn server đọc từ kết quả theo mức tin, top 50 + quanh tôi, công tắc
  hồ sơ (người lớn bật, trẻ em tắt, bật cần "Tôi đã hỏi ý bé"). ADR 0029 sửa trong #55: bảng đọc thẳng từ kết quả
  (đơn giản, luôn đúng), "một dòng mỗi hồ sơ" của D-09 để dành khi quy mô cần. CI #55 từng đỏ do smoke còn gọi API cũ.
- Chờ owner: review #43–#56. Agent đang làm: E2 (run tính hạng, ADR 0030), xếp trên E1b.

## 2026-10-18 (sáng) — agent

- D3b #54 CI xanh. E1 tách đôi như D3: E1a #55 (ADR 0029) — engine `Integrity`: mức tin theo bằng chứng, luật v1, nhật ký
  quyết định chỉ ghi thêm, ván phòng `verified` (ít hơn hai người thật thì không lên bảng công khai), bảng account theo
  tuần lịch Việt Nam; E1b (bảng công khai, công tắc hồ sơ) xếp trên. Tự review: run đã `held` không tự `checked` lại.
- Chờ owner: review #43–#55. Agent kế tiếp: E1b.

## 2026-10-18 (rạng sáng, tiếp) — agent

- D2 #52: setup token → chủ đầu tiên, 2FA cho console, step-up, audit log chỉ ghi thêm (trigger); CI xanh sau hai lần sửa
  (smoke nhận quyền chủ, tương phản nút). D3 tách đôi: D3a #53 người dùng; D3b #54 (ADR 0028) bật/tắt cách đăng nhập lúc
  chạy, chế độ đăng ký, cộng đồng + mã mời — mọi cách tạo account đều theo. ADR dời số: E1 0029, E2 0030.
- Làm D3b lộ lỗ ở D3a: tài khoản bị khoá vào lại bằng quên mật khẩu / gia hạn phiên → sửa trên #53 (4ae3697).
- Chờ owner: review #43–#54. Agent kế tiếp: E1, xếp trên D3b.

## 2026-10-18 (rạng sáng) — agent

- D1 #51 (ADR 0027): `apps/admin` ở `/admin/` trong image hub (CSP riêng, noindex), `/api/admin` với OpenAPI riêng, vai trò
  là claim của account → quyền, đọc vai trò từ DB mỗi request; trang tổng quan, game, sức khoẻ, hệ thống; mỗi module lộ
  `…Facts` thay vì để admin đọc bảng; lệnh `admin grant|revoke|list` trong container. CI xanh, smoke e2e cấp vai trò thật.
- Chờ owner: review #43–#51. Agent kế tiếp: D2 (setup token, 2FA, audit), xếp trên D1.

## 2026-10-18 (khuya, tiếp) — agent

- C4 #50 (ADR 0026): Google + OIDC chung (OpenIdConnect, code + PKCE, trả về bằng query), GitHub (OAuth + PKCE); liên kết
  theo `(provider, subject)`, email chỉ để tìm account, chứng minh bằng mã hoặc mật khẩu trước khi liên kết; CI xanh.
- Tự review sửa: liên kết chỉ bắt đầu từ trang hub (`Sec-Fetch-Site`); race khi liên kết → 409 thay vì 500; bản nháp quyền
  riêng tư nhắc dữ liệu provider (`TERMS_VERSION` 2026-10-18.2). Chưa làm: chứng minh bằng provider đã liên kết (D-03).
- Chờ owner: review #43–#50. Agent kế tiếp: D1, xếp trên C4.

## 2026-10-18 (khuya) — agent

- C3 #49 (ADR 0025): mã quản lý 6 số (L1), L2 bằng mật khẩu hoặc mã email, đổi mật khẩu, đồng ý điều khoản ở tuổi 16+
  và hỏi lại khi điều khoản đổi; bản nháp Điều khoản + Quyền riêng tư trong hub chờ owner duyệt. #48 CI xanh.

## 2026-10-18 (tối) — agent

- A3 #47 (GHCR publish, UAT kéo image theo SHA) và C2 #48 (ADR 0024: email là định danh, attempt + mã, decoy chống dò,
  reset kết thúc mọi phiên khác, đổi email, username cũ thêm email) mở; #44, #46, #47 CI xanh.
- C1 sửa hai lỗi e2e: bước tự chọn hồ sơ tốn thêm một request trong rate limit chung (smoke + rooms cùng một phút) →
  API tự chọn khi đăng ký/đăng nhập; trang đăng nhập/đăng ký điều hướng hai lần → chỉ guard điều hướng.
- C2 tách rate limit theo IP thành ba nhóm (đăng nhập/xin mã, nhập mã, PIN/parent gate). ADR dời số: C4 0025, D1 0026,
  E1 0027, E2 0028.

## 2026-10-18 (chiều) — agent

- Mở A1 #43 (ADR 0021), A2 #44 (chart; CI cài lên kind — sửa `helm test --logs` vì pod test bị xoá khi pass), B1 #45
  (ADR 0022), C1 #46 (ADR 0023: account sở hữu hồ sơ, ID Damm, tên tự do, migration UAT có test dữ liệu cũ).
- Phát hiện khi làm C1: API chạy InvariantGlobalization nên `Normalize` không làm gì ngoài ASCII → hub gửi NFC, gập tên
  dành riêng bằng bảng chữ Latin có dấu; khoá dòng account để giới hạn 1–5 hồ sơ đúng khi request song song.
- Chờ owner: review #43–#46 theo thứ tự; E-02 Q2; D-13; chạy thử migration trên dump UAT trước khi deploy C1.

## 2026-10-18 — owner + agent (chat)

- Owner: "ok rồi đó, theo đề xuất bạn có thể impl toàn bộ giúp tôi k, planning và làm những việc song song" → D-16 Q4,
  D-06 (N = 16), E-02 (Q1), E-01 decided; E-02 Q2 (Resend Free/Pro) và D-13 còn chờ nhưng không chặn code.
- Plan sang *Graduate*: [delivery.md](delivery.md) — 19 PR trong sáu lane, ADR 0021…0027, quy tắc merge migration
  từng cái một. Agent bắt đầu A1.

## 2026-10-17 (khuya) — owner + agent (chat)

- Owner: "ok ngu de xuat cua ban on nba" → D-17 decided (bỏ @handle, tên thoải mái có emoji, ID 12 số, tên vui ngẫu
  nhiên, ba mức mời); D-16 decided Q1–Q3 (module, replay Ghép Khối trong v1, minh bạch); D-10 decided.
- Owner hỏi giải thích bốn câu còn chờ → agent viết đề xuất cho từng câu: D-16 Q4 (bảng cộng đồng nhận `checked` cho
  game chưa có replay), D-06 (N = 16, theo R-07 mới về luật trẻ em), E-02 Q1 (`no-reply@…`), E-02 Q2 (Resend Free hay Pro
  — gói Free dùng chung 100 email/ngày với platform).
- Chờ owner: bốn câu trên. Agent kế tiếp: T1.

## 2026-10-17 (tối) — owner + agent (chat)

- Owner: "ok on … còn lại ôn" → brief xác nhận (plan sang *Map*); D-01, D-05, D-09, D-11 decided; D-15 deferred.
- Owner đổi tên hồ sơ thành "đặt thoải mái cho vui" + ID `xxxx xxxx xxxx` để mời đích danh, hồ sơ mặc định có sẵn → D-17
  proposed (bỏ @handle, ID 12 số có chữ số Damm); research bổ sung friend code Nintendo, Damm (R-04).
- Owner muốn "1 engine xịn" cho độ tin → D-16 proposed (mức tin theo bằng chứng, máy chỉ ẩn người mới phạt, verifier và
  tín hiệu cắm thêm); D-10 thành verifier đầu tiên; R-06 (Steam, Google Play, Lichess, Trackmania).
- Chờ owner: D-17 Q1–Q4, D-16 Q1–Q4, D-06, E-02. Agent kế tiếp: T1.

## 2026-10-17 — owner + agent (chat, ba lượt)

- Owner đặt hướng: release là kim chỉ nam, sửa nền trước; user-first; auth bằng email + Google/GitHub; admin console;
  chart riêng cho `platform-infra`. Agent review và tách thành các track; owner chấp nhận các đề xuất còn lại.
- Owner đổi family thành "một account nhiều hồ sơ, @handle duy nhất" → D-01 proposed (agent rút lại phương án Family);
  OAuth chỉ ở prod → D-04 decided, D-15 proposed defer; luồng auth chuẩn, vẽ mermaid → D-02/D-03 decided, design §3.
- Mở plan space (`plans/`, ngoài `docs/` vì site publish mọi thứ dưới `docs/`); research R-01…R-05; bảng xếp hạng
  phân tầng theo độ tin (D-09…D-11).
- Chờ owner: brief, D-01 Q1–Q5, D-05, D-06, D-09…D-11, E-02, D-15. Agent kế tiếp: T1 (ADR production via chart → E-03 → E-04).
