# R-12 — Tiền lệ: trang chủ, cửa của người quay lại, lần đầu vào app

- Date: 2026-10-24 · Feeds: [D-08](../items/D-08-landing-introduces.md), [D-09](../items/D-09-the-way-back-in.md),
  [D-10](../items/D-10-entering-the-hub.md) · Bước 2 của [R-10](R-10-surface-round-2-plan.md)

## Question

Sản phẩm cùng loại làm trang chủ cho người mới thế nào, đưa người quay lại vào app thế nào, và hỏi đăng nhập lúc nào?

## Findings

**Quan sát trực tiếp** (2026-10-24, Playwright, Pixel 7, `vi-VN`, chưa đăng nhập, chỉ đọc trang công khai):

| Sản phẩm | `/` cho người mới | Nút ở màn đầu | Section |
|---|---|---|---|
| Duolingo | Trang giới thiệu | Hai nút xếp chồng, căn giữa, cùng bề rộng: **"Bắt đầu"** (chính) và **"Tôi đã có tài khoản"** (phụ) | Hero (hình + H1) → "miễn phí. vui nhộn. hiệu quả" → "Dựa trên căn cứ khoa học" → "tiếp thêm động lực" → "cá nhân hoá" → "học bất kỳ lúc nào" → lời mời cuối trang |
| Chess.com | Trang giới thiệu | "Get Started", "Log In", "Sign Up", "Use App" | H1 → chơi với bot → bài học → câu đố → xem giải → tin |
| Discord | Trang giới thiệu | Tải app (điện thoại) | H1 → 7 section tính năng, mỗi section một hình → câu chốt "You can't scroll anymore. Better go chat." |
| Lichess | **App là trang chủ**: sảnh tạo ván ngay | "Chơi", "Tạo ván đấu tại sảnh" | Không có trang giới thiệu |
| Poki, CrazyGames | **Danh mục là trang chủ** | Ô game | Lưới game → "What is Poki?" / "About CrazyGames" ở cuối (chữ cho SEO) |
| PBS KIDS Games | Danh mục | Ô game, không đăng nhập | — |
| Toca Boca | Trang giới thiệu | **"I'm an adult" / "I'm a kid"** trước nội dung | Tách người lớn và trẻ từ cửa |
| YouTube (gia đình) | `youtubekids.com` chuyển tới `youtube.com/myfamily` | — | Lựa chọn cho từng lứa tuổi → Hỏi đáp |

**Theo tài liệu:**

- Google xếp **"Redirecting users to an internal page once they are logged in"** vào redirect hợp lệ; cloaking là cho
  bot và người dùng thấy nội dung khác nhau "with the intent to manipulate search rankings and mislead users"
  ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)).
- GitHub: "Your personal dashboard is the first page you'll see when you sign in" — cùng URL, nội dung theo phiên
  ([GitHub Docs](https://docs.github.com/en/account-and-profile/get-started/personal-dashboard-quickstart)).
- NN/g khuyên không đặt tường đăng nhập ở trải nghiệm đầu (từ 1999): người dùng bực, chi phí tương tác cao; cách tốt hơn
  là cho xem giá trị trước, hỏi đăng nhập ở lúc cần ([Login Walls](https://www.nngroup.com/articles/login-walls/)).
- Baymard: **19%** người mua bỏ giỏ hàng vì bị bắt tạo tài khoản
  ([Baymard](https://baymard.com/blog/reduce-cart-abandonment)) — bối cảnh mua hàng, chỉ để thấy cỡ của cái giá.
- YouTube Kids: lần đầu, **người lớn** đăng nhập (tuỳ chọn, nhưng là đường mở quyền kiểm soát), đồng ý thay trẻ, rồi
  tạo hồ sơ trẻ, tối đa 8 ([Google Help](https://support.google.com/youtubekids/answer/7554914)).
- Khan Academy Kids: lần đầu hỏi email của bố mẹ rồi mới tạo hồ sơ trẻ (tên, tuổi, avatar) — theo video hướng dẫn và
  bài đánh giá lúc ra mắt, chưa có trang trợ giúp chính thức ([Khan Academy help](https://support.khanacademy.org/hc/articles/360040168512-Parent-Quick-Start-Guide)).

## Assumptions

- Duolingo và Chess.com đưa người đã đăng nhập vào thẳng app khi mở `/` — biết từ dùng thường ngày, chưa kiểm được vì
  không đăng nhập.
- Bố cục trên máy tính của các trang trên chưa chụp; nhận xét về "nút căn giữa" chỉ đúng cho điện thoại.

## So what

1. **Trang chủ của một sản phẩm cần giải thích** (Duolingo, Discord, Chess.com) theo một khuôn chung: hero căn giữa có
   hai nút (bắt đầu / đã có tài khoản) → vài section giá trị, mỗi section một ý và một hình → lời mời cuối trang. Danh
   mục làm trang chủ là kiểu của cổng game (Poki, PBS KIDS), nơi người đến để chọn game chứ không để hiểu sản phẩm.
   → D-08 theo khuôn của Duolingo; danh sách game để ở `/games/`.
2. **Nút "Tôi đã có tài khoản" ngay ở hero là cửa cho người quay lại trên trình duyệt mới.** Người đã chơi trên máy
   này thì sản phẩm nhận ra (GitHub, Duolingo); Google không coi đó là gian lận khi nội dung cho bot giống người mới.
   → D-09: nhận ra máy quen ngay ở `/`, không cần đổi domain/path.
3. **Không ai cùng loại vừa chặn đăng nhập vừa cho trẻ chơi qua link.** Sản phẩm cho trẻ hỏi người lớn ở lần đầu
   (YouTube Kids, Khan Academy Kids, Toca Boca) nhưng *hỏi và giải thích*, còn cổng game không hỏi gì. → D-10: hỏi ở lần
   đầu, cho chọn, nói rõ tiến độ lưu ở đâu; link mời đi thẳng.
