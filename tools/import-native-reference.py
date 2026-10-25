"""Turn observed native ImageMap records and font widths into runtime manifests."""
from pathlib import Path
import json,struct,re
import pefile
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32
from unicorn.x86_const import UC_X86_REG_ECX,UC_X86_REG_ESP

ROOT=Path(__file__).resolve().parents[1]
def main():
    catalog=json.loads((ROOT/'analysis/native-reference/catalog/ui-atlas.json').read_text())
    ui={}
    for key,frames in catalog.items():
        ui[key]=[dict(image=f['image'],**dict(zip(['x','y','w','h','ax','ay'],f['values']))) for f in frames]
    (ROOT/'assets/data/ui-atlas.json').write_text(json.dumps(ui,indent=2),encoding='utf8')
    pe=pefile.PE(str(ROOT.parent/'Vascolet1/Vascolet.exe'));image=pe.get_memory_mapped_image();base=pe.OPTIONAL_HEADER.ImageBase
    decompiled=(ROOT/'analysis/native/00443070.c').read_text()
    assigned={int(i,0):int(v,0) for i,v in re.findall(r'local_124\[(0x[0-9a-f]+|\d+)\] = (0x[0-9a-f]+|\d+);',decompiled)}
    codes=[65,66]+[assigned[i] for i in range(135)]
    u=Uc(UC_ARCH_X86,UC_MODE_32);u.mem_map(base,0x200000);u.mem_write(base,image);u.mem_map(0x2000000,0x10000)
    trampoline=0x2000100;output=0x2000200;stack=0x200f000
    u.mem_write(trampoline,b'\xd9\x1d'+struct.pack('<I',output)+b'\x90')
    glyphs={}
    for i,code in enumerate(codes):
        u.reg_write(UC_X86_REG_ECX,code);u.reg_write(UC_X86_REG_ESP,stack);u.mem_write(stack,struct.pack('<I',trampoline))
        u.emu_start(0x442e50,trampoline+6,count=1000)
        advance=struct.unpack('<f',u.mem_read(output,4))[0]
        glyphs[chr(code)]={'x':i%12*40,'y':i//12*40,'advance':advance}
    font={'image':'assets/lang/images/white_font_new.png','outlineImage':'assets/lang/images/white_font_new_outline.png','cell':40,'lineHeight':30,'source':'00443070 character table / 00442e50 advance function','glyphs':glyphs}
    (ROOT/'assets/data/font.json').write_text(json.dumps(font,indent=2,ensure_ascii=False),encoding='utf8')
    maps=json.loads((ROOT/'analysis/maps.json').read_text(encoding='utf8'));objects={}
    for name in ['prehistory','egypt','castle','pirates','future']:
        folder='progress' if name=='prehistory' else name
        live=json.loads((ROOT/f'analysis/native-reference/{folder}/{name}-actors.json').read_text())
        placed=[o for o in maps[name]['objects'] if o['type']!='Vascolet']
        assert len(live)==len(placed),(name,len(live),len(placed))
        rows=[]
        for index,(o,a) in enumerate(zip(placed,live)):
            if o['type']=='Item':assert o['props']['pRequiredItem']==a['key'],(name,index,o,a)
            roomX,roomY=a['room'];x,y=a['baseBox'];w,h=a['box'][2:]
            rows.append({'id':maps[name]['objects'].index(o),'type':o['type'],'x':roomX*1216+x,'y':roomY*912+y,'w':w,'h':h,'room':[int(roomX),int(roomY)],'nativeVtable':a['vtable']})
        objects[name]=rows
    (ROOT/'assets/data/native-objects.json').write_text(json.dumps(objects,indent=2),encoding='utf8')
    print('Native UI groups:',len(ui),'glyphs:',len(glyphs))

if __name__=='__main__':main()
