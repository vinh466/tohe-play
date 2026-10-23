# Makes the Studio checks' corpus of good and bad files (README.md). Run once, by hand, with Pillow:
#   python3 make.py .
# The files are committed; the tests never run this.
import os
import random
import sys

from PIL import Image, PngImagePlugin

out = sys.argv[1]
rnd = random.Random(20261024)
# The palette of the fixtures' pixel style (StudioChecksCorpusTests).
PAL = [(0, 0, 0), (255, 255, 255), (170, 85, 51), (51, 170, 85)]


def img(w, h, transparent=True):
    im = Image.new("RGBA", (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            if transparent and rnd.random() < 0.2:
                px[x, y] = (1, 2, 3, 0)  # transparent: its colour does not count
            else:
                px[x, y] = PAL[rnd.randrange(4)] + (255,)
    return im


def save(im, name, **kw):
    im.save(os.path.join(out, name), **kw)


good = img(16, 16)
save(good, "good-16.png")
save(good, "good-16.webp", lossless=True, exact=True)
info = PngImagePlugin.PngInfo()
info.add_text("Comment", "made on a phone")
info.add_text("Author", "Co Ba")
save(good, "good-meta.png", pnginfo=info)
save(good, "good-meta.webp", lossless=True, exact=True,
     exif=b"Exif\x00\x00MM\x00*\x00\x00\x00\x08\x00\x00",
     xmp=b"<x:xmpmeta xmlns:x='adobe:ns:meta/'/>")
save(img(64, 16), "good-sheet-64x16.png")

p = Image.new("RGBA", (20, 30))
pp = p.load()
for y in range(30):
    for x in range(20):
        pp[x, y] = (rnd.randrange(256), rnd.randrange(256), rnd.randrange(256), rnd.randrange(256))
save(p, "good-painted-20x30.png")


def wang(bad):
    im = img(32, 16, transparent=False)
    px = im.load()
    for t in range(2):
        for i in range(16):
            for (x, y) in [(t * 16 + i, 0), (t * 16 + i, 15), (t * 16, i), (t * 16 + 15, i)]:
                px[x, y] = PAL[3] + (255,)
    if bad:
        px[16, 7] = PAL[0] + (255,)  # the second tile's west edge differs on one pixel
    return im


save(wang(False), "good-wang-32x16.png")
save(wang(True), "bad-wang-32x16.png")

Image.new("P", (16, 16)).save(os.path.join(out, "bad-format.gif"))
with open(os.path.join(out, "good-16.webp"), "rb") as src, open(os.path.join(out, "bad-magic.png"), "wb") as dst:
    dst.write(src.read())
Image.new("1", (1040, 1040)).save(os.path.join(out, "bad-pixels-1040.png"), optimize=True)
save(img(128, 128, transparent=False), "bad-large-128.png")
save(img(20, 16), "bad-size-20x16.png")
c = good.copy()
c.load()[5, 5] = (0x12, 0x34, 0x56, 255)
save(c, "bad-colour-16.png")
a = good.copy()
a.load()[6, 6] = (170, 85, 51, 128)
save(a, "bad-alpha-16.png")
save(img(48, 16), "bad-sheet-48x16.png")
for f in sorted(os.listdir(out)):
    print(f, os.path.getsize(os.path.join(out, f)))
