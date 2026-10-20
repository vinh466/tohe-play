// The words of /guides/ and /guides/install/. The steps for each platform come from plans/product-surface E-03; the
// owner tries them on real devices (E-03 §14) and corrects what a phone shows differently.

export const guides = {
  title: 'Hướng dẫn — Tò He',
  description: 'Hướng dẫn dùng Tò He: cài lên màn hình chính trên Android, iPhone và máy tính.',
  heading: 'Hướng dẫn',
  lead: 'Mọi thứ để bắt đầu với Tò He.',
  items: [
    {
      href: '/guides/install/',
      title: 'Cài Tò He lên màn hình chính',
      text: 'Mở nhanh như một ứng dụng, trên Android, iPhone hay máy tính — kể cả khi bạn đang đọc link trong Zalo hay Messenger.',
    },
  ],
};

export interface Platform {
  id: string;
  /** The label in the list at the top and the heading of the section. */
  title: string;
  intro?: string;
  steps: string[];
  note?: string;
}

export const install = {
  title: 'Cài Tò He lên màn hình chính — Android, iPhone, máy tính',
  description:
    'Cách thêm Tò He vào màn hình chính trên Android (Chrome), iPhone (iOS 26, Safari), máy tính, và cách mở link từ Zalo hay Messenger bằng trình duyệt.',
  heading: 'Cài Tò He lên màn hình chính',
  back: '← Hướng dẫn',
  lead: 'Không cài cũng chơi được bình thường. Cài rồi thì Tò He mở nhanh như một ứng dụng, chạy toàn màn hình và chơi được cả khi mất mạng (sau lần mở đầu). Chọn máy của bạn:',
  jump: 'Chọn máy của bạn',
  platforms: [
    {
      id: 'android',
      title: 'Android (Chrome)',
      steps: [
        'Mở Tò He bằng Chrome (Edge hay Samsung Internet cũng được).',
        'Chạm nút ⋮ ở góc trên bên phải.',
        'Chọn "Cài đặt ứng dụng" (một số máy ghi "Thêm vào Màn hình chính").',
        'Chạm "Cài đặt". Biểu tượng Tò He xuất hiện trên màn hình chính.',
      ],
    },
    {
      id: 'iphone',
      title: 'iPhone (iOS 26, Safari)',
      steps: [
        'Mở Tò He bằng Safari. Nếu bạn đang ở trong Zalo hay Messenger, làm theo mục bên dưới trước.',
        'Chạm nút ⋯ ở thanh dưới, rồi chọn "Chia sẻ".',
        'Kéo xuống và chọn "Thêm vào Màn hình chính".',
        'Bật "Mở dưới dạng ứng dụng web", rồi chạm "Thêm".',
      ],
      note: 'Trên iPhone, ứng dụng đã cài giữ dữ liệu riêng, tách khỏi Safari. Nếu bạn đã chơi dở và muốn giữ tiến độ, hãy đăng nhập trước khi cài. iPhone dùng iOS cũ hơn: nút Chia sẻ (hình ô vuông có mũi tên đi lên) nằm ngay thanh dưới của Safari.',
    },
    {
      id: 'zalo',
      title: 'Đang mở trong Zalo hay Messenger',
      intro:
        'Link mở trong Zalo, Messenger hay Facebook nằm trong một trình duyệt nhỏ của chính app đó, và không cài được. Mở bằng trình duyệt thật của máy:',
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
        'Bấm biểu tượng cài đặt ở cuối thanh địa chỉ (hình màn hình có mũi tên đi xuống), hoặc vào menu ⋮ rồi chọn "Cài đặt Tò He".',
        'Bấm "Cài đặt". Tò He mở thành một cửa sổ riêng.',
      ],
      note: 'Safari trên Mac: Chia sẻ → Thêm vào Dock. Firefox trên máy tính không cài được ứng dụng web, nhưng vẫn chơi bình thường trong trang.',
    },
  ] satisfies Platform[],
  done: {
    heading: 'Cài xong rồi?',
    text: 'Mở Tò He từ màn hình chính và chơi tiếp. Gặp trục trặc, bạn cứ viết cho chúng tôi.',
    play: 'Mở Tò He',
    faq: 'Hỏi đáp',
  },
};
