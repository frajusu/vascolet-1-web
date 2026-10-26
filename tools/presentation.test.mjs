import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FixedStepClock,RenderHistory,SIMULATION_STEP} from '../js/presentation.js';
import {animationSounds} from '../js/sound-events.js';
const data=JSON.parse(await readFile(new URL('../assets/data/animations.json',import.meta.url),'utf8'));
const animations=Object.fromEntries(Object.values(data).flat().map(a=>[a.key,a]));
function world(){return {map:{},roomKey:'1,3',time:0,roomTime:0,player:{x:0,y:0,animTime:0,animation:'WALK'},enemies:[],platforms:[],doors:[],shots:[],effects:[],inRoom:()=>true};}

test('60/120/144 Hz render cadence keeps identical physics and sound events',()=>{
  for(const hz of [60,120,144]){
    const w=world(),clock=new FixedStepClock(),history=new RenderHistory(),positions=[],sounds=[];let ticks=0;
    for(let frame=0;frame<hz;frame++){
      const {alpha}=clock.advance(1/hz,dt=>{history.capture(w);ticks++;w.player.x+=250*dt;const previous=w.player.animTime;w.player.animTime+=dt;w.time+=dt;w.roomTime+=dt;sounds.push(...animationSounds('WALK',previous,w.player.animTime,animations));});
      const view=history.frame(w,alpha);positions.push(view?view.value(w.player,'x'):w.player.x);
    }
    assert.equal(ticks,60,hz);assert.ok(Math.abs(w.player.x-250)<1e-9,hz);assert.deepEqual(sounds,['STEP_1','STEP_2','STEP_1','STEP_2'],hz);
    if(hz>60)assert.ok(new Set(positions.map(x=>x.toFixed(6))).size>hz*.95,'High-refresh render should have intermediate positions');
    for(let i=4;i<positions.length;i++)assert.ok(Math.abs(positions[i]-positions[i-1]-250/hz)<1e-8,hz);
  }
});
test('render snapshots interpolate moving actors and clocks without mutating simulation',()=>{
  const w=world(),platform={x:5,y:10,age:0},door={progress:0};w.platforms.push(platform);w.doors.push(door);const history=new RenderHistory();history.capture(w);
  w.player.x=10;w.player.animTime=.1;platform.x=15;platform.y=30;door.progress=.5;w.roomTime=.1;
  const before=JSON.stringify(w),view=history.frame(w,.25);
  assert.equal(view.value(w.player,'x'),2.5);assert.equal(view.value(platform,'y'),15);assert.equal(view.value(door,'progress'),.125);assert.equal(view.clock('roomTime'),.025);assert.equal(JSON.stringify(w),before);
});
test('room changes, new actors, respawn and animation switches never smear or rewind',()=>{
  const w=world(),history=new RenderHistory();history.capture(w);w.player.x=500;w.roomKey='2,3';assert.equal(history.frame(w,.5),null);
  history.capture(w);w.player={x:100,y:50,animTime:0,animation:'JUMP'};assert.equal(history.frame(w,.5).value(w.player,'x'),100);
  history.capture(w);w.player.animation='CLIMB';w.player.animTime=0;assert.equal(history.frame(w,.5).value(w.player,'animTime'),0);
  history.reset();assert.equal(history.frame(w,.5),null);
});
test('stalls are bounded and pause/reset does not carry old accumulator time',()=>{
  const clock=new FixedStepClock();let ticks=0;clock.advance(20,()=>ticks++);assert.equal(ticks,6);clock.advance(SIMULATION_STEP/2,()=>ticks++);clock.reset();assert.deepEqual(clock.advance(SIMULATION_STEP/2,()=>ticks++),{steps:0,alpha:.5});assert.equal(ticks,6);
});
