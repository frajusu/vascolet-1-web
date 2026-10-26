import {Art,image,loadArt,loadImage,loadJSON,drawSprite} from './assets.js';
import {World,ERAS} from './game.js';
import {renderWorld,drawPage} from './render.js';
import {uiFrame,nativeText,nativeButton} from './native-ui.js';
import {Input,setupInput} from './input.js';
import {Save} from './save.js';
import {AudioSystem as Audio} from './audio.js';
import {FixedStepClock,RenderHistory} from './presentation.js';

const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),controls=document.querySelector('#controls'),boot=document.querySelector('#boot'),err=document.querySelector('#err');
const world=new World(),testMode=new URLSearchParams(location.search).has('test');
const simulation=new FixedStepClock(),history=new RenderHistory();
let state='boot',pagePath='',story=[],afterStory=null,buttons=[],hover=null,pressed=null,last=0,generation=0,confirmation=null,selection=[],musicVolume=.5,effectsVolume=.5,frozen=false;
let lastDraw=null;
const MENU=['Jugar','Opciones','Ayuda','Creditos','Salir'];
function fit(){const available=Math.min(innerWidth/800,innerHeight/600),scale=available>=1?Math.floor(available):available;canvas.style.width=(Save.data.settings.stretch?innerWidth:800*scale)+'px';canvas.style.height=(Save.data.settings.stretch?innerHeight:600*scale)+'px';const r=canvas.getBoundingClientRect();Object.assign(controls.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
function fail(error){state='error';boot.hidden=true;err.textContent='No se pudo iniciar el juego. Recarga para volver a intentar.\n'+(error.stack??error);console.error(error);}
const guarded=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(fail);
function change(next){state=next;simulation.reset();history.reset();buttons=[];hover=pressed=null;controls.replaceChildren();Input.release();canvas.style.cursor=next==='playing'?'none':'default';}
function hit(label,x,y,w,h,action,{small=false,disabled=false,draw=true}={}){
  const b={id:buttons.length,label,x,y,w,h,action,small,disabled,draw};buttons.push(b);
  const el=document.createElement('button');el.textContent=label;el.disabled=disabled;el.setAttribute('aria-label',label);el.style.left=x/12+'%';el.style.top=y/9+'%';el.style.width=w/12+'%';el.style.height=h/9+'%';
  el.onpointerenter=()=>{hover=b.id;};el.onpointerleave=()=>{if(hover===b.id)hover=null;pressed=null;};el.onpointerdown=()=>{pressed=b.id;};el.onpointerup=()=>{pressed=null;};el.onfocus=()=>{hover=b.id;};el.onblur=()=>{if(hover===b.id)hover=null;};el.onclick=guarded(action);controls.append(el);return b;
}
function button(label,cx,cy,action,{small=false,disabled=false}={}){const f=Art.ui[small?'SMALL_BUTTON':'MENU_BUTTON'][0];return hit(label,cx-f.w/2,cy-f.h/2,f.w,f.h,action,{small,disabled});}
async function page(path){await loadImage(path);pagePath=path;}
async function menu(){generation++;world.persist();change('menu');await page('assets/images/menuElements/menu.jpg');Audio.playMusic('andy');MENU.forEach((label,i)=>button(label,1060,130+80*i,[play,options,()=>imageScreen('assets/lang/images/help/ayuda.jpg'),()=>imageScreen('assets/lang/images/credits/creditos.jpg'),exit][i]));}
async function play(){
  if(Save.data.completed.length){await select();return;}
  if(Save.data.run){await loadLevel(Save.data.run.level,{resume:true});return;}
  await sequence([1,2,3,4].map(n=>`assets/lang/images/intros/intro_page${n}.jpg`),()=>startEra(0));
}
async function sequence(paths,done){story=[...paths];afterStory=done;await advance();}
async function advance(){
  if(!story.length){const done=afterStory;afterStory=null;await done?.();return;}
  const path=story.shift();change('story');await page(path);hit('Continuar',0,0,1200,900,advance,{draw:false});
}
async function imageScreen(path){change('image');await page(path);hit('Continuar',0,0,1200,900,menu,{draw:false});}
async function startEra(level,{carry=false}={}){const resume=Save.data.run?.level===level;await sequence([`assets/lang/images/intros/${ERAS[level].intro}.jpg`],()=>loadLevel(level,{carry,resume}));}
async function loadLevel(level,options={}){
  const token=++generation;change('loading');boot.hidden=false;boot.textContent='Cargando…';await world.load(level,options);if(token!==generation)return;boot.hidden=true;resume();
}
function resume(){change('playing');hit('Pausa',480,0,240,45,pause,{draw:false});Audio.resume();canvas.focus({preventScroll:true});}
function pause(){if(state!=='playing')return;world.persist();change('paused');Audio.suspend();button('Jugar',600,517,resume);button('Salir',600,592,()=>confirm('¿Seguro que quieres\nvolver al menú\nprincipal?',menu,restorePause));}
function restorePause(){change('playing');pause();}
function confirm(text,yes,no){confirmation={text,yes,no};change('confirm');button('Sí',520,580,yes,{small:true});button('No',680,580,no,{small:true});}
function exit(){change('exited');Audio.suspend();ctx.fillStyle='#000';ctx.fillRect(0,0,800,600);}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('#wrap').requestFullscreen();}catch{}fit();}
function options(){
  change('options');musicVolume=Save.data.settings.musicVolume??.5;effectsVolume=Save.data.settings.effectsVolume??.5;
  function slider(label,y,value,callback){const input=document.createElement('input');input.type='range';input.min=0;input.max=1;input.step=.01;input.value=value;input.setAttribute('aria-label',label);Object.assign(input.style,{left:492/12+'%',top:(y+4)/9+'%',width:226/12+'%',height:32/9+'%'});input.oninput=()=>{callback(Number(input.value));Audio.volume();Save.write();};controls.append(input);}
  slider('Música',264,musicVolume,v=>{musicVolume=v;Save.data.settings.musicVolume=v;});slider('Efectos',357,effectsVolume,v=>{effectsVolume=v;Save.data.settings.effectsVolume=v;});
  hit('Apagar música',677,211,50,60,()=>{Save.data.settings.musicOn=!(Save.data.settings.musicOn!==false);Save.write();Audio.volume();},{draw:false});
  hit('Apagar efectos',677,304,50,60,()=>{Save.data.settings.effectsOn=!(Save.data.settings.effectsOn!==false);Save.write();Audio.volume();},{draw:false});
  hit('Pantalla Completa',683,401,40,40,fullscreen,{draw:false});
  hit('Estirar Pantalla',683,445,40,40,()=>{Save.data.settings.stretch=!Save.data.settings.stretch;Save.write();fit();},{draw:false});button('Atrás',605,530,menu,{small:true});
}
async function select(){
  const unlocked=Math.min(5,Math.max(1,...Save.data.completed.map(n=>n+2)));
  if(unlocked===1){await startEra(0);return;}
  change('levels');await Promise.all([loadImage(`assets/gui/native/select-${unlocked}.png`),...Array.from({length:unlocked},(_,i)=>loadImage(`assets/gui/native/hover-${i}.png`))]);await page(`assets/gui/native/select-${unlocked}.png`);
  for(let i=0;i<5;i++){const card=selection[i].card;hit(ERAS[i].name,card.x,card.y,card.w,card.h,()=>startEra(i),{disabled:i>=unlocked,draw:false});}button('Atrás',600,870,menu,{small:true}).draw=false;
}
function drawMenuButtons(){MENU.forEach((label,i)=>nativeButton(ctx,{label,x:935.5,y:95+80*i,w:249,h:70},state==='menu'&&hover===i,state==='menu'&&pressed===i));}
function drawInterface(alpha=1){
  if(state==='exited')return;
  if(['playing','paused','confirm'].includes(state)&&world.map)renderWorld(ctx,world,state==='playing'&&!frozen?history.frame(world,alpha):null);else if(pagePath)drawPage(ctx,pagePath);
  ctx.save();ctx.scale(2/3,2/3);
  if(state==='options')drawMenuButtons();
  if(state==='paused'||state==='confirm'){uiFrame(ctx,'PAUSE_DIALOG',0,600,440);}
  if(state==='options'){
    uiFrame(ctx,'OPTIONS',0,455,0);uiFrame(ctx,'OPTIONS',Save.data.settings.musicOn===false?2:1,677,211);uiFrame(ctx,'OPTIONS',Save.data.settings.effectsOn===false?2:1,677,304);
    uiFrame(ctx,'OPTIONS',document.fullscreenElement?3:4,683,401);uiFrame(ctx,'OPTIONS',Save.data.settings.stretch?3:4,683,445);
    uiFrame(ctx,'OPTIONS',5,455+37+musicVolume*186,264);uiFrame(ctx,'OPTIONS',5,455+37+effectsVolume*186,357);
  }
  if(state==='levels'){
    const unlocked=Math.min(5,Math.max(1,...Save.data.completed.map(n=>n+2)));
    if(hover!==null&&hover<unlocked){const card=selection[hover].card,skin=image(`assets/gui/native/hover-${hover}.png`);if(skin){ctx.save();ctx.beginPath();ctx.rect(card.x,card.y,card.w,card.h);ctx.clip();ctx.drawImage(skin,0,0,800,600,0,0,1200,900);ctx.restore();}}
    for(let i=0;i<unlocked;i++)if(Save.data.bestCoins?.[i]){
      const bg=image('assets/lang/images/seleccionar_nivel/fondo_seleccionar_nivel.jpg');if(bg)ctx.drawImage(bg,45+225*i,790,180,50,45+225*i,790,180,50);
      nativeText(ctx,`${Save.data.bestCoins[i]} / 100`,145+225*i,812);drawSprite(ctx,'COIN',225+225*i,830,{scale:.5});
    }
  }
  if(state==='confirm'){
    uiFrame(ctx,'PAUSE_DIALOG',1,600,500);confirmation.text.split('\n').forEach((s,i)=>nativeText(ctx,s,600,440+i*30));
  }
  for(const b of buttons)if(b.draw||(state==='levels'&&b.label==='Atrás'&&(hover===b.id||pressed===b.id)))nativeButton(ctx,b,hover===b.id,pressed===b.id);
  ctx.restore();
  if(testMode)lastDraw={state,page:pagePath,level:world.level};
}
function tick(t){
  const elapsed=(t-last)/1000||0;last=t;let alpha=1;
  try{
    if(Input.tap('Escape')){Input.flush();if(state==='playing')pause();else if(state==='paused')resume();else if(state==='confirm')guarded(confirmation.no)();else if(state==='options'||state==='levels')guarded(menu)();}
    if(state==='playing'&&!frozen){
      ({alpha}=simulation.advance(elapsed,dt=>{history.capture(world);world.update(dt);Input.flush();}));
      while(world.events.length){const e=world.events.shift();if(e.type==='complete'){guarded(e.level===4?()=>sequence(['assets/lang/images/intros/fin.jpg'],menu):()=>select())();}else if(e.type==='gameover')guarded(imageScreen)('assets/lang/images/intros/perdiste.jpg');}
    }else{simulation.reset();if(Input.tap('Enter','Space')){const b=buttons.find(x=>x.id===hover)??buttons.find(x=>!x.disabled);Input.flush();guarded(b?.action??(()=>{}))();}Input.flush();}
    drawInterface(alpha);
  }catch(error){fail(error);}
  requestAnimationFrame(tick);
}
async function startup(){
  Save.load();Audio.init();setupInput();addEventListener('resize',fit);document.addEventListener('fullscreenchange',fit);fit();
  addEventListener('keydown',e=>{if(['story','image'].includes(state)&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!['Shift','Control','Alt','Meta'].includes(e.key)){e.preventDefault();Input.release();guarded(state==='story'?advance:menu)();}});
  addEventListener('blur',()=>{Input.release();if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});addEventListener('pagehide',()=>world.persist());
  await Promise.all([loadArt(),Audio.preloadEffects()]);selection=await loadJSON('assets/data/selection.json');await loadImage('assets/lang/images/seleccionar_nivel/fondo_seleccionar_nivel.jpg');boot.hidden=true;await menu();requestAnimationFrame(tick);
}
if(testMode)window.__vascolet={world,Art,Audio,drawSprite,get state(){return state;},get lastDraw(){return lastDraw;},loadLevel,pause,resume,showMenu:menu,select,draw:drawInterface,
  freeze(value=true){frozen=value;simulation.reset();history.reset();Input.release();},
  place(x,y){Object.assign(world.player,{x,y,vx:0,vy:0});world.updateCamera(1);history.reset();},
  step(count=1,held=[],pressedKeys=[]){for(let i=0;i<count;i++){history.capture(world);world.update(1/60,{down:(...keys)=>keys.some(k=>held.includes(k)),tap:(...keys)=>i===0&&keys.some(k=>pressedKeys.includes(k))});}drawInterface();},
  renderFraction(alpha){const view=history.frame(world,alpha);renderWorld(ctx,world,view);return {x:view?view.value(world.player,'x'):world.player.x,y:view?view.value(world.player,'y'):world.player.y,physicalX:world.player.x};},
  snapshot(){return {state,level:world.level,player:{...world.player},lives:world.lives,score:world.score,counts:{...world.counts},checkpoint:{...world.checkpoint},consumed:[...world.consumed],complete:world.complete};}
};
startup().catch(fail);
