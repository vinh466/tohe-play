// The crops of the slice (SPEC.md, "Crops"): what a seed costs, what the harvest sells for, how many stages a crop grows
// through and how long it takes to ripen when every stage is watered at once. The rules (logic.ts) read these numbers;
// the art is asset ids of the pack farm-tiny (Kenney's Tiny Farm, CC0), one picture per growing stage.
import { defineCatalog } from '@tohe/game-kit';

export const crops = defineCatalog('crop', [
  {
    id: 'carrot',
    name: { vi: 'Cà rốt', en: 'Carrot' },
    seedPrice: 2,
    sellPrice: 5,
    stages: 3,
    ripeMinutes: 3,
    art: {
      stages: ['tiles/tile-0004', 'tiles/tile-0005', 'tiles/tile-0006'],
      produce: 'tiles/tile-0008',
      seed: 'tiles/tile-0010',
      crate: 'tiles/tile-0011',
    },
  },
  {
    id: 'tomato',
    name: { vi: 'Cà chua', en: 'Tomato' },
    seedPrice: 5,
    sellPrice: 14,
    stages: 3,
    ripeMinutes: 15,
    art: {
      stages: ['tiles/tile-0040', 'tiles/tile-0041', 'tiles/tile-0042'],
      produce: 'tiles/tile-0044',
      seed: 'tiles/tile-0046',
      crate: 'tiles/tile-0047',
    },
  },
  {
    id: 'wheat',
    name: { vi: 'Lúa mì', en: 'Wheat' },
    seedPrice: 8,
    sellPrice: 25,
    stages: 4,
    ripeMinutes: 60,
    // The pack draws wheat in three stages; its first is the pack's seedling (tile 81), as the spec's four need.
    art: {
      stages: ['tiles/tile-0081', 'tiles/tile-0064', 'tiles/tile-0065', 'tiles/tile-0066'],
      produce: 'tiles/tile-0068',
      seed: 'tiles/tile-0070',
      crate: 'tiles/tile-0071',
    },
  },
] as const);

export type CropId = (typeof crops.ids)[number];
export type Crop = (typeof crops.items)[number];

/** How long one stage takes once watered, in milliseconds. */
export const stageMs = (crop: Crop) => (crop.ripeMinutes * 60_000) / crop.stages;
