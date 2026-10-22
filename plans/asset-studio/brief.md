# Brief — Asset Studio: nguyên liệu cho game nhiều content

Status: **confirmed**. Owner, chat 2026-10-22: "đúng ý r". Trích dẫn là lời owner trong chat ngày 2026-10-22, giữ
nguyên văn và chỉ cắt bớt; `[...]` là chú thích của agent.

## Vì sao

Tò He hiện có năm game, và cả năm đều tự vẽ hình bằng code (`drawTexture`), không dùng ảnh nào. Các game kế tiếp trong
backlog (Vườn Rau Mini, Hiệp Sĩ Tò He, farming RPG) cần nhiều hình đẹp, đa dạng và có cơ chế mở rộng được. Engine
không chặn chuyện này, nhưng nền tảng thì chưa xây:

> "ok ổn là nên tảng k chặn, chỉ là ta chưa xây"

Owner muốn có một Studio do Tò He quản lý, nơi AI là người làm chính:

> "ta có 1 nên tảng cho việc AI/người tạo được các "nguyên liệu" này luôn (1 Studio mở cho AI connect và làm việc,
> người thì hỗ trợ upload lên đc r, ta sẽ xây các công cụ cho AI làm ra asset là chính, và ta có thể quản lý đc 1 cách
> hợp lý và phân phối đc chúng cho các games, game chỉ việc lựa và chọn haha), sẽ được Tò He quản lý, các game sẽ phải
> phụ thuộc chính vào đây, giúp Tò He kiểm soát được asset tập trung luôn"

Mức phụ thuộc vào Studio do từng game tự quyết và khai báo rõ với nền tảng:

> "nền tảng ta sẽ hỗ trợ và game sẽ tự quyết định mức độ phụ thuộc, vd game muốn hỗ trợ office [offline] thì chốt là
> asset sẽ đc tải sẳn sàng cho thiết bị, game full office [offline] 1 người thì tự vận hành k cần BE hay asset từ nền
> tảng cũng đc (build 1 cục, với game nhẹ, game muốn như vậy), game có thể chốt cần internet thì thoải mái muôn local
> asset hay load động gì đó, đó là lựa chọn của game, game sẽ tự xử lý để đảm bảo vận hành của chính nó và nó contract
> rõ với nền tảng, nền tảng thì cũng cấp mở hơn (... có thể là cách tiếp cận này cho các vấn đề khá, chủ yếu là ý tưởng
> rõ ràng trong phụ thuộc để game đa dạng và mở hơn)"

Người dùng chính của nền tảng là agent:

> "chúng ta đang trong giai đoạn highlevel brainstorm cho nên tảng để game có thể dựng trên nó 1 cách thuận tiện (cho
> Agent dựng là chủ yếu nè, người duyệt và hỗ trợ đc thì tốt luôn)"

## Ràng buộc đang có hiệu lực

- **Sandbox của game** (ADR 0002, 0040): game chạy trong iframe trên `games.toheplay.io.vn`, với CSP `connect-src 'self'`
  (`packages/contract/src/csp.ts:16`). Game không gọi API và không gọi mạng ra ngoài folder của mình (`AGENTS.md:31`).
- **Build bất biến** (ADR 0007): `/<id>/<version>/` được cache một năm (`deploy/docker/Caddyfile.games:31`). Muốn đổi gì
  thì ra version mới.
- **Offline trước** (ADR 0005). Spike S1 (game offline hoàn toàn trong iframe trên iOS) **vẫn mở**
  (`docs/roadmap/walking-skeleton.md:36`).
- **Ranked replay** (ADR 0030): server chạy lại ván, nên luật và data ảnh hưởng luật phải cố định theo build.
- **Repo public và chưa có LICENSE** (`gh repo view`, 2026-10-22). Asset nào vào repo thì ai cũng thấy.
- **Host đã giữ chỗ** (ADR 0042, `packages/routes/src/map.ts:65`): `studio.` cho công cụ làm game, nếu cần quyền khác
  người chơi; `media.` cho file người dùng tải lên, không cookie.
- **Production chỉ đọc từ ngoài** (`AGENTS.md:42`): agent không ghi vào cluster của prod. Studio chạy ở đâu và agent
  ghi vào nó bằng gì là câu hỏi của D-11.
- **Build được phép cần mạng** khi dùng Studio (owner, D-06): "build sẽ chịu là có mạng và phụ thuộc vào store (nếu có
  dùng) (nên xây dựng cơ chế cache nha)".
- **Nền tảng gia đình**: trẻ em chơi (`minAge`), nên nội dung phải được người duyệt.
- **Chi phí**: owner quyết ngân sách cho generator trả phí. Worker là Opus ở effort ≤ high.
- **Chưa có người dùng ngoài** (owner thử một mình): được làm lại tận gốc, không cần giữ tương thích ngược.

## Done when

1. Một agent tạo được một **pack** asset (từ pack CC0, generator AI hoặc vẽ bằng code), chạy qua hậu xử lý và kiểm tra
   tự động, rồi gửi duyệt. Owner duyệt xong thì pack có version, hash, nguồn gốc và license.
2. Một game **khai báo** trong `game.json` pack và version nó dùng, cùng chế độ tải. Build ghi lock và đóng gói. Build
   vẫn bất biến, conformance kiểm đúng điều game khai báo.
3. Studio sửa một asset thì game cũ **không đổi**. Game muốn dùng bản mới thì nâng version qua một PR.
4. Mỗi game có màn ghi công sinh ra từ lock (license nào cần ghi công thì có).
5. **Pilot**: một vertical slice nhiều content (Vườn Rau Mini: 1 map, 3 cây, 1 NPC, ngày/đêm, cả dọc lẫn ngang) dựng
   trên Studio. Đã đo kích thước, FPS và save trên máy thật.
6. Nguyên tắc "game khai báo mức phụ thuộc, nền tảng cung cấp và giữ rào" được ghi thành ADR, để dùng lại cho các vấn
   đề khác ngoài asset.

Chế độ `precache` và `on-demand` đã được thiết kế, nhưng chỉ xây khi có điều kiện (D-13: sau spike S1 và khi có game
cần). Chúng không chặn *Done when*.

## Not this plan

- **Xưởng tạo game cho người dùng** (người ngoài tự làm game). `studio.` ở đây chỉ phục vụ việc tạo asset cho game của
  Tò He.
- **Asset người chơi tải lên trong game** (avatar, ảnh). Phần này thuộc `media.`.
- **3D, video, cutscene.**
- **Mua bán asset hay marketplace.**
- **Viết game Vườn Rau Mini đầy đủ.** Ở đây chỉ làm slice để kiểm chứng Studio.
- **Agent cùng vận hành nền tảng** (monitoring, cập nhật tự động). Owner có ý định này (2026-10-22: "có đường cho bạn
  (Agent) có thể cùng quản lý trên đó luôn (monitoring, update tự động, nhạy cảm thì k, ...)"). Nó sẽ là một plan riêng.
  Plan này chỉ làm cơ chế token cho agent sao cho plan đó dùng lại được (D-15).
- **Chọn LICENSE cho code của repo.** Đã ghi vào log là việc phát hiện ra. D-07 chỉ quyết license của asset.
