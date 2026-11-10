#!/usr/bin/env python3
"""Generate the 32×32 pixel portraits for Vân Du Ký.

The portraits are drawn from code, not hand-painted: every hero, enemy and boss gets a
deterministic silhouette from its role, element and id. Run from the game folder:

    python3 art/generate-portraits.py

The PNGs land in `public/portraits/<id>.png`; the game loads them by id, and a content
test fails when one is missing. Keep the drawings at 32×32: the UI scales them with
`image-rendering: pixelated` (24 px on a battle card, 40–64 px in the codex).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from PIL import Image, ImageDraw

W = H = 32
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "portraits")
ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "content")

ELEMENTS = {
    "ember": {
        "dark": (74, 30, 24, 255),
        "mid": (156, 54, 40, 255),
        "light": (214, 96, 62, 255),
        "accent": (240, 186, 84, 255),
        "glow": (255, 224, 150, 255),
    },
    "tide": {
        "dark": (24, 52, 70, 255),
        "mid": (42, 96, 122, 255),
        "light": (96, 164, 182, 255),
        "accent": (188, 228, 232, 255),
        "glow": (222, 246, 248, 255),
    },
    "stone": {
        "dark": (58, 56, 48, 255),
        "mid": (96, 94, 78, 255),
        "light": (150, 144, 118, 255),
        "accent": (208, 190, 136, 255),
        "glow": (238, 224, 184, 255),
    },
    "gale": {
        "dark": (32, 62, 54, 255),
        "mid": (60, 112, 94, 255),
        "light": (118, 172, 144, 255),
        "accent": (206, 232, 212, 255),
        "glow": (234, 248, 236, 255),
    },
}

SKIN = [
    (214, 178, 140, 255),
    (196, 156, 116, 255),
    (236, 200, 162, 255),
    (172, 128, 92, 255),
]
SKIN_SHADE = (168, 124, 92, 255)
DARK = (28, 26, 24, 255)
INK = (18, 17, 16, 255)
WOOD = (108, 78, 48, 255)
METAL = (176, 182, 178, 255)
ENEMY_SKIN = [
    (96, 108, 86, 255),
    (120, 92, 76, 255),
    (86, 96, 110, 255),
    (110, 84, 96, 255),
]


def parse_heroes() -> list[dict[str, str]]:
    text = open(os.path.join(ROOT, "heroes.ts"), encoding="utf-8").read()
    pattern = re.compile(
        r"H\(\s*'([^']+)',\s*'[^']*',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'",
        re.S,
    )
    return [
        {"id": m[0], "role": m[1], "element": m[2], "rarity": m[3], "kind": "hero"}
        for m in pattern.findall(text)
    ]


def parse_enemies() -> list[dict[str, str]]:
    text = open(os.path.join(ROOT, "enemies.ts"), encoding="utf-8").read()
    pattern = re.compile(
        r"E\(\s*'([^']+)',\s*'[^']*',\s*'([^']+)',\s*'([^']+)'",
        re.S,
    )
    bosses = {"sen-da-co", "vua-re", "nua-lua", "nuoc-lon"}
    return [
        {
            "id": m[0],
            "role": m[1],
            "element": m[2],
            "rarity": "boss" if m[0] in bosses else "enemy",
            "kind": "boss" if m[0] in bosses else "enemy",
        }
        for m in pattern.findall(text)
    ]


def seed_of(entity_id: str) -> int:
    return int(hashlib.md5(entity_id.encode()).hexdigest(), 16)


def rect(d: ImageDraw.ImageDraw, box, fill) -> None:
    d.rectangle(box, fill=fill)


def hero_portrait(entity: dict[str, str]) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pal = ELEMENTS[entity["element"]]
    seed = seed_of(entity["id"])
    role = entity["role"]

    skin = SKIN[seed % len(SKIN)]
    hood = role == "seer"
    hair = pal["mid"] if entity["element"] != "ember" else (92, 52, 36, 255)
    if seed % 5 == 0:
        hair = (146, 122, 88, 255)

    # Cloak and shoulders.
    d.polygon([(9, 31), (8, 21), (12, 16), (20, 16), (24, 21), (23, 31)], fill=pal["dark"])
    rect(d, (10, 25, 21, 26), pal["mid"])
    rect(d, (10, 26, 21, 26), pal["accent"])
    # Arms.
    rect(d, (7, 19, 9, 27), pal["dark"])
    rect(d, (22, 19, 24, 27), pal["dark"])
    rect(d, (7, 26, 9, 27), skin)
    rect(d, (22, 26, 24, 27), skin)
    # Neck and head.
    rect(d, (14, 15, 17, 17), skin)
    rect(d, (11, 6, 20, 16), skin)
    rect(d, (11, 15, 20, 16), SKIN_SHADE)
    # Hair or hood.
    rect(d, (10, 3, 21, 7), hair)
    rect(d, (10, 6, 11, 12), hair)
    rect(d, (20, 6, 21, 12), hair)
    if hood:
        d.polygon([(9, 8), (16, 1), (23, 8), (23, 15), (20, 15), (20, 8), (12, 8), (12, 15), (9, 15)], fill=pal["mid"])
        rect(d, (10, 5, 21, 12), skin)
        rect(d, (11, 4, 20, 4), pal["light"])
    elif role == "vanguard":
        rect(d, (10, 6, 21, 8), METAL)
        rect(d, (15, 4, 16, 6), pal["accent"])
    # Eyes and mouth.
    eye_y = 11
    gap = 3 + (seed % 2)
    rect(d, (13, eye_y, 13, eye_y), INK)
    rect(d, (19 - gap, eye_y, 19 - gap, eye_y), INK)
    rect(d, (13, eye_y - 1, 13, eye_y - 1), pal["glow"])
    rect(d, (19 - gap, eye_y - 1, 19 - gap, eye_y - 1), pal["glow"])
    rect(d, (15, 14, 16, 14), SKIN_SHADE)
    # A cheek mark from the element.
    rect(d, (12 + (seed % 3), 12, 12 + (seed % 3), 12), pal["light"])

    # Role props.
    if role == "vanguard":
        rect(d, (2, 17, 8, 27), pal["light"])
        rect(d, (2, 17, 8, 18), pal["accent"])
        rect(d, (4, 20, 6, 24), pal["dark"])
        rect(d, (3, 21, 7, 23), pal["accent"])
        rect(d, (1, 17, 1, 27), INK)
    elif role == "blade":
        d.line([(26, 5), (29, 26)], fill=INK, width=3)
        d.line([(26, 5), (28, 25)], fill=pal["glow"], width=1)
        rect(d, (23, 24, 29, 24), pal["accent"])
        rect(d, (25, 23, 26, 26), WOOD)
    elif role == "seer":
        rect(d, (27, 5, 28, 31), WOOD)
        rect(d, (26, 4, 29, 7), pal["accent"])
        rect(d, (27, 3, 28, 3), pal["glow"])
        rect(d, (6, 10, 6, 10), pal["glow"])
        rect(d, (5, 14, 5, 14), pal["glow"])
    else:  # binder
        for i, y in enumerate((8, 12, 16)):
            x = 3 + (i % 2) * 2
            rect(d, (x, y, x + 2, y + 2), pal["accent"])
            rect(d, (x + 1, y + 1, x + 1, y + 1), pal["dark"])
        rect(d, (12, 13, 19, 13), pal["light"])
        rect(d, (14, 15, 17, 15), pal["accent"])

    # Element sparks.
    accents = [(24, 3), (26, 8), (5, 4), (3, 9), (29, 11), (25, 12)]
    for i in range(2 + (seed % 3)):
        x, y = accents[(seed + i) % len(accents)]
        rect(d, (x, y, x, y), pal["accent"] if i % 2 == 0 else pal["glow"])

    return img


def enemy_portrait(entity: dict[str, str]) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pal = ELEMENTS[entity["element"]]
    seed = seed_of(entity["id"])
    boss = entity["kind"] == "boss"
    skin = ENEMY_SKIN[seed % len(ENEMY_SKIN)]
    role = entity["role"]

    # A wider, jagged body for monsters; bosses fill the frame.
    inset = 6 if boss else 9
    d.polygon(
        [(inset, 31), (inset - 2, 22), (inset + 2, 17), (31 - inset, 17), (34 - inset, 22), (32 - inset, 31)],
        fill=pal["dark"],
    )
    rect(d, (inset + 1, 21, 30 - inset, 24), pal["mid"])
    # Spikes on the shoulders.
    for x in (inset, 30 - inset):
        d.polygon([(x, 20), (x + 3, 15), (x + 5, 20)], fill=pal["light"])
    # Head.
    head_l, head_r = (8, 23) if boss else (10, 21)
    top = 3 if boss else 6
    rect(d, (head_l, top, head_r, 17), skin)
    rect(d, (head_l, 15, head_r, 17), pal["dark"])
    # Horns.
    horns = 2 + (seed % 2)
    for i in range(horns):
        x = head_l + 1 + i * ((head_r - head_l - 2) // max(1, horns - 1))
        d.polygon([(x, top + 1), (x + 2, top - 4 - (seed + i) % 3), (x + 4, top + 1)], fill=pal["accent"])
    # Glowing eyes.
    eye_y = top + 6
    rect(d, (head_l + 2, eye_y, head_l + 3, eye_y + 1), pal["glow"])
    rect(d, (head_r - 3, eye_y, head_r - 2, eye_y + 1), pal["glow"])
    rect(d, (head_l + 3, eye_y, head_l + 3, eye_y), INK)
    rect(d, (head_r - 3, eye_y, head_r - 3, eye_y), INK)
    # Teeth.
    rect(d, (13, 14, 18, 14), INK)
    for x in range(14, 19, 2):
        rect(d, (x, 13, x, 14), pal["glow"])

    # Role props: claws, a blade, a staff, chains.
    if role == "blade":
        d.line([(25, 10), (29, 27)], fill=pal["accent"], width=2)
    elif role == "seer":
        rect(d, (27, 7, 28, 30), WOOD)
        rect(d, (26, 5, 29, 8), pal["light"])
    elif role == "binder":
        for i, y in enumerate((9, 13, 17)):
            x = 2 + (i % 2) * 2
            rect(d, (x, y, x + 2, y + 2), pal["accent"])
    else:
        for x in (4, 26):
            rect(d, (x, 22, x + 1, 26), pal["light"])

    if boss:
        # Crown and a wider aura.
        for i, x in enumerate((9, 14, 19)):
            d.polygon([(x, 4), (x + 2, 0), (x + 4, 4)], fill=pal["accent"])
        rect(d, (8, 4, 23, 4), pal["accent"])
        rect(d, (3, 28, 28, 31), pal["dark"])
        rect(d, (4, 29, 27, 29), pal["mid"])
    else:
        # Feet/rocks.
        rect(d, (9, 29, 13, 31), pal["dark"])
        rect(d, (19, 29, 23, 31), pal["dark"])

    # Element motes.
    accents = [(3, 6), (28, 12), (5, 15), (30, 18), (2, 25), (24, 3)]
    for i in range(2 + (seed % 3)):
        x, y = accents[(seed + i) % len(accents)]
        rect(d, (x, y, x, y), pal["accent"])

    return img


def write_atlas(entities: list[dict[str, str]]) -> None:
    """Pack the same 32×32 frames into one 8-wide sheet for Phaser: one texture, one draw batch."""
    columns = 8
    rows = (len(entities) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * W, rows * H), (0, 0, 0, 0))
    frames = {}
    for index, entity in enumerate(entities):
        image = Image.open(os.path.join(OUT, f"{entity['id']}.png")).convert("RGBA")
        x = (index % columns) * W
        y = (index // columns) * H
        sheet.alpha_composite(image, (x, y))
        frames[entity["id"]] = {
            "frame": {"x": x, "y": y, "w": W, "h": H},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": W, "h": H},
            "sourceSize": {"w": W, "h": H},
        }
    sheet.save(os.path.join(OUT, "atlas.png"))
    with open(os.path.join(OUT, "atlas.json"), "w", encoding="utf-8") as handle:
        json.dump(
            {
                "frames": frames,
                "meta": {
                    "app": "van-du-ky portraits",
                    "version": "1.0.0",
                    "image": "atlas.png",
                    "format": "RGBA8888",
                    "size": {"w": sheet.width, "h": sheet.height},
                    "scale": "1",
                },
            },
            handle,
            ensure_ascii=False,
            separators=(",", ":"),
        )


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    entities = parse_heroes() + parse_enemies()
    seen = set()
    for entity in entities:
        if entity["id"] in seen:
            raise SystemExit(f"duplicate portrait id: {entity['id']}")
        seen.add(entity["id"])
        image = hero_portrait(entity) if entity["kind"] == "hero" else enemy_portrait(entity)
        image.save(os.path.join(OUT, f"{entity['id']}.png"))
    write_atlas(entities)
    print(f"wrote {len(entities)} portraits and an atlas to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
