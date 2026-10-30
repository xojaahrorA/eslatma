#!/usr/bin/env python3
"""Capacitor Android ikonka va splash ekranlarini icon-512.png dan generatsiya qiladi."""
from PIL import Image
import os

RES = "/home/z/my-project/android/app/src/main/res"
SRC = "/home/z/my-project/public/icon-512.png"
BG = (18, 16, 28, 255)  # #12101c

src = Image.open(SRC).convert("RGBA")

# ─── Launcher icons (kvadrat + round) ───
sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for dpi, s in sizes.items():
    d = os.path.join(RES, f"mipmap-{dpi}")
    os.makedirs(d, exist_ok=True)
    img = src.resize((s, s), Image.LANCZOS)
    img.save(os.path.join(d, "ic_launcher.png"))
    # round: doira maska
    big = s * 4
    m = Image.new("L", (big, big), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).ellipse((0, 0, big, big), fill=255)
    m = m.resize((s, s), Image.LANCZOS)
    round_img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    round_img.paste(img, (0, 0), m)
    round_img.save(os.path.join(d, "ic_launcher_round.png"))
    print(f"mipmap-{dpi}: ic_launcher + round ({s}px)")

# ─── Adaptive foreground (safe zone 66%) ───
fg_sizes = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for dpi, s in fg_sizes.items():
    d = os.path.join(RES, f"mipmap-{dpi}")
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    inner = int(s * 0.60)  # ikonka canvasning 60%i — doira crop xavfsiz
    off = (s - inner) // 2
    icon = src.resize((inner, inner), Image.LANCZOS)
    canvas.paste(icon, (off, off), icon)
    canvas.save(os.path.join(d, "ic_launcher_foreground.png"))
    print(f"mipmap-{dpi}: foreground ({s}px)")

# ─── Splash ekranlar (mavjud o'lchamlarni saqlab) ───
for root, _, files in os.walk(RES):
    for f in files:
        if f == "splash.png":
            p = os.path.join(root, f)
            w, h = Image.open(p).size
            canvas = Image.new("RGBA", (w, h), BG)
            side = int(min(w, h) * 0.28)
            icon = src.resize((side, side), Image.LANCZOS)
            canvas.paste(icon, ((w - side) // 2, (h - side) // 2), icon)
            canvas.convert("RGB").save(p)
            print(f"splash: {os.path.relpath(root, RES)} ({w}x{h})")

print("DONE")
