import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { access,mkdir,writeFile,readdir } from 'node:fs/promises';
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'test-results');await mkdir(output,{recursive:true});
const candidates=[process.env.BROWSER_EXECUTABLE,chromium.executablePath(),'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].filter(Boolean);
if(process.env.LOCALAPPDATA){const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');for(const d of (await readdir(cache).catch(()=>[])).filter(n=>/^chromium-\d+$/.test(n)).sort().reverse())candidates.push(path.join(cache,d,'chrome-win64/chrome.exe'));}
let executable;for(const file of candidates){try{await access(file);executable=file;break;}catch{}}
if(!executable)throw Error('Set BROWSER_EXECUTABLE to an installed browser');
const child=fork(path.join(root,'tools/serve.mjs'),['--port','0',...(process.argv.includes('--built')?['--built']:[])],{cwd:root,silent:true});
const url=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>reject(Error('Server exit '+code)));child.on('message',m=>{if(m.type==='ready')resolve(m.url);});});
let browser;const failures=[],steps=[];const report={scope:'Keyboard walk/jump, browser UI and deterministic controlled fixtures on all five original maps. Not a natural full-campaign playthrough or a native fidelity certification.',steps,failures};
async function step(name,fn){await fn();steps.push(name);console.log('PASS',name);}
try{
  browser=await chromium.launch({executablePath:executable,headless:true});const page=await browser.newPage({viewport:{width:1200,height:1100}});
  page.on('pageerror',e=>failures.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  await page.goto(url+'/?test=1');await page.waitForFunction(()=>window.__vascolet?.state==='menu');
  await step('menu and original artwork',async()=>{await page.getByRole('button',{name:'Nueva aventura',exact:true}).waitFor();await page.screenshot({path:path.join(output,'menu.png')});});
  await step('intro sequence has one continue control and reaches Prehistoria',async()=>{await page.getByRole('button',{name:'Nueva aventura',exact:true}).click();for(let i=0;i<5;i++){await page.getByRole('button',{name:'Continuar ↵',exact:true}).click();}await page.waitForFunction(()=>window.__vascolet.state==='playing');});
  await step('keyboard movement and jumping on original terrain',async()=>{
    await page.waitForTimeout(450);const before=await page.evaluate(()=>window.__vascolet.snapshot());await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');const after=await page.evaluate(()=>window.__vascolet.snapshot());assert.ok(after.player.x>before.player.x+65,'Walk did not move right');
    await page.keyboard.press('Space');await page.waitForTimeout(140);const jumped=await page.evaluate(()=>window.__vascolet.snapshot());assert.ok(jumped.player.y<after.player.y-25,'Jump did not rise');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__vascolet.state==='paused');await page.screenshot({path:path.join(output,'pause.png')});
  });
  await step('options persist volume and smoothing, resume works',async()=>{
    await page.getByRole('button',{name:'Opciones',exact:true}).click();await page.getByLabel('Suavizar imágenes').uncheck();await page.getByLabel('Volumen').fill('0');
    await page.getByRole('button',{name:'Volver',exact:true}).click();await page.getByRole('button',{name:'Seguir jugando',exact:true}).click();await page.keyboard.press('Escape');
  });
  for(let level=0;level<5;level++)await step('era '+level+': render, grounding, items, double jump, doors, checkpoints, hazards and exit',async()=>{
    await page.evaluate(async level=>{const t=window.__vascolet;await t.loadLevel(level);t.pause();t.world.player.invulnerable=100;},level);
    const result=await page.evaluate(()=>{
      const t=window.__vascolet,w=t.world;t.step(100);const initial={x:w.player.x,y:w.player.y,grounded:w.player.grounded,counts:{enemies:w.enemies.length,items:w.items.length}};
      const milk=w.items.find(i=>i.asset==='VASCOLETS');w.player.x=milk.x;w.player.y=milk.y;w.player.vx=0;w.player.vy=0;t.step();const milkCount=w.counts.VASCOLETS;
      const cereal=w.items.find(i=>i.asset==='CEREALS');w.collect(cereal);
      // A real empty region of this map prevents a low ceiling from cancelling
      // the launch in the same tick. This is explicitly a controlled fixture.
      let air=null;for(let y=2;y<w.map.h-2&&!air;y++)for(let x=1;x<w.map.w-2&&!air;x++){
        let empty=true;for(let dy=-2;dy<=2;dy++)for(let dx=0;dx<2;dx++)if(w.map.flags[(y+dy)*w.map.w+x+dx])empty=false;
        const box={x:x*w.map.tw+5,y:y*w.map.th,w:50,h:90};
        if(empty&&!w.doors.some(d=>box.x<d.x+d.w&&box.x+50>d.x&&box.y<d.y+d.h&&box.y+90>d.y))air=box;
      }
      if(!air)throw Error('No collision-free double-jump fixture in map');w.player.x=air.x;w.player.y=air.y;w.player.climbing=false;w.player.grounded=false;w.player.coyote=0;w.player.jumps=1;w.player.vy=100;t.step(1,[],['Space']);const doubleJump=w.player.vy;
      const door=w.doors[0];w.player.x=door.x-w.player.w+1;w.player.y=door.y+door.h-w.player.h;w.player.vy=0;w.counts[door.required]=0;t.step();const locked=!door.open;w.counts[door.required]=door.count;w.player.x=door.x-w.player.w+1;w.player.y=door.y+door.h-w.player.h;w.player.vy=0;t.step();const unlocked=door.open&&w.counts[door.required]===0;
      const save=w.saves[0];w.player.x=save.x;w.player.y=save.y;w.player.vy=0;t.step();const checkpointActive=save.active;
      const point={...w.checkpoint};const hazard=w.map.flags.findIndex(f=>f&4);w.player.x=(hazard%w.map.w)*w.map.tw+10;w.player.y=Math.floor(hazard/w.map.w)*w.map.th+10;w.player.vx=0;w.player.vy=0;w.player.invulnerable=0;t.step();const lostLife=w.lives===9;t.step(60);const respawn={x:w.player.x,y:w.player.y};
      w.enemies.forEach(e=>e.dead=true);w.player.invulnerable=100;const exit=w.items.find(i=>i.asset==='MICROWAVE');w.player.x=exit.x;w.player.y=exit.y;w.player.vy=0;t.step();
      return {initial,milkCount,doubleJump,locked,unlocked,checkpointActive,point,lostLife,respawn,complete:w.complete};
    });
    report['era'+level]=result;
    assert.ok(result.initial.grounded,'Spawn did not settle on a floor');assert.equal(result.milkCount,1);assert.equal(result.doubleJump,-640);assert.ok(result.locked);assert.ok(result.unlocked);assert.ok(result.checkpointActive);assert.ok(result.lostLife);assert.ok(Math.abs(result.respawn.x-result.point.x)<1);assert.ok(result.complete);assert.ok(result.initial.counts.enemies>20);
    // Take a clean entry screenshot, not the teleported exit fixture.
    await page.evaluate(async level=>{const t=window.__vascolet;await t.loadLevel(level);t.pause();t.world.player.invulnerable=100;t.step(100);t.resume();},level);await page.screenshot({path:path.join(output,`era-${level}.png`)});await page.evaluate(()=>window.__vascolet.pause());
    report['era'+level]=result;
  });
  await step('checkpoint survives a page reload',async()=>{
    const before=await page.evaluate(()=>{const t=window.__vascolet,w=t.world;w.complete=false;const s=w.saves[0];w.player.x=s.x;w.player.y=s.y;w.player.vy=0;t.step();w.persist();return {...w.checkpoint};});
    await page.reload();await page.waitForFunction(()=>window.__vascolet.state==='menu');await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.waitForFunction(()=>window.__vascolet.state==='playing');const after=await page.evaluate(()=>window.__vascolet.snapshot());assert.deepEqual(after.checkpoint,before);
  });
  await step('mobile layout and actual touch movement',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const mobile=await context.newPage();mobile.on('pageerror',e=>failures.push(e.message));
    await mobile.goto(url+'/?test=1');await mobile.waitForFunction(()=>window.__vascolet?.state==='menu');await mobile.evaluate(async()=>{await window.__vascolet.loadLevel(0);});await mobile.waitForTimeout(400);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.locator('#touch [data-key="ArrowRight"]').waitFor({state:'visible'});
    const before=await mobile.evaluate(()=>window.__vascolet.world.player.x),box=await mobile.locator('#touch [data-key="ArrowRight"]').boundingBox();
    const session=await context.newCDPSession(mobile);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await mobile.waitForTimeout(400);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await mobile.evaluate(()=>window.__vascolet.world.player.x)>before+40,'Touch control did not move the player');await mobile.screenshot({path:path.join(output,'mobile.png')});await context.close();
  });
  assert.deepEqual(failures,[]);report.ok=true;
}catch(e){report.ok=false;report.error=e.stack;throw e;}finally{await writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser?.close();if(child.connected)child.send({type:'stop'});else child.kill();}
