// The known sources `import` takes files from: free packs whose licence and author were checked by a person. A new
// source is a change to this table, reviewed like code.

export interface KnownSource {
  /** What `import` is given: `kenney-tiny-farm`. */
  name: string;
  /** The pack's own name, as its author calls it. */
  title: string;
  /** The zip to download. A source's address can move: `--from` takes a zip downloaded by hand from `page`. */
  download: string;
  /** The page that names the pack, its author and its licence: what a reviewer opens. */
  page: string;
  author: string;
  /** An SPDX identifier the Studio accepts. */
  licence: string;
  /** The credit, when the licence asks for one. */
  attribution: string | null;
  /** Globs of the archive's paths taken when `--include` is not given. */
  include: string[];
  /** Tags every imported asset starts with. */
  tags: string[];
}

export const KNOWN_SOURCES: readonly KnownSource[] = [
  {
    name: 'kenney-tiny-farm',
    title: 'Tiny Farm',
    download: 'https://kenney.nl/media/pages/assets/tiny-farm/dfded1ae3e-1782913588/kenney_tiny-farm.zip',
    page: 'https://kenney.nl/assets/tiny-farm',
    author: 'Kenney (www.kenney.nl)',
    licence: 'CC0-1.0',
    attribution: null,
    // The single 16×16 tiles; the tilemaps and previews are left out.
    include: ['Tiles/*.png'],
    tags: ['farm', 'pixel'],
  },
];

export const knownSource = (name: string) => KNOWN_SOURCES.find((source) => source.name === name);
