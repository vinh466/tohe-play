// The words of /guides/ and /guides/install/, and of their English pages under /en/. The steps for each platform come
// from plans/product-surface E-03; the owner tries them on real devices (E-03 §14) and corrects what a phone shows
// differently. A guide's `path` is its Vietnamese one: the English page links the same page under /en/.
import type { Lang } from '../i18n.ts';

const viGuides = {
  title: 'Hướng dẫn — Tò He',
  description: 'Hướng dẫn dùng Tò He: cài lên màn hình chính trên Android, iPhone và máy tính.',
  heading: 'Hướng dẫn',
  lead: 'Mọi thứ để bắt đầu với Tò He.',
  items: [
    {
      path: '/guides/install/',
      title: 'Cài Tò He lên màn hình chính',
      text: 'Mở nhanh như một ứng dụng, trên Android, iPhone hay máy tính, kể cả khi đang đọc link trong Zalo hay Messenger.',
    },
  ],
};

export const guides: Record<Lang, typeof viGuides> = {
  vi: viGuides,
  en: {
    title: 'Guides — Tò He',
    description: 'Guides to Tò He: adding it to the home screen on Android, iPhone and a computer.',
    heading: 'Guides',
    lead: 'Everything you need to get started with Tò He.',
    items: [
      {
        path: '/guides/install/',
        title: 'Add Tò He to your home screen',
        text: 'Open it quickly, like an app, on Android, iPhone or a computer, even when you are reading the link inside Zalo or Messenger.',
      },
    ],
  },
};

export interface Platform {
  /** The section's anchor, `#<id>`. */
  id: string;
  /** The label in the list at the top and the heading of the section. */
  title: string;
  intro?: string;
  steps: string[];
  note?: string;
}

const viInstall = {
  title: 'Cài Tò He lên màn hình chính — Android, iPhone, máy tính',
  description:
    'Cách thêm Tò He ra màn hình chính trên Android (Chrome), iPhone (iOS 26, Safari) và máy tính, và cách mở link từ Zalo hay Messenger bằng trình duyệt.',
  heading: 'Cài Tò He lên màn hình chính',
  back: '← Hướng dẫn',
  lead: 'Không cài cũng chơi được. Cài rồi thì Tò He mở nhanh như một ứng dụng, chạy toàn màn hình, và vẫn mở được khi mất mạng. Game đã chơi một lần thường vẫn chơi được. Chọn loại máy:',
  jump: 'Chọn loại máy',
  platforms: [
    {
      id: 'android',
      title: 'Android (Chrome)',
      steps: [
        'Mở Tò He bằng Chrome (Edge hay Samsung Internet cũng được).',
        'Chạm nút ⋮ ở góc trên bên phải.',
        'Chọn "Cài đặt ứng dụng" (một số máy ghi "Thêm vào Màn hình chính").',
        'Chạm "Cài đặt". Biểu tượng Tò He hiện ra trên màn hình chính.',
      ],
    },
    {
      id: 'iphone',
      title: 'iPhone (iOS 26, Safari)',
      steps: [
        'Mở Tò He bằng Safari. Đang ở trong Zalo hay Messenger thì làm theo mục bên dưới trước.',
        'Chạm nút Chia sẻ (hình ô vuông có mũi tên đi lên). Chưa thấy nút thì chạm ⋯ ở thanh dưới trước.',
        'Kéo xuống và chọn "Thêm vào Màn hình chính".',
        'Bật "Mở dưới dạng ứng dụng web", rồi chạm "Thêm".',
      ],
      note: 'Trên iPhone, ứng dụng đã cài giữ dữ liệu riêng, tách khỏi Safari. Đang chơi dở mà muốn giữ ván thì đăng nhập trước khi cài.',
    },
    {
      id: 'zalo',
      title: 'Đang mở trong Zalo hay Messenger',
      intro:
        'Link mở trong Zalo, Messenger hay Facebook chạy trong một trình duyệt nhỏ của chính app đó, không cài được. Mở bằng trình duyệt của máy:',
      steps: [
        'Chạm nút ⋯ (hoặc ⋮) ở góc trên màn hình.',
        'Chọn "Mở bằng trình duyệt". Tên mục có thể khác đôi chút giữa các app và phiên bản, ví dụ "Mở trong Chrome" hay "Mở trong Safari".',
        'Hoặc chép link rồi dán vào Chrome hay Safari.',
        'Khi Tò He đã mở trong trình duyệt, làm theo mục Android hoặc iPhone ở trên.',
      ],
    },
    {
      id: 'may-tinh',
      title: 'Máy tính',
      steps: [
        'Mở Tò He bằng Chrome hoặc Edge.',
        'Bấm biểu tượng cài đặt ở cuối thanh địa chỉ (hình màn hình có mũi tên đi xuống), hoặc mở menu ⋮ rồi chọn "Cài đặt Tò He".',
        'Bấm "Cài đặt". Tò He mở thành một cửa sổ riêng.',
      ],
      note: 'Safari trên Mac: nút Chia sẻ, rồi Thêm vào Dock. Firefox trên máy tính không cài được ứng dụng web, nhưng vẫn chơi bình thường trong trang.',
    },
  ] as Platform[],
  done: {
    heading: 'Cài xong rồi?',
    text: 'Mở Tò He từ màn hình chính là chơi tiếp. Có trục trặc cứ viết cho chúng tôi.',
    play: 'Mở Tò He',
    faq: 'Hỏi đáp',
  },
};

export const install: Record<Lang, typeof viInstall> = {
  vi: viInstall,
  en: {
    title: 'Add Tò He to your home screen — Android, iPhone, computer',
    description:
      'How to add Tò He to the home screen on Android (Chrome), iPhone (iOS 26, Safari) and a computer, and how to open a link from Zalo or Messenger in a real browser.',
    heading: 'Add Tò He to your home screen',
    back: '← Guides',
    lead: 'You can play without installing anything. Once installed, Tò He opens quickly like an app, runs full screen, and still opens without a connection. A game you have played before usually still plays. Choose your device:',
    jump: 'Choose your device',
    platforms: [
      {
        id: 'android',
        title: 'Android (Chrome)',
        steps: [
          'Open Tò He in Chrome (Edge or Samsung Internet work too).',
          'Tap the ⋮ button in the top right corner.',
          'Choose "Install app" (some phones say "Add to Home screen").',
          'Tap "Install". The Tò He icon appears on your home screen.',
        ],
      },
      {
        id: 'iphone',
        title: 'iPhone (iOS 26, Safari)',
        steps: [
          'Open Tò He in Safari. If you are inside Zalo or Messenger, follow the section below first.',
          'Tap the Share button (a square with an arrow pointing up). If you do not see it, tap ⋯ in the bottom bar first.',
          'Scroll down and choose "Add to Home Screen".',
          'Turn on "Open as Web App", then tap "Add".',
        ],
        note: 'On iPhone, the installed app keeps its own data, apart from Safari. If you have a game in progress and want to keep it, sign in before installing.',
      },
      {
        id: 'zalo',
        title: 'Opened inside Zalo or Messenger',
        intro:
          'A link opened in Zalo, Messenger or Facebook runs in that app’s own small browser, which cannot install anything. Open it in your phone’s real browser:',
        steps: [
          'Tap the ⋯ (or ⋮) button at the top of the screen.',
          'Choose "Open in browser". The wording differs a little between apps and versions, for example "Open in Chrome" or "Open in Safari".',
          'Or copy the link and paste it into Chrome or Safari.',
          'Once Tò He is open in the browser, follow the Android or iPhone section above.',
        ],
      },
      {
        id: 'computer',
        title: 'Computer',
        steps: [
          'Open Tò He in Chrome or Edge.',
          'Click the install icon at the end of the address bar (a screen with an arrow pointing down), or open the ⋮ menu and choose "Install Tò He".',
          'Click "Install". Tò He opens in a window of its own.',
        ],
        note: 'Safari on a Mac: the Share button, then Add to Dock. Firefox on a computer cannot install web apps, but you can still play in the page.',
      },
    ],
    done: {
      heading: 'All set?',
      text: 'Open Tò He from your home screen and keep playing. If something goes wrong, write to us.',
      play: 'Open Tò He',
      faq: 'FAQ',
    },
  },
};
