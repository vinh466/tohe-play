// The words of /family/ and /en/family/ (ADR 0057, D-07): the family register, written for a parent. Every other
// public page keeps the 16+ register. Each line must stay true of the code: the privacy notice (/privacy/) is the
// authority on data, and profile management is where the PIN and the limits are. The owner reviews these words in the
// pull request.
import type { Lang } from '../i18n.ts';
import { site } from './site.ts';

const vi = {
  title: 'Gia đình — chơi cùng bé, an tâm cho bố mẹ',
  description:
    'Tò He dành cho người 16+ trước, nhưng có chỗ cho các bé: hồ sơ riêng theo độ tuổi, PIN quản lý, không quảng cáo, không trò chuyện, không theo dõi.',
  heading: 'Gia đình',
  lead: 'Tò He là sạp game cho người lớn trước. Khi nhà có bé, bố mẹ vẫn dùng chung được: mỗi bé một hồ sơ, có PIN để giữ phần quản lý.',
  sections: [
    {
      heading: 'Bé chơi gì ở Tò He',
      paragraphs: [
        'Mỗi trò là một ván ngắn vài phút. Không quảng cáo, không có gì để mua, không có trò chuyện với người lạ.',
        'Trang của mỗi trò ghi rõ tuổi phù hợp, số người chơi và cách chơi, để bố mẹ xem trước khi mở.',
      ],
    },
    {
      heading: 'Hồ sơ riêng cho bé',
      paragraphs: [
        'Bố mẹ tạo một hồ sơ cho mỗi bé trong tài khoản của mình: tên, hình đại diện và một khoảng tuổi.',
        'Tò He chỉ hiện những trò phù hợp với khoảng tuổi đó. Hồ sơ của bé mặc định chỉ chơi với người trong tài khoản và không hiện trên bảng công khai; bố mẹ đổi được trong phần quản lý.',
      ],
    },
    {
      heading: 'PIN giữ phần quản lý',
      paragraphs: [
        'Vào phần quản lý tài khoản cần mã quản lý 6 số của bố mẹ. Bé có thể có mã PIN 4 số riêng để vào hồ sơ của mình.',
        'Đang chơi bằng hồ sơ của bé mà muốn đổi sang hồ sơ người lớn hay mở link ra ngoài thì cần mã của bố mẹ. Quên mã quản lý thì lấy lại bằng email của tài khoản.',
      ],
    },
    {
      heading: 'Dữ liệu của bé',
      paragraphs: [
        'Tò He giữ tên, hình đại diện, khoảng tuổi, điểm và ván đã lưu của bé. Không có quảng cáo, không có công cụ theo dõi của bên khác.',
        'Xoá hồ sơ là xoá luôn điểm và ván đã lưu của bé. Những gì Tò He giữ, vì sao và xoá thế nào: xem Quyền riêng tư.',
      ],
    },
    {
      heading: 'Thời gian chơi',
      paragraphs: [
        'Tò He không đếm giờ, không có chuỗi ngày và không nhắc bé quay lại. Hết ván là hết.',
        'Muốn giới hạn giờ, bố mẹ dùng chức năng thời gian sử dụng của điện thoại hay máy tính. Tò He không có đồng hồ riêng.',
      ],
    },
    {
      heading: 'Hỏi thêm',
      paragraphs: [
        'Câu hỏi về tài khoản, dữ liệu và cách chơi nằm ở Hỏi đáp. Muốn hỏi riêng thì viết cho Tò He.',
      ],
    },
  ],
  actions: { play: 'Mở Tò He', manage: 'Quản lý hồ sơ' },
  links: { games: 'Xem các trò chơi', faq: 'Đọc Hỏi đáp', privacy: 'Quyền riêng tư' },
  contact: { label: 'Email', email: site.email },
};

const en: typeof vi = {
  title: 'Family — play with your child, with peace of mind',
  description:
    'Tò He is for players 16 and over first, but there is room for children: a profile for each child with an age band, a manage PIN, no ads, no chat, no tracking.',
  heading: 'Family',
  lead: 'Tò He is a game shelf for adults first. When there are children at home, you can still share it: one profile for each child, with a PIN that keeps the managing to you.',
  sections: [
    {
      heading: 'What a child plays',
      paragraphs: [
        'Every game is a short round of a few minutes. No ads, nothing to buy, and no chat with anyone.',
        "Each game's page says the age it suits, how many people play and how it is played, so a parent can look before opening it.",
      ],
    },
    {
      heading: 'A profile for each child',
      paragraphs: [
        'A parent makes a profile for each child inside their own account: a name, a picture and an age band.',
        'Tò He shows only the games that suit that age band. A child’s profile starts playing only with people in the account and off the public boards; a parent can change that in the managing pages.',
      ],
    },
    {
      heading: 'The PIN keeps the managing',
      paragraphs: [
        "The account's managing pages need the parent's six-digit manage PIN. A child may have a four-digit PIN of their own to open their profile.",
        "Changing from a child's profile to an adult's, or opening a link out of Tò He, needs the parent's PIN. A forgotten manage PIN is recovered with the account's email.",
      ],
    },
    {
      heading: 'A child’s data',
      paragraphs: [
        "Tò He keeps a child's name, picture, age band, scores and saved rounds. No ads, and no tracking tools from anyone else.",
        'Deleting a profile deletes its scores and saved rounds too. What Tò He keeps, why and how to delete it: see the privacy notice.',
      ],
    },
    {
      heading: 'Time spent playing',
      paragraphs: [
        'Tò He keeps no clock, no streaks and no reminders to come back. A round ends and that is that.',
        'To set a time limit, use the screen-time settings of the phone or computer. Tò He has no timer of its own.',
      ],
    },
    {
      heading: 'More questions',
      paragraphs: [
        'Questions about accounts, data and how to play are in the FAQ. To ask something else, write to Tò He.',
      ],
    },
  ],
  actions: { play: 'Open Tò He', manage: 'Manage profiles' },
  links: { games: 'See the games', faq: 'Read the FAQ', privacy: 'the privacy notice (in Vietnamese)' },
  contact: { label: 'Email', email: site.email },
};

export const family: Record<Lang, typeof vi> = { vi, en };
