// The frame of /terms/ and /privacy/. The texts themselves are not here: they are apps/hub/src/legal/documents.ts, the
// one source the app's sign-up also reads (ADR 0025), and are not changed from this app — a change there bumps
// TERMS_VERSION and everyone accepts again.

export const legal = {
  /** The notice the app showed on its own pages, with the version it names. */
  draft: (version: string) =>
    `Bản nháp (phiên bản ${version}): người vận hành Tò He sẽ duyệt trước khi mở cho mọi người.`,
  terms: {
    title: 'Điều khoản sử dụng — Tò He',
    description:
      'Điều khoản sử dụng Tò He: tài khoản và hồ sơ, chơi cùng nhau, điểm không phải tiền, và những điều bạn cần biết khi dùng.',
  },
  privacy: {
    title: 'Chính sách quyền riêng tư — Tò He',
    description:
      'Chính sách quyền riêng tư của Tò He: Tò He lưu những gì, ai thấy gì, trẻ em, và quyền của bạn với dữ liệu của mình.',
  },
  other: { terms: 'Điều khoản sử dụng', privacy: 'Chính sách quyền riêng tư' },
};
