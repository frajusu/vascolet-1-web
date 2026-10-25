import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {access,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fork} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'test-results');await mkdir(output,{recursive:true});
const candidates=[process.env.BROWSER_EXECUTABLE,chromium.executablePath(),'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].filter(Boolean);
if(process.env.LOCALAPPDATA){const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');for(const d of(await readdir(cache).catch(()=>[])).filter(d=>/^chromium-/.test(d)).sort().reverse())candidates.push(path.join(cache,d,'chrome-win64/chrome.exe'));}
let executablePath;for(const p of candidates){try{await access(p);executablePath=p;break;}catch{}}if(!executablePath)throw Error('Set BROWSER_EXECUTABLE to an installed browser');
const child=fork(path.join(root,'tools/serve.mjs'),['--port','0',...(process.argv.includes('--built')?['--built']:[])],{cwd:root,silent:true});
const url=await new Promise((resolve,reject)=>{child.once('error',reject);child.on('message',m=>{if(m.type==='ready')resolve(m.url);});});
const report={ok:false,scope:'Actual keyboard/UI checks and controlled gameplay fixtures; native PNG visual regressions. Not a natural full-campaign completion or a proof of exact enemy AI.',steps:[],errors:[],nativeComparisons:[]};let browser;
async function step(name,fn){await fn();report.steps.push(name);console.log('PASS',name);}
async function reference(page,name,file,limit,rectangle=null){
  const base64=(await readFile(path.join(root,'analysis/native-reference',file))).toString('base64');
  const result=await page.evaluate(async({base64,rectangle})=>{
    const im=new Image();im.src='data:image/png;base64,'+base64;await im.decode();const c=new OffscreenCanvas(800,600),ctx=c.getContext('2d');ctx.drawImage(im,0,0);
    const rect=rectangle??{x:0,y:0,w:800,h:600};const a=ctx.getImageData(rect.x,rect.y,rect.w,rect.h).data,b=document.querySelector('#game').getContext('2d').getImageData(rect.x,rect.y,rect.w,rect.h).data;let sum=0;
    for(let i=0;i<a.length;i+=4)for(let k=0;k<3;k++)sum+=Math.abs(a[i+k]-b[i+k]);return {mae:sum/(a.length/4*3),pixels:a.length/4};
  },{base64,rectangle});report.nativeComparisons.push({name,...result,limit});assert.ok(result.mae<limit,`${name}: native RGB MAE ${result.mae} >= ${limit}`);
}
try{
  browser=await chromium.launch({executablePath,headless:true});const page=await browser.newPage({viewport:{width:800,height:600}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url+'/?test=1');await page.waitForFunction(()=>window.__vascolet?.state==='menu');
  await step('canvas-only page and original menu',async()=>{
    assert.equal(await page.locator('header,footer,nav,.cabinet,.timeline').count(),0);
    assert.deepEqual(await page.locator('#controls button').allTextContents(),['Jugar','Opciones','Ayuda','Creditos','Salir']);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);
    await reference(page,'menu','boot/boot-2s.png',1);await page.locator('#game').screenshot({path:path.join(output,'menu.png')});
  });
  await step('original options, separate volumes and native fullscreen/stretch controls',async()=>{
    await page.getByRole('button',{name:'Opciones',exact:true}).click();await page.waitForFunction(()=>window.__vascolet.state==='options');await page.mouse.move(790,590);
    await reference(page,'options','menus/options.png',1.2);
    for(const [name,value] of [['Música','.2'],['Efectos','.1']])await page.getByLabel(name,{exact:true}).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
    await page.getByRole('button',{name:'Apagar música'}).click();
    const settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('vascolet-1-web:native-v2')).settings);assert.equal(settings.musicVolume,.2);assert.equal(settings.effectsVolume,.1);assert.equal(settings.musicOn,false);
    if(await page.evaluate(()=>document.fullscreenEnabled)){await page.getByRole('button',{name:'Pantalla Completa'}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.evaluate(()=>document.exitFullscreen());}
    await page.setViewportSize({width:960,height:640});await page.getByRole('button',{name:'Estirar Pantalla'}).click();assert.equal(await page.locator('#game').evaluate(c=>Math.round(c.getBoundingClientRect().width)),960);await page.getByRole('button',{name:'Estirar Pantalla'}).click();await page.setViewportSize({width:800,height:600});
    await page.getByRole('button',{name:'Atrás',exact:true}).click();
  });
  await step('original help and credits, without added panels',async()=>{
    await page.getByRole('button',{name:'Ayuda',exact:true}).click();await page.waitForFunction(()=>window.__vascolet.state==='image');await reference(page,'help','catalog/help.png',1);await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vascolet.state==='menu');
    await page.getByRole('button',{name:'Creditos',exact:true}).click();await page.waitForFunction(()=>window.__vascolet.state==='image');await reference(page,'credits','catalog/credits.png',1);await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vascolet.state==='menu');
  });
  await step('native introduction and dinosaur start',async()=>{
    await page.getByRole('button',{name:'Jugar',exact:true}).click();
    for(let i=0;i<5;i++){await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();await page.keyboard.press('Enter');await page.waitForTimeout(50);}
    await page.waitForFunction(()=>window.__vascolet.state==='playing');await page.waitForFunction(()=>window.__vascolet.world.player.grounded);
    assert.ok(await page.evaluate(()=>window.__vascolet.world.level===0));
  });
  await step('real keyboard walking/jumping and original pause/exit confirmation',async()=>{
    const before=await page.evaluate(()=>window.__vascolet.snapshot());await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');await page.waitForTimeout(100);const moved=await page.evaluate(()=>window.__vascolet.snapshot());assert.ok(moved.player.x>before.player.x+70);
    await page.keyboard.press('Space');await page.waitForTimeout(180);const jumped=await page.evaluate(()=>window.__vascolet.snapshot());assert.ok(jumped.player.y<moved.player.y-35);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__vascolet.state==='paused');assert.deepEqual(await page.locator('#controls button').allTextContents(),['Jugar','Salir']);await page.locator('#game').screenshot({path:path.join(output,'pause.png')});
    await page.getByRole('button',{name:'Salir',exact:true}).click();assert.deepEqual(await page.locator('#controls button').allTextContents(),['Sí','No']);await page.getByRole('button',{name:'No',exact:true}).click();await page.getByRole('button',{name:'Jugar',exact:true}).click();
  });
  const names=['prehistory','egypt','castle','pirates','future'];
  for(let level=0;level<5;level++)await step(`${names[level]}: native geometry, upgrades, consumed keys, checkpoint, death arc and exit`,async()=>{
    await page.evaluate(async level=>{const t=window.__vascolet;t.freeze();await t.loadLevel(level);t.step(180);},level);
    await reference(page,names[level]+' entry',`${level===0?'game/prehistory':names[level]+'/'+names[level]}-start.png`,6);
    await page.locator('#game').screenshot({path:path.join(output,`era-${level}.png`)});
    const result=await page.evaluate(()=>{
      const t=window.__vascolet,w=t.world,b=w.player;b.invulnerable=1000;
      const grounded=b.grounded,mode=b.animation;
      const milk=w.items.find(i=>i.asset==='VASCOLETS');t.place(milk.x,milk.y);t.step(2);const milkCount=w.counts.VASCOLETS;
      const cereal=w.items.find(i=>i.asset==='CEREALS');w.collect(cereal);
      let air=null;for(let y=2;y<w.map.h-2&&!air;y++)for(let x=1;x<w.map.w-2&&!air;x++){
        let empty=true;for(let dy=-2;dy<=2;dy++)for(let dx=0;dx<2;dx++)if(w.map.flags[(y+dy)*w.map.w+x+dx])empty=false;
        if(empty)air={x:x*76+5,y:y*76};
      }
      if(!air)throw Error('No free-space fixture');t.place(air.x,air.y);b.climbing=false;b.grounded=false;b.jumps=1;b.vy=100;t.step(1,[],['Space']);const doubleJump=b.vy;
      const door=w.doors[0];t.place(door.x-b.w+1,door.y+door.h-b.h);w.counts[door.required]=0;t.step();const locked=!door.open;w.counts[door.required]=door.count;t.place(door.x-b.w+1,door.y+door.h-b.h);t.step();const opened=door.open&&w.counts[door.required]===0;
      const save=w.saves[0];t.place(save.x+(save.w-b.w)/2,save.y+save.h-b.h);t.step();const checkpointActive=save.active,checkpoint={...w.checkpoint};
      const hazard=w.map.flags.findIndex(f=>f&4);t.place(hazard%w.map.w*76+10,Math.floor(hazard/w.map.w)*76+10);b.invulnerable=0;t.step();const startsDeath=!!w.death&&w.lives===10;
      t.step(35);const waitsBeforeFlight=!!w.death&&w.death.wait>0;t.step(180);const respawned=!w.death&&w.lives===9;
      b.invulnerable=1000;const exit=w.items.find(i=>i.asset==='MICROWAVE');t.place(exit.x,exit.y);t.step(2);
      return {grounded,mode,milkCount,doubleJump,locked,opened,checkpointActive,checkpoint,startsDeath,waitsBeforeFlight,respawned,complete:w.complete};
    });
    report[names[level]]=result;assert.ok(result.grounded);assert.equal(result.milkCount,1);assert.equal(result.doubleJump,-640);assert.ok(result.locked&&result.opened);assert.ok(result.checkpointActive);assert.ok(result.startsDeath&&result.waitsBeforeFlight&&result.respawned);assert.ok(result.complete);
  });
  await step('native selector raster, order and functional era selection',async()=>{
    await page.evaluate(async()=>{await window.__vascolet.select();});await page.mouse.move(790,590);await page.waitForTimeout(50);
    assert.deepEqual((await page.locator('#controls button').allTextContents()).slice(0,5),['Prehistoria','Egipto','Castillo','Piratas','Futuro']);await reference(page,'selector','selection-skins/select-5.png',.5);await page.locator('#game').screenshot({path:path.join(output,'selector.png')});
    await page.getByRole('button',{name:'Futuro',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vascolet.state==='playing');
    await page.evaluate(()=>{const t=window.__vascolet;t.freeze();const s=t.world.saves[0];t.place(s.x,s.y);t.step();t.world.persist();});
    const checkpoint=await page.evaluate(()=>({...window.__vascolet.world.checkpoint}));await page.reload();await page.waitForFunction(()=>window.__vascolet?.state==='menu');await page.getByRole('button',{name:'Jugar',exact:true}).click();await page.getByRole('button',{name:'Futuro',exact:true}).waitFor();
    // Continuation is represented by its original era card, not an added menu.
    await page.getByRole('button',{name:'Futuro',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).waitFor();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vascolet.state==='playing');
    assert.deepEqual(await page.evaluate(()=>window.__vascolet.world.checkpoint),checkpoint);report.savedCheckpoint=checkpoint;
  });
  await step('small screen remains only the game, with no page decoration',async()=>{await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('header,footer,nav').count(),0);await page.locator('#game').screenshot({path:path.join(output,'mobile.png')});});
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=error.stack;throw error;}finally{await writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser?.close();if(child.connected)child.send({type:'stop'});else child.kill();}
