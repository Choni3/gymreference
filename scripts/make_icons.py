"""Generate the PNG app icons (green tile, white dumbbell) with only the stdlib."""
import struct, sys, zlib
from pathlib import Path

GREEN = (22, 163, 74)
WHITE = (255, 255, 255)

def inside_round_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

# Dumbbell in a 64-unit design space: (x0, y0, x1, y1, radius)
SHAPES = [
    (14, 30, 50, 34, 1),   # bar
    (10, 20, 16, 44, 2),   # left outer plate
    (17, 24, 22, 40, 2),   # left inner plate
    (42, 24, 47, 40, 2),   # right inner plate
    (48, 20, 54, 44, 2),   # right outer plate
]

def pixel(u, v):
    for s in SHAPES:
        if inside_round_rect(u, v, *s):
            return WHITE
    return GREEN

def render(size):
    rows = []
    ss = 3  # supersampling
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (x + (sx + 0.5) / ss) * 64 / size
                    v = (y + (sy + 0.5) / ss) * 64 / size
                    c = pixel(u, v)
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] // n
            if a:
                row += bytes([acc[0] * 255 // acc[3], acc[1] * 255 // acc[3], acc[2] * 255 // acc[3], a])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

out = Path(sys.argv[1] if len(sys.argv) > 1 else "icons")
out.mkdir(exist_ok=True)
# Full squares: iOS and Android apply their own corner masks.
(out / "apple-touch-icon.png").write_bytes(render(180))
(out / "icon-192.png").write_bytes(render(192))
(out / "icon-512.png").write_bytes(render(512))
