// Compare the web renderer against every room captured from the Windows game.
// Moving actors, the player, HUD and sign text are excluded from the static score.
import {chromium} from 'playwright-core';
import {fork} from 'node:child_process';
import {readFile,writeFile,access,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'analysis/web-reference');await mkdir(output,{recursive:true});
const candidates=[process.env.BROWSER_EXECUTABLE,chromium.executablePath()].filter(Boolean);
if(process.env.LOCALAPPDATA){const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');for(const d of(await readdir(cache)).filter(d=>/^chromium-/.test(d)).sort().reverse())candidates.push(path.join(cache,d,'chrome-win64/chrome.exe'));}
let executablePath;for(const p of candidates){try{await access(p);executablePath=p;break;}catch{}}if(!executablePath)throw Error('Browser missing');
const server=fork(path.join(root,'tools/serve.mjs'),['--port','0'],{silent:true,cwd:root});const url=await new Promise((resolve,reject)=>{server.once('error',reject);server.on('message',m=>{if(m.type==='ready')resolve(m.url);});});
let browser;const records=[];const names=['prehistory','egypt','castle','pirates','future'];
try{
  browser=await chromium.launch({executablePath,headless:true});const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.goto(url+'/?test=1');await page.waitForFunction(()=>window.__vascolet?.state==='menu');
  for(const [level,name] of names.entries()){
    const survey=JSON.parse(await readFile(path.join(root,`analysis/native-reference/world/${name}/scenes.json`),'utf8'));
    await page.evaluate(async level=>{const t=window.__vascolet;t.freeze();await t.loadLevel(level);t.world.player.invulnerable=1000;},level);
    for(const room of survey.rooms){
      const result=await page.evaluate(async({name,room})=>{
        const t=window.__vascolet,w=t.world,b=w.player;
        w.complete=false;w.death=null;w.effects=[];w.consumed.clear();w.lives=10;w.score=0;Object.keys(w.counts).forEach(k=>w.counts[k]=0);
        t.place(room.column*1216+room.fixture.x-25,room.row*912+room.fixture.y-90);b.invulnerable=1000;t.step(3);
        const simulationRoom=[w.camera.x/1216,w.camera.y/912];
        // Compare the SAME authored room. A fallback placement inside solid
        // fill may depenetrate differently; retain that fact separately rather
        // than comparing one room's image with its neighbour.
        w.camera.x=room.column*1216;w.camera.y=room.row*912;t.draw();
        const canvas=document.querySelector('#game'),pixels=canvas.getContext('2d').getImageData(0,0,800,600).data;
        const bitmap=await createImageBitmap(await(await fetch(`/analysis/native-reference/world/${name}/${room.file}`)).blob());
        const ref=new OffscreenCanvas(800,600),ctx=ref.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const original=ctx.getImageData(0,0,800,600).data;
        const mask=new Uint8Array(800*600);mask.fill(1);
        function exclude(x,y,width,height){const left=Math.max(0,Math.floor(x)),right=Math.min(800,Math.ceil(x+width)),top=Math.max(0,Math.floor(y)),bottom=Math.min(600,Math.ceil(y+height));if(right<=left||bottom<=top)return;for(let py=top;py<bottom;py++)mask.fill(0,py*800+left,py*800+right);}
        exclude(0,0,800,62);exclude(0,99,800,57);exclude((room.fixture.x-140)*2/3,(room.fixture.y-250)*2/3,200,210);
        for(const o of [...w.enemies,...w.items,...w.platforms])if(w.inRoom(o)){
          const a=t.Art.atlas[o.asset],dx=Number(o.props.pxDelta)||0,dy=Number(o.props.pyDelta)||0;
          const cx=o.baseX??o.x,cy=o.baseY??o.y,margin=o.type==='Item'?10:100;
          exclude((cx+o.w/2-a.ax-w.camera.x+Math.min(0,dx)-margin)*2/3,(cy+o.h-a.ay-w.camera.y+Math.min(0,dy)-margin)*2/3,(a.w+Math.abs(dx)+margin*2)*2/3,(a.h+Math.abs(dy)+margin*2)*2/3);
        }
        let sum=0,count=0,total=0;
        for(let i=0;i<800*600;i++)for(let c=0;c<3;c++){const d=Math.abs(pixels[i*4+c]-original[i*4+c]);total+=d;if(mask[i]){sum+=d;count++;}}
        return {staticMAE:sum/count,fullMAE:total/(800*600*3),staticPixels:count/3,simulationRoom,actualRoom:[w.camera.x/1216,w.camera.y/912]};
      },{name,room});
      records.push({level:name,column:room.column,row:room.row,...result});
    }
    const group=records.filter(r=>r.level===name);console.log(name,group.length,'rooms, average static MAE',group.reduce((n,r)=>n+r.staticMAE,0)/group.length);
  }
  const report={scope:'Static-world RGB MAE (0–255), compared with JPEG captures from the original. Excludes moving actors, player, HUD and the sign-text band. This is not a dynamic behavior equivalence test.',rooms:records.length,records};
  await writeFile(path.join(output,'scene-comparison.json'),JSON.stringify(report,null,2));console.log('Worst rooms:',[...records].sort((a,b)=>b.staticMAE-a.staticMAE).slice(0,10));
}finally{await browser?.close();if(server.connected)server.send({type:'stop'});else server.kill();}
