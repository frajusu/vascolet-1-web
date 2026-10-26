import {image,Art,drawSprite,drawAnimation} from './assets.js';
import {VIEW_WIDTH,VIEW_HEIGHT,ROOM_COLUMNS,ROOM_ROWS} from './game.js';
import {Save} from './save.js';
import {uiFrame,nativeText} from './native-ui.js';
export function drawPage(ctx,path){const im=image(path);ctx.fillStyle='#000';ctx.fillRect(0,0,800,600);if(im)ctx.drawImage(im,0,0,im.width===800?800:1200,im.height===600?600:900,0,0,800,600);}
const roomLayers=new WeakMap();
function tiles(ctx,w){
  const m=w.map,c=w.camera,tw=m.tw,th=m.th;
  let cached=roomLayers.get(m);const key=c.x+','+c.y;
  if(cached?.key===key){ctx.drawImage(cached.canvas,0,0,VIEW_WIDTH,VIEW_HEIGHT,0,0,VIEW_WIDTH,VIEW_HEIGHT);return;}
  const buffer=document.createElement('canvas');buffer.width=ROOM_COLUMNS*tw;buffer.height=ROOM_ROWS*th;
  const output=ctx;ctx=buffer.getContext('2d');ctx.imageSmoothingEnabled=false;
  const x0=Math.max(0,Math.floor(c.x/tw)),y0=Math.max(0,Math.floor(c.y/th)),x1=Math.min(m.w-1,Math.floor((c.x+VIEW_WIDTH)/tw)),y1=Math.min(m.h-1,Math.floor((c.y+VIEW_HEIGHT)/th));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const raw=m.layer.data[y*m.w+x]>>>0,gid=raw&0x1fffffff;if(!gid)continue;
    const ts=[...m.tilesets].reverse().find(t=>t.firstgid<=gid),im=image(ts.image);if(!im)continue;
    const id=gid-ts.firstgid,sx=(id%ts.columns)*tw,sy=Math.floor(id/ts.columns)*th,px=x*tw-c.x,py=y*th-c.y;
    if(raw&0xe0000000){ctx.save();ctx.translate(px+tw/2,py+th/2);if(raw&0x20000000)ctx.transform(0,1,1,0,0,0);ctx.scale(raw&0x80000000?-1:1,raw&0x40000000?-1:1);ctx.drawImage(im,sx,sy,tw,th,-tw/2,-th/2,tw,th);ctx.restore();}
    else ctx.drawImage(im,sx,sy,tw,th,px,py,tw,th);
  }
  roomLayers.set(m,{key,canvas:buffer});output.drawImage(buffer,0,0,VIEW_WIDTH,VIEW_HEIGHT,0,0,VIEW_WIDTH,VIEW_HEIGHT);
}
function visible(w,e){return w.inRoom(e)&&e.x+e.w>w.camera.x-250&&e.x<w.camera.x+VIEW_WIDTH+250&&e.y+e.h>w.camera.y-350&&e.y<w.camera.y+VIEW_HEIGHT+350;}
const value=(view,actor,key)=>view?view.value(actor,key):actor[key];
function entity(ctx,w,e,options={},view=null){drawSprite(ctx,e.asset,value(view,e,'x')+e.w/2-w.camera.x,value(view,e,'y')+e.h-w.camera.y,options);}
export function drawHUD(ctx,w){
  ctx.save();ctx.scale(2/3,2/3);
  uiFrame(ctx,'HUD_BACKGROUND',1,0,0);uiFrame(ctx,'HUD_BACKGROUND',1,600,0);
  uiFrame(ctx,'HUD_HERO',0,45,5);nativeText(ctx,String(w.lives).padStart(2,'0'),105,71,{align:'left'});
  nativeText(ctx,'Puntos',270,29);nativeText(ctx,String(w.score).padStart(6,'0'),270,59);
  for(let i=0;i<4;i++)uiFrame(ctx,'HUD_MILK_GLASSES',i<w.counts.VASCOLETS?0:1,405+i*50.985,45);
  for(let i=0;i<4;i++)uiFrame(ctx,'HUD_CEREALS',i<w.counts.CEREALS?0:1,608.94+i*72.765,45);
  for(const [i,key] of ['YELLOW_KEY','RED_KEY','GREEN_KEY','BLUE_KEY'].entries()){uiFrame(ctx,'HUD_KEYS',i,930+i*60,10);nativeText(ctx,String(w.counts[key]),982+i*60,77,{align:'left'});}
  if(w.sign){
    const rows=w.sign.text.split('\n');ctx.fillStyle='#000';ctx.fillRect(0,150,1200,rows.length*30+20);
    rows.forEach((line,i)=>nativeText(ctx,line,600,175+i*30));
  }
  ctx.restore();
}
export function renderWorld(ctx,w,view=null){
  ctx.imageSmoothingEnabled=Save.data.settings.smooth;ctx.fillStyle='#000';ctx.fillRect(0,0,800,600);
  ctx.save();ctx.scale(800/VIEW_WIDTH,600/VIEW_HEIGHT);tiles(ctx,w);
  for(const s of w.signs)if(visible(w,s))drawSprite(ctx,'SIGN',s.x+s.w/2-w.camera.x,s.y+s.h-w.camera.y);
  for(const s of w.saves)if(visible(w,s))drawSprite(ctx,'SAVE',s.x+s.w/2-w.camera.x,s.y+s.h-w.camera.y);
  for(const d of w.doors)if(visible(w,d)){
    const a=Art.atlas[d.asset],im=image(a.image),h=Math.max(0,d.h*(1-value(view,d,'progress')));
    if(h)ctx.drawImage(im,a.x,a.y+a.h-h,a.w,h,d.x+d.w/2-a.ax-w.camera.x,d.y+d.h-h-w.camera.y,a.w,h);
  }
  for(const p of w.platforms)if(visible(w,p))entity(ctx,w,p,{},view);
  for(const i of w.items)if(!w.consumed.has(i.id)&&visible(w,i)){
    const roomTime=view?view.clock('roomTime'):(w.roomTime??w.time),bob=-3.5*(1-Math.cos(roomTime*Math.PI*2/3));entity(ctx,w,{...i,y:i.y+bob});
  }
  for(const e of w.enemies)if(!e.dead&&!e.hidden&&visible(w,e)){
    const key=e.type==='Piranha'?e.asset+(e.vy<0?'_UP':'_DOWN'):(e.props.pAnim??e.asset);
    if(Art.anims[key])drawAnimation(ctx,key,value(view,e,'age'),value(view,e,'x')+e.w/2-w.camera.x,value(view,e,'y')+e.h-w.camera.y,{flip:e.look<0});else entity(ctx,w,e,{flip:e.look<0},view);
  }
  for(const shot of w.shots)if(visible(w,shot))entity(ctx,w,shot,{flip:shot.vx<0},view);
  const b=w.player,prefix=w.level===0?'D_':w.level===4?'P_':'';
  if(!w.death&&!w.exit){
    if(b.animation)drawAnimation(ctx,b.animation,value(view,b,'animTime'),value(view,b,'x')+b.w/2-w.camera.x,value(view,b,'y')+b.h-w.camera.y,{flip:b.face<0});
    else drawSprite(ctx,prefix+'VASCOLET',value(view,b,'x')+b.w/2-w.camera.x,value(view,b,'y')+b.h-w.camera.y,{flip:b.face<0});
  }else if(w.death){
    drawSprite(ctx,prefix+'VASCOLET_DEAD',value(view,w.death,'x')+b.w/2-w.camera.x,value(view,w.death,'y')+b.h-w.camera.y);
  }
  if(w.exit&&w.exit.time<1)drawAnimation(ctx,'POWER',value(view,w.exit,'time'),w.exit.x-w.camera.x,w.exit.y-w.camera.y);
  for(const e of w.effects)drawAnimation(ctx,e.asset,value(view,e,'age'),value(view,e,'x')-w.camera.x,value(view,e,'y')-w.camera.y);
  ctx.restore();drawHUD(ctx,w);
}
