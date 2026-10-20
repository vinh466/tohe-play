// The words of /about/. The owner reviews them in the pull request (who writes "chúng tôi", and the contact, are theirs
// to settle).
import { site } from './site.ts';

export const about = {
  title: 'Giới thiệu — Tò He là gì, ai làm ra nó',
  description:
    'Tò He là một góc chơi nhỏ gồm những trò chơi đơn giản trên trình duyệt, không quảng cáo, không theo dõi. Một dự án gia đình, mở cho ai muốn chơi.',
  heading: 'Giới thiệu',
  sections: [
    {
      heading: 'Tò He là gì',
      paragraphs: [
        'Tò He là một góc chơi nhỏ: vài trò chơi đơn giản chạy ngay trong trình duyệt điện thoại hay máy tính, mở ra là chơi, một ván vài phút.',
        'Tên gọi lấy từ tò he, món đồ chơi nặn bằng bột màu của trẻ em Việt: nhỏ, nhiều màu và nặn rất nhanh. Mỗi trò chơi ở đây là một con tò he như thế.',
      ],
    },
    {
      heading: 'Vì sao không quảng cáo',
      paragraphs: [
        'Các cổng game nhỏ thường đầy quảng cáo và những lần bị cắt ngang. Tò He muốn làm điều ngược lại: một nơi yên tĩnh để chơi.',
        'Vì vậy Tò He không có quảng cáo, không bán gì trong game, không có công cụ theo dõi của bên thứ ba, và không có trò chuyện tự do. Nền tảng chỉ đếm tổng số, không theo dõi từng người.',
      ],
    },
    {
      heading: 'Ai làm ra Tò He',
      paragraphs: [
        'Tò He là một dự án gia đình: một người làm và vận hành, ban đầu cho chính gia đình mình, nay mở cho bất kỳ ai được chia sẻ link. Nó cũng là nơi để học cách xây một nền tảng bền, nên mã nguồn công khai trên GitHub.',
      ],
    },
    {
      heading: 'Liên hệ',
      paragraphs: [
        'Góp ý, báo lỗi, hỏi về dữ liệu của bạn hay muốn làm một trò chơi cho Tò He: viết cho chúng tôi.',
      ],
    },
  ],
  contact: { label: 'Email', email: site.email },
  links: {
    games: 'Xem các trò chơi',
    faq: 'Đọc Hỏi đáp',
    dev: 'Tài liệu cho người làm game',
  },
};
