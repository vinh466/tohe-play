import { defineCatalog } from '@tohe/game-kit';

/** A bond pair: deployed together, the two heroes gain a small stat bonus; the codex tells their story. */
export interface BondDef {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly name: string;
  readonly note: string;
}

const bonds = [
  {
    id: 'tien-tri',
    a: 've-binh',
    b: 'tien-tri',
    name: 'Khiên và Lời',
    note: 'Khiên chắn trước, lời tiên tri đi sau.',
  },
  { id: 'troi-buoc', a: 'kiem-si', b: 'troi-buoc', name: 'Kiếm và Gió', note: 'Kiếm mở đường, gió giữ cửa.' },
  { id: 'moc-y', a: 'loi-vu', b: 'moc-y', name: 'Sấm và Lá', note: 'Sấm gọi mưa, lá giữ đất.' },
  { id: 'hoa-ky', a: 'hoa-ky', b: 'lua-do', name: 'Hai Ngọn Lửa', note: 'Hai ngọn lửa cùng một bếp.' },
  { id: 'dat-nen', a: 'thach-nu', b: 'dat-nen', name: 'Đá và Đất', note: 'Đá và đất, không thể tách rời.' },
  {
    id: 'song-xanh',
    a: 'song-xanh',
    b: 'nuoc-ngot',
    name: 'Sóng và Bờ',
    note: 'Sóng lớn cần nước ngọt để về bờ.',
  },
  { id: 'may-trang', a: 'gio-lanh', b: 'may-trang', name: 'Gió và Mây', note: 'Gió lạnh đi cùng mây trắng.' },
  {
    id: 'tro-tan',
    a: 'vong-lua',
    b: 'tro-tan',
    name: 'Lửa và Tro',
    note: 'Lửa cháy hết mình, tro giữ ấm lâu.',
  },
  {
    id: 'linh-thach',
    a: 'da-mem',
    b: 'linh-thach',
    name: 'Đá Biết Nói',
    note: 'Đá biết chữa lành, đá biết trả lời.',
  },
  {
    id: 'bao-tuyet',
    a: 'thuy-trieu',
    b: 'bao-tuyet',
    name: 'Triều và Bão',
    note: 'Triều dâng và bão tuyết, hai mặt của Đèo Gió.',
  },
] as const satisfies readonly BondDef[];

export const BONDS = defineCatalog('bond', bonds);
export type BondId = (typeof bonds)[number]['id'];
