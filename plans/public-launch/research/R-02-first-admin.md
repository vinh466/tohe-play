# R-02 — Admin đầu tiên của một app tự host: người khác làm thế nào?

- Date: 2026-10-17 · Feeds: D-08

## Câu hỏi

Khi cài mới chưa có admin, làm sao để *đúng người cài đặt* trở thành admin, trên một URL có thể đã public?

## Phát hiện

| App | Cách | Ai trở thành admin |
|---|---|---|
| Jenkins | Trang "Unlock Jenkins" đòi mật khẩu sinh lúc cài, in giữa hai dòng dấu sao trong log và lưu ở `secrets/initialAdminPassword` | Người đọc được log hoặc file trên server |
| Discourse | `DISCOURSE_DEVELOPER_EMAILS` trong `app.yml`: danh sách email trở thành admin khi đăng ký | Người sở hữu email trong danh sách |
| Mastodon | Tạo account bằng trình duyệt, rồi `RAILS_ENV=production bin/tootctl accounts modify <user> --role Owner` trên server; từ 4.0 có vai trò Owner/Admin/Moderator | Người có shell trên server |
| Outline (đang chạy ở `platform-infra`) | Người đăng nhập đầu tiên tạo workspace và thành admin; không có cách giao lại mà không sửa DB (`~/workspace/platform-infra/apps/outline/README.md`, mục *Checking it*) | Người vào trước — README của họ phải dặn "làm việc đó có chủ đích" |

Điểm chung của cách an toàn: quyền admin đầu tiên gắn với **thứ chỉ người vận hành có** — log/secret, cấu hình, hay
shell — chứ không gắn với việc ai mở URL trước.

## Giả định

- Hành vi Discourse lấy từ hướng dẫn cũ và thread Meta; chưa đối chiếu README `discourse_docker` hiện tại. Không ảnh
  hưởng thiết kế, vì Tò He chỉ mượn ý tưởng danh sách email.

## Ý nghĩa

D-08 ghép cả ba: token (Jenkins) là bắt buộc; danh sách email (Discourse) là tuỳ chọn; lệnh CLI trong container
(Mastodon) là lối thoát khẩn cấp. Giữ được trải nghiệm owner muốn ("chưa có admin thì cho đăng ký lần đầu") mà không
có cuộc đua trên URL public.

## Nguồn

- [Jenkins: installing on macOS (unlock bằng initialAdminPassword)](https://jenkins.io/doc/book/installing/macos)
- [Discourse Meta: First Admin GUI utility](https://meta.discourse.org/t/first-admin-gui-utility/11894) · [Discourse Meta: admin accounts in app.yml](https://meta.discourse.org/t/create-admin-account-s-in-app-yml-without-email-confirmation/53934?tl=en)
- [Mastodon: tootctl](https://docs.joinmastodon.org/admin/tootctl/)
- `~/workspace/platform-infra/apps/outline/README.md` (repo của owner)
