export const SIMULATION_STEP=1/60;
export class FixedStepClock {
  constructor(){this.accumulator=0;}
  reset(){this.accumulator=0;}
  advance(elapsed,step){
    this.accumulator+=Math.max(0,Math.min(.1,Number.isFinite(elapsed)?elapsed:0));let steps=0;
    while(this.accumulator+1e-12>=SIMULATION_STEP){step(SIMULATION_STEP);this.accumulator-=SIMULATION_STEP;steps++;}
    if(this.accumulator<1e-12)this.accumulator=0;
    return {steps,alpha:Math.max(0,Math.min(1,this.accumulator/SIMULATION_STEP))};
  }
}
const fields=['x','y','age','animTime','time','progress','animation','hidden'];
const mix=(a,b,t)=>a+(b-a)*t;
// Presentation-only snapshots. Nothing here changes collision coordinates,
// saved data, animation-event timing, RNG or the authored room transitions.
export class RenderHistory {
  constructor(){this.previous=null;}
  reset(){this.previous=null;}
  capture(world){
    const actors=new WeakMap();
    function remember(actor){if(actor)actors.set(actor,Object.fromEntries(fields.map(key=>[key,actor[key]])));}
    remember(world.player);remember(world.death);remember(world.exit);
    for(const collection of [world.platforms,world.enemies,world.doors,world.shots,world.effects])for(const actor of collection??[])if(world.inRoom(actor))remember(actor);
    this.previous={map:world.map,room:world.roomKey,time:world.time,roomTime:world.roomTime,actors};
  }
  frame(world,alpha=1){
    const previous=this.previous;
    if(!previous||previous.map!==world.map||previous.room!==world.roomKey||alpha>=1)return null;
    const fraction=Math.max(0,Math.min(1,alpha));
    return {
      value(actor,key){
        const old=previous.actors.get(actor),current=actor[key];
        if(!old||old.hidden!==actor.hidden||key==='animTime'&&old.animation!==actor.animation||!Number.isFinite(old[key])||!Number.isFinite(current))return current;
        return mix(old[key],current,fraction);
      },
      clock(key){return Number.isFinite(previous[key])&&Number.isFinite(world[key])?mix(previous[key],world[key],fraction):world[key];},
    };
  }
}
