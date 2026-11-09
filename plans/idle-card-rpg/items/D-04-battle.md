# D-04 — Core loop and battle model

**Status:** proposed — chờ owner chốt · **Kind:** decision · **Blocked by:** D-01

## Question

Vòng lặp chính là gì, và trận đánh diễn ra thế nào để "cân bằng" giữa auto và quyết định, đọc được trên phone, và đủ sâu cho một tuần nội dung?

## Options

### A — ATB / Combat Readiness (Epic Seven)

- Mỗi unit tích một thanh; tốc độ và kỹ năng đẩy/kéo thanh quyết định ai đi trước.
- **Pros**: sâu nhất; turn manipulation là một lớp tactic rất hay; hợp người thích Epic Seven.
- **Cons**: UI dày (thanh ATB, nhiều trạng thái); khó đọc trên 360 px; khó simulate; dễ thành "spreadsheet" với người mới.
- **Cost**: cao; cần nhiều thời gian cân bằng và test.

### B — Round-based speed order (Summoners War) — recommended

- Mỗi round, mọi unit còn sống hành động một lần theo SPD; buff/debuff tick cuối round.
- **Pros**: đọc rõ ("ai đi tiếp"); auto dễ; vẫn có chiều sâu nhờ speed tuning, buff/debuff, target, ultimate timing; simulate được.
- **Cons**: ít "liên tục" hơn ATB; cần làm turn rail đẹp để không nhàm.
- **Cost**: trung bình; cân bằng speed và ultimate charge là chính.

### C — Auto-charge ultimates (AFK Arena)

- Đánh thường auto; ultimate tích năng lượng; người chơi bấm hoặc để auto.
- **Pros**: nhẹ nhất; tốt nhất cho idle; UI ít.
- **Cons**: quá ít agency; "cân bằng" sẽ thành "xem auto"; khó tạo cảm giác first clear/boss đáng nhớ.
- **Cost**: thấp; nhưng không đạt yêu cầu "có quyết định".

## Recommendation

**B + một lớp C**: round-based speed order, **auto đánh thường**, **manual ultimate** (hoặc auto toggle), **target selection** cho boss/first clear.

### Battle shape

- **4 hero vs 4 enemy**, 2 hàng (trước/sau), portrait.
- **3–5 round**, 20–40 s; boss 60–90 s. Tốc độ ×1/×2/×3; auto toggle.
- **Turn rail** trên cùng: 6 actor tiếp theo, icon hero/enemy; buff speed làm icon di chuyển.
- **Ultimate**: tích theo lượt/năng lượng; bấm card để tung; giữ lại để burst. Auto tung khi sẵn.
- **Target**: mặc định enemy HP thấp nhất; tap để focus; boss có add thì chọn.
- **Formation**: hàng trước nhận melee nhiều hơn, bảo vệ hàng sau; một số skill đánh theo hàng.
- **Win/lose**: giết hết enemy / hết hero. Retry miễn phí; không energy. Thua hiện gợi ý ("thiếu power", "đổi hệ", "nâng gear"), không hiện paywall.
- **Determinism**: seeded RNG; cùng team/seed → cùng trận. Cần cho balance sim và daily boss ranked sau này.

### Vì sao không chọn A hay C

- A đòi hỏi một UI và một hệ thống cân bằng mà v1 1 tuần không đủ thời gian để làm tốt; nếu làm dở, nó khó hiểu hơn B.
- C bỏ mất phần "quyết định" mà owner muốn; nó biến game thành idle thuần, trong khi điểm mạnh cần là hệ thống/tiến trình.
- B là điểm cân bằng: đủ quen với người chơi Summoners War, đủ nhẹ cho người chơi AFK, đủ rõ cho phone.

## What it changes

- **D-05**: 4 hero, role/element, skill set; ultimate charge.
- **D-06**: gear có SPD; speed tuning là một phần của progression.
- **D-09**: stage design theo wave/round; boss có phase/telegraph.
- **D-12**: battle screen layout (turn rail, 4 cards, ultimate buttons).
- **D-13**: card/sprite lunge, hit-stop, damage numbers.
- **D-16**: battle prototype là milestone đầu.

## Open sub-questions (giải ở D-04 khi owner chốt hướng)

- SPD có RNG ±5% như Epic Seven không? (Đề xuất: không ở v1; deterministic, chỉ buff/debuff thay đổi order.)
- Ultimate charge bằng lượt hay bằng energy? (Đề xuất: lượt; 3–4 lượt, có thể bị giảm bởi gear/skill.)
- Auto có dùng ultimate thông minh hay bấm bừa? (Đề xuất: auto dùng khi HP team thấp hoặc boss sắp phase; có thể chọn "auto thường" vs "auto full".)
- Có cho phép pause giữa trận không? (Đề xuất: có, game offline; panel của shell pause.)

## Evidence

- [R-03 — Battle, card UX and pixel art](../research/R-03-battle-card-ux.md).
- [R-01 — Genre landscape](../research/R-01-genre.md).
- Epic Seven's CR: https://epic7x.com/combat-readiness-tutorial/
- AFK's auto + manual ultimates: Deconstructor of Fun, *AFK Arena* (2019).
- Summoners War's 4-unit turn-based battles: Troy Dunniway, *Summoners War Breakdown* (2017).

## Discussion

**agent (2026-11-09):** recommend B+. Nó giữ được "cân bằng" đúng nghĩa: auto cho farm, manual cho khoảnh khắc khó. Nếu owner muốn sâu hơn nữa, A là con đường nâng cấp sau v1, không phải bây giờ.

**owner:** _chưa trả lời._
