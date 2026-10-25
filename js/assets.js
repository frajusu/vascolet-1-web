const images=new Map(),promises=new Map();
export function image(path){return images.get(path);}
export function loadImage(path){
  if(promises.has(path))return promises.get(path);
  const task=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images.set(path,im);resolve(im);};im.onerror=()=>reject(Error('No se pudo cargar '+path));im.src=new URL('../'+path,import.meta.url).href;});
  promises.set(path,task);return task;
}
export async function loadText(path){const r=await fetch(new URL('../'+path,import.meta.url));if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.text();}
export async function loadJSON(path){return JSON.parse(await loadText(path));}
export async function loadXML(path){return new DOMParser().parseFromString(await loadText(path),'application/xml');}
export const Art={atlas:{},anims:{},pages:{}};
export async function loadArt(){
  const [atlas,anims]=await Promise.all([loadJSON('assets/data/atlas.json'),loadJSON('assets/data/animations.json')]);Art.atlas=atlas;
  for(const group of Object.values(anims))for(const a of group)Art.anims[a.key]=a;
  await Promise.all([...new Set(Object.values(atlas).map(a=>a.image))].map(loadImage));
  await loadImage('assets/images/menuElements/menu.jpg');
}
export function frameAt(name,time){
  const a=Art.anims[name];if(!a?.frames.length)return null;
  const total=a.frames.reduce((n,f)=>n+f.duration,0);let tick=Math.max(0,time*a.fps);
  tick=a.loop?tick%total:Math.min(tick,total-.001);
  for(const f of a.frames){if(tick<f.duration)return f;tick-=f.duration;}return a.frames.at(-1);
}
export function drawSprite(ctx,key,x,y,{frame=0,flip=false,scale=1,alpha=1,origin=true}={}){
  const a=Art.atlas[key];if(!a)throw Error('Sprite no recuperado: '+key);
  const im=image(a.image);if(!im)return;
  const i=Math.max(0,Math.min(a.count-1,frame));
  const sx=a.x+(i%a.columns)*a.w,sy=a.y+Math.floor(i/a.columns)*a.h;
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale((flip?-1:1)*scale,scale);ctx.globalAlpha=alpha;
  ctx.drawImage(im,sx,sy,a.w,a.h,origin?-a.ax:0,origin?-a.ay:0,a.w,a.h);ctx.restore();
}
export function drawAnimation(ctx,key,time,x,y,options){const f=frameAt(key,time);if(f)drawSprite(ctx,f.asset,x,y,{...options,frame:f.frame});else drawSprite(ctx,key,x,y,options);}
