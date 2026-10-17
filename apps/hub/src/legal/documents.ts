// The terms of use and the privacy notice the hub shows, and asks to accept at sign-up (ADR 0025). The Vietnamese text
// is the one that counts. DRAFT: written from what the code does, not legal advice — the owner reviews both, and fills
// in how to reach the operator, before Tò He opens to everyone.

/** Change it with any change to either document: signed-in accounts accept the new version once. */
export const TERMS_VERSION = '2026-10-18';

export interface Section {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  sections: Section[];
}

const contact = 'Cách liên hệ người vận hành Tò He: (người vận hành điền vào trước khi mở cho mọi người).';

export const terms: LegalDocument = {
  title: 'Điều khoản sử dụng',
  sections: [
    {
      heading: 'Tò He là gì',
      paragraphs: [
        'Tò He là một góc chơi nhỏ gồm những trò chơi đơn giản trên trình duyệt, không quảng cáo, không bán gì. Người vận hành Tò He giữ cho nó chạy.',
      ],
    },
    {
      heading: 'Tài khoản',
      paragraphs: [
        'Người từ 16 tuổi trở lên tự tạo tài khoản bằng email của mình. Dưới 16 tuổi, bạn chơi bằng một hồ sơ do bố mẹ hoặc người giám hộ tạo trong tài khoản của họ; người tạo hồ sơ chịu trách nhiệm cho hồ sơ đó.',
        'Giữ mật khẩu và mã quản lý cho riêng mình. Những gì làm từ tài khoản của bạn được coi là do bạn làm.',
      ],
    },
    {
      heading: 'Hồ sơ và tên',
      paragraphs: [
        'Tên hồ sơ do bạn chọn và người chơi khác có thể thấy. Đừng dùng tên xúc phạm, mạo danh người khác hoặc mạo danh Tò He. Người vận hành có thể đổi tên hoặc ẩn một hồ sơ vi phạm.',
      ],
    },
    {
      heading: 'Chơi cùng nhau',
      paragraphs: [
        'Ở phòng chơi online chỉ có những câu phản ứng có sẵn, không có trò chuyện tự do.',
        'Không gian lận để lên bảng xếp hạng: không sửa trò chơi, không dùng công cụ tự động, không lợi dụng lỗi. Kết quả bất thường có thể bị giữ lại để xem xét hoặc bị gỡ.',
      ],
    },
    {
      heading: 'Điểm không phải tiền',
      paragraphs: ['Tò He không có tiền, xu hay vật phẩm để mua bán. Điểm chỉ để vui.'],
    },
    {
      heading: 'Dịch vụ như hiện có',
      paragraphs: [
        'Tò He có thể thay đổi, tạm ngừng, hoặc gặp sự cố làm mất dữ liệu. Người vận hành cố gắng sao lưu và sửa lỗi, nhưng không thể hứa trước điều gì.',
      ],
    },
    {
      heading: 'Ngừng dùng',
      paragraphs: [
        'Bạn có thể ngừng dùng Tò He bất cứ lúc nào. Người vận hành có thể khoá tài khoản vi phạm những điều trên.',
      ],
    },
    {
      heading: 'Khi điều khoản thay đổi',
      paragraphs: ['Tò He hỏi bạn đồng ý với bản mới trước khi chơi tiếp.'],
    },
    { heading: 'Liên hệ', paragraphs: [contact] },
  ],
};

export const privacy: LegalDocument = {
  title: 'Chính sách quyền riêng tư',
  sections: [
    {
      heading: 'Tò He lưu những gì',
      paragraphs: [
        'Tài khoản: email (để đăng nhập, lấy lại mật khẩu và nhận thông báo bảo mật), mật khẩu và mã quản lý (chỉ lưu dạng băm, không ai đọc được), tên tài khoản, thời điểm tạo, và bản điều khoản bạn đã đồng ý.',
        'Hồ sơ: tên, hình đại diện, người lớn hay trẻ em, độ tuổi của bé theo khoảng (ví dụ 6–8 tuổi, để chọn trò chơi hợp tuổi), mã PIN (dạng băm) và ID hồ sơ 12 số.',
        'Trò chơi: ván đã lưu và điểm của từng hồ sơ. Ở phòng online: ai ngồi ghế nào, các nước đi và kết quả, để xem lại ván và tính thành tích.',
        'Mã xác nhận gửi qua email: chỉ lưu dạng băm, hết hạn sau 15 phút, bị xoá sau một ngày. Thư đã gửi: nội dung bị xoá ngay khi gửi xong; chỉ giữ người nhận, loại thư và thời gian trong 30 ngày.',
        'Dữ liệu kỹ thuật, nếu bật: loại máy, trình duyệt, lỗi và độ mượt của trò chơi — không có tên, tài khoản hay hồ sơ. Chi tiết giữ 30 ngày, số liệu cộng theo ngày giữ một năm. Bạn tắt được ở trang "Dữ liệu kỹ thuật".',
      ],
    },
    {
      heading: 'Ai thấy gì',
      paragraphs: [
        'Người chơi khác chỉ thấy tên và hình đại diện của hồ sơ, ở phòng chơi và trên bảng xếp hạng. ID hồ sơ hiện trong "Quản lý tài khoản" để bạn tự chia sẻ khi muốn.',
        'Email, độ tuổi và tài khoản của bạn không bao giờ hiện cho người khác.',
      ],
    },
    {
      heading: 'Trẻ em',
      paragraphs: [
        'Trẻ dưới 16 tuổi không tự tạo tài khoản, không có email hay mật khẩu. Bố mẹ tạo hồ sơ cho con — đó là sự đồng ý của người đại diện — và quyết định con có được chơi với người ngoài tài khoản hay không (mặc định là không).',
      ],
    },
    {
      heading: 'Lưu trên máy của bạn',
      paragraphs: [
        'Một cookie giữ bạn đăng nhập; không có nó thì không đăng nhập được. Tò He cũng lưu ván chơi trên máy để chơi được khi mất mạng. Không có cookie quảng cáo hay theo dõi.',
      ],
    },
    {
      heading: 'Bên thứ ba',
      paragraphs: [
        'Thư được gửi qua một dịch vụ gửi thư (Resend). Tò He chạy trên máy chủ người vận hành thuê, và kết nối có thể đi qua Cloudflare để được mã hoá và chống tấn công. Tò He không bán hay chia sẻ dữ liệu của bạn cho ai để quảng cáo.',
        'Máy chủ có thể ghi lại địa chỉ IP khi có lỗi hoặc để chặn đăng nhập sai quá nhiều lần, chỉ để vận hành và bảo vệ Tò He.',
      ],
    },
    {
      heading: 'Quyền của bạn',
      paragraphs: [
        'Trong "Quản lý tài khoản", bạn xem và sửa tên, hồ sơ, email, mật khẩu; tắt dữ liệu kỹ thuật; xoá hồ sơ. Muốn xoá cả tài khoản, hãy liên hệ người vận hành cho tới khi Tò He có nút xoá.',
      ],
    },
    { heading: 'Liên hệ', paragraphs: [contact] },
  ],
};
