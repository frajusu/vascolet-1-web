import { Art,loadImage,loadXML } from './assets.js';
import { parseTMX,originalText,HAZARD } from './tmx.js';
import { PHYSICS,nativeMotion,moveBody,overlap,clamp,flagsAt,onLadder,hazardous } from './physics.js';
import { Input } from './input.js';
import { Save } from './save.js';
import { AudioSystem as Audio } from './audio.js';

export const ERAS=[
  {id:'prehistory',name:'Prehistoria',intro:'intro_prehistoria',music:'prehistoria'},
  {id:'egypt',name:'Egipto',intro:'intro_egipto',music:'andy'},
  {id:'castle',name:'Castillo',intro:'intro_castillo',music:'castillo'},
  {id:'pirates',name:'Piratas',intro:'intro_pirata',music:'piratas'},
  {id:'future',name:'Futuro',intro:'intro_futuro',music:'futuro'},
];
// StageManager 004276b0: 16×12 cells, with a 1200×900 native display region.
// Keep TMX's 76px coordinates intact and fit each 1216×912 room into 4:3.
export const ROOM_COLUMNS=16,ROOM_ROWS=12;
export const VIEW_WIDTH=1200,VIEW_HEIGHT=900;
const enemyTypes=new Set(['Enemy','Fire','Bird','Piranha','Guillotine','Thrower','Jumper','Stalactite']);
const numeric=(p,k,fallback=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):fallback;
const truth=(p,k)=>String(p[k]).toLowerCase()==='true';
const near=(a,b,margin=750)=>Math.abs(a.x-b.x)<margin&&Math.abs(a.y-b.y)<margin;
const seedCounts=()=>({YELLOW_KEY:0,RED_KEY:0,GREEN_KEY:0,BLUE_KEY:0,VASCOLETS:0,CEREALS:0});

export class World {
  constructor(){this.map=null;this.level=0;this.time=0;this.score=0;this.lives=10;this.counts=seedCounts();this.consumed=new Set();this.checkpoint=null;this.camera={x:0,y:0};this.death=null;this.events=[];this.complete=false;}
  async load(level,{resume=false,carry=false}={}){
    const era=ERAS[level];if(!era)throw Error('Época inválida');
    const map=parseTMX(await loadXML('assets/data/'+era.id+'.tmx'));
    const native=Art.nativeObjects[era.id];if(!native)throw Error('Missing observed object geometry for '+era.id);
    for(const n of native){const o=map.objects[n.id];if(!o||o.type!==n.type)throw Error('Native/TMX object correspondence changed');Object.assign(o,{sourceRect:{x:o.x,y:o.y,w:o.w,h:o.h},x:n.x,y:n.y,w:n.w,h:n.h,room:n.room});}
    await Promise.all(map.tilesets.map(t=>loadImage(t.image)));
    this.map=map;this.level=level;this.time=0;this.roomKey=null;this.roomTime=0;this.complete=false;this.exit=null;this.death=null;this.events=[];this.particles=[];this.shots=[];this.effects=[];this.meteorTimer=.7;
    if(!carry){this.lives=10;this.score=0;}this.counts=seedCounts();this.consumed=new Set();
    // The native object loader overwrites the player position in document order.
    // Egypt ships a stale first spawn; the final Vascolet object is the entrance.
    const spawn=map.objects.filter(o=>o.type==='Vascolet').at(-1);if(!spawn)throw Error('Mapa sin Vascolet');
    this.checkpoint={x:spawn.x-PHYSICS.width/2,y:spawn.y-PHYSICS.height};
    let opened=[];
    const saved=Save.data.run;
    if(resume&&saved?.level===level){this.lives=saved.lives;this.score=saved.score;this.counts={...seedCounts(),...saved.counts};this.consumed=new Set(saved.consumed);this.checkpoint={...saved.checkpoint};opened=saved.doors;}
    this.items=map.objects.filter(o=>o.type==='Item').map(o=>({...o,asset:o.props.pAsset,baseY:o.y}));
    this.signs=map.objects.filter(o=>o.type==='Information').map(o=>({...o,text:originalText(o.props.pText)}));
    this.saves=map.objects.filter(o=>o.type==='SavePoint').map(o=>({...o,active:Math.abs(this.checkpoint.x-o.x)<80&&Math.abs(this.checkpoint.y+90-o.y-o.h)<90}));
    this.doors=map.objects.filter(o=>o.type==='Door').map(o=>({...o,asset:o.props.pAsset,open:opened.includes(o.id),progress:opened.includes(o.id)?1:0,required:o.props.pRequiredItem,count:numeric(o.props,'pRequiredCount',numeric(o.props,'pCount',1))}));
    this.platforms=map.objects.filter(o=>o.type==='Platform'||o.type==='PlatformInterp').map(o=>({...o,asset:o.props.pAsset,baseX:o.x,baseY:o.y,dx:0,dy:0,phase:0}));
    this.enemies=map.objects.filter(o=>enemyTypes.has(o.type)).map(o=>{
      const a=Art.atlas[o.props.pAsset];if(!a)throw Error('No hay atlas para '+o.props.pAsset);
      return {...o,baseX:o.x,baseY:o.y,asset:o.props.pAsset,vx:numeric(o.props,'pxVel'),vy:numeric(o.props,'pyVel'),dead:false,timer:numeric(o.props,'pMinTime',2),age:0,activated:false,falling:false,look:numeric(o.props,'pLook',numeric(o.props,'pxVel',1)<0?-1:1)};
    });
    this.resetPlayer();this.camera.x=this.player.x-375;this.camera.y=this.player.y-285;this.updateCamera(1);
    Save.data.lastLevel=level;this.persist();Audio.playMusic(era.music);
  }
  resetPlayer(){this.player={...this.checkpoint,w:PHYSICS.width,h:PHYSICS.height,vx:0,vy:0,grounded:false,face:1,jumps:0,coyote:0,buffer:0,invulnerable:0,animation:'',animTime:0,climbing:false,drop:0};}
  persist(){if(!this.map||this.complete||this.lives<0)return;Save.data.run={level:this.level,lives:this.lives,score:this.score,counts:{...this.counts},checkpoint:{...this.checkpoint},consumed:[...this.consumed],doors:this.doors.filter(d=>d.open).map(d=>d.id)};Save.write();}
  animate(name){if(this.player.animation!==name){this.player.animation=name;this.player.animTime=0;}}
  addScore(points){const old=Math.floor(this.score/2000);this.score+=points;const gained=Math.floor(this.score/2000)-old;if(gained>0){this.lives+=gained;Audio.effect('extra_life');}}
  collect(item){
    if(this.consumed.has(item.id))return;this.consumed.add(item.id);
    const key=item.props.pRequiredItem??item.asset,count=numeric(item.props,'pCount',1);
    if(key==='POINTS'){this.addScore(count);Audio.effect('item');}
    else if(key==='LIVES'){this.lives+=count;Audio.effect('extra_life');}
    else if(key==='MICROWAVE'){this.finish();return;}
    else {
      this.counts[key]=(this.counts[key]??0)+count;
      if(key==='VASCOLETS'||key==='CEREALS'){
        this.counts[key]=Math.min(4,this.counts[key]);Audio.effect('powerup');
      } else Audio.effect('item');
    }
    this.effects.push({asset:'POWER',x:item.x+item.w/2,y:item.y+item.h,age:0});this.persist();
  }
  finish(){if(this.complete)return;this.complete=true;this.exit={time:0,x:this.player.x+this.player.w/2,y:this.player.y+this.player.h,done:false};Save.data.completed=[...new Set([...Save.data.completed,this.level])];Save.data.bestCoins??=[0,0,0,0,0];Save.data.bestCoins[this.level]=Math.max(Save.data.bestCoins[this.level],this.items.filter(i=>i.asset==='COIN'&&this.consumed.has(i.id)).length);Save.data.run=null;Save.write();Audio.suspend();Audio.effect('microwave');}
  die(){if(this.death||this.complete||this.player.invulnerable>0)return;this.death={time:0,wait:1,x:this.player.x,y:this.player.y,vy:-800};Audio.suspend();Audio.effect('death_1');}
  updateCamera(dt){
    const p=this.player,m=this.map,w=ROOM_COLUMNS*m.tw,h=ROOM_ROWS*m.th;
    const originX=p.x+p.w/2,centerY=p.y+p.h/2;
    if(!this.roomKey||dt>=.5||Math.abs(originX-this.camera.x)>w*1.5||Math.abs(centerY-this.camera.y)>h*1.5){
      this.camera.x=clamp(Math.floor(originX/w)*w,0,Math.max(0,m.w*m.tw-w));
      this.camera.y=clamp(Math.floor(centerY/h)*h,0,Math.max(0,m.h*m.th-h));
    }else{
      // 00432320/004279d0: cross a 1200×900 viewport, then activate the next
      // 16×12 source-tile room. The 16/12px seams are not a smooth camera pan.
      if(originX-this.camera.x>VIEW_WIDTH&&this.camera.x+w<m.w*m.tw){p.x+=w-VIEW_WIDTH;this.camera.x+=w;}
      else if(originX<this.camera.x&&this.camera.x>0){p.x-=w-VIEW_WIDTH;this.camera.x-=w;}
      if(centerY-this.camera.y>VIEW_HEIGHT&&this.camera.y+h<m.h*m.th){p.y+=h-VIEW_HEIGHT;this.camera.y+=h;}
      else if(centerY<this.camera.y&&this.camera.y>0){p.y-=h-VIEW_HEIGHT;this.camera.y-=h;}
    }
    const key=this.camera.x+','+this.camera.y;
    if(this.roomKey!==key){
      this.roomKey=key;this.roomTime=0;this.sign=null;
      for(const e of this.enemies??[])if(this.inRoom(e)){
        if(!truth(e.props,'pIsKey'))e.dead=false;e.x=e.baseX;e.y=e.baseY;e.age=0;e.vx=numeric(e.props,'pxVel');e.vy=numeric(e.props,'pyVel');e.timer=numeric(e.props,'pMinTime',2);e.falling=false;
      }
      for(const p of this.platforms??[])if(this.inRoom(p)){p.x=p.baseX;p.y=p.baseY;p.age=0;p.dx=0;p.dy=0;}
      this.shots=[];
    }
  }
  inRoom(object){return !object.room||(object.room[0]===Math.round(this.camera.x/(ROOM_COLUMNS*this.map.tw))&&object.room[1]===Math.round(this.camera.y/(ROOM_ROWS*this.map.th)));}
  updatePlatforms(dt){
    for(const p of this.platforms){
      if(!this.inRoom(p))continue;p.age=(p.age??0)+dt;
      const x=p.x,y=p.y,props=p.props,dx=numeric(props,'pxDest'),dy=numeric(props,'pyDest');
      const duration=p.type==='Platform'?Math.max(.1,Math.hypot(dx,dy)/numeric(props,'pSpeed',100)):Math.max(.1,numeric(props,'pDuration',2));
      const wait=Math.max(0,numeric(props,'pWait')),cycle=2*(duration+wait),phase=p.age%cycle;
      const fraction=phase<duration?phase/duration:phase<duration+wait?1:phase<2*duration+wait?1-(phase-duration-wait)/duration:0;
      // Interpolated platforms ease into each endpoint; linear ones keep their TMX speed.
      const t=p.type==='PlatformInterp'?(1-Math.cos(Math.PI*fraction))/2:fraction;
      p.x=p.baseX+dx*t;p.y=p.baseY+dy*t;p.dx=p.x-x;p.dy=p.y-y;
      const b=this.player;if(!this.death&&b.grounded&&b.x+b.w>x&&b.x<x+p.w&&Math.abs(b.y+b.h-y)<3){
        const carry={...b,vx:p.dx/dt,vy:p.dy/dt};moveBody(this.map,carry,dt,{doors:this.doors});b.x=carry.x;b.y=carry.y;
      }
    }
  }
  updateEnemies(dt){
    const player=this.player;
    for(const e of this.enemies){
      if(e.dead||!this.inRoom(e))continue;e.age+=dt;e.activated=true;const p=e.props;
      if(e.type==='Bird'){
        const duration=Math.max(.1,numeric(p,'pDuration',4)),t=(Math.sin(e.age*Math.PI*2/duration-Math.PI/2)+1)/2;
        const previous=e.x;e.x=e.baseX+numeric(p,'pxDelta',300)*t;e.y=e.baseY+numeric(p,'pyDelta',20)*Math.sin(e.age*Math.PI*2/duration);e.look=e.x<previous?-1:1;
      }else if(e.type==='Piranha'){
        const duration=Math.max(.1,numeric(p,'pDuration',1.5)),wait=Math.max(.1,numeric(p,'pMinTime',1)),t=e.age%(duration+wait);
        e.hidden=t>duration;const phase=Math.min(1,t/duration),old=e.y;e.y=e.baseY+numeric(p,'pyDelta',-250)*4*phase*(1-phase);e.vy=(e.y-old)/dt;
      }else if(e.type==='Guillotine'){
        const duration=Math.max(.1,numeric(p,'pDuration',.5)),wait=numeric(p,'pWait',1.7),phase=e.age%(duration*2+wait);
        e.y=e.baseY+numeric(p,'pyDelta',100)*(phase<duration?phase/duration:phase<duration+wait?1:1-(phase-duration-wait)/duration);
      }else if(e.type==='Stalactite'){
        if(!e.falling&&Math.abs(player.x-e.x)<numeric(p,'pxOffset',100)&&player.y>e.y)e.falling=true;
        if(e.falling){e.vy+=numeric(p,'pyAccel',800)*dt;moveBody(this.map,e,dt);if(e.grounded){e.dead=true;this.effects.push({asset:'ENEMY_DEATH',x:e.x,y:e.y,age:0});}}
      }else if(e.type==='Thrower'){
        e.timer-=dt;if(e.timer<=0){e.timer=numeric(p,'pMinTime',2)+(numeric(p,'pMaxTime',3)-numeric(p,'pMinTime',2))*.5;
          const vx=numeric(p,'pxVel',350),vy=numeric(p,'pyVel');e.look=vx<0?-1:1;
          this.shots.push({x:e.x+e.w/2+numeric(p,'pxOffset'),y:e.y+e.h+numeric(p,'pyOffset'),w:20,h:20,vx,vy,age:0,asset:p.pBulletAsset});Audio.effect(this.level===4?'laser':'cannon');}
      }else {
        if(e.type==='Jumper'&&e.grounded)e.vy=-Math.max(350,Math.abs(numeric(p,'pyVel',400)));
        e.vy+=PHYSICS.gravity*dt;const vx=e.vx;moveBody(this.map,e,dt,{doors:this.doors});
        if(e.hitX)e.vx=-vx;
        if(e.grounded&&truth(p,'pCollidesFloor')&&Math.abs(e.vx)>0){
          const ahead=e.vx>0?e.x+e.w+5:e.x-5;
          if(!(flagsAt(this.map,ahead,e.y+e.h+8)&3))e.vx=-e.vx;
        }
        if(e.vx)e.look=e.vx<0?-1:1;
      }
      if(e.hidden||!overlap(player,e)||this.death)continue;
      const canStomp=['Enemy','Jumper','Bird'].includes(e.type)&&!['STATIC_SNAKE','SNAKE_ROBOT','BIG_ROBOT'].includes(e.asset);
      if(canStomp&&player.vy>0&&this.previousPlayerY+player.h<=e.y+Math.max(20,player.vy*dt+5)){
        e.dead=true;player.vy=-380;this.addScore(100);Audio.effect('death_2');this.effects.push({asset:'ENEMY_DEATH',x:e.x+e.w/2,y:e.y+e.h,age:0});
      }else this.die();
    }
    const roomX=Math.floor((player.x+player.w/2)/(ROOM_COLUMNS*this.map.tw)),roomY=Math.floor((player.y+player.h-1)/(ROOM_ROWS*this.map.th));
    const meteorZone=truth(this.map.props,'pMeteorites')||truth(this.map.layer.props,`pMeteorite(${roomX},${roomY})`);
    if(meteorZone){this.meteorTimer-=dt;if(this.meteorTimer<=0){this.meteorTimer=.8;this.shots.push({x:this.camera.x+((Math.sin(this.time*17.13)+1)/2)*ROOM_COLUMNS*this.map.tw,y:this.camera.y-45,w:32,h:36,vx:80,vy:420,age:0,asset:this.map.props.pAssetMeteorites??'METEORITE',gravity:250});}}
    for(const shot of this.shots){shot.vy+=(shot.gravity??0)*dt;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.age+=dt;if(overlap(player,shot))this.die();if(flagsAt(this.map,shot.x,shot.y)&1)shot.age=99;}
    this.shots=this.shots.filter(s=>s.age<6&&near(s,player,1600));
  }
  update(dt,input=Input){
    if(!this.map)return;
    if(this.complete){if(this.exit&&!this.exit.done){this.exit.time+=dt;if(this.exit.time>=1){this.exit.done=true;this.events.push({type:'complete',level:this.level});}}return;}
    this.time+=dt;this.roomTime=(this.roomTime??0)+dt;
    for(const e of this.effects)e.age+=dt;this.effects=this.effects.filter(e=>e.age<1.2);
    if(this.death){
      this.death.time+=dt;
      if(this.death.wait>0){this.death.wait-=dt;if(this.death.wait<=0)Audio.effect('death_2');return;}
      const motion=nativeMotion({vx:0,vy:this.death.vy},dt);this.death.y+=motion.moveVY*dt;this.death.vy=motion.vy;
      if(this.death.y+this.player.h>this.camera.y+VIEW_HEIGHT+500){if(this.lives===0){this.events.push({type:'gameover'});this.complete=true;Save.data.run=null;Save.write();}else{this.lives--;this.resetPlayer();this.death=null;this.updateCamera(1);this.persist();Audio.resume();}}
      return;
    }
    const b=this.player;this.previousPlayerY=b.y;b.invulnerable=Math.max(0,b.invulnerable-dt);b.drop=Math.max(0,b.drop-dt);b.animTime+=dt;
    const motion=nativeMotion(b,dt,b.climbing?0:PHYSICS.gravity);b.vx=motion.vx;b.vy=motion.vy;
    b.coyote=b.grounded?.09:Math.max(0,b.coyote-dt);b.buffer=Math.max(0,b.buffer-dt);
    b.buffer=input.tap('Space','KeyZ')?1:0;
    const dx=Number(input.down('ArrowRight','KeyD'))-Number(input.down('ArrowLeft','KeyA'));
    const dy=Number(input.down('ArrowDown','KeyS'))-Number(input.down('ArrowUp','KeyW'));
    if(dx)b.face=dx;
    if(onLadder(this.map,b)&&dy){b.climbing=true;b.x=Math.floor((b.x+b.w/2)/this.map.tw)*this.map.tw+this.map.tw/2-b.w/2;}
    if(!onLadder(this.map,b))b.climbing=false;
    if(b.climbing){b.vy=dy*PHYSICS.climb;b.jumps=0;}
    if(b.grounded){b.jumps=0;}
    if(b.buffer>0){
      if(dy>0&&b.grounded){b.drop=.22;b.grounded=false;b.y+=3;b.buffer=0;}
      else if(b.grounded||b.climbing){b.vy=-PHYSICS.jumps[clamp(this.counts.VASCOLETS,0,4)];b.jumps=1;b.climbing=false;b.grounded=false;b.airSteer=dx?10:20;b.coyote=0;b.buffer=0;Audio.effect('jump');}
      else if(this.counts.CEREALS>0&&b.jumps<2){b.vy=-PHYSICS.doubleJumps[clamp(this.counts.CEREALS,0,4)];b.jumps=2;b.climbing=false;b.airSteer=dx?10:20;b.buffer=0;Audio.effect('jump_vascolet');}
    }
    b.vx=b.climbing?0:b.grounded?dx*PHYSICS.speed:clamp(b.vx+dx*(b.airSteer??20),-PHYSICS.speed,PHYSICS.speed);
    this.updatePlatforms(dt);
    for(const d of this.doors){
      if(!this.inRoom(d))continue;
      if(!d.open&&overlap({...b,x:b.x-10,w:b.w+20},d)){
        if((this.counts[d.required]??0)>=d.count){d.open=true;this.counts[d.required]-=d.count;Audio.effect('door');this.persist();}
      }
      if(d.open)d.progress=Math.min(1,d.progress+dt*2);
    }
    const moved={...b,vx:b.climbing?0:motion.moveVX,vy:motion.moveVY};
    moveBody(this.map,moved,dt,{doors:this.doors.filter(d=>this.inRoom(d)),platforms:this.platforms.filter(p=>this.inRoom(p)),drop:b.drop>0,climbing:b.climbing});
    b.x=moved.x;b.y=moved.y;b.hitX=moved.hitX;b.hitCeiling=moved.hitCeiling;b.grounded=moved.grounded&&b.vy>=0;
    if(b.grounded||moved.hitCeiling&&b.vy<0)b.vy=0;if(moved.hitX)b.vx=0;
    if(hazardous(this.map,b))this.die();
    for(const item of this.items)if(this.inRoom(item)&&!this.consumed.has(item.id)&&overlap(b,item))this.collect(item);
    for(const s of this.saves)if(this.inRoom(s)&&!s.active&&overlap(b,s)){
      this.saves.forEach(p=>p.active=false);s.active=true;this.checkpoint={x:s.x+(s.w-b.w)/2,y:s.y+s.h-b.h};Audio.effect('item');this.persist();
    }
    const sign=this.signs.find(s=>this.inRoom(s)&&overlap(b,s));this.sign=sign??null;
    this.updateEnemies(dt);
    const prefix=this.level===0?'D_':this.level===4?'P_':'';
    if(b.climbing)this.animate('CLIMB');else if(!b.grounded)this.animate(prefix+'JUMP');else if(dx)this.animate(prefix+'WALK');else this.animate('');
    this.updateCamera(dt);
  }
}
