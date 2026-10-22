# D-03 — Tính năng nào phải có trước launch, cái nào để sau?

- Status: **deferred** → backlog sản phẩm (owner, 2026-10-23, chat) — mở lại khi owner chọn một mục ra làm
- Kind: decision
- Blocks: E-01 (Cổng), E-05 (Điều khoản nói đúng tính năng) · Blocked by: — · Đi cùng: [D-02](D-02-layout.md), [D-04](D-04-coming-back.md)
- Decided: —

## Why it matters

Owner (2026-10-22): "research xem ta có thể học hỏi gì từ nó hay sản phẩm tương tự để chốt plan nâng cấp sắp tôi, thoải
mái đề xuất mạnh cho tôi". Brief Q2: danh sách "tính năng còn thiếu trước launch" là của owner; agent chỉ đưa ứng viên.

## What is true today

[R-05](../research/R-05-learning-from-peers.md):

- Nhiều thứ các nền tảng khác có thì Tò He **đã có ở API**: bot lấp ghế và đánh thay, QR, xem bàn, emote, "Thách bạn",
  trang game công khai, link mời. Cái thiếu là cách bày ra trong khung app mới (D-02).
- Cái chưa có: thử thách hằng ngày, bàn cố định của gia đình, màn hình chung, bàn theo lượt nhiều ngày.

## Options — ứng viên, theo bậc

Cột "Cần": **ADR** khi đổi Game Contract hay mô hình phòng; **nội dung** khi là chữ và trang.

### Bậc 1 — trước launch: giá trị cao, cái giá thấp hay vừa

| # | Đề xuất | Học từ | Đã có / mới | Cái giá | Cần |
|---|---|---|---|---|---|
| 1 | **Lời hứa "không bao giờ"**: một dòng ở đầu `/` — "Không quảng cáo · Không cần tài khoản · Chơi ngay"; một trang hứa công khai: không quảng cáo, không theo dõi, không mua, không xu | Lichess ("never will"); dòng ".io" chỉ nói được "không đăng nhập" | vision đã hứa; chưa thành trang | thấp | nội dung |
| 2 | **Mục Chơi cùng là một thẻ ba hành động to**: **Tạo bàn** (luật, bot lấp ghế, khoá bàn) · **Vào bàn** (mã 6 số; camera của máy đọc QR là mở link) · **Thách bạn**; dưới là bàn của bạn, lời mời | skribbl, Gartic, BGA | API đã có hết; gom lại trong D-02 | vừa — đã trong PR 2 của D-02 | — |
| 3 | **Thẻ mời nói rõ chỗ trống**: thẻ xem trước `/r/…` ghi "Tiến Lên · Bàn của Bà · còn 1 ghế"; mở link là thẻ "Vào bàn" (tên, avatar, một nút) | Gartic; thói quen nhóm Zalo | thẻ đã có (ADR 0044); thêm số ghế | thấp | — |
| 4 | **Thử thách hôm nay**: mỗi game một seed mỗi ngày, ai cũng như nhau; thẻ ở đầu mục Trò chơi; **bảng của gia đình** chỉ gồm các hồ sơ trong tài khoản; dùng lại hạ tầng "Thách bạn". Không chuỗi ngày, không phạt khi bỏ | Lichess (câu đố hằng ngày), Duolingo Family Quest (hợp tác) | mới | vừa — một kiểu lối vào mới `daily` (ADR 0045 đã chừa: "each is a new kind") + seed theo ngày từ server | ADR (Game Contract) |
| 5 | **Bàn của gia đình**: mỗi tài khoản một bàn cố định với mã không đổi — ghim vào nhóm Zalo, ông bà luôn bấm cùng một link | (mới — chưa thấy ai làm) | mới; bàn hôm nay đóng sau 30 phút không ai nối (ADR 0016) | vừa — giữ mã và cài đặt bàn ở server, bàn trong bộ nhớ dựng lại khi có người vào | ADR (mô hình phòng) |
| 6 | **Chế độ trẻ em nhìn thấy được**: hồ sơ trẻ em có ô to, ít chữ; ở bàn chỉ có emote (không chữ); không hiện ở bảng xếp hạng công khai; một dấu nhỏ cho biết đang ở hồ sơ trẻ | Lichess Kid Mode, Khan Academy Kids | phần lớn đã có (hồ sơ trẻ, mã của bố mẹ, công tắc chơi với người ngoài); bảng xếp hạng **cần kiểm** | thấp | — |
| 7 | **Trang SEO theo nhu cầu tìm kiếm**: "game cho bé không quảng cáo", "chơi Tiến Lên với gia đình", "game chơi cùng bạn qua Zalo" | miniblox (`/game/unblocked`, `/game/school`) | mới | thấp | nội dung |

### Bậc 2 — sau launch: mạnh tay, cái giá lớn

| # | Đề xuất | Học từ | Cái giá | Cần |
|---|---|---|---|---|
| 8 | **Màn hình chung**: TV hay máy tính bảng hiện bàn Tiến Lên và mã QR; mỗi điện thoại là bài trên tay của một người; người đến muộn làm khán giả — cả nhà quanh TV ngày Tết | Jackbox | lớn — vai "màn hình" và "tay cầm" trong Game Contract, game phải làm lại phần hiển thị | ADR (Game Contract) |
| 9 | **Bàn theo lượt nhiều ngày**: Tiến Lên, cờ — mỗi người đi khi rảnh; cho gia đình ở hai thành phố | Board Game Arena | lớn — trạng thái bàn phải lưu bền (hôm nay trong bộ nhớ, ADR 0016); báo "đến lượt bạn" (thông báo đẩy tự bật, D-04) | ADR |
| 10 | **Mùa Tết, ngày lễ**: giao diện theo mùa, một link tạo cả giải đấu gia đình, "bảng vàng" in được — chỉ trang trí, không xu | ZingPlay (sự kiện) — bỏ phần cược | vừa | — |
| 11 | **Thẻ kết quả**: ảnh xem trước cho link "Thách bạn" ghi điểm cần vượt | miniblox (gợi ý của scout) | vừa — ảnh OG sinh ở server | — |
| 12 | **Ủng hộ tự nguyện**: người ủng hộ chỉ được một huy hiệu | Lichess | thấp về kỹ thuật; **cần owner quyết** — vision hứa "không mua trong app" | ADR (vision) |

### Không làm — dù các nền tảng khác làm

- Xu, vàng, chip, **mức cược**, cấp VIP, quà đăng nhập mỗi ngày, vòng quay, hộp quà ngẫu nhiên — ZingPlay và dòng ".io" làm,
  đọc như cờ bạc với trẻ em.
- Quảng cáo đè lên màn chơi, SDK và analytics của bên thứ ba (miniblox).
- Chat chữ với người lạ; phòng công khai ngẫu nhiên làm mặc định (skribbl, Gartic).
- Chuỗi ngày có phạt, câu gây áy náy, tự chạy sang ván sau (ICO, R-03).

## Recommendation

**Bậc 1 trọn vẹn trước launch** (1–7). 1, 3, 6, 7 rẻ. 2 đã nằm trong D-02. 4 và 5 cần hai ADR nhỏ và là **hai điểm khác
biệt** của Tò He với mọi nền tảng ở trên — cả hai dựa trên thứ đã có (Thách bạn, mã bàn). Bậc 2 vào roadmap sau launch, theo
thứ tự 8 (Tết là dịp tự nhiên nhất), 9, 10, 11; 12 chờ owner.

Cách đặt trong khung (D-02):

- **Trò chơi**: thẻ "Thử thách hôm nay" → "Chơi tiếp" → mọi trò chơi (trẻ em: ô to, chỉ hình).
- **Chơi cùng**: Tạo bàn · Vào bàn · Thách bạn → **Bàn của gia đình** → bàn đang ngồi → lời mời.
- **Tôi**: đổi người chơi (avatar cả nhà) → cài đặt → khu của bố mẹ (sau mã quản lý).

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Bậc 1 (1–7) làm hết trước launch? Bỏ hay thêm mục nào? | Làm hết |
| Q2 | Bậc 2: thứ tự 8 → 9 → 10 → 11 sau launch? | Đồng ý thứ tự này |
| Q3 | Ủng hộ tự nguyện (12) — có hay không? | Owner quyết; nếu có thì chỉ huy hiệu, ngoài app, ghi vào vision |

## Decision

**Deferred** — owner, 2026-10-23, chat: "rất nhìu thứ hay cần làm, nhưng nó trải trên nhìu scope, hay tạo các backlog đến hợp hơp và tracking tốt để có thể pick ra làm từ từ phù hợp sau đó quay lại nhiệm vụ ưu tiên là chốt và nâng cấp bố cục sản phảm và các bề mặt tốt cho UX user, và bề mặt giới thiệu sản phẩm, SEO GEO, và scale bề mặt này tương lai nè, tôi muốn chốt được thiết kế này xong là có thể build tiếp chi tiết tiếp theo và sau đó có thể tập trung phát triển thêm đc game sau đó nè". Mục 1–12 vào `docs/roadmap/product-backlog.md`, có mã, trạng thái
và nguồn; mục 1 (lời hứa), 7 (trang SEO theo nhu cầu) thuộc bề mặt giới thiệu nên đi vào D-06; mục 2 đã nằm trong D-02.

## Discussion

**agent** (2026-10-22): miniblox.io đáng học ở cách làm SEO (trang tĩnh theo nhu cầu tìm kiếm, `llms.txt`) và lời mời
"không đăng nhập", **không** đáng học ở cách kiếm tiền — quảng cáo đè lên màn chơi là đúng thứ Tò He hứa không làm.
