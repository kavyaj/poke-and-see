"""Builds the two sharpest levels of World Globe tiles (toys/globe/tiles/3 and /4)
from NASA's Blue Marble Next Generation, 500 m per pixel (August 2004, topography and bathymetry).

    pip install Pillow
    python3 tools/globe-tiles.py

Downloads 8 pictures (about 410 MB) into a folder outside the repo, then writes
382 tiles to toys/globe/tiles/3 and 1177 tiles to toys/globe/tiles/4 (about 217 MB).
Only tiles listed in toys/globe/data/tiles.json are made: open ocean is skipped
and the globe uses the level below there.
"""
import json, os, sys, tempfile, urllib.request
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLOBE = os.path.join(ROOT, 'toys', 'globe')
SRC = os.path.join(tempfile.gettempdir(), 'blue-marble-500m')
URL = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200408.3x21600x21600.{}.jpg'
T, Q = 1350, 80


def fetch(name):
    """Download one NASA picture, resuming if the connection drops."""
    path = os.path.join(SRC, name + '.jpg')
    url = URL.format(name)
    want = int(urllib.request.urlopen(urllib.request.Request(url, method='HEAD')).headers['Content-Length'])
    for _ in range(8):
        have = os.path.getsize(path) if os.path.exists(path) else 0
        if have == want:
            return path
        req = urllib.request.Request(url, headers={'Range': f'bytes={have}-'} if have else {})
        try:
            with urllib.request.urlopen(req) as r, open(path, 'ab' if have else 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
        except Exception as e:
            print('  retrying', name, e)
    sys.exit(f'Could not download {name} completely')


def main():
    os.makedirs(SRC, exist_ok=True)
    manifest = json.load(open(os.path.join(GLOBE, 'data', 'tiles.json')))
    for l in (3, 4):
        os.makedirs(os.path.join(GLOBE, 'tiles', str(l)), exist_ok=True)
    n3 = n4 = 0
    for ci, col in enumerate('ABCD'):          # A..D run west to east, 90 degrees each
        for ri, row in enumerate('12'):        # 1 is the northern half, 2 the southern
            name = col + row
            print('downloading', name)
            im = Image.open(fetch(name)).convert('RGB')
            print('cutting', name)
            # level 4: 16 x 16 tiles straight from the 500 m picture
            for i in range(16):
                for j in range(16):
                    x, y = ci * 16 + i, ri * 16 + j
                    if manifest['4'][y * 64 + x] == '1':
                        im.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)).save(
                            os.path.join(GLOBE, 'tiles', '4', f'{x}_{y}.jpg'), quality=Q, optimize=True)
                        n4 += 1
            # level 3: the same picture at half size, 8 x 8 tiles
            half = im.resize((10800, 10800), Image.LANCZOS)
            del im
            for i in range(8):
                for j in range(8):
                    x, y = ci * 8 + i, ri * 8 + j
                    if manifest['3'][y * 32 + x] == '1':
                        half.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)).save(
                            os.path.join(GLOBE, 'tiles', '3', f'{x}_{y}.jpg'), quality=Q, optimize=True)
                        n3 += 1
            del half
    print(f'done: {n3} tiles in level 3 (expect 382), {n4} in level 4 (expect 1177)')
    print('the downloads are in', SRC, '(delete that folder when you are happy)')


if __name__ == '__main__':
    main()
