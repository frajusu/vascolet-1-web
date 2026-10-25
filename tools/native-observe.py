"""Observe the real Vascolet 1 renderer on an unselected Windows desktop.

Reuses the IO-only laboratory from Vascolet 4 read-only. The adapter is compiled
into TEMP and all game files there are copies. No host input or desktop switch.
"""
from pathlib import Path
import argparse, base64, ctypes, hashlib, importlib.util, json, os, shutil, struct, subprocess, time
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
TEMP=Path(os.environ['LOCALAPPDATA'])/'Temp/opencode/vascolet1-native-reference'
REFERENCE=ROOT.parent/'vascolet-web/tools/native-isolated'

def build():
    assert TEMP.parent.is_dir()
    source=ROOT.parent/'Vascolet1'; assert (source/'Vascolet.exe').is_file()
    TEMP.mkdir(exist_ok=True)
    shutil.copytree(source/'assets',TEMP/'assets',dirs_exist_ok=True)
    shutil.copy2(source/'Vascolet.exe',TEMP/'Vascolet.exe')
    for dll in source.glob('*.dll'):shutil.copy2(dll,TEMP/dll.name)
    if not (TEMP/'OpenAL32.dll').exists():shutil.copy2(ROOT.parent/'Vascolet/OpenAL32.dll',TEMP/'OpenAL32.dll')
    adapter=(REFERENCE/'adapter.cpp').read_text().replace('BYTE frame[4 * 1024 * 1024]','BYTE frame[16 * 1024 * 1024]')
    # Vascolet 1 loops until ShowCursor(FALSE) returns negative. Preserve that
    # contract privately; returning zero would spin forever when gameplay starts.
    adapter=adapter.replace('static int WINAPI showCursor(BOOL) { return 0; }','static int WINAPI showCursor(BOOL visible) { return visible ? 0 : -1; }')
    marker='    if (channel) {\n        ++channel->presents;'
    assert adapter.count(marker)==1
    adapter=adapter.replace(marker,'''    if (channel && window) {
        struct Fixture { volatile LONG command; volatile LONG status; float column, row, x, y; };
        auto* fixture = (Fixture*)(channel->frame + sizeof(channel->frame) - 64);
        if (fixture->command == 3 || fixture->command == 4) {
            BYTE enabled = fixture->command == 3 ? 1 : 0;
            fixture->command = 0;
            DWORD config = *(DWORD*)((DWORD)GetModuleHandleW(nullptr) + 0x11012c);
            if (config) { *(BYTE*)(config + 7) = enabled; fixture->status = 1; }
            else fixture->status = -1;
        }
        if (fixture->command == 2) {
            fixture->command = 0;
            DWORD base = (DWORD)GetModuleHandleW(nullptr);
            DWORD progress = *(DWORD*)(base + 0x1105b0);
            if (progress) { *(DWORD*)(progress + 0x24) = (DWORD)fixture->column; fixture->status = 1; }
            else fixture->status = -1;
        }
        if (fixture->command == 1) {
            fixture->command = 0;
            DWORD base = (DWORD)GetModuleHandleW(nullptr);
            DWORD hero = *(DWORD*)(base + 0x110580), stage = *(DWORD*)(base + 0x1105a4);
            if (hero && stage) {
                *(float*)(stage + 0x1c) = fixture->column;
                *(float*)(stage + 0x20) = fixture->row;
                using Room = void (__cdecl*)(void*, float, float);
                ((Room)(base + 0x20230))(*(void**)(hero + 0x270), fixture->column, fixture->row);
                float x = fixture->x, y = fixture->y;
                DWORD position = base + 0x32e40;
                __asm {
                    push y
                    push x
                    mov eax, hero
                    call position
                }
                *(float*)(hero + 0x24c) = 0;
                *(float*)(hero + 0x250) = 0;
                *(DWORD*)(hero + 0x240) = 2;
                fixture->status = 1;
            } else fixture->status = -1;
        }
        // Dispatch only on the game's own private desktop/thread. Cross-desktop
        // PostMessage is rejected by Windows and does not drive this WinMouse.
        static BYTE previousButton = 0;
        BYTE current = channel->buttons[0];
        if (current != previousButton) {
            LPARAM xy = MAKELPARAM(channel->mouseX, channel->mouseY);
            SendMessageW(window, WM_MOUSEMOVE, current ? MK_LBUTTON : 0, xy);
            SendMessageW(window, current ? WM_LBUTTONDOWN : WM_LBUTTONUP, current ? MK_LBUTTON : 0, xy);
            previousButton = current;
        }
    }
    if (channel) {
        ++channel->presents;''')
    (TEMP/'adapter.cpp').write_text(adapter)
    shutil.copy2(REFERENCE/'adapter.def',TEMP/'adapter.def')
    vc=Path(r'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat')
    assert vc.is_file()
    cmd=f'call "{vc}" x86 && cl /nologo /LD /MT /O2 /EHsc /std:c++17 "{TEMP / "adapter.cpp"}" /Fo"{TEMP / "adapter.obj"}" /link /DEF:"{TEMP / "adapter.def"}" /OUT:"{TEMP / "dinput8.dll"}" /IMPLIB:"{TEMP / "adapter.lib"}" user32.lib dxguid.lib'
    subprocess.run(cmd,shell=True,cwd=TEMP,check=True)

def runner_module():
    spec=importlib.util.spec_from_file_location('vascolet_reference_runner',REFERENCE/'runner.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.SIZE=320+16*1024*1024
    return module

def image_base(pid):
    from ctypes import wintypes as W
    class Module(ctypes.Structure):
        _fields_=[('size',W.DWORD),('moduleID',W.DWORD),('pid',W.DWORD),('globalUsage',W.DWORD),('processUsage',W.DWORD),('base',ctypes.c_void_p),('bytes',W.DWORD),('handle',W.HMODULE),('name',W.WCHAR*256),('path',W.WCHAR*260)]
    k=ctypes.WinDLL('kernel32',use_last_error=True)
    k.CreateToolhelp32Snapshot.argtypes=[W.DWORD,W.DWORD];k.CreateToolhelp32Snapshot.restype=W.HANDLE
    k.Module32FirstW.argtypes=[W.HANDLE,ctypes.POINTER(Module)];k.Module32NextW.argtypes=k.Module32FirstW.argtypes;k.CloseHandle.argtypes=[W.HANDLE]
    handle=k.CreateToolhelp32Snapshot(0x18,pid);entry=Module();entry.size=ctypes.sizeof(entry)
    try:
        ok=k.Module32FirstW(handle,ctypes.byref(entry))
        while ok:
            if entry.name.lower()=='vascolet.exe':return entry.base
            ok=k.Module32NextW(handle,ctypes.byref(entry))
        raise RuntimeError('Game module base not found')
    finally:k.CloseHandle(handle)

def private_windows(r,module):
    from ctypes import wintypes as W
    callback_type=ctypes.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
    module.U.EnumDesktopWindows.argtypes=[W.HANDLE,callback_type,W.LPARAM]
    module.U.EnumChildWindows.argtypes=[W.HWND,callback_type,W.LPARAM]
    module.U.GetWindowTextW.argtypes=[W.HWND,W.LPWSTR,ctypes.c_int]
    module.U.GetClassNameW.argtypes=[W.HWND,W.LPWSTR,ctypes.c_int]
    rows=[]
    def read(hwnd,param):
        text=ctypes.create_unicode_buffer(4096);cls=ctypes.create_unicode_buffer(256)
        module.U.GetWindowTextW(hwnd,text,4096);module.U.GetClassNameW(hwnd,cls,256)
        rows.append({'hwnd':int(hwnd),'class':cls.value,'text':text.value});return True
    @callback_type
    def top(hwnd,param):
        read(hwnd,param);module.U.EnumChildWindows(hwnd,callback_type(read),0);return True
    module.U.EnumDesktopWindows(r.desktop,top,0)
    return rows

def metrics(r):
    from ctypes import wintypes as W
    k=ctypes.WinDLL('kernel32');k.GetProcessTimes.argtypes=[W.HANDLE,*([ctypes.c_void_p]*4)]
    values=[ctypes.c_uint64() for _ in range(4)];k.GetProcessTimes(r.process.handle,*[ctypes.byref(v) for v in values])
    class Memory(ctypes.Structure):
        _fields_=[('cb',W.DWORD),('faults',W.DWORD)]+[(name,ctypes.c_size_t) for name in ['peakWorking','working','peakPaged','paged','peakNonpaged','nonpaged','pagefile','peakPagefile','private']]
    ps=ctypes.WinDLL('psapi');ps.GetProcessMemoryInfo.argtypes=[W.HANDLE,ctypes.c_void_p,W.DWORD]
    m=Memory();m.cb=ctypes.sizeof(m);ps.GetProcessMemoryInfo(r.process.handle,ctypes.byref(m),m.cb)
    return {'cpuSeconds':(values[2].value+values[3].value)/1e7,'workingMB':m.working/1048576,'privateMB':m.private/1048576,'presents':r.presents}

def catalog(r,address):
    def u32(p):return struct.unpack('<I',r.read_memory(p,4))[0]
    obj=u32(address);head=u32(obj+28);result={};seen=set()
    def visit(node):
        if not node or node==head or node in seen:return
        seen.add(node);assert len(seen)<2000
        visit(u32(node));n=u32(node+32);cap=u32(node+36)
        if n<1024:
            key=r.read_memory(u32(node+16) if cap>=8 else node+16,n*2).decode('utf-16le')
            value=u32(node+40);count=u32(value);arr=u32(value+4);frames=[]
            if count<500:
                for i in range(count):
                    f=u32(arr+i*4);raw=r.read_memory(f,32);ints=struct.unpack('<8I',raw);floats=struct.unpack('<8f',raw)
                    texture=ints[0];length=u32(texture+24);cap=u32(texture+28)
                    image=r.read_memory(u32(texture+8) if cap>=8 else texture+8,length*2).decode('utf-16le') if length<1024 else '?'
                    frames.append({'image':image,'texture':hex(texture),'ints':list(ints),'values':list(floats[2:]),'textureBytes':r.read_memory(texture,160).hex()})
            result[key]=frames
        visit(u32(node+8))
    visit(u32(head+4));return result

def actors(r,base):
    def u32(p):return struct.unpack('<I',r.read_memory(p,4))[0]
    hero=u32(base+0x110580);scene=u32(hero+0x270);head=u32(scene+0x174);node=u32(head);rows=[]
    while node!=head and len(rows)<2000:
        obj=u32(node+8);raw=r.read_memory(obj,0x350)
        key='';length=struct.unpack_from('<I',raw,0x340)[0];cap=struct.unpack_from('<I',raw,0x344)[0]
        if length<200:
            try:key=r.read_memory(u32(obj+0x330) if cap>=8 else obj+0x330,length*2).decode('utf-16le')
            except Exception:pass
        rows.append({'address':hex(obj),'vtable':hex(u32(obj)-base+0x400000),'key':key,'display':list(struct.unpack_from('<2f',raw,0x164)),'box':list(struct.unpack_from('<4f',raw,0x230)),'baseBox':list(struct.unpack_from('<2f',raw,0x254)),'room':list(struct.unpack_from('<2f',raw,0x260)),'active':raw[0x25c]})
        node=u32(node)
    return rows

def hud(r,base):
    obj=struct.unpack('<I',r.read_memory(base+0x110134,4))[0];rows={}
    offsets={'overlayA':0x86*4,'overlayB':0xb2*4,'backgroundA':0x1d6*4,'backgroundB':0x202*4,'hero':0x22e*4}
    for group,start in [('milk',0x25e*4),('cereals',0x30e*4),('keys',0x3be*4)]:
        for i in range(4):offsets[group+str(i)]=start+i*0xb0
    for key,offset in offsets.items():
        raw=r.read_memory(obj+offset,0xb0)
        rows[key]={'position':list(struct.unpack_from('<2f',raw,4)),'floats':list(struct.unpack('<44f',raw)),'source':list(struct.unpack_from('<6f',raw,0x8c))}
    return rows

def survey_rooms(r,base,place,name,out):
    root=ET.parse(TEMP/f'assets/data/{name}.tmx').getroot();width=int(root.get('width'));height=int(root.get('height'))
    layer=next(l for l in root.findall('layer') if l.get('name')!='REF');raw=base64.b64decode(layer.find('data').text);gids=struct.unpack('<'+'I'*(len(raw)//4),raw);fill=gids[0]
    flags={}
    for t in root.findall('./tileset/tile'):
        p={x.get('name') for x in t.findall('./properties/property')};f=0
        for key,bit in [('pHard',1),('pLadder',8),('pLadderEnd',16),('pPlatform',2),('pKilling',4)]:
            if key in p:f=bit
        flags[int(t.get('id'))+1]=f
    placed=[o for o in root.findall('./objectgroup/object') if o.get('type')!='Vascolet'];live=actors(r,base);assert len(placed)==len(live)
    obstructions=[]
    for o,a in zip(placed,live):
        if o.get('type') in ['Item','Information','Door','SavePoint']:obstructions.append(a)
    place({'command':3,'column':0,'row':0});rooms=out/'rooms';rooms.mkdir(exist_ok=True);records=[]
    for cy in range(height//12):
        for cx in range(width//16):
            cells=[gids[(cy*12+y)*width+cx*16+x] for y in range(12) for x in range(16)]
            if not any(g not in [fill,0] for g in cells):continue
            candidates=[]
            for ty in range(2,11):
                for tx in range(1,15):
                    if flags.get(cells[ty*16+tx],0)&5 or flags.get(cells[(ty-1)*16+tx],0)&5:continue
                    if not flags.get(cells[(ty+1)*16+tx],0)&(1|2|16):continue
                    x,y=tx*76+38,ty*76+75;box=(x-25,y-90,50,90)
                    if any(a['room']==[float(cx),float(cy)] and box[0]<a['baseBox'][0]+a['box'][2] and box[0]+50>a['baseBox'][0] and box[1]<a['baseBox'][1]+a['box'][3] and box[1]+90>a['baseBox'][1] for a in obstructions):continue
                    candidates.append(((x-600)**2+(y-450)**2,x,y))
            _,x,y=min(candidates) if candidates else (0,600,450)
            place({'column':cx,'row':cy,'x':x,'y':y,'after':.035})
            im=r.capture(timeout=10);file=f'{cx:02d}-{cy:02d}.jpg';im.save(rooms/file,quality=88)
            stage=struct.unpack('<I',r.read_memory(base+0x1105a4,4))[0];actual=list(struct.unpack('<2f',r.read_memory(stage+0x1c,8)))
            records.append({'column':cx,'row':cy,'fixture':{'x':x,'y':y},'actualRoom':actual,'sameRoom':actual==[float(cx),float(cy)],'file':'rooms/'+file})
    (out/'scenes.json').write_text(json.dumps({'level':name,'fixture':'Original room activation and placement; no-damage flag enabled in temporary process only.','rooms':records},indent=2))
    return {'rooms':len(records),'sameRoom':sum(a['sameRoom'] for a in records)}

def observe(plan,out):
    out.mkdir(parents=True,exist_ok=True)
    module=runner_module();report={'binarySha256':hashlib.sha256((TEMP/'Vascolet.exe').read_bytes()).hexdigest(),'actions':[]}
    try:
        with module.NativeRunner(TEMP/'Vascolet.exe') as r:
            report['desktopBefore']=r.input_desktop_before
            base=image_base(r.pid);report['imageBase']=hex(base)
            def va(address):
                address=int(address,0) if isinstance(address,str) else address
                return address+base-0x400000 if 0x400000<=address<0x540000 else address
            def place(action):
                command=320+16*1024*1024-64
                struct.pack_into('<iiffff',r.channel,command,0,0,float(action['column']),float(action['row']),float(action.get('x',600)),float(action.get('y',450)))
                struct.pack_into('<i',r.channel,command,action.get('command',1))
                deadline=time.perf_counter()+15
                while struct.unpack_from('<i',r.channel,command+4)[0]==0:
                    r.check_alive()
                    if time.perf_counter()>deadline:raise TimeoutError('Native room fixture did not finish')
                    time.sleep(.01)
                time.sleep(action.get('after',.1))
                return struct.unpack_from('<i',r.channel,command+4)[0]
            for index,action in enumerate(plan):
                kind=action['action'];entry=dict(action)
                if kind=='wait':time.sleep(action.get('seconds',1))
                elif kind=='metrics':entry.update(metrics(r))
                elif kind=='room':
                    entry['fixture']=True;entry['status']=place(action)
                elif kind=='collectExit':
                    target=next(a for a in actors(r,base) if a['key']=='MICROWAVE')
                    x,y=target['baseBox'];w,h=target['box'][2:]
                    fixture={'column':target['room'][0],'row':target['room'][1],'x':x+w/2,'y':y+h,'after':action.get('after',1)}
                    entry['fixture']=fixture;entry['status']=place(fixture)
                elif kind=='unlock':
                    entry['fixture']=True;entry['status']=place({'command':2,'column':action.get('levels',5),'row':0})
                elif kind=='normalDamage':entry['status']=place({'command':4,'column':0,'row':0});entry['fixture']=True
                elif kind=='press':r.press(action['key'],action.get('seconds',.12),action.get('after',.3))
                elif kind=='hold':r.keys(action['keys']);time.sleep(action['seconds']);r.keys([])
                elif kind=='mouse':
                    x,y=action['x'],action['y']
                    struct.pack_into('<ii',r.channel,296,x,y)
                    down=action.get('down',False);r.channel[308]=0x80 if down else 0
                    time.sleep(action.get('after',.2))
                elif kind=='click':
                    x,y=action['x'],action['y'];xy=(y<<16)|(x&0xffff)
                    struct.pack_into('<ii',r.channel,296,x,y)
                    r.channel[308]=0x80
                    time.sleep(.15);r.channel[308]=0
                    time.sleep(action.get('after',.5))
                elif kind=='capture':
                    try:image=r.capture(timeout=action.get('timeout',15))
                    except Exception:
                        report['windows']=private_windows(r,module);report['metrics']=metrics(r);raise
                    name=action.get('name',f'{index:03d}');image.save(out/(name+'.png'));entry['size']=image.size;entry['presents']=r.presents
                elif kind=='memory':entry['hex']=r.read_memory(va(action['address']),action['size']).hex()
                elif kind=='pointer':
                    address=struct.unpack('<I',r.read_memory(va(action['address']),4))[0]
                    entry['pointer']=hex(address);entry['hex']=r.read_memory(address+action.get('offset',0),action['size']).hex()
                elif kind=='catalog':
                    data=catalog(r,va(action['address']));name=action.get('name','catalog');(out/(name+'.json')).write_text(json.dumps(data,indent=2));entry['entries']=len(data)
                elif kind=='actors':
                    data=actors(r,base);name=action.get('name','actors');(out/(name+'.json')).write_text(json.dumps(data,indent=2));entry['entries']=len(data)
                elif kind=='hud':
                    data=hud(r,base);(out/'hud.json').write_text(json.dumps(data,indent=2));entry['entries']=len(data)
                elif kind=='survey':entry.update(survey_rooms(r,base,place,action['level'],out));entry['fixture']=True
                elif kind=='advanceIntros':
                    pages=[]
                    for p in (TEMP/'assets/lang/images/intros').glob('intro*.jpg'):
                        pages.append((p.name,np.asarray(Image.open(p).convert('RGB').crop((0,0,1200,900)).resize((800,600),Image.Resampling.BILINEAR),dtype=np.float32)))
                    seen=[]
                    for _ in range(10):
                        frame=np.asarray(r.capture(),dtype=np.float32)
                        score,name=min((float(np.abs(frame-data).mean()),name) for name,data in pages)
                        if score>12:break
                        seen.append({'page':name,'meanError':score});r.press(28,.12,.8)
                    entry['pages']=seen
                else:raise ValueError(kind)
                report['actions'].append(entry)
            report['presents']=r.presents;report['hwnd']=r.hwnd
        report['desktopAfter']=module.input_desktop_name();assert report['desktopAfter']==report['desktopBefore'];report['ok']=True
    finally:
        (out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--build',action='store_true');p.add_argument('--plan',type=Path);p.add_argument('--output',type=Path,default=ROOT/'analysis/native-reference/boot');args=p.parse_args()
    if args.build:build()
    if args.plan:observe(json.loads(args.plan.read_text()),args.output)
