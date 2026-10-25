"""Bake observed static selector states, retaining native rasterization exactly."""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def main():
    source=ROOT/'analysis/native-reference/selection-skins';dest=ROOT/'assets/gui/native';dest.mkdir(parents=True,exist_ok=True);records=[]
    for file in sorted(source.glob('*.png')):
        if not file.stem.startswith(('select-','hover-')):continue
        target=dest/file.name;im=Image.open(file);assert im.size==(800,600);im.save(target)
        records.append({'path':target.relative_to(ROOT).as_posix(),'source':file.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    assert len(records)==9
    (ROOT/'assets/data/native-skins.json').write_text(json.dumps({'binarySha256':'7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71','states':records},indent=2))
    print('Baked',len(records),'original selector states')
if __name__=='__main__':main()
