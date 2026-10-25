import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { parseTMX,originalText,HARD,PLATFORM,HAZARD } from '../js/tmx.js';
import { PHYSICS,SKIN,nativeMotion,moveBody,flagsAt,hazardous } from '../js/physics.js';
import { sanitizeSave } from '../js/save.js';
import { World,ERAS,ROOM_COLUMNS,ROOM_ROWS } from '../js/game.js';
const root=new URL('../',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const parse=xml=>parseTMX(new JSDOM(xml,{contentType:'application/xml'}).window.document);

test('all five complete original maps, flags and entity assets are usable',async()=>{
  const atlas=await json('assets/data/atlas.json');const expected={prehistory:[576,96],egypt:[240,204],pirates:[256,204],castle:[224,204],future:[256,204]};
  for(const [name,[w,h]] of Object.entries(expected)){
    const m=parse(await readFile(new URL(`assets/data/${name}.tmx`,root),'utf8'));
    assert.equal(m.w,w);assert.equal(m.h,h);assert.equal(m.layer.data.length,w*h);assert.ok(m.flags.some(f=>f&HARD));assert.ok(m.flags.some(f=>f&HAZARD));assert.notEqual(m.layer.name,'REF');
    assert.ok(m.objects.some(o=>o.type==='Vascolet'));assert.equal(m.objects.filter(o=>o.props.pAsset==='MICROWAVE').length,1);
    assert.equal(m.objects.filter(o=>o.props.pAsset==='CEREALS').length,4);assert.equal(m.objects.filter(o=>o.props.pAsset==='VASCOLETS').length,4);
    for(const o of m.objects){if(o.type==='Vascolet')continue;if(o.props.pAsset)assert.ok(atlas[o.props.pAsset],`${name}: missing ${o.props.pAsset}`);if(o.props.pBulletAsset)assert.ok(atlas[o.props.pBulletAsset]);}
    if(name==='prehistory'){assert.equal(m.tilesets[0].flags[11],HARD);assert.equal(m.tilesets[0].flags[12],PLATFORM);}
  }
});
test('imported assets are byte-identical to the original inventory',async()=>{
  for(const file of await json('analysis/inventory.json')){
    const data=await readFile(new URL(file.path,root));assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.path);
  }
});
test('recovered rectangles, grids, pivots and all animation frames fit original textures',async()=>{
  const atlas=await json('assets/data/atlas.json'),anims=await json('assets/data/animations.json'),inventory=await json('analysis/inventory.json');
  const sizes=new Map(inventory.map(f=>[f.path,f.size]));assert.ok(Object.keys(atlas).length>95);
  for(const [name,a] of Object.entries(atlas)){
    const [w,h]=sizes.get(a.image)??[];assert.ok(w&&h,name);assert.ok(a.w>0&&a.h>0&&a.count>0&&a.columns>0,name);
    const cols=Math.min(a.columns,a.count),rows=Math.ceil(a.count/a.columns);
    assert.ok(a.x+cols*a.w<=w,`${name}: horizontal overflow`);assert.ok(a.y+rows*a.h<=h,`${name}: vertical overflow`);
  }
  let count=0;for(const group of Object.values(anims))for(const a of group){assert.ok(a.fps>0);assert.ok(a.frames.length);for(const f of a.frames){assert.ok(atlas[f.asset],`${a.key}: unknown ${f.asset}`);assert.ok(f.frame>=0&&f.frame<atlas[f.asset].count,`${a.key} frame ${f.frame}`);assert.ok(f.duration>0);count++;}}
  assert.ok(count>250);
});
test('player constants and room layout match the binary evidence',async()=>{
  const c=await json('analysis/native-constants.json');for(const k of ['speed','gravity','maxSpeed','climb','width','height'])assert.equal(PHYSICS[k],c[k].value,k);
  assert.deepEqual(PHYSICS.jumps,c.jumps.values);assert.deepEqual(PHYSICS.doubleJumps,c.doubleJumps.values);assert.equal(ROOM_COLUMNS,c.roomColumns.value);assert.equal(ROOM_ROWS,c.roomRows.value);
});
function fixture(){const m={w:30,h:20,tw:76,th:76,flags:new Uint8Array(600)};for(let x=0;x<30;x++)m.flags[10*30+x]=HARD;return m;}
test('gravity, stable grounding, jumping, ceiling and high-speed collision',()=>{
  const m=fixture(),b={x:100,y:400,w:50,h:90,vx:0,vy:0};for(let i=0;i<120;i++){b.vy+=PHYSICS.gravity/60;moveBody(m,b,1/60);}assert.equal(b.y,670-SKIN);assert.ok(b.grounded);
  b.vy=-PHYSICS.jumps[0];let highest=b.y;for(let i=0;i<60;i++){b.vy+=PHYSICS.gravity/60;moveBody(m,b,1/60);highest=Math.min(highest,b.y);}assert.ok(highest<580&&highest>550);assert.equal(b.y,670-SKIN);
  m.flags[5*30+3]=HARD;b.x=300;b.y=500;b.vx=-3000;b.vy=0;moveBody(m,b,.1);assert.ok(b.x>=0);
  b.x=3*76+10;b.y=500;b.vx=0;b.vy=-1500;moveBody(m,b,.1);assert.equal(b.y,6*76);assert.ok(b.hitCeiling);
});
test('one-way platforms, dropping through, solid doors and hazard detection',()=>{
  const m=fixture();m.flags[8*30+2]=PLATFORM;const b={x:160,y:500,w:50,h:90,vx:0,vy:400};moveBody(m,b,.1);assert.equal(b.y,518-SKIN);assert.ok(b.grounded);
  b.vy=200;moveBody(m,b,.1,{drop:true});assert.ok(b.y>518-SKIN);
  const door={x:300,y:0,w:76,h:760,open:false};b.x=240;b.y=400;b.vx=500;b.vy=0;moveBody(m,b,.1,{doors:[door]});assert.equal(b.x,250);
  door.open=true;b.vx=500;moveBody(m,b,.1,{doors:[door]});assert.equal(b.x,300);
  m.flags[5*30+4]=HAZARD;assert.ok(hazardous(m,b));assert.equal(flagsAt(m,-1,-1),0);
});
test('observed object geometry corresponds to every original placed object',async()=>{
  const native=await json('assets/data/native-objects.json');let count=0;
  assert.deepEqual(ERAS.map(e=>e.id),['prehistory','egypt','castle','pirates','future']);
  for(const era of ERAS){const m=parse(await readFile(new URL(`assets/data/${era.id}.tmx`,root),'utf8'));assert.equal(native[era.id].length,m.objects.filter(o=>o.type!=='Vascolet').length);for(const o of native[era.id]){assert.equal(o.type,m.objects[o.id].type);assert.ok([o.x,o.y,o.w,o.h,...o.room].every(Number.isFinite));assert.ok(o.w>0&&o.h>0);count++;}}
  assert.equal(count,1674);
});
test('native analytical integration, vector speed limit and viewport seams',()=>{
  let b={vx:0,vy:-600},y=0;for(let i=0;i<20;i++){const motion=nativeMotion(b,1/60);y+=motion.moveVY/60;b.vx=motion.vx;b.vy=motion.vy;}assert.ok(Math.abs(y+100)<1e-9);assert.equal(b.vy,0);
  const fast=nativeMotion({vx:1400,vy:1400},1/60);assert.ok(Math.hypot(fast.vx,fast.vy)<=1500.00001);
  const w=new World();w.map={w:32,h:24,tw:76,th:76};w.player={x:1201-25,y:100,w:50,h:90};w.camera={x:0,y:0};w.roomKey='0,0';w.updateCamera(1/60);assert.equal(w.camera.x,1216);assert.equal(w.player.x+w.player.w/2-w.camera.x,1);
});
test('observed UI atlases, original font and raster selector states are intact',async()=>{
  const ui=await json('assets/data/ui-atlas.json'),font=await json('assets/data/font.json'),skins=await json('assets/data/native-skins.json');assert.equal(ui.MENU_BUTTON.length,4);assert.equal(ui.OPTIONS.length,6);assert.equal(Object.keys(font.glyphs).length,137);assert.equal(font.glyphs.J.advance,12);assert.equal(skins.states.length,9);
  for(const s of skins.states)assert.equal(createHash('sha256').update(await readFile(new URL(s.path,root))).digest('hex'),s.sha256);
});
test('original Spanish escapes and corrupt save data are handled',()=>{
  assert.equal(originalText('\\!Energ\\ia!\\nBa\\mo'), '¡Energía!\nBaño');
  assert.equal(sanitizeSave({version:1,run:{level:0,lives:10,score:10,checkpoint:{x:NaN,y:0}}}).run,null);
  const s=sanitizeSave({version:1,completed:[1,1,7,-1],lastLevel:99,settings:{volume:3,smooth:false}});assert.deepEqual(s.completed,[1]);assert.equal(s.lastLevel,0);assert.equal(s.settings.volume,1);assert.equal(s.settings.smooth,false);
});
