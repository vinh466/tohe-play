# R-02 — Nguồn luật chơi, cơ chế và meta để viết SPEC của game

- Date: 2026-10-19 · Feeds: E-05, D-03

## Question

(owner, 2026-10-19) "có nguồn "bussiness" kho về game sẳn free, mô tả chi tiết về game và cơ chế vận hành, mở rộng của
game k nhỉ [...] để đỡ tốn công lặp lại"

## Findings

Không có kho miễn phí nào gom đủ luật, cơ chế và meta cho game casual. Mỗi nguồn chỉ phủ một lớp.

| Lớp | Nguồn | License | Dùng cho |
|---|---|---|---|
| Luật bài, biến thể | [Pagat](https://pagat.com/climbing/thirteen.html), có [trang bài Việt Nam](https://pagat.com/national/vietnam.html) | Đọc miễn phí, nội dung có bản quyền | Tiến Lên, các game bài sau |
| Board game truyền thống | [Ludii Games Database](https://github.com/Ludeme), luật viết dạng máy đọc được | CC BY 4.0 theo [record của dataset](https://b2find.eudat.eu/dataset/2fbdee44-e084-560e-81f1-cc5931c1874a); chưa xem file LICENSE trên GitHub | Cờ Caro, board game |
| Puzzle có generator và solver | [Simon Tatham's Puzzles](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/) | MIT | Sudoku Nhí (*Solo*), Nối Đường Ống (*Net*) |
| Xếp gạch | [tetris.wiki](https://tetris.wiki/Tetris_Guideline) (SRS, 7-bag) | Chưa rõ; "Tetris" là thương hiệu | Xếp Gạch: chỉ học cơ chế |
| Luật bài (wiki) | [Wikibooks Card Games](https://en.wikibooks.org/wiki/Card_Games) | CC BY-SA | Bổ sung cho Pagat |
| Pattern thiết kế | Gameplay Design Patterns ([DiGRA](https://dl.digra.org/index.php/dl/article/view/1293)); Pattern Language for Game Design; Machinations ([Game Mechanics](https://designersnotebook.com/Books/Game_Mechanics/game_mechanics.htm)) | Chưa rõ | Cơ chế, kinh tế (Vườn Rau) |
| Core loop, meta | [Mobile Free to Play](https://mobilefreetoplay.com/?p=8517), Deconstructor of Fun | Đọc miễn phí | Meta, nhưng bỏ phần monetization F2P |
| Không nên dùng | BoardGameGeek: API [cấm dùng thương mại nếu không có license](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use) | — | Chỉ đọc tay |

## Assumptions

Luật chơi (tức cơ chế) thường không được bảo hộ, còn câu chữ và hình ảnh thì có. Vì vậy SPEC viết bằng lời của Tò He và
ghi nguồn. Đây không phải tư vấn pháp lý.

## So what

- **E-05:** `/new-game` nên gợi ý các nguồn này khi viết SPEC, và nhắc ghi nguồn. Chỉ cần thêm một đoạn trong skill,
  không xây kho riêng.
