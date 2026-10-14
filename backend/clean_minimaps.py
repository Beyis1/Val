"""Clean stylised minimaps: close prop holes, flat Valorant-like fill + crisp outline."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageChops
for p in sorted(Path("/app/frontend/public/maps").glob("*/minimap.png")):
    raw = p.with_name("minimap_raw.png")
    if not raw.exists(): raw.write_bytes(p.read_bytes())
    im = Image.open(raw).convert("RGBA"); a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    closed = a.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))      # fill small holes (props)
    opened = closed.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # drop specks
    edge = ImageChops.subtract(opened, opened.filter(ImageFilter.MinFilter(3)))
    fill = Image.new("RGBA", im.size, (58, 77, 99, 0)); fill.putalpha(opened.point(lambda v: 225 if v else 0))
    line = Image.new("RGBA", im.size, (214, 228, 240, 0)); line.putalpha(edge)
    out = Image.alpha_composite(fill, line); out.save(p); print("clean", p.parent.name, im.size)
