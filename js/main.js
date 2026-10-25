import { Art,loadArt,loadImage } from './assets.js';
import { World,ERAS } from './game.js';
import { renderWorld,drawPage } from './render.js';
import { Input,setupInput } from './input.js';
import { Save } from './save.js';
import { AudioSystem as Audio } from './audio.js';

const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),panels=document.querySelector('#panels'),loading=document.querySelector('#loading'),error=document.querySelector('#error');
const world=new World();let state='boot',pagePath='',sequence=[],afterSequence=null,generation=0,menuIndex=0,accumulator=0,last=0;
const query=new URLSearchParams(location.search),testMode=query.has('test');
function reportError(err){state='error';loading.hidden=true;error.hidden=false;error.replaceChildren();const title=document.createElement('strong');title.textContent='No se pudo preparar el viaje';const detail=document.createElement('span');detail.textContent=err.message;const retry=document.createElement('button');retry.className='action';retry.textContent='Volver a cargar';retry.onclick=()=>location.reload();error.append(title,detail,retry);console.error(err);}
function guard(fn){return(...args)=>Promise.resolve().then(()=>fn(...args)).catch(reportError);}
function setState(next){state=next;Input.release();panels.replaceChildren();menuIndex=0;document.querySelector('#pause').hidden=next!=='playing';document.querySelector('#touch').hidden=next!=='playing';document.querySelectorAll('[data-era]').forEach((b,i)=>{b.classList.toggle('active',Boolean(world.map)&&world.level===i);b.classList.toggle('completed',Save.data.completed.includes(i));});}
function button(label,action,primary=false){const b=document.createElement('button');b.className='action'+(primary?' primary':'');b.textContent=label;b.onclick=guard(action);return b;}
function panel(title,description){const p=document.createElement('section');p.className='panel';if(title){const h=document.createElement('h2');h.textContent=title;p.append(h);}if(description){const text=document.createElement('p');text.textContent=description;p.append(text);}panels.append(p);return p;}
function stack(p,...buttons){const s=document.createElement('div');s.className='stack';s.append(...buttons);p.append(s);}
function gameFocus(){canvas.focus({preventScroll:true});}
async function page(path){await loadImage(path);pagePath=path;}
async function showMenu(){generation++;world.persist();setState('menu');await page('assets/images/menuElements/menu.jpg');Audio.playMusic('andy');const p=panel();p.classList.add('menu-panel');p.append(button('Nueva aventura',newAdventure,true),button('Continuar',continueRun),button('Elegir época',levelSelect),button('Opciones',()=>options('menu')),button('Ayuda',()=>imageScreen('assets/lang/images/help/ayuda.jpg')),button('Créditos',()=>imageScreen('assets/lang/images/credits/creditos.jpg')));const note=document.createElement('p');note.className='menu-note';note.textContent=Save.available?'Tu avance se guarda en este navegador.':'El guardado no está disponible en este navegador.';p.append(note);}
async function playSequence(paths,done){setState('story');sequence=[...paths];afterSequence=done;await advanceStory();}
async function advanceStory(){if(sequence.length){panels.replaceChildren();await page(sequence.shift());const p=panel();p.classList.add('image-panel');p.append(button('Continuar ↵',advanceStory,true));}else{const done=afterSequence;afterSequence=null;await done?.();}}
async function newAdventure(){const begin=()=>{Save.data.run=null;Save.write();return playSequence([1,2,3,4].map(n=>`assets/lang/images/intros/intro_page${n}.jpg`),()=>startEra(0));};if(Save.data.run){setState('confirm');const p=panel('¿Comenzar otro viaje?','Se reemplazará el punto de salvado de esta aventura.');stack(p,button('Comenzar',begin,true),button('Volver',showMenu));}else await begin();}
async function continueRun(){const saved=Save.data.run;if(saved)await loadLevel(saved.level,{resume:true});else await startEra(Save.data.lastLevel);}
async function startEra(level,{carry=false}={}){await playSequence([`assets/lang/images/intros/${ERAS[level].intro}.jpg`],()=>loadLevel(level,{carry}));}
async function loadLevel(level,options={}){
  const token=++generation;setState('loading');loading.hidden=false;loading.querySelector('strong').textContent='Viajando a '+ERAS[level].name+'…';
  try{await world.load(level,options);if(token!==generation)return;loading.hidden=true;setState('playing');gameFocus();accumulator=0;}catch(err){if(token===generation)reportError(err);}
}
async function levelSelect(){world.persist();setState('levels');await page('assets/lang/images/seleccionar_nivel/fondo_seleccionar_nivel.jpg');const p=panel('Elige una época');stack(p,...ERAS.map((era,i)=>button((Save.data.completed.includes(i)?'✓ ':'')+era.name,()=>startEra(i))),button('Volver',showMenu));const hint=document.createElement('small');hint.textContent='Puedes explorar las cinco épocas. Cada una inicia con sus propios objetos y poderes.';p.append(hint);}
function pause(){if(state!=='playing')return;world.persist();setState('paused');Audio.suspend();const p=panel('Viaje en pausa');stack(p,button('Seguir jugando',resume,true),button('Opciones',()=>options('paused')),button('Volver al punto de salvado',()=>{world.resetPlayer();resume();}),button('Elegir época',levelSelect),button('Menú principal',showMenu));}
function resume(){setState('playing');Audio.resume();gameFocus();accumulator=0;}
function options(back){setState('options');const p=panel('Opciones');const volume=document.createElement('label');volume.className='setting';volume.append('Volumen');const range=document.createElement('input');range.type='range';range.min=0;range.max=1;range.step=.05;range.value=Save.data.settings.volume;range.setAttribute('aria-label','Volumen');range.oninput=()=>{Save.data.settings.volume=Number(range.value);Save.write();Audio.volume();};volume.append(range);p.append(volume);const smoothing=document.createElement('label');smoothing.className='setting';smoothing.append('Suavizar imágenes');const check=document.createElement('input');check.type='checkbox';check.checked=Save.data.settings.smooth;check.onchange=()=>{Save.data.settings.smooth=check.checked;Save.write();};smoothing.append(check);p.append(smoothing);stack(p,button('Pantalla completa',fullscreen),button('Borrar progreso',()=>confirmReset(back)),button('Volver',back==='paused'?()=>{resume();pause();}:showMenu));}
function confirmReset(back){setState('confirm');const p=panel('¿Borrar el progreso?','Se borrarán los puntos de salvado y las épocas completadas de este navegador.');stack(p,button('Borrar progreso',()=>{Save.reset();world.map=null;showMenu();}),button('Conservar mi progreso',()=>options(back),true));}
async function imageScreen(path){setState('image');await page(path);const p=panel();p.classList.add('image-panel');p.append(button('Volver al menú ↵',showMenu));}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.stage').requestFullscreen();}catch{if(state==='playing')world.notify('Usa el botón de pantalla completa del navegador.',4);}}
async function completed(level){setState('completed');const p=panel('¡Microondas encontrado!',`Completaste ${ERAS[level].name}. La máquina está lista para otro salto en el tiempo.`);stack(p,button(level<4?'Viajar a '+ERAS[level+1].name:'Ver el final',()=>level<4?startEra(level+1,{carry:true}):playSequence(['assets/lang/images/intros/fin.jpg'],showMenu),true),button('Elegir época',levelSelect),button('Menú principal',showMenu));}
function handleMenuInput(){
  const buttons=[...panels.querySelectorAll('button:not(:disabled)')];
  if(Input.tap('ArrowDown','ArrowRight')){menuIndex=(menuIndex+1)%Math.max(1,buttons.length);buttons[menuIndex]?.focus();}
  if(Input.tap('ArrowUp','ArrowLeft')){menuIndex=(menuIndex-1+buttons.length)%Math.max(1,buttons.length);buttons[menuIndex]?.focus();}
  if(Input.tap('Enter','Space')){const active=document.activeElement;const target=buttons.includes(active)?active:buttons[menuIndex];Input.flush();target?.click();}
}
function frame(time){
  const elapsed=Math.min(.1,(time-last)/1000||0);last=time;
  try{
    if(Input.tap('Escape')){Input.flush();if(state==='playing')pause();else if(state==='paused')resume();else if(!['boot','loading','error','menu'].includes(state))guard(showMenu)();}
    if(state==='playing'){
      accumulator+=elapsed;while(accumulator>=1/60){world.update(1/60);Input.flush();accumulator-=1/60;}
      while(world.events.length){const event=world.events.shift();if(event.type==='complete')guard(completed)(event.level);if(event.type==='gameover')guard(imageScreen)('assets/lang/images/intros/perdiste.jpg');}
    }else{accumulator=0;handleMenuInput();Input.flush();}
    if(['playing','paused','options','confirm','completed'].includes(state)&&world.map)renderWorld(ctx,world);else if(pagePath)drawPage(ctx,pagePath);
    if(state==='paused'){ctx.fillStyle='#16090966';ctx.fillRect(0,0,800,600);}
  }catch(err){reportError(err);}
  requestAnimationFrame(frame);
}
async function boot(){
  Save.load();setupInput();document.querySelector('#pause').onclick=pause;document.querySelector('#fullscreen').onclick=fullscreen;
  for(const b of document.querySelectorAll('[data-era]'))b.onclick=guard(()=>{if(state==='loading'||state==='boot')return;if(state==='playing')world.persist();return startEra(Number(b.dataset.era));});
  window.addEventListener('blur',()=>{if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
  window.addEventListener('pagehide',()=>world.persist());
  await loadArt();loading.hidden=true;await showMenu();requestAnimationFrame(frame);
}
// Explicit fixture interface, available only on ?test=1; normal play has no cheats.
if(testMode)window.__vascolet={world,Art,get state(){return state;},loadLevel,pause,resume,showMenu,
  step(count=1,held=[],pressed=[]){for(let i=0;i<count;i++){const input={down:(...k)=>k.some(x=>held.includes(x)),tap:(...k)=>i===0&&k.some(x=>pressed.includes(x))};world.update(1/60,input);}renderWorld(ctx,world);},
  snapshot(){return {state,level:world.level,player:{...world.player},lives:world.lives,score:world.score,counts:{...world.counts},checkpoint:{...world.checkpoint},consumed:[...world.consumed],complete:world.complete};}
};
boot().catch(reportError);
