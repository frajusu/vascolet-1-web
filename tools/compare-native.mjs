import {chromium} from 'playwright-core';
import {fork} from 'node:child_process';
import {mkdir,writeFile,access,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'analysis/web-reference');await mkdir(output,{recursive:true});
const candidates=[process.env.BROWSER_EXECUTABLE,chromium.executablePath()].filter(Boolean);
if(process.env.LOCALAPPDATA){const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');for(const d of(await readdir(cache).catch(()=>[])).filter(d=>/^chromium-/.test(d)).sort().reverse())candidates.push(path.join(cache,d,'chrome-win64/chrome.exe'));}
let executablePath;for(const c of candidates){try{await access(c);executablePath=c;break;}catch{}}if(!executablePath)throw Error('Browser missing');
const server=fork(path.join(root,'tools/serve.mjs'),['--port','0'],{silent:true,cwd:root});
const url=await new Promise((resolve,reject)=>{server.once('error',reject);server.on('message',m=>{if(m.type==='ready')resolve(m.url);});});
let browser;const errors=[];
try{
  browser=await chromium.launch({executablePath,headless:true});const page=await browser.newPage({viewport:{width:800,height:600}});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(url+'/?test=1');await page.waitForFunction(()=>window.__vascolet?.state==='menu');
  const capture=async name=>{await page.locator('#game').screenshot({path:path.join(output,name+'.png')});};
  await capture('menu');await page.getByRole('button',{name:'Opciones',exact:true}).click();await page.mouse.move(790,590);await capture('options');await page.getByRole('button',{name:'Atrás',exact:true}).click();
  await page.getByRole('button',{name:'Ayuda',exact:true}).click();await capture('help');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vascolet.state==='menu');
  await page.getByRole('button',{name:'Creditos',exact:true}).click();await capture('credits');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__vascolet.state==='menu');
  for(let i=0;i<5;i++){
    await page.evaluate(async i=>{const t=window.__vascolet;t.freeze();await t.loadLevel(i);t.step(180);},i);
    await capture(['prehistory','egypt','castle','pirates','future'][i]+'-start');
    if(i===0){await page.evaluate(()=>{const t=window.__vascolet;t.world.player.x+=125;t.step(1);t.pause();});await capture('pause');await page.getByRole('button',{name:'Salir',exact:true}).click();await capture('confirm');}
  }
  await page.evaluate(async()=>{const s=await import('/js/save.js');s.Save.data.completed=[0,1,2,3,4];await window.__vascolet.select();});await page.mouse.move(790,590);await capture('select');
  await writeFile(path.join(output,'report.json'),JSON.stringify({errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('Native comparison captures:',output);
}finally{await browser?.close();if(server.connected)server.send({type:'stop'});else server.kill();}
