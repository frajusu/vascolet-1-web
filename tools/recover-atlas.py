"""Recover hardcoded ImageMapDesc records in a bounded x86 emulator.

Only the selected asset-constructor instructions run. Every call is intercepted;
no Windows API, renderer, audio, game loop or native executable is run.
Requires pefile, capstone, unicorn. Keeps evidence of the raw descriptor fields.
"""
from pathlib import Path
import argparse, bisect, hashlib, json, struct
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import *

ROOT=Path(__file__).resolve().parents[1]
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--exe',type=Path,default=ROOT.parent/'Vascolet1/Vascolet.exe')
    ap.add_argument('--index',type=Path,default=ROOT.parent/'vascolet1-analisis/descompilado/funciones.tsv')
    ap.add_argument('--audio-only',action='store_true')
    a=ap.parse_args(); pe=pefile.PE(str(a.exe)); base=pe.OPTIONAL_HEADER.ImageBase
    digest=hashlib.sha256(a.exe.read_bytes()).hexdigest()
    if digest!='7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71':
        raise ValueError('Different game build: these constructor addresses must be re-identified first')
    image=pe.get_memory_mapped_image(); cs=Cs(CS_ARCH_X86,CS_MODE_32)
    f32=lambda address:struct.unpack_from('<f',image,address-base)[0]
    constants={
        'binarySha256':digest,
        'gravity':{'address':'0050a7c0','value':f32(0x50a7c0)},
        'maxSpeed':{'address':'004ea3c8','value':f32(0x4ea3c8)},
        'speed':{'address':'0050a7c4','value':f32(0x50a7c4)},
        'climb':{'address':'0050a820','value':f32(0x50a820)},
        'width':{'address':'004eef3c','value':f32(0x4eef3c)},
        'height':{'address':'004eef38','value':f32(0x4eef38)},
        'jumps':{'address':'0050a7d0','values':[abs(f32(0x50a7d0+i*8)) for i in range(5)]},
        'doubleJumps':{'address':'0050a7f8','values':[abs(f32(0x50a7f8+i*8)) for i in range(5)]},
        'roomColumns':{'address':'004eee0c','value':f32(0x4eee0c)},
        'roomRows':{'address':'004eedd0','value':f32(0x4eedd0)},
        'nativeViewportWidth':{'address':'004eef78','value':f32(0x4eef78)},
        'nativeViewportHeight':{'address':'004eee64','value':f32(0x4eee64)},
    }
    if not a.audio_only:(ROOT/'analysis/native-constants.json').write_text(json.dumps(constants,indent=2),encoding='utf8')
    funcs=[]
    for line in a.index.read_text().splitlines()[1:]:
        addr,name,size=line.split('\t'); funcs.append((int(addr,16),int(size)))
    starts=[f[0] for f in funcs]; cleanups={}
    def cleanup(addr):
        if addr not in cleanups:
            i=bisect.bisect_right(starts,addr)-1
            end=starts[i+1] if i+1<len(starts) else addr+100
            rets=[int(ins.op_str,0) if ins.op_str else 0 for ins in cs.disasm(image[addr-base:end-base],addr) if ins.mnemonic=='ret']
            cleanups[addr]=rets[-1] if rets else 0
        return cleanups[addr]
    result={}; animation_result={}; audio=[]
    jobs=[] if a.audio_only else [(0x42cd10,'player'),(0x438be0,'enemies'),(0x418100,'items'),(0x419b20,'elements'),(0x42b3c0,'playerAnimations'),(0x434760,'enemyAnimations')]
    jobs.append((0x41d3f0,'audio'))
    for start,label in jobs:
        u=Uc(UC_ARCH_X86,UC_MODE_32); u.mem_map(0,0x10000); u.mem_map(base,0x200000); u.mem_write(base,image)
        u.mem_map(0x1000000,0x200000); u.mem_map(0x2000000,0x400000)
        u.reg_write(UC_X86_REG_ESP,0x11f0000); u.reg_write(UC_X86_REG_ECX,0x2000000); u.reg_write(UC_X86_REG_EDI,0x2000000)
        u.mem_write(0x11f0004,struct.pack('<II',0x2000000,0x2000000))
        heap=[0x2100000]; strings={}; records=[]; calls={}; animations={}; frames={}
        def alloc(n=256):
            r=heap[0]; heap[0]+=(n+15)&~15; return r
        def dword(p): return struct.unpack('<I',u.mem_read(p,4))[0]
        def wide(p,n=None):
            if n is None:
                b=bytearray()
                for i in range(2048):
                    w=bytes(u.mem_read(p+i*2,2))
                    if w==b'\0\0':break
                    b.extend(w)
                return b.decode('utf-16le','replace')
            return bytes(u.mem_read(p,n*2)).decode('utf-16le','replace')
        def string(p):
            if p in strings:return strings[p]
            try:
                n=dword(p+20); cap=dword(p+24)
                return wide(dword(p+4) if cap>=8 else p+4,n) if n<2048 else '?'
            except Exception:return '?'
        def setstring(p,text):
            strings[p]=text; raw=text.encode('utf-16le')+b'\0\0'
            if len(text)>=8:
                ptr=alloc(len(raw)); u.mem_write(ptr,raw); u.mem_write(p+4,struct.pack('<I',ptr)); cap=max(8,len(text))
            else:u.mem_write(p+4,raw); cap=7
            u.mem_write(p+20,struct.pack('<II',len(text),cap))
        def hook(uc,address,size,user):
            ins=next(cs.disasm(bytes(uc.mem_read(address,size)),address))
            if ins.mnemonic=='ret': uc.emu_stop(); return
            if ins.mnemonic!='call':return
            if not ins.op_str.startswith('0x'):raise RuntimeError('Unexpected indirect call '+ins.op_str)
            target=int(ins.op_str,16); esp=uc.reg_read(UC_X86_REG_ESP); eax=uc.reg_read(UC_X86_REG_EAX)
            ecx=uc.reg_read(UC_X86_REG_ECX); esi=uc.reg_read(UC_X86_REG_ESI); ebx=uc.reg_read(UC_X86_REG_EBX)
            calls[hex(target)]=calls.get(hex(target),0)+1
            pop=cleanup(target); ret=alloc()
            if target==0x401bd0:
                text=wide(eax,dword(esp)); setstring(esi,text); pop=4; ret=esi
            elif target==0x403480:
                # cdecl concatenation: literal + extension, result returned through EDI.
                dest=uc.reg_read(UC_X86_REG_EDI)
                setstring(dest,wide(dword(esp))+string(dword(esp+4))); pop=0; ret=dest
            elif target==0x4018c0:
                begin=dword(esp); count=dword(esp+4)
                setstring(ecx,string(eax)[begin:begin+count]); pop=8; ret=ecx
            elif target==0x401c80:
                setstring(ecx,wide(eax)); pop=0; ret=ecx
            elif target==0x401cc0:
                setstring(ecx,''); pop=0; ret=ecx
            elif target==0x4033f0:
                desc=dword(esp); raw=bytes(uc.mem_read(desc,80)); fields=list(struct.unpack('<20I',raw))
                floats=list(struct.unpack('<20f',raw))
                records.append({'key':string(ebx),'image':string(desc),'type':fields[7], 'fields':fields[8:20], 'floats':floats[8:20], 'site':hex(address)})
                pop=4
            elif target==0x42c7a0:
                key=string(dword(esp)); desc=struct.unpack('<4I',uc.mem_read(ebx,16))
                animations[ret]={'key':key,'fps':desc[1],'loop':bool(desc[2]&255),'frames':[],'site':hex(address)}; pop=4
            elif target==0x42d6a0:
                frames[ret]={'asset':string(ecx),'frame':dword(esp)}; pop=4
            elif target==0x41e390 and label=='enemyAnimations':
                key=string(eax); arr=alloc(256)
                for i in range(64):
                    ptr=alloc(16); frames[ptr]={'asset':key,'frame':i}; uc.mem_write(arr+i*4,struct.pack('<I',ptr))
                uc.mem_write(ret+4,struct.pack('<I',arr)); pop=0
            elif target==0x4594c0 and esi in animations:
                desc=dword(esp); raw=bytes(uc.mem_read(desc,48)); fields=struct.unpack('<12I',raw)
                animations[esi]['frames'].append(dict(frames.get(fields[0],{'asset':'?','frame':0}),duration=fields[9])); pop=4
            elif target==0x41d230:
                key=string(uc.reg_read(UC_X86_REG_EDX));path=string(dword(esp));gain=struct.unpack('<f',uc.mem_read(esp+4,4))[0]
                audio.append({'key':key,'path':path,'gain':gain,'source':hex(address)});pop=8
            uc.reg_write(UC_X86_REG_EAX,ret); uc.reg_write(UC_X86_REG_ESP,esp+pop); uc.reg_write(UC_X86_REG_EIP,address+size)
        u.hook_add(UC_HOOK_CODE,hook)
        try:u.emu_start(start,0,count=2000000)
        except Exception as exc:raise RuntimeError(f'{label} at {u.reg_read(UC_X86_REG_EIP):x}: {exc}') from exc
        if bytes(u.mem_read(u.reg_read(UC_X86_REG_EIP),1)) not in [b'\xc2',b'\xc3']:
            raise RuntimeError(f'{label}: constructor did not reach its return')
        if label!='audio':result[label]=records
        if animations: animation_result[label]=list(animations.values())
        print(label,len(records),'calls',calls)
    (ROOT/'assets/data/audio.json').write_text(json.dumps({'binarySha256':digest,'effects':audio},indent=2),encoding='utf8')
    if a.audio_only:return
    (ROOT/'analysis/atlas-evidence.json').write_text(json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False),encoding='utf8')
    (ROOT/'analysis/animation-evidence.json').write_text(json.dumps(animation_result,indent=2,ensure_ascii=False),encoding='utf8')
    atlas={}
    for group,records in result.items():
        for r in records:
            if r['key']=='MENU' or 'PIXEL' in r['key']:continue
            f=r['floats']; fields=r['fields']; count=fields[6] if r['type']==2 else (fields[4]*fields[5] if r['type']==1 else 1)
            atlas[r['key']]={'image':r['image'],'x':f[0],'y':f[1],'w':f[2],'h':f[3], 'columns':fields[4] if r['type'] in [1,2] else 1,'count':count,'ax':f[8],'ay':f[9],'source':r['site']}
    dest=ROOT/'assets/data'; (dest/'atlas.json').write_text(json.dumps(atlas,indent=2,ensure_ascii=False),encoding='utf8')
    (dest/'animations.json').write_text(json.dumps(animation_result,indent=2,ensure_ascii=False),encoding='utf8')

if __name__=='__main__': main()
