// The crops of the slice (SPEC.md, "Crops"): what a seed costs, what the harvest sells for, how many stages a crop grows
// through and how long it takes to ripen when every stage is watered at once. The rules (logic.ts) read these numbers;
// the art is frames of the pack farm-tiny's tileset (map.ts, TILESET), one picture per growing stage.
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
      stages: [4, 5, 6],
      produce: 8,
      seed: 10,
      crate: 11,
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
      stages: [40, 41, 42],
      produce: 44,
      seed: 46,
      crate: 47,
    },
  },
  {
    id: 'wheat',
    name: { vi: 'Lúa mì', en: 'Wheat' },
    seedPrice: 8,
    sellPrice: 25,
    stages: 4,
    ripeMinutes: 60,
    // The pack draws wheat in three stages; its first is the pack's seedling (frame 81), as the spec's four need.
    art: {
      stages: [81, 64, 65, 66],
      produce: 68,
      seed: 70,
      crate: 71,
    },
  },
] as const);

export type CropId = (typeof crops.ids)[number];
export type Crop = (typeof crops.items)[number];

/** How long one stage takes once watered, in milliseconds. */
export const stageMs = (crop: Crop) => (crop.ripeMinutes * 60_000) / crop.stages;
