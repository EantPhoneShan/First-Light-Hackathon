"""
Generates First Light's built-in vector art into public/assets/svg/.
Style matches the brief's prompt: flat vector, soft cel shading (3 tones per surface),
3/4 isometric view, navy and white with orange accents, transparent background, no text.

Run:  python3 art/make_svgs.py
These are the fallback art. A ChatGPT WebP with the same name in public/assets/ wins.
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'svg')

INK = '#0b1328'
NAVY_D, NAVY, NAVY_L = '#121d3a', '#1c2a50', '#2a3b6b'
# Lighter slate for dark parts, so they read on the navy UI.
SLATE_L, SLATE, SLATE_D = '#6a7fb8', '#4a5f9a', '#33457a'
WHITE, WHITE_S, WHITE_D = '#eef2fa', '#c9d1e3', '#a3aec8'
ORANGE_L, ORANGE, ORANGE_D = '#ffb27a', '#ff8a3d', '#d9661c'
GOLD_L, GOLD, GOLD_D = '#ffe08a', '#ffc94a', '#c9952a'
CELL_L, CELL, CELL_D = '#5a86f0', '#2a5bd7', '#1c3f9e'
SW = 0.7  # outline width


class Pic:
    """Collects shapes in isometric space and fits the viewBox at the end."""

    def __init__(self, s=6.0):
        self.s = s
        self.parts = []
        self.pts = []

    def P(self, x, y, z):
        px = (x - y) * 0.866 * self.s
        py = (x + y) * 0.5 * self.s - z * self.s
        self.pts.append((px, py))
        return px, py

    def poly(self, pts, fill, stroke=INK, sw=SW, extra=''):
        d = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
        self.parts.append(f'<polygon points="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" {extra}/>')

    def line(self, a, b, color=INK, sw=SW, cap='round'):
        self.parts.append(f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{color}" stroke-width="{sw}" stroke-linecap="{cap}"/>')

    def raw(self, s, pts=()):
        self.parts.append(s)
        self.pts.extend(pts)

    def box(self, x0, y0, z0, dx, dy, dz, top, left, right):
        x1, y1, z1 = x0 + dx, y0 + dy, z0 + dz
        P = self.P
        faces = {
            'top': [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
            'left': [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
            'right': [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
        }
        self.poly(faces['left'], left)
        self.poly(faces['right'], right)
        self.poly(faces['top'], top)
        return faces

    def svg(self, pad=2.0, square=True):
        xs = [p[0] for p in self.pts]
        ys = [p[1] for p in self.pts]
        x0, x1, y0, y1 = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
        w, h = x1 - x0, y1 - y0
        if square:
            m = max(w, h)
            x0 -= (m - w) / 2
            y0 -= (m - h) / 2
            w = h = m
        body = '\n  '.join(self.parts)
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}">\n  {body}\n</svg>\n'


def fp(face, u, v):
    """Point on a quad face: u along edge 0->1, v along edge 0->3."""
    a, b, c, d = face
    x = a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v + (a[0] - b[0] + c[0] - d[0]) * u * v
    y = a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v + (a[1] - b[1] + c[1] - d[1]) * u * v
    return x, y


def grid(pic, face, n, m, fill, inset=0.08, gap=0.06):
    """Solar-cell grid on a face."""
    for i in range(n):
        for j in range(m):
            u0 = inset + i * (1 - 2 * inset) / n + gap / 2
            u1 = inset + (i + 1) * (1 - 2 * inset) / n - gap / 2
            v0 = inset + j * (1 - 2 * inset) / m + gap / 2
            v1 = inset + (j + 1) * (1 - 2 * inset) / m - gap / 2
            pic.poly([fp(face, u0, v0), fp(face, u1, v0), fp(face, u1, v1), fp(face, u0, v1)], fill, sw=0.35)


def bolt(pic, face, fill=GOLD):
    pts = [(0.55, 0.15), (0.35, 0.55), (0.5, 0.55), (0.42, 0.88), (0.68, 0.42), (0.52, 0.42), (0.62, 0.15)]
    pic.poly([fp(face, u, v) for u, v in pts], fill, sw=0.45)


def ellipse_on(pic, face, cu, cv, r, fill, stroke=INK, sw=SW, n=28):
    pts = [fp(face, cu + r * math.cos(t), cv + r * math.sin(t)) for t in [i * 2 * math.pi / n for i in range(n)]]
    pic.poly(pts, fill, stroke, sw)


# ---------------------------------------------------------------- parts

def cubesat(units_x, units_y, units_z, cells=False):
    p = Pic(7 if units_z <= 3 else 6)
    f = p.box(0, 0, 0, units_x, units_y, units_z, WHITE, WHITE_D, WHITE_S)
    # unit seams
    for k in range(1, units_z):
        p.line(fp(f['left'], 0, k / units_z), fp(f['left'], 1, k / units_z), WHITE_D, 0.5)
        p.line(fp(f['right'], 0, k / units_z), fp(f['right'], 1, k / units_z), WHITE_D, 0.5)
    # rails (orange corner rails = the accent)
    for face in ('left', 'right'):
        a, b, c, d = f[face]
        p.line(a, d, ORANGE, 1.4)
    p.line(f['left'][1], f['left'][2], ORANGE, 1.4)
    if cells:
        grid(p, f['left'], units_x, units_z, CELL)
        grid(p, f['right'], units_y, units_z, CELL_D)
    return p


def bus_3u():
    return cubesat(1, 1, 3).svg()


def bus_6u():
    return cubesat(2, 1, 3).svg()


def bus_12u():
    return cubesat(2, 2, 3).svg()


def bus_smallsat():
    """A fridge-sized small satellite: gold-foil box, white top deck, two folded-out solar wings.
    Bigger than any CubeSat, so it reads as a different class of craft in the parts tray."""
    p = Pic(4.2)
    # left wing (behind the body)
    w1 = p.box(-3.9, 0.6, 2.0, 3.2, 1.8, 0.02, CELL, CELL_D, CELL)
    grid(p, w1['top'], 3, 2, CELL_L, inset=0.04)
    p.line(p.P(-0.7, 1.5, 2.0), p.P(0, 1.5, 2.0), WHITE_D, 1.6)
    # body: gold foil (thermal blanket) with a white top deck
    f = p.box(0, 0, 0, 3.0, 3.0, 3.4, GOLD_L, GOLD_D, GOLD)
    for k in (0.33, 0.66):
        p.line(fp(f['left'], k, 0.06), fp(f['left'], k, 0.94), GOLD_D, 0.45)
        p.line(fp(f['right'], k, 0.06), fp(f['right'], k, 0.94), GOLD_D, 0.45)
    deck = p.box(-0.1, -0.1, 3.4, 3.2, 3.2, 0.25, WHITE, WHITE_D, WHITE_S)
    # orange accent band round the base
    p.line(fp(f['left'], 0, 0.1), fp(f['left'], 1, 0.1), ORANGE, 1.3)
    p.line(fp(f['right'], 0, 0.1), fp(f['right'], 1, 0.1), ORANGE, 1.3)
    # star tracker and antenna on the deck
    p.box(0.4, 0.4, 3.65, 0.6, 0.6, 0.5, NAVY_L, NAVY_D, NAVY)
    ellipse_on(p, deck['top'], 0.68, 0.62, 0.17, ORANGE, sw=0.4)
    ellipse_on(p, deck['top'], 0.68, 0.62, 0.08, ORANGE_L, sw=0.3)
    # right wing (in front)
    p.line(p.P(3.0, 1.5, 2.0), p.P(3.7, 1.5, 2.0), WHITE_D, 1.6)
    w2 = p.box(3.7, 0.6, 2.0, 3.2, 1.8, 0.02, CELL, CELL_D, CELL)
    grid(p, w2['top'], 3, 2, CELL_L, inset=0.04)
    return p.svg()


def solar_body():
    p = Pic(9)
    f = p.box(0, 0, 0, 1.6, 1.6, 2.2, SLATE_L, SLATE_D, SLATE)
    grid(p, f['left'], 2, 3, CELL)
    grid(p, f['right'], 2, 3, CELL_D)
    grid(p, f['top'], 2, 2, CELL_L)
    return p.svg()


def solar_wings():
    p = Pic(5)
    # left wing (behind), body, right wing (front)
    w1 = p.box(-5.4, 0.6, 1.6, 4.6, 0.2, 0.15, CELL_L, CELL_D, CELL)
    w1t = p.box(-5.4, 0.2, 1.75, 4.6, 1.2, 0.01, CELL, CELL_D, CELL)
    grid(p, w1t['top'], 4, 1, CELL_L, inset=0.04)
    p.box(0, 0, 0, 1.4, 1.4, 3.2, WHITE, WHITE_D, WHITE_S)
    w2t = p.box(1.4, 0.2, 1.75, 4.6, 1.2, 0.01, CELL, CELL_D, CELL)
    grid(p, w2t['top'], 4, 1, CELL_L, inset=0.04)
    # hinges
    p.line(p.P(1.4, 0.8, 1.75), p.P(1.9, 0.8, 1.75), ORANGE, 1.6)
    p.line(p.P(-0.8, 0.8, 1.75), p.P(0, 0.8, 1.75), ORANGE, 1.6)
    return p.svg()


def battery(big):
    p = Pic(9 if not big else 7.5)
    if big:
        for i in range(2):
            f = p.box(i * 1.25, 0, 0, 1.15, 1.6, 2.6, SLATE_L, SLATE_D, SLATE)
            p.box(i * 1.25 + 0.35, 0.55, 2.6, 0.45, 0.45, 0.3, ORANGE_L, ORANGE_D, ORANGE)
        bolt(p, f['right'])
        p.line(p.P(0.6, 0.8, 2.9), p.P(1.85, 0.8, 2.9), INK, 0.8)
    else:
        f = p.box(0, 0, 0, 1.2, 1.4, 2.2, SLATE_L, SLATE_D, SLATE)
        p.box(0.4, 0.45, 2.2, 0.45, 0.45, 0.3, ORANGE_L, ORANGE_D, ORANGE)
        bolt(p, f['right'])
    return p.svg()


def radio(kind):
    p = Pic(8)
    f = p.box(0, 0, 0, 2, 2, 0.8, WHITE, WHITE_D, WHITE_S)
    p.box(0.2, 0.2, 0, 1.6, 0.05, 0.6, NAVY, NAVY_D, NAVY)  # connector strip
    if kind == 'uhf':
        for x, y in ((0.3, 0.3), (1.7, 1.7), (1.7, 0.3), (0.3, 1.7)):
            a = p.P(x, y, 0.8)
            b = p.P(x + (0.9 if x > 1 else -0.9), y + (0.9 if y > 1 else -0.9), 1.0)
            p.line(a, b, WHITE_D, 1.4)
            p.line(a, b, WHITE, 0.6)
        p.box(0.7, 0.7, 0.8, 0.6, 0.6, 0.25, ORANGE_L, ORANGE_D, ORANGE)
    elif kind == 's':
        top = p.box(0.25, 0.25, 0.8, 1.5, 1.5, 0.12, GOLD_L, GOLD_D, GOLD)
        ellipse_on(p, top['top'], 0.5, 0.5, 0.18, ORANGE, sw=0.4)
    else:  # X-band dish
        p.box(0.8, 0.8, 0.8, 0.4, 0.4, 0.9, NAVY_L, NAVY_D, NAVY)
        cx, cy = p.P(1, 1, 2.4)
        rx, ry = 13, 7
        p.raw(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx}" ry="{ry}" fill="{WHITE_S}" stroke="{INK}" stroke-width="{SW}" transform="rotate(-18 {cx:.2f} {cy:.2f})"/>',
              [(cx - rx, cy - ry - 4), (cx + rx, cy + ry)])
        p.raw(f'<ellipse cx="{cx - 1:.2f}" cy="{cy - 1:.2f}" rx="{rx - 2.5}" ry="{ry - 2}" fill="{WHITE}" transform="rotate(-18 {cx:.2f} {cy:.2f})"/>')
        p.line((cx, cy), (cx + 3, cy - 9), INK, 0.9)
        p.raw(f'<circle cx="{cx + 3:.2f}" cy="{cy - 9:.2f}" r="1.6" fill="{ORANGE}" stroke="{INK}" stroke-width="0.5"/>', [(cx + 3, cy - 12)])
    return p.svg()


def computer():
    p = Pic(8)
    board = p.box(0, 0, 0, 3, 2.4, 0.18, '#2f8f6b', '#1d5c45', '#247556')
    for (x, y, w, d) in ((0.3, 0.3, 1.1, 1.1), (1.7, 0.4, 0.8, 0.6), (1.7, 1.3, 0.8, 0.7)):
        p.box(x, y, 0.18, w, d, 0.22, NAVY_L, NAVY_D, NAVY)
    for i in range(6):
        u = 0.1 + i * 0.15
        p.line(fp(board['top'], u, 0.92), fp(board['top'], u, 1.0), GOLD, 0.9)
    p.box(0.55, 0.55, 0.4, 0.6, 0.6, 0.02, ORANGE_L, ORANGE_D, ORANGE)
    return p.svg()


def magnetorquer():
    p = Pic(7)
    p.box(0, 0, 0, 3, 3, 0.2, NAVY_L, NAVY_D, NAVY)
    # three rods: along x, along y, and upright
    def rod(x, y, z, dx, dy, dz):
        p.box(x, y, z, dx, dy, dz, ORANGE_L, ORANGE_D, ORANGE)
    rod(0.3, 0.3, 0.2, 2.4, 0.4, 0.4)
    rod(2.3, 0.9, 0.2, 0.4, 1.8, 0.4)
    rod(0.4, 2.2, 0.2, 0.4, 0.4, 2.0)
    for k in range(1, 6):
        p.line(p.P(0.3 + k * 0.4, 0.3, 0.6), p.P(0.3 + k * 0.4, 0.7, 0.6), ORANGE_D, 0.5)
    return p.svg()


def cold_gas():
    p = Pic(8)
    p.box(0, 0, 0, 2.4, 2.4, 0.25, NAVY_L, NAVY_D, NAVY)
    cx, cy = p.P(1.2, 1.2, 1.6)
    r = 11
    p.raw(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r}" fill="{WHITE_S}" stroke="{INK}" stroke-width="{SW}"/>', [(cx - r, cy - r), (cx + r, cy + r)])
    p.raw(f'<path d="M{cx - r * 0.7:.2f},{cy - r * 0.2:.2f} A{r} {r} 0 0 1 {cx + r * 0.3:.2f},{cy - r * 0.95:.2f} A{r * 0.8} {r * 0.8} 0 0 0 {cx - r * 0.7:.2f},{cy - r * 0.2:.2f}Z" fill="{WHITE}"/>')
    p.raw(f'<rect x="{cx - r:.2f}" y="{cy - 1:.2f}" width="{2 * r}" height="2" fill="{ORANGE}"/>')
    # nozzle
    nx, ny = p.P(2.6, 1.2, 0.5)
    p.raw(f'<path d="M{nx - 3:.2f},{ny - 6:.2f} L{nx + 3:.2f},{ny - 6:.2f} L{nx + 6:.2f},{ny + 3:.2f} L{nx - 6:.2f},{ny + 3:.2f}Z" fill="{NAVY}" stroke="{INK}" stroke-width="{SW}"/>', [(nx - 6, ny - 6), (nx + 6, ny + 3)])
    return p.svg()


def camera(thermal):
    p = Pic(8)
    body = SLATE_L if thermal else WHITE
    f = p.box(0, 0, 0, 2.2, 2.2, 2.2, body, SLATE_D if thermal else WHITE_D, SLATE if thermal else WHITE_S)
    lens = f['right']
    ellipse_on(p, lens, 0.5, 0.5, 0.42 if thermal else 0.36, NAVY_D, sw=0.8)
    if thermal:
        ellipse_on(p, lens, 0.5, 0.5, 0.32, ORANGE_D, sw=0.4)
        ellipse_on(p, lens, 0.5, 0.5, 0.2, ORANGE, sw=0.3)
        ellipse_on(p, lens, 0.5, 0.5, 0.09, GOLD_L, sw=0.2)
    else:
        ellipse_on(p, lens, 0.5, 0.5, 0.24, CELL_D, sw=0.4)
        ellipse_on(p, lens, 0.42, 0.42, 0.07, CELL_L, sw=0)
    p.line(fp(f['top'], 0.15, 0.2), fp(f['top'], 0.85, 0.2), ORANGE, 1.2)
    return p.svg()


# ---------------------------------------------------------------- rockets (side view, 2D)

def rocket(scale, stages, boosters=0):
    """Generic rocket, height grows with class. Side view, cel shaded left/right halves."""
    w = 10 * scale
    stage_h = [18 * scale * k for k in stages]
    nose = 14 * scale
    parts = []
    y = 0
    total = sum(stage_h) + nose
    def body(y0, h, color, shade):
        parts.append(f'<rect x="{-w / 2:.2f}" y="{y0:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{color}" stroke="{INK}" stroke-width="0.8"/>')
        parts.append(f'<rect x="{0:.2f}" y="{y0:.2f}" width="{w / 2:.2f}" height="{h:.2f}" fill="{shade}"/>')
    # nose cone
    parts.append(f'<path d="M{-w / 2:.2f},{nose:.2f} Q{-w / 2:.2f},{nose * 0.3:.2f} 0,0 Q{w / 2:.2f},{nose * 0.3:.2f} {w / 2:.2f},{nose:.2f}Z" fill="{WHITE}" stroke="{INK}" stroke-width="0.8"/>')
    parts.append(f'<path d="M0,0 Q{w / 2:.2f},{nose * 0.3:.2f} {w / 2:.2f},{nose:.2f} L0,{nose:.2f}Z" fill="{WHITE_S}"/>')
    y = nose
    for i, h in enumerate(stage_h):
        body(y, h, WHITE, WHITE_S)
        parts.append(f'<rect x="{-w / 2:.2f}" y="{y + h - 3 * scale:.2f}" width="{w:.2f}" height="{2 * scale:.2f}" fill="{ORANGE if i == 0 else NAVY_L}"/>')
        y += h
    # boosters
    for side in ([-1, 1] if boosters else []):
        bx = side * (w / 2 + 3.2 * scale)
        bh = stage_h[-1] * 0.85
        by = y - bh
        parts.append(f'<rect x="{bx - 3 * scale:.2f}" y="{by:.2f}" width="{6 * scale:.2f}" height="{bh:.2f}" rx="{1.5 * scale:.2f}" fill="{WHITE_S}" stroke="{INK}" stroke-width="0.8"/>')
        parts.append(f'<path d="M{bx - 3 * scale:.2f},{by + 2:.2f} Q{bx:.2f},{by - 6 * scale:.2f} {bx + 3 * scale:.2f},{by + 2:.2f}Z" fill="{WHITE}" stroke="{INK}" stroke-width="0.8"/>')
    # fins + engine
    for side in (-1, 1):
        parts.append(f'<path d="M{side * w / 2:.2f},{y - 10 * scale:.2f} L{side * (w / 2 + 6 * scale):.2f},{y + 2 * scale:.2f} L{side * w / 2:.2f},{y:.2f}Z" fill="{NAVY}" stroke="{INK}" stroke-width="0.8"/>')
    parts.append(f'<path d="M{-w * 0.3:.2f},{y:.2f} L{w * 0.3:.2f},{y:.2f} L{w * 0.4:.2f},{y + 4 * scale:.2f} L{-w * 0.4:.2f},{y + 4 * scale:.2f}Z" fill="{NAVY_D}" stroke="{INK}" stroke-width="0.8"/>')
    # windows/logo-less band
    parts.append(f'<circle cx="0" cy="{nose + 6 * scale:.2f}" r="{1.8 * scale:.2f}" fill="{CELL}" stroke="{INK}" stroke-width="0.6"/>')
    H = y + 4 * scale
    pad = 4
    half = max(w / 2 + 7 * scale, (w / 2 + 6.5 * scale) if boosters else 0) + pad
    vb_w = max(half * 2, H / 2 + 2 * pad)
    body_s = '\n  '.join(parts)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-vb_w / 2:.2f} {-pad} {vb_w:.2f} {H + 2 * pad:.2f}">\n  {body_s}\n</svg>\n'


# ---------------------------------------------------------------- role avatars (2D)

GLYPH = {
    # simple, original glyphs drawn on a 24-unit grid
    'planner': '<rect x="7" y="5" width="10" height="14" rx="1.5" fill="none" stroke="#0b1328" stroke-width="1.8"/><path d="M10 5h4v2h-4z" fill="#0b1328"/><path d="M9.5 10.5h5M9.5 13.5h5M9.5 16.5h3" stroke="#0b1328" stroke-width="1.6" stroke-linecap="round"/>',
    'engineer': '<path d="M15.5 5.5a4 4 0 0 0-4.6 5.2l-5.4 5.4a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a4 4 0 0 0 5.2-4.6l-2.4 2.4-2.2-.3-.3-2.2z" fill="#0b1328"/>',
    'science': '<path d="M10 5h4M11 5v5l-4.5 7.5A1.5 1.5 0 0 0 7.8 19.8h8.4a1.5 1.5 0 0 0 1.3-2.3L13 10V5" fill="none" stroke="#0b1328" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><path d="M8.5 15.5h7l1.2 2.3H7.3z" fill="#0b1328"/>',
    'flight': '<path d="M12 12l0 8M9 20h6" stroke="#0b1328" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="11" r="1.8" fill="#0b1328"/><path d="M8 7a5.5 5.5 0 0 0 0 8M16 7a5.5 5.5 0 0 1 0 8M5.5 4.5a9 9 0 0 0 0 13M18.5 4.5a9 9 0 0 1 0 13" fill="none" stroke="#0b1328" stroke-width="1.6" stroke-linecap="round"/>',
}
SUIT = {'planner': ORANGE, 'engineer': GOLD, 'science': '#3ddc97', 'flight': CELL_L}


def avatar(role):
    c = SUIT[role]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="62" fill="{NAVY}"/>
  <circle cx="64" cy="64" r="62" fill="none" stroke="{c}" stroke-width="4"/>
  <clipPath id="c"><circle cx="64" cy="64" r="60"/></clipPath>
  <g clip-path="url(#c)">
    <path d="M18 128 Q20 88 64 86 Q108 88 110 128Z" fill="{WHITE_S}" stroke="{INK}" stroke-width="1.5"/>
    <path d="M64 86 Q108 88 110 128 L64 128Z" fill="{WHITE_D}"/>
    <rect x="46" y="96" width="36" height="22" rx="4" fill="{c}" stroke="{INK}" stroke-width="1.5"/>
    <circle cx="64" cy="56" r="30" fill="{WHITE}" stroke="{INK}" stroke-width="1.5"/>
    <path d="M64 26 A30 30 0 0 1 64 86 A34 34 0 0 0 64 26Z" fill="{WHITE_S}"/>
    <rect x="42" y="42" width="44" height="28" rx="13" fill="{NAVY_D}" stroke="{INK}" stroke-width="1.5"/>
    <path d="M48 50 Q54 45 62 46" stroke="{CELL_L}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="37" cy="58" r="4" fill="{c}" stroke="{INK}" stroke-width="1.2"/>
    <circle cx="91" cy="58" r="4" fill="{c}" stroke="{INK}" stroke-width="1.2"/>
  </g>
  <circle cx="100" cy="100" r="20" fill="{c}" stroke="{NAVY_D}" stroke-width="3"/>
  <g transform="translate(88 88)">{GLYPH[role]}</g>
</svg>
'''


# ---------------------------------------------------------------- scene

def wings_group():
    """Solar-wing CubeSat as an inline group (for the title art)."""
    s = solar_wings()
    vb = s.split('viewBox="')[1].split('"')[0].split()
    inner = s.split('>', 1)[1].rsplit('</svg>', 1)[0]
    return [float(v) for v in vb], inner


def title_art():
    (vx, vy, vw, vh), inner = wings_group()
    stars = ''.join(
        f'<circle cx="{(i * 97.3) % 1024:.1f}" cy="{(i * 53.7) % 300:.1f}" r="{(i % 3) * 0.6 + 0.6:.1f}" fill="#e8edf8" opacity="{0.35 + (i % 4) * 0.15:.2f}"/>'
        for i in range(90))
    scale = 420 / vw
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="0%" r="70%"><stop offset="0%" stop-color="#4aa3ff" stop-opacity=".55"/><stop offset="100%" stop-color="#4aa3ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4aa3ff"/><stop offset="10%" stop-color="#1f5fa8"/><stop offset="100%" stop-color="#0d2a55"/></linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff6d8"/><stop offset="35%" stop-color="#ffc94a" stop-opacity=".8"/><stop offset="100%" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
  </defs>
  {stars}
  <circle cx="900" cy="90" r="110" fill="url(#sun)"/>
  <ellipse cx="512" cy="1060" rx="1000" ry="760" fill="url(#glow)"/>
  <ellipse cx="512" cy="1080" rx="960" ry="760" fill="url(#earth)" stroke="#4aa3ff" stroke-width="2"/>
  <ellipse cx="512" cy="1080" rx="1010" ry="800" fill="none" stroke="#ff8a3d" stroke-opacity=".55" stroke-width="2" stroke-dasharray="8 10"/>
  <g transform="translate(500 175) rotate(-8) scale({scale:.3f}) translate({-(vx + vw / 2):.2f} {-(vy + vh / 2):.2f})">{inner}</g>
</svg>
'''


def ground_dish():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <path d="M44 118 L64 70 L84 118Z" fill="{WHITE_S}" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M64 70 L84 118 L64 118Z" fill="{WHITE_D}"/>
  <rect x="34" y="114" width="60" height="8" rx="2" fill="{NAVY_L}" stroke="{INK}" stroke-width="2"/>
  <g transform="rotate(-30 64 62)">
    <path d="M22 58 Q64 100 106 58Z" fill="{WHITE}" stroke="{INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M64 79 Q85 76 106 58 L64 58Z" fill="{WHITE_S}"/>
    <ellipse cx="64" cy="58" rx="42" ry="9" fill="{WHITE_S}" stroke="{INK}" stroke-width="2"/>
    <path d="M64 58 L64 22" stroke="{INK}" stroke-width="2.5"/>
    <path d="M30 58 L64 22 L98 58" fill="none" stroke="{INK}" stroke-width="1.5"/>
    <circle cx="64" cy="20" r="5" fill="{ORANGE}" stroke="{INK}" stroke-width="2"/>
  </g>
  <path d="M96 22 a10 10 0 0 1 10 10 M96 12 a20 20 0 0 1 20 20" fill="none" stroke="{ORANGE}" stroke-width="3" stroke-linecap="round"/>
</svg>
'''


def radar():
    p = Pic(6)
    p.box(0.8, 0.6, 0, 1.6, 1.6, 1.6, SLATE_L, SLATE_D, SLATE)
    # long flat antenna panel on a short boom
    p.box(1.5, 1.2, 1.6, 0.25, 0.25, 0.6, WHITE, WHITE_D, WHITE_S)
    pan = p.box(-1.2, 0.9, 2.2, 6.0, 0.9, 0.18, WHITE, WHITE_D, WHITE_S)
    grid(p, pan['top'], 8, 2, GOLD, inset=0.05, gap=0.08)
    p.line(p.P(-1.2, 1.8, 2.2), p.P(4.8, 1.8, 2.2), ORANGE, 1.2)
    return p.svg()


def solar_array():
    """Big deployable array for small and large satellite buses."""
    p = Pic(3.2)
    for x0 in (-11, 2.2):
        w = p.box(x0, 0.2, 2.4, 8.8, 1.8, 0.01, CELL, CELL_D, CELL)
        grid(p, w['top'], 6, 2, CELL_L, inset=0.03)
    p.box(0, 0, 0, 2.2, 2.2, 4.4, WHITE, WHITE_D, WHITE_S)
    p.line(p.P(-2.2, 1.1, 2.4), p.P(0, 1.1, 2.4), ORANGE, 2)
    p.line(p.P(2.2, 1.1, 2.4), p.P(3.2, 1.1, 2.4), ORANGE, 2)
    return p.svg()


def battery_pack():
    p = Pic(5.5)
    for i in range(3):
        for j in range(2):
            p.box(i * 1.1, j * 1.3, 0, 1.0, 1.2, 2.4, SLATE_L, SLATE_D, SLATE)
    f = p.box(-0.1, -0.1, 2.4, 3.4, 2.8, 0.25, NAVY_L, NAVY_D, NAVY)
    p.box(0.3, 1.0, 2.65, 0.4, 0.4, 0.25, ORANGE_L, ORANGE_D, ORANGE)
    p.box(2.3, 1.0, 2.65, 0.4, 0.4, 0.25, ORANGE_L, ORANGE_D, ORANGE)
    bolt(p, f['top'])
    return p.svg()


def reaction_wheel():
    p = Pic(8)
    p.box(0, 0, 0, 2.6, 2.6, 0.5, SLATE_L, SLATE_D, SLATE)
    cx, cy = p.P(1.3, 1.3, 0.9)
    p.raw(f'<ellipse cx="{cx:.2f}" cy="{cy + 3:.2f}" rx="14" ry="7.5" fill="{WHITE_D}" stroke="{INK}" stroke-width="{SW}"/>', [(cx - 14, cy - 8), (cx + 14, cy + 11)])
    p.raw(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="14" ry="7.5" fill="{WHITE}" stroke="{INK}" stroke-width="{SW}"/>')
    p.raw(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="9" ry="4.8" fill="none" stroke="{WHITE_D}" stroke-width="1.2"/>')
    p.raw(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="3" ry="1.6" fill="{ORANGE}" stroke="{INK}" stroke-width="0.5"/>')
    p.raw(f'<path d="M{cx + 10:.2f},{cy - 9:.2f} a12 6 0 0 1 8 6" fill="none" stroke="{ORANGE}" stroke-width="1.4" stroke-linecap="round"/>', [(cx + 18, cy - 10)])
    return p.svg()


def multispectral():
    p = Pic(7)
    f = p.box(0, 0, 0, 3.2, 2.0, 2.0, WHITE, WHITE_D, WHITE_S)
    face = f['left']
    for u, col in ((0.2, CELL_D), (0.5, '#2f8f6b'), (0.8, ORANGE_D)):
        ellipse_on(p, face, u, 0.5, 0.13, NAVY_D, sw=0.6)
        ellipse_on(p, face, u, 0.5, 0.08, col, sw=0.3)
    p.line(fp(f['top'], 0.15, 0.2), fp(f['top'], 0.85, 0.2), ORANGE, 1.2)
    return p.svg()


def spectrometer():
    p = Pic(7)
    f = p.box(0, 0, 0, 3.0, 1.8, 1.6, SLATE_L, SLATE_D, SLATE)
    p.box(3.0, 0.5, 0.4, 0.8, 0.8, 0.8, WHITE, WHITE_D, WHITE_S)
    # rainbow slit on the side: a spectrometer splits light into colours
    cols = ['#ff5c6c', ORANGE, GOLD, '#3ddc97', CELL_L, '#8a6cff']
    for i, c in enumerate(cols):
        u0 = 0.15 + i * 0.11
        p.poly([fp(f['left'], u0, 0.35), fp(f['left'], u0 + 0.1, 0.35), fp(f['left'], u0 + 0.1, 0.65), fp(f['left'], u0, 0.65)], c, sw=0.25)
    return p.svg()


def magnetometer():
    p = Pic(6)
    p.box(0, 0, 0, 1.6, 1.6, 0.6, SLATE_L, SLATE_D, SLATE)
    p.line(p.P(0.8, 0.8, 0.6), p.P(4.6, 0.8, 3.6), WHITE_D, 2.2)
    p.line(p.P(0.8, 0.8, 0.6), p.P(4.6, 0.8, 3.6), WHITE, 1)
    p.box(4.3, 0.5, 3.4, 0.7, 0.7, 0.7, ORANGE_L, ORANGE_D, ORANGE)
    cx, cy = p.P(4.65, 0.85, 4.4)
    p.raw(f'<path d="M{cx - 6:.2f},{cy - 3:.2f} q6 -6 12 0 M{cx - 9:.2f},{cy - 6:.2f} q9 -9 18 0" fill="none" stroke="{CELL_L}" stroke-width="1.2" stroke-linecap="round"/>', [(cx - 9, cy - 12), (cx + 9, cy)])
    return p.svg()


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        # Buses and parts, named by Member 1's ids in src/data/parts.json
        'bus-cubesat-6u': bus_6u(), 'bus-smallsat': bus_smallsat(), 'bus-large': cubesat(3, 3, 3, cells=True).svg(),
        'solar-body': solar_body(), 'solar-wings': solar_wings(), 'solar-array': solar_array(),
        'battery-small': battery(False), 'battery-large': battery(True), 'battery-pack': battery_pack(),
        'computer': computer(), 'magnetorquer': magnetorquer(), 'reaction-wheel': reaction_wheel(),
        'cold-gas-thruster': cold_gas(),
        'antenna-uhf': radio('uhf'), 'antenna-s': radio('s'), 'antenna-x': radio('x'),
        'camera': camera(False), 'multispectral-imager': multispectral(), 'thermal-imager': camera(True),
        'radar': radar(), 'spectrometer': spectrometer(), 'magnetometer': magnetometer(),
        'rocket-rideshare': rocket(0.8, [1.6, 0.9]),
        'rocket-small': rocket(1.0, [2.0, 1.0]),
        'rocket-medium': rocket(1.25, [2.6, 1.2]),
        'rocket-heavy': rocket(1.35, [3.0, 1.3], boosters=1),
        'rocket-super': rocket(1.6, [3.4, 1.6], boosters=1),
        'role-planner': avatar('planner'), 'role-engineer': avatar('engineer'),
        'role-science': avatar('science'), 'role-flight': avatar('flight'),
        'scene-title': title_art(), 'scene-ground-dish': ground_dish(),
    }
    # Remove art for part ids that no longer exist
    keep = {f'{n}.svg' for n in files}
    for old in os.listdir(OUT):
        if old.endswith('.svg') and old not in keep:
            os.remove(os.path.join(OUT, old))
    for name, svg in files.items():
        with open(os.path.join(OUT, f'{name}.svg'), 'w') as fh:
            fh.write(svg)
    print(f'wrote {len(files)} files to {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
