import { HARD,PLATFORM,HAZARD,LADDER,LADDER_END } from './tmx.js';
// Original data at 0050a7bc..0050a820; world coordinates are original pixels.
export const PHYSICS=Object.freeze({speed:250,gravity:1800,maxSpeed:1500,width:50,height:90,climb:150,jumps:[600,700,790,810,850],doubleJumps:[0,640,680,720,760]});
export const SKIN=.49;
// bat::MobileObject, 00447290: displacement v*dt + a*dt²/2, then velocity.
// The 1500 limit is a VECTOR magnitude, not a separately invented fall speed.
export function nativeMotion(body,dt,accelY=PHYSICS.gravity){
  let dx=body.vx*dt,dy=body.vy*dt+accelY*dt*dt/2,vx=body.vx,vy=body.vy+accelY*dt;
  const displacement=Math.hypot(dx,dy),limit=PHYSICS.maxSpeed*dt;if(displacement>limit){dx*=limit/displacement;dy*=limit/displacement;}
  const speed=Math.hypot(vx,vy);if(speed>PHYSICS.maxSpeed){vx*=PHYSICS.maxSpeed/speed;vy*=PHYSICS.maxSpeed/speed;}
  return {moveVX:dx/dt,moveVY:dy/dt,vx,vy};
}
export const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function flagsAt(map,x,y){const tx=Math.floor(x/map.tw),ty=Math.floor(y/map.th);return tx<0||ty<0||tx>=map.w||ty>=map.h?0:map.flags[ty*map.w+tx];}
export function touchesFlag(map,body,flag){
  for(let y=Math.floor((body.y+1)/map.th);y<=Math.floor((body.y+body.h-1)/map.th);y++)for(let x=Math.floor((body.x+1)/map.tw);x<=Math.floor((body.x+body.w-1)/map.tw);x++)if(x>=0&&y>=0&&x<map.w&&y<map.h&&(map.flags[y*map.w+x]&flag))return true;
  return false;
}
export function onLadder(map,b){return Boolean(flagsAt(map,b.x+b.w/2,b.y+b.h*.6)&(LADDER|LADDER_END));}
export function moveBody(map,b,dt,{platforms=[],doors=[],drop=false,climbing=false}={}){
  const previous={x:b.x,y:b.y}; b.grounded=false;b.hitX=false;b.hitCeiling=false;
  const move=(axis,amount)=>{
    if(!amount)return;
    const steps=Math.max(1,Math.ceil(Math.abs(amount)/(Math.min(map.tw,map.th)/3)));
    for(let i=0;i<steps;i++){
      const before=axis==='y'?b.y:b.x;b[axis]+=amount/steps;
      const x0=Math.max(0,Math.floor(b.x/map.tw)),x1=Math.min(map.w-1,Math.floor((b.x+b.w-.01)/map.tw));
      const skin=axis==='y'&&amount>=0?SKIN:0;
      const y0=Math.max(0,Math.floor(b.y/map.th)),y1=Math.min(map.h-1,Math.floor((b.y+b.h+skin-.01)/map.th));
      const solids=[];
      for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
        const f=map.flags[ty*map.w+tx];
        const solid=Boolean(f&HARD)||(!climbing&&axis==='y'&&amount>=0&&!drop&&(f&(PLATFORM|LADDER_END))&&before+b.h<=ty*map.th+.5);
        if(solid)solids.push({x:tx*map.tw,y:ty*map.th,w:map.tw,h:map.th});
      }
      for(const d of doors)if(!d.open&&overlap(b,d))solids.push(d);
      if(axis==='y'&&amount>=0&&!drop)for(const p of platforms)if(before+b.h<=p.y+Math.max(2,p.dy??0)&&overlap({...b,h:b.h+SKIN},p))solids.push(p);
      for(const r of solids){
        if(!overlap(skin?{...b,h:b.h+skin}:b,r))continue;
        if(axis==='x'){b.x=amount>0?r.x-b.w:r.x+r.w;b.vx=0;b.hitX=true;}
        else if(amount>=0){b.y=r.y-b.h-SKIN;b.vy=0;b.grounded=true;}
        else {b.y=r.y+r.h;b.vy=0;b.hitCeiling=true;}
      }
    }
  };
  move('x',b.vx*dt);move('y',b.vy*dt);
  b.x=clamp(b.x,0,map.w*map.tw-b.w);return previous;
}
export function hazardous(map,b){return touchesFlag(map,b,HAZARD)||b.y>map.h*map.th+200;}
