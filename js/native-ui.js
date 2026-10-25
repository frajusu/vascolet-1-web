// Native coordinates: 1200×900, observed at 800×600. No browser-page decoration.
import {Art,image} from './assets.js';
export function uiFrame(ctx,key,index,x,y,{origin=true,scale=1}={}){
  const f=Art.ui[key]?.[index];if(!f)throw Error('Native UI frame missing: '+key+' '+index);
  const im=image(f.image);if(!im)return;
  ctx.drawImage(im,f.x,f.y,f.w,f.h,x-(origin?f.ax*scale:0),y-(origin?f.ay*scale:0),f.w*scale,f.h*scale);
}
export function measureNative(text,scale=1){return [...text].reduce((n,c)=>n+(Art.font.glyphs[c]?.advance??Art.font.glyphs['?'].advance)*scale,0);}
export function nativeText(ctx,text,x,y,{align='center',scale=1,outline=false}={}){
  const font=Art.font,im=image(outline?font.outlineImage:font.image);if(!im)return;
  const width=measureNative(text,scale);let pen=x-(align==='center'?width/2:align==='right'?width:0);
  for(const char of text){const g=font.glyphs[char]??font.glyphs['?'];ctx.drawImage(im,g.x,g.y,40,40,pen+(g.advance/2-20)*scale,y-19*scale,40*scale,40*scale);pen+=g.advance*scale;}
}
export function nativeButton(ctx,b,hover=false,down=false){
  uiFrame(ctx,b.small?'SMALL_BUTTON':'MENU_BUTTON',b.disabled?3:down?2:hover?1:0,b.x+b.w/2,b.y+b.h/2);
  nativeText(ctx,b.label,b.x+b.w/2,b.y+b.h/2);
}
