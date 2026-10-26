import {crossedAnimationFrames} from './animation-timing.js';
// Original player update 004313c0 (timeline indices, not atlas frame numbers).
export const PLAYER_FRAME_SOUNDS=Object.freeze({
  WALK:{2:'STEP_1',6:'STEP_2'},
  D_WALK:{3:'D_STEP_2',9:'D_STEP_1'},
  CLIMB:{1:'STAIR_1',3:'STAIR_2'},
});
export function animationSounds(name,from,to,animations){
  const events=PLAYER_FRAME_SOUNDS[name];if(!events)return [];
  return crossedAnimationFrames(animations[name],from,to,Object.keys(events).map(Number)).map(e=>events[e.index]);
}
// 004401a0 sets flags from the projectile key; 00440580 plays their sound.
export function shotSound(asset,bulletAsset){
  const bullet=bulletAsset??({CANNON_LASER:'CANNONBALL_FUTURE',CANNON_PIRATES:'CANNONBALL_PIRATES'}[asset]);
  return bullet==='CANNONBALL_FUTURE'?'LASER':bullet==='CANNONBALL_PIRATES'?'CANNON':'SHOOT';
}
