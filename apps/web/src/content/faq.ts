// The words of /faq/: short questions people really ask, short answers (plain text: they are also the page's
// FAQPage structured data, so no markup). The owner reviews them in the pull request; the privacy notice is the
// authority on data (/privacy/), the terms on the rest (/terms/).
import { site } from './site.ts';

export interface Question {
  q: string;
  a: string;
}

export const faq = {
  title: 'Hỏi đáp — Tò He',
  description:
    'Tò He có miễn phí không, có cần tài khoản không, dữ liệu để ở đâu, bé chơi có ổn không, chơi khi mất mạng được không: câu trả lời ngắn.',
  heading: 'Hỏi đáp',
  lead: 'Những câu người ta hay hỏi đầu tiên.',
  more: {
    text: `Chưa thấy câu bạn cần? Viết cho chúng tôi: ${site.email}.`,
    privacy: 'Chính sách quyền riêng tư',
    terms: 'Điều khoản sử dụng',
    install: 'Cách cài lên màn hình chính',
  },
  questions: [
    {
      q: 'Tò He có miễn phí không?',
      a: 'Có. Tò He không quảng cáo, không bán gì trong game, và không có tiền, xu hay vật phẩm để mua bán. Điểm chỉ để vui.',
    },
    {
      q: 'Tôi có cần tạo tài khoản để chơi không?',
      a: 'Không. Mở link là chơi ngay, và máy sẽ nhớ ván của bạn trên chính máy đó. Tạo tài khoản (bằng email, hoặc Google) khi bạn muốn giữ tiến độ, chơi trên máy khác hay có tên trên bảng xếp hạng.',
    },
    {
      q: 'Tò He lưu những gì về tôi?',
      a: 'Chơi không tài khoản thì ván chơi nằm trên máy của bạn. Có tài khoản thì Tò He lưu email, tên hồ sơ, ván đã lưu và điểm. Tò He không bán dữ liệu của bạn và không có quảng cáo hay công cụ theo dõi của bên thứ ba. Một ít số liệu kỹ thuật (loại máy, lỗi, độ mượt của game) không gắn với tên bạn, và bạn tắt được. Chi tiết ở trang Chính sách quyền riêng tư.',
    },
    {
      q: 'Bé chơi có an toàn không?',
      a: 'Trẻ dưới 16 tuổi không tự tạo tài khoản: bố mẹ tạo hồ sơ cho con trong tài khoản của mình, bé chỉ cần chọn một hình đại diện. Trong phòng chơi online chỉ có những câu phản ứng có sẵn, không có trò chuyện tự do. Mặc định, bé không chơi cùng người ngoài tài khoản của bố mẹ.',
    },
    {
      q: 'Không có mạng thì có chơi được không?',
      a: 'Sau khi đã mở Tò He một lần, các ván chơi một mình hay với bạn máy chơi được cả khi mất mạng. Phòng chơi online thì cần mạng.',
    },
    {
      q: 'Tò He chạy trên điện thoại nào?',
      a: 'Trên điện thoại Android và iPhone có trình duyệt hiện đại như Chrome hay Safari, và cả trên máy tính. Không phải tải gì từ cửa hàng ứng dụng.',
    },
    {
      q: 'Làm sao thêm Tò He vào màn hình chính?',
      a: 'Dùng menu của trình duyệt: Chrome có "Cài đặt ứng dụng", Safari trên iPhone có Chia sẻ → "Thêm vào Màn hình chính". Link mở trong Zalo hay Messenger thì mở bằng trình duyệt trước. Từng bước ở trang Hướng dẫn cài đặt.',
    },
    {
      q: 'Chơi cùng bạn bè và người thân như thế nào?',
      a: 'Một số game, như Tiến Lên, có phòng chơi online: bạn mở phòng, gửi link hoặc mã cho mọi người, mỗi người vào bằng điện thoại của mình. Thiếu người thì có bạn máy chơi thay.',
    },
    {
      q: 'Tôi muốn xoá hồ sơ hay tài khoản thì sao?',
      a: 'Vào "Quản lý tài khoản" trong Tò He. Xoá một hồ sơ thì ván đã lưu và điểm của hồ sơ đó bị xoá ngay. Xoá tài khoản thì sau 7 ngày mọi hồ sơ và dữ liệu đi kèm bị xoá hẳn.',
    },
    {
      q: 'Ai làm ra Tò He, và tôi góp ý ở đâu?',
      a: `Tò He là một dự án gia đình, do một người vận hành. Góp ý, báo lỗi hay hỏi về dữ liệu, bạn viết cho ${site.email}.`,
    },
  ] satisfies Question[],
};
