// The words of /faq/ and /en/faq/: short questions people really ask, short answers (plain text: they are also the
// page's FAQPage structured data, so no markup). The owner reviews them in the pull request; the privacy notice is the
// authority on data (/privacy/), the terms on the rest (/terms/) — both in Vietnamese only for now (ADR 0047).
import type { Lang } from '../i18n.ts';
import { site } from './site.ts';

export interface Question {
  /** The anchor of the question on the page, `/faq/#<id>`: the same in both languages; the home page links to three. */
  id: string;
  q: string;
  a: string;
}

const vi = {
  title: 'Hỏi đáp — Tò He',
  description:
    'Tò He có miễn phí không, có cần tài khoản không, dữ liệu để đâu, bé chơi có an toàn không, mất mạng có chơi được không: trả lời ngắn.',
  heading: 'Hỏi đáp',
  lead: 'Mấy câu người ta hay hỏi đầu tiên.',
  more: {
    text: `Chưa thấy câu cần hỏi? Viết cho chúng tôi: ${site.email}.`,
    privacy: 'Chính sách quyền riêng tư',
    terms: 'Điều khoản sử dụng',
    install: 'Cách cài ra màn hình chính',
  },
  questions: [
    {
      id: 'mien-phi',
      q: 'Tò He có miễn phí không?',
      a: 'Có. Không quảng cáo, không bán gì trong game, không có xu hay vật phẩm để mua. Điểm chỉ để vui.',
    },
    {
      id: 'tai-khoan',
      q: 'Có cần tạo tài khoản để chơi không?',
      a: 'Không. Mở link là chơi, máy nhớ ván đang chơi ngay trên máy đó. Muốn giữ tiến độ, chơi trên máy khác hay có tên trên bảng xếp hạng thì tạo tài khoản bằng email hoặc Google.',
    },
    {
      id: 'du-lieu',
      q: 'Tò He lưu những gì về tôi?',
      a: 'Chơi không tài khoản thì ván chơi nằm trên máy. Có tài khoản thì Tò He lưu email, tên hồ sơ, ván đã lưu và điểm. Tò He không bán dữ liệu, không có quảng cáo hay công cụ theo dõi của bên khác. Một ít số liệu kỹ thuật (loại máy, lỗi, độ mượt của game) không gắn với tên ai, và tắt được. Chi tiết ở trang Chính sách quyền riêng tư.',
    },
    {
      id: 'tre-em',
      q: 'Bé chơi có an toàn không?',
      a: 'Trẻ dưới 16 tuổi không tự tạo tài khoản: bố mẹ tạo hồ sơ cho con trong tài khoản của mình, bé chỉ cần chọn hình đại diện. Trong bàn chơi online chỉ có những câu phản ứng có sẵn, không trò chuyện tự do. Mặc định, bé không chơi cùng người ngoài tài khoản của bố mẹ.',
    },
    {
      id: 'mat-mang',
      q: 'Mất mạng có chơi được không?',
      a: 'Tò He đã mở một lần thì mở được cả khi mất mạng, và game đã chơi một lần thường vẫn chơi được vì trình duyệt còn giữ nó. Tiến độ lưu trên máy, có mạng lại thì đồng bộ. Bàn chơi online thì cần mạng.',
    },
    {
      id: 'may-nao',
      q: 'Tò He chạy trên điện thoại nào?',
      a: 'Android và iPhone có trình duyệt mới như Chrome hay Safari, và cả máy tính. Không phải tải gì từ cửa hàng ứng dụng.',
    },
    {
      id: 'cai-dat',
      q: 'Thêm Tò He ra màn hình chính thế nào?',
      a: 'Dùng menu của trình duyệt: Chrome có "Cài đặt ứng dụng", Safari trên iPhone có nút Chia sẻ rồi "Thêm vào Màn hình chính". Link mở trong Zalo hay Messenger thì mở bằng trình duyệt trước. Từng bước ở trang Hướng dẫn cài.',
    },
    {
      id: 'choi-cung',
      q: 'Chơi cùng cả nhà thế nào?',
      a: 'Một số game, như Tiến Lên, có bàn chơi online: mở bàn, gửi link hoặc mã cho mọi người, ai cũng vào bằng điện thoại của mình. Thiếu người thì có bạn máy ngồi vào.',
    },
    {
      id: 'xoa',
      q: 'Muốn xoá hồ sơ hay tài khoản thì sao?',
      a: 'Vào "Quản lý tài khoản" trong Tò He. Xoá hồ sơ thì ván đã lưu và điểm của hồ sơ đó mất ngay. Xoá tài khoản thì sau 7 ngày mọi hồ sơ và dữ liệu đi kèm được xoá hẳn.',
    },
    {
      id: 'ai-lam',
      q: 'Ai làm ra Tò He, góp ý ở đâu?',
      a: `Tò He là dự án của một gia đình, một người làm và vận hành. Góp ý, báo lỗi hay hỏi về dữ liệu thì viết cho ${site.email}.`,
    },
  ] as Question[],
};

const en: typeof vi = {
  title: 'FAQ — Tò He',
  description:
    'Is Tò He free, do you need an account, where is your data kept, is it safe for children, does it work offline: short answers.',
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
      id: 'mien-phi',
      q: 'Is Tò He free?',
      a: 'Yes. No ads, nothing to buy in the games, no coins or items. Scores are just for fun.',
    },
    {
      id: 'tai-khoan',
      q: 'Do I need an account to play?',
      a: 'No. Open the link and play. Your device remembers your game in progress. Create an account with an email address or Google if you want to keep your progress, play on another device or have your name on the leaderboard.',
    },
    {
      id: 'du-lieu',
      q: 'What does Tò He keep about me?',
      a: 'Without an account, your games stay on your device. With an account, Tò He keeps your email address, profile names, saved games and scores. It does not sell your data, and has no ads or trackers from anyone else. A little technical data (the kind of device, errors, how smoothly a game runs) is not tied to anyone’s name, and you can turn it off. The details are in the privacy notice, in Vietnamese.',
    },
    {
      id: 'tre-em',
      q: 'Is it safe for children?',
      a: 'Children under 16 do not create accounts themselves. A parent creates a profile for the child in their own account, and the child only picks an avatar. Online tables have only ready-made reactions, no free chat. By default, a child does not play with people outside the parent’s account.',
    },
    {
      id: 'mat-mang',
      q: 'Can I play without an internet connection?',
      a: 'Once Tò He has been opened, it opens without a connection too, and a game you have played before usually still plays, as long as the browser has kept it. Your progress is saved on the device and syncs when you are back online. Online tables need a connection.',
    },
    {
      id: 'may-nao',
      q: 'Which phones does Tò He run on?',
      a: 'Android phones and iPhones with a recent browser such as Chrome or Safari, and computers too. Nothing to download from an app store.',
    },
    {
      id: 'cai-dat',
      q: 'How do I add Tò He to my home screen?',
      a: 'Use the browser’s menu: Chrome has "Install app", Safari on iPhone has the Share button, then "Add to Home Screen". If the link opened inside Zalo or Messenger, open it in a real browser first. Step by step in the install guide.',
    },
    {
      id: 'choi-cung',
      q: 'How do we play together?',
      a: 'Some games, like Tiến Lên, have online tables. Open a table and send the link or the code to everyone, and each person joins on their own phone. If someone is missing, a bot takes the seat.',
    },
    {
      id: 'xoa',
      q: 'How do I delete a profile or my account?',
      a: 'Go to "Manage account" in Tò He. Deleting a profile deletes its saved games and scores at once. Deleting the account deletes every profile and its data for good after 7 days.',
    },
    {
      id: 'ai-lam',
      q: 'Who makes Tò He, and where do I send feedback?',
      a: `Tò He is a family project, built and run by one person. For feedback, a bug or a question about your data, write to ${site.email}.`,
    },
  ],
};

export const faq: Record<Lang, typeof vi> = { vi, en };
