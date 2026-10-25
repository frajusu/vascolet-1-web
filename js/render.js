import { image,Art,drawSprite,drawAnimation } from './assets.js';
import { ERAS,ROOM_COLUMNS,ROOM_ROWS } from './game.js';
import { Save } from './save.js';
import { clamp } from './physics.js';
const WIDTH=800,HEIGHT=600;
function rounded(ctx,x,y,w,h,r=10){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function text(ctx,s,x,y,{size=18,color='#fff4d6',align='left',weight='bold'}={}){ctx.font=`${weight} ${size}px "Trebuchet MS",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(s,x,y);}
function lines(ctx,string,maxWidth){
  const result=[];for(const paragraph of string.split('\n')){let line='';for(const word of paragraph.split(' ')){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){result.push(line);line=word;}else line=next;}result.push(line);}return result;
}
export function drawPage(ctx,path){
  const im=image(path);ctx.fillStyle='#b30e1d';ctx.fillRect(0,0,WIDTH,HEIGHT);if(!im)return;
  // Shipped JPGs contain a 1172×879 4:3 image padded to a power-of-two texture.
  ctx.drawImage(im,0,0,1172,879,0,0,WIDTH,HEIGHT);
}
function tiles(ctx,world){
  const m=world.map,c=world.camera,tw=m.tw,th=m.th;
  const x0=Math.max(0,Math.floor(c.x/tw)),y0=Math.max(0,Math.floor(c.y/th)),x1=Math.min(m.w-1,Math.ceil((c.x+ROOM_COLUMNS*tw)/tw)),y1=Math.min(m.h-1,Math.ceil((c.y+ROOM_ROWS*th)/th));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const raw=m.layer.data[y*m.w+x]>>>0,gid=raw&0x1fffffff;if(!gid)continue;
    const ts=[...m.tilesets].reverse().find(t=>t.firstgid<=gid),im=image(ts.image);if(!im)continue;
    const id=gid-ts.firstgid,sx=(id%ts.columns)*tw,sy=Math.floor(id/ts.columns)*th;
    const px=Math.round(x*tw-c.x),py=Math.round(y*th-c.y);
    if(raw&0xe0000000){ctx.save();ctx.translate(px+tw/2,py+th/2);if(raw&0x20000000)ctx.transform(0,1,1,0,0,0);ctx.scale(raw&0x80000000?-1:1,raw&0x40000000?-1:1);ctx.drawImage(im,sx,sy,tw,th,-tw/2,-th/2,tw,th);ctx.restore();}
    else ctx.drawImage(im,sx,sy,tw,th,px,py,tw,th);
  }
}
function visible(w,e){return e.x+e.w>w.camera.x-250&&e.x<w.camera.x+ROOM_COLUMNS*w.map.tw+250&&e.y+e.h>w.camera.y-350&&e.y<w.camera.y+ROOM_ROWS*w.map.th+350;}
function entity(ctx,w,e,options={}){drawSprite(ctx,e.asset,e.x+e.w/2-w.camera.x,e.y+e.h-w.camera.y,options);}
function hud(ctx,w){
  ctx.fillStyle='#291210e8';rounded(ctx,12,12,644,58,8);ctx.strokeStyle='#ffe08a66';ctx.strokeRect(22,69,624,1);
  text(ctx,'VASCOLET',26,30,{size:12,color:'#ffe08a'});text(ctx,ERAS[w.level].name.toUpperCase(),26,51,{size:16});
  drawSprite(ctx,'LIVES',185,61,{scale:.42});text(ctx,String(w.lives),205,42,{size:23});
  drawSprite(ctx,'COIN',264,61,{scale:.42});text(ctx,String(w.score).padStart(6,'0'),286,42,{size:20,color:'#ffe08a'});
  drawSprite(ctx,'VASCOLETS',416,61,{scale:.42});text(ctx,w.counts.VASCOLETS+'/4',436,42,{size:18});
  drawSprite(ctx,'CEREALS',513,61,{scale:.42});text(ctx,w.counts.CEREALS+'/4',533,42,{size:18});
  let x=30;for(const key of ['YELLOW_KEY','RED_KEY','GREEN_KEY','BLUE_KEY'])if(w.counts[key]){drawSprite(ctx,key,x,110,{scale:.4});text(ctx,String(w.counts[key]),x+17,92,{size:13});x+=60;}
  if(w.sign){
    ctx.font='bold 18px "Trebuchet MS",sans-serif';const rows=lines(ctx,w.sign.text,650),h=rows.length*25+24;
    const y=Object.keys(w.counts).some(k=>k.endsWith('KEY')&&w.counts[k])?130:90;
    ctx.fillStyle='#fff4d6f5';rounded(ctx,50,y,700,h);rows.forEach((line,i)=>text(ctx,line,400,y+24+i*25,{size:18,color:'#4c241a',align:'center'}));
  }else if(w.tipTime>0){
    ctx.fillStyle='#291210db';rounded(ctx,50,128,700,38,7);text(ctx,w.tip,400,147,{size:15,align:'center',color:'#ffe08a'});
  }
  if(w.death){ctx.fillStyle=`rgba(65,0,0,${clamp(w.death.time*.7,0,.6)})`;ctx.fillRect(0,0,WIDTH,HEIGHT);text(ctx,w.lives>0?'¡Otra oportunidad!':'¡Perdiste!',400,260,{size:46,align:'center',color:'#ffe08a'});text(ctx,w.lives>0?'Volviendo al punto de salvado…':'La máquina te espera para otro viaje.',400,310,{size:20,align:'center'});}
}
export function renderWorld(ctx,w){
  ctx.imageSmoothingEnabled=Save.data.settings.smooth;ctx.fillStyle='#65bde4';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.save();ctx.scale(WIDTH/(ROOM_COLUMNS*w.map.tw),HEIGHT/(ROOM_ROWS*w.map.th));tiles(ctx,w);
  for(const s of w.signs)if(visible(w,s))drawSprite(ctx,'SIGN',s.x+s.w/2-w.camera.x,s.y+s.h-w.camera.y,{scale:.6});
  for(const s of w.saves)if(visible(w,s)){drawSprite(ctx,'SAVE',s.x+s.w/2-w.camera.x,s.y+s.h-w.camera.y,{scale:.6,alpha:s.active?1:.85});if(s.active){ctx.fillStyle='#ffe08a';ctx.beginPath();ctx.arc(s.x+s.w/2-w.camera.x,s.y-25-w.camera.y,5,0,Math.PI*2);ctx.fill();}}
  for(const d of w.doors)if(visible(w,d)){
    const a=Art.atlas[d.asset],im=image(a.image);ctx.save();ctx.beginPath();ctx.rect(d.x-w.camera.x,d.y-w.camera.y,d.w,d.h);ctx.clip();ctx.drawImage(im,a.x,a.y,a.w,a.h,d.x-w.camera.x,d.y-d.h*d.progress-w.camera.y,d.w,d.h);ctx.restore();
  }
  for(const p of w.platforms)if(visible(w,p)){const a=Art.atlas[p.asset],im=image(a.image);ctx.drawImage(im,a.x,a.y,a.w,a.h,p.x-w.camera.x,p.y-w.camera.y,p.w,Math.min(60,p.displayH));}
  for(const i of w.items)if(!w.consumed.has(i.id)&&visible(w,i))entity(ctx,w,i,{scale:.72});
  for(const e of w.enemies)if(!e.dead&&!e.hidden&&visible(w,e)){
    const key=e.type==='Piranha'?e.asset+(e.vy<0?'_UP':'_DOWN'):(e.props.pAnim??e.asset);
    if(Art.anims[key])drawAnimation(ctx,key,e.age,e.x+e.w/2-w.camera.x,e.y+e.h-w.camera.y,{flip:e.look<0});else entity(ctx,w,e,{flip:e.look<0});
  }
  for(const shot of w.shots)if(visible(w,shot))entity(ctx,w,shot,{scale:.65,flip:shot.vx<0});
  const b=w.player,alpha=b.invulnerable>0&&Math.floor(w.time*12)%2?.4:1;
  if(!w.death){
    if(b.animation)drawAnimation(ctx,b.animation,b.climbing&&!b.vy?0:b.animTime,b.x+b.w/2-w.camera.x,b.y+b.h-w.camera.y,{flip:b.face<0,alpha});
    else drawSprite(ctx,'VASCOLET',b.x+b.w/2-w.camera.x,b.y+b.h-w.camera.y,{flip:b.face<0,alpha});
  }
  for(const e of w.effects)drawAnimation(ctx,e.asset,e.age,e.x-w.camera.x,e.y-w.camera.y,{scale:.8});
  ctx.restore();hud(ctx,w);
}
