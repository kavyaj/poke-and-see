"""Builds the sharp World Globe pictures from NASA's 500 m-per-pixel world maps.

    pip install Pillow
    python tools/globe-tiles.py day      (the default)
    python tools/globe-tiles.py night

day:   Blue Marble Next Generation (August 2004, topography and bathymetry).
       Downloads 8 pictures (about 410 MB), then writes 382 tiles to toys/globe/tiles/3
       and 1177 tiles to toys/globe/tiles/4 (about 217 MB).
night: Earth at Night (Black Marble) 2016.
       Downloads 8 pictures (about 216 MB), then writes 8, 128, 382 and 1177 tiles to
       toys/globe/night/1 to /4, plus the whole-world img/night-1k.jpg and img/night-4k.jpg.

Downloads go to a folder outside the repo. Levels 3 and 4 are only made where
toys/globe/data/tiles.json lists them: open ocean is skipped and the globe uses
the level below there.
"""
import json, os, sys, tempfile, time, urllib.request
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLOBE = os.path.join(ROOT, 'toys', 'globe')
KINDS = {
    'day': ('blue-marble-500m', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200408.3x21600x21600.{}.jpg',
            'tiles', (3, 4), {3: 382, 4: 1177}),
    'night': ('black-marble-500m', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_{}.jpg',
              'night', (1, 2, 3, 4), {1: 8, 2: 128, 3: 382, 4: 1177}),
}
T, Q = 1350, 80
PER = {1: 1, 2: 4, 3: 8, 4: 16}        # tiles across one 90-degree picture, per level
SIDE = {1: 2048, 2: 5400, 3: 10800, 4: 21600}   # the picture is resized to this before cutting


def fetch(src, url, name):
    """Download one NASA picture, resuming if the connection drops. Gives up on a stalled connection after a minute."""
    path = os.path.join(src, name + '.jpg')
    url = url.format(name)
    for attempt in range(12):
        try:
            want = int(urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=60).headers['Content-Length'])
            have = os.path.getsize(path) if os.path.exists(path) else 0
            if have == want:
                return path
            req = urllib.request.Request(url, headers={'Range': f'bytes={have}-'} if have else {})
            with urllib.request.urlopen(req, timeout=60) as r, open(path, 'ab' if have else 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
        except Exception as e:
            print('  retrying', name, e)
            time.sleep(min(60, 5 * (attempt + 1)))
    sys.exit(f'Could not download {name} completely')


def main():
    kind = sys.argv[1] if len(sys.argv) > 1 else 'day'
    folder, url, out, levels, expect = KINDS[kind]
    src = os.path.join(tempfile.gettempdir(), folder)
    os.makedirs(src, exist_ok=True)
    manifest = json.load(open(os.path.join(GLOBE, 'data', 'tiles.json')))
    for l in levels:
        os.makedirs(os.path.join(GLOBE, out, str(l)), exist_ok=True)
    made = dict.fromkeys(levels, 0)
    world = {4096: Image.new('RGB', (4096, 2048)), 1024: Image.new('RGB', (1024, 512))}
    for ci, col in enumerate('ABCD'):          # A..D run west to east, 90 degrees each
        for ri, row in enumerate('12'):        # 1 is the northern half, 2 the southern
            name = col + row
            print('downloading', name)
            im = Image.open(fetch(src, url, name)).convert('RGB')
            print('cutting', name)
            for l in sorted(levels, reverse=True):     # sharpest first, then keep shrinking the same picture
                if im.size[0] != SIDE[l]:
                    im = im.resize((SIDE[l], SIDE[l]), Image.LANCZOS)
                n, t = PER[l], SIDE[l] // PER[l]
                for i in range(n):
                    for j in range(n):
                        x, y = ci * n + i, ri * n + j
                        if l <= 2 or manifest[str(l)][y * 4 * n + x] == '1':
                            im.crop((i * t, j * t, (i + 1) * t, (j + 1) * t)).save(
                                os.path.join(GLOBE, out, str(l), f'{x}_{y}.jpg'), quality=Q, optimize=True)
                            made[l] += 1
            if kind == 'night':
                for w, pic in world.items():
                    s = w // 4
                    pic.paste(im.resize((s, s), Image.LANCZOS), (ci * s, ri * s))
            del im
    if kind == 'night':
        for w, pic in world.items():
            pic.save(os.path.join(GLOBE, 'img', f'night-{w // 1024}k.jpg'), quality=Q, optimize=True)
    print('done:', ', '.join(f'{made[l]} tiles in level {l} (expect {expect[l]})' for l in levels))
    print('the downloads are in', src, '(delete that folder when you are happy)')


if __name__ == '__main__':
    main()
