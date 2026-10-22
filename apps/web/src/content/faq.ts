// The words of /faq/ and /en/faq/: short questions people really ask, short answers (plain text: they are also the
// page's FAQPage structured data, so no markup). The owner reviews them in the pull request; the privacy notice is the
// authority on data (/privacy/), the terms on the rest (/terms/) — both in Vietnamese only for now (ADR 0047).
import type { Lang } from '../i18n.ts';
import { site } from './site.ts';

export interface Question {
  q: string;
  a: string;
}

const vi = {
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
      a: 'Tò He đã mở một lần thì vẫn mở được khi mất mạng, và game đã chơi một lần thường vẫn chơi được, vì trình duyệt còn giữ nó. Tiến độ lưu trên máy và đồng bộ khi có mạng lại. Bàn chơi online thì cần mạng.',
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
  ] as Question[],
};

const en: typeof vi = {
  title: 'FAQ — Tò He',
  description:
    'Is Tò He free, do you need an account, where is your data kept, is it fine for children, does it work offline: short answers.',
  heading: 'FAQ',
  lead: 'What people ask first.',
  more: {
    text: `Didn’t find your question? Write to us: ${site.email}.`,
    privacy: 'Privacy notice (in Vietnamese)',
    terms: 'Terms of use (in Vietnamese)',
    install: 'How to add it to your home screen',
  },
  questions: [
    {
      q: 'Is Tò He free?',
      a: 'Yes. Tò He has no ads, sells nothing in its games, and has no money, coins or items to buy or sell. Scores are just for fun.',
    },
    {
      q: 'Do I need an account to play?',
      a: 'No. Open the link and play, and your device remembers your games. Create an account (with an email address, or Google) when you want to keep your progress, play on another device or have your name on the leaderboard.',
    },
    {
      q: 'What does Tò He keep about me?',
      a: 'Without an account, your games stay on your device. With an account, Tò He keeps your email address, your profile names, your saved games and your scores. Tò He does not sell your data and has no third-party ads or trackers. A little technical data (the kind of device, errors, how smoothly a game runs) is not tied to your name, and you can turn it off. The details are in the privacy notice, in Vietnamese.',
    },
    {
      q: 'Is it safe for children?',
      a: 'Children under 16 do not create accounts themselves: a parent creates a profile for the child in their own account, and the child only picks an avatar. Online tables have only ready-made reactions, no free chat. By default, a child does not play with people outside the parent’s account.',
    },
    {
      q: 'Can I play without an internet connection?',
      a: 'Once you have opened Tò He, it opens without a connection too, and a game you have played before usually still plays, as long as the browser has kept it. Your progress is saved on the device and syncs when you are back online. Online tables need a connection.',
    },
    {
      q: 'Which phones does Tò He run on?',
      a: 'Android phones and iPhones with a modern browser such as Chrome or Safari, and computers too. Nothing to download from an app store.',
    },
    {
      q: 'How do I add Tò He to my home screen?',
      a: 'Use the browser’s menu: Chrome has "Install app", Safari on iPhone has Share → "Add to Home Screen". If the link opened inside Zalo or Messenger, open it in a real browser first. Step by step in the install guide.',
    },
    {
      q: 'How do I play with friends and family?',
      a: 'Some games, like Tiến Lên, have online tables: you open a table and send the link or the code to everyone, and each person joins on their own phone. If someone is missing, a bot takes the seat.',
    },
    {
      q: 'How do I delete a profile or my account?',
      a: 'Go to "Manage account" in Tò He. Deleting a profile deletes its saved games and scores at once. Deleting the account deletes every profile and its data for good after 7 days.',
    },
    {
      q: 'Who makes Tò He, and where do I send feedback?',
      a: `Tò He is a family project, run by one person. For feedback, a bug or a question about your data, write to ${site.email}.`,
    },
  ],
};

export const faq: Record<Lang, typeof vi> = { vi, en };
