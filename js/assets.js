import {sampleAnimation} from './animation-timing.js';
const images=new Map(),promises=new Map();
// AnimationEffect constructor 004345a0 assigns native blend mode 2 to POWER.
// The black texels in coinEffect.png are additive zero, not opaque background.
export const SPRITE_COMPOSITES=Object.freeze({POWER:'lighter'});
export function image(path){return images.get(path);}
export function loadImage(path){
  if(promises.has(path))return promises.get(path);
  const task=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images.set(path,im);resolve(im);};im.onerror=()=>reject(Error('No se pudo cargar '+path));im.src=new URL('../'+path,import.meta.url).href;});
  promises.set(path,task);return task;
}
export async function loadText(path){const r=await fetch(new URL('../'+path,import.meta.url));if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.text();}
export async function loadJSON(path){return JSON.parse(await loadText(path));}
export async function loadXML(path){return new DOMParser().parseFromString(await loadText(path),'application/xml');}
export const Art={atlas:{},anims:{},pages:{},ui:{},font:null,nativeObjects:{}};
export async function loadArt(){
  const [atlas,anims,ui,font,nativeObjects]=await Promise.all([loadJSON('assets/data/atlas.json'),loadJSON('assets/data/animations.json'),loadJSON('assets/data/ui-atlas.json'),loadJSON('assets/data/font.json'),loadJSON('assets/data/native-objects.json')]);Art.atlas=atlas;Art.ui=ui;Art.font=font;Art.nativeObjects=nativeObjects;
  for(const group of Object.values(anims))for(const a of group)Art.anims[a.key]=a;
  await Promise.all([...new Set(Object.values(atlas).map(a=>a.image))].map(loadImage));
  await loadImage('assets/images/menuElements/menu.jpg');
  await Promise.all([...new Set(Object.values(ui).flat().map(f=>f.image)),font.image,font.outlineImage].map(loadImage));
}
export function frameAt(name,time){
  return sampleAnimation(Art.anims[name],time);
}
export function drawSprite(ctx,key,x,y,{frame=0,flip=false,scale=1,alpha=1,origin=true,composite=SPRITE_COMPOSITES[key]??'source-over'}={}){
  const a=Art.atlas[key];if(!a)throw Error('Sprite no recuperado: '+key);
  const im=image(a.image);if(!im)return;
  const i=Math.max(0,Math.min(a.count-1,frame));
  const sx=a.x+(i%a.columns)*a.w,sy=a.y+Math.floor(i/a.columns)*a.h;
  ctx.save();ctx.translate(x,y);ctx.scale((flip?-1:1)*scale,scale);ctx.globalAlpha=alpha;ctx.globalCompositeOperation=composite;
  ctx.drawImage(im,sx,sy,a.w,a.h,origin?-a.ax:0,origin?-a.ay:0,a.w,a.h);ctx.restore();
}
export function drawAnimation(ctx,key,time,x,y,options){const f=frameAt(key,time);if(f)drawSprite(ctx,f.asset,x,y,{...options,frame:f.frame});else drawSprite(ctx,key,x,y,options);}
