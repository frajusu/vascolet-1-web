"""Reproducible asset import and evidence catalog. Never executes the original game."""
from pathlib import Path
import argparse, base64, collections, hashlib, json, re, shutil, struct
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
def props(e):
    return {p.get('name'): p.get('value', p.text or '') for p in e.findall('./properties/property')}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', type=Path, default=ROOT.parent/'Vascolet1')
    args = ap.parse_args()
    source = args.source
    (ROOT/'analysis').mkdir(exist_ok=True)
    (ROOT/'assets').mkdir(exist_ok=True)
    shutil.copytree(source/'assets', ROOT/'assets', dirs_exist_ok=True)
    catalog = {}
    for path in sorted((ROOT/'assets/data').glob('*.tmx')):
        m = ET.parse(path).getroot()
        layers = []
        for layer in m.findall('layer'):
            d = layer.find('data')
            raw = base64.b64decode(d.text)
            assert not d.get('compression'), 'Add compression support before importing this map'
            gids = list(struct.unpack('<'+'I'*(len(raw)//4), raw))
            assert len(gids) == int(layer.get('width'))*int(layer.get('height'))
            layers.append({'name':layer.get('name'), 'nonempty':sum(bool(g) for g in gids), 'gids':dict(collections.Counter(gids)), 'props':props(layer)})
        objects = []
        for group in m.findall('objectgroup'):
            for o in group.findall('object'):
                objects.append(dict(o.attrib, group=group.get('name'), props=props(o)))
        catalog[path.stem] = {'map':m.attrib, 'props':props(m), 'layers':layers, 'objectTypes':dict(collections.Counter(o.get('type') for o in objects)), 'objects':objects}
    (ROOT/'analysis/maps.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf8')
    binary = (source/'Vascolet.exe').read_bytes()
    ascii_strings = [s.decode('ascii') for s in re.findall(rb'[\x20-\x7e]{5,}',binary)]
    wide_strings = [s.decode('utf-16le') for s in re.findall(rb'(?:[\x20-\x7e]\x00){5,}',binary)]
    relevant = [s for s in ascii_strings+wide_strings if any(x in s for x in ['.?AV','assets/', 'pHard','pPlatform','pSpeed','pAsset','pGravity','pJump'])]
    (ROOT/'analysis/binary-strings.txt').write_text('\n'.join(relevant),encoding='utf8')
    inventory = []
    thumbs = []
    for original in sorted((source/'assets').rglob('*')):
        if not original.is_file(): continue
        path=ROOT/'assets'/original.relative_to(source/'assets')
        entry = {'path':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        if path.suffix.lower() in ['.png','.jpg']:
            im=Image.open(path).convert('RGBA'); entry['size']=im.size
            thumb=Image.new('RGB',(360,240),'#8b9bac'); im.thumbnail((350,205)); thumb.paste(im,((360-im.width)//2,20),im)
            ImageDraw.Draw(thumb).text((5,225),path.name,fill='black'); thumbs.append(thumb)
        inventory.append(entry)
    sheet=Image.new('RGB',(360*4,240*((len(thumbs)+3)//4)),'white')
    for i,t in enumerate(thumbs): sheet.paste(t,((i%4)*360,(i//4)*240))
    sheet.save(ROOT/'analysis/contact-sheet.jpg')
    (ROOT/'analysis/inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf8')
    for name,m in catalog.items(): print(name,m['map'],m['objectTypes'])
    print('Imported',len(inventory),'assets; binary SHA256',hashlib.sha256(binary).hexdigest())

if __name__=='__main__': main()
