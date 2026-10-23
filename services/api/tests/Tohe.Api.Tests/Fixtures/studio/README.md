# The Studio checks' corpus

Small good and bad files for the Studio's server-side checks ([Asset Studio, Checks](../../../../../../docs/architecture/asset-studio.md#checks)).
`StudioChecksTests` runs each against a pixel style — tile 16, palette `#000000`, `#ffffff`, `#aa5533`, `#33aa55` —
or a painted one (no tile, no palette), with small limits (4096 bytes a file, 1 048 576 pixels): each bad file fails
exactly one code, and every code has a passing and a failing case. `make.py` made them once, with Pillow; the tests
never run it.

| File | Is | Fails |
| --- | --- | --- |
| `good-16.png`, `good-16.webp` | 16×16, palette colours, alpha 0 or 255 | nothing |
| `good-meta.png` | `good-16.png` with two `tEXt` chunks | nothing; kept without them |
| `good-meta.webp` | `good-16.webp` with `EXIF` and `XMP ` chunks | nothing; kept without them, its flags cleared |
| `good-sheet-64x16.png` | a sprite sheet of four 16×16 frames | nothing |
| `good-wang-32x16.png` | two Wang tiles whose edges are all one green | nothing |
| `good-painted-20x30.png` | any colour, any alpha, any size (painted style) | nothing |
| `bad-format.gif` | a GIF | `format_not_allowed` |
| `bad-magic.png` | WebP bytes named `.png` | `magic_mismatch` |
| `bad-pixels-1040.png` | 1040×1040 in 212 bytes | `too_many_pixels` |
| `bad-large-128.png` | 128×128 of noise, over 4096 bytes | `too_large` |
| `bad-size-20x16.png` | 20 wide on a tile of 16 | `size_not_tile_multiple` |
| `bad-sheet-48x16.png` | three 16×16 cells for four frames | `frames_mismatch` |
| `bad-colour-16.png` | one opaque pixel `#123456` | `colour_not_in_palette` |
| `bad-alpha-16.png` | one pixel at alpha 128 | `alpha_not_binary` |
| `bad-wang-32x16.png` | the second tile's west edge differs by one pixel | `tile_edges_differ` |

The metadata codes (`id_duplicate`, `style_unknown`, `style_not_approved`, `source_incomplete`, `licence_not_accepted`,
`attribution_missing`, `vendor_not_checked`, `semver_too_small`, and `too_large` for a version) need no file: their
cases are in `StudioChecksTests` itself.
