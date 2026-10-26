"""Prepare README pictures and preserve the original EXE's complete icon group."""
from pathlib import Path
import argparse, io, struct
import pefile
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def original_icon(executable):
    pe=pefile.PE(str(executable))
    types={entry.id:entry for entry in pe.DIRECTORY_ENTRY_RESOURCE.entries}
    group=types[14].directory.entries[0]
    data=group.directory.entries[0].data.struct
    raw=pe.get_data(data.OffsetToData,data.Size)
    reserved,kind,count=struct.unpack_from('<HHH',raw)
    assert (reserved,kind)==(0,1)
    icons={entry.id:entry for entry in types[3].directory.entries}
    entries=[];payload=[];offset=6+16*count
    for i in range(count):
        w,h,colors,unused,planes,bpp,size,resource=struct.unpack_from('<BBBBHHIH',raw,6+i*14)
        entry=icons[resource].directory.entries[0].data.struct
        pixels=pe.get_data(entry.OffsetToData,entry.Size);assert len(pixels)==size
        entries.append(struct.pack('<BBBBHHII',w,h,colors,unused,planes,bpp,size,offset))
        payload.append(pixels);offset+=size
    result=struct.pack('<HHH',0,1,count)+b''.join(entries)+b''.join(payload)
    # Preserve the actual PNG/DIB payloads, not a re-rendered replacement icon.
    for i,pixels in enumerate(payload):
        size,start=struct.unpack_from('<II',result,6+16*i+8)
        assert result[start:start+size]==pixels
    with Image.open(io.BytesIO(result)) as image:print('Original icon sizes:',sorted(image.ico.sizes()))
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--exe',type=Path,default=ROOT.parent/'Vascolet1/Vascolet.exe');parser.add_argument('--screenshots',type=Path,default=ROOT/'test-results');args=parser.parse_args()
    icons=ROOT/'assets/icons';icons.mkdir(parents=True,exist_ok=True)
    (icons/'vascolet.ico').write_bytes(original_icon(args.exe))
    pictures=ROOT/'docs/images';pictures.mkdir(parents=True,exist_ok=True)
    with Image.open(ROOT/'assets/images/menuElements/menu.jpg') as image:
        image.crop((0,0,1200,900)).resize((960,720),Image.Resampling.LANCZOS).convert('RGB').save(pictures/'vascolet.jpg',quality=90,optimize=True)
    for source,name in [('era-0.png','prehistoria.jpg'),('era-4.png','futuro.jpg')]:
        with Image.open(args.screenshots/source) as image:
            assert image.size==(800,600)
            image.convert('RGB').save(pictures/name,quality=90,optimize=True)
    print('Prepared original favicon and three README images')

if __name__=='__main__':main()
