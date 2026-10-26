import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {animationDuration,sampleAnimation} from '../js/animation-timing.js';
import {animationSounds,shotSound,PLAYER_FRAME_SOUNDS} from '../js/sound-events.js';
const data=JSON.parse(await readFile(new URL('../assets/data/animations.json',import.meta.url),'utf8'));
const animations=Object.fromEntries(Object.values(data).flat().map(a=>[a.key,a]));
const audio=JSON.parse(await readFile(new URL('../assets/data/audio.json',import.meta.url),'utf8'));
test('native effect manifest has all shipped sounds, original aliases and gains',async()=>{
  const inventory=JSON.parse(await readFile(new URL('../analysis/inventory.json',import.meta.url),'utf8'));
  assert.equal(audio.effects.length,21);assert.deepEqual(new Set(audio.effects.map(e=>e.path)),new Set(inventory.filter(e=>e.path.startsWith('assets/audio/fx/')).map(e=>e.path)));
  const byKey=new Map(audio.effects.map(e=>[e.key,e]));assert.ok(byKey.get('JUMP').path.endsWith('jump_vascolet.ogg'));assert.ok(byKey.get('JUMP_ENEMY').path.endsWith('/jump.ogg'));assert.ok(Math.abs(byKey.get('ITEM').gain-.6)<1e-6);assert.ok(Math.abs(byKey.get('POWERUP').gain-.4)<1e-6);
  for(const mapping of Object.values(PLAYER_FRAME_SOUNDS))for(const key of Object.values(mapping))assert.ok(byKey.has(key));
});
test('walking, dinosaur footsteps and stairs use native frame boundaries only once',()=>{
  assert.deepEqual(animationSounds('WALK',0,32/60,animations),['STEP_1','STEP_2']);
  assert.deepEqual(animationSounds('D_WALK',0,66/60,animations),['D_STEP_2','D_STEP_1']);
  assert.deepEqual(animationSounds('CLIMB',0,40/60,animations),['STAIR_1','STAIR_2']);
  assert.deepEqual(animationSounds('CLIMB',0,-40/60,animations),['STAIR_2','STAIR_1']);
  assert.deepEqual(animationSounds('WALK',8/60,9/60,animations),[]);assert.deepEqual(animationSounds('CLIMB',.3,.3,animations),[]);
  assert.equal(sampleAnimation(animations.CLIMB,-1/60).frame,23);
});
test('particle lifetime follows original animation duration and shot sound follows asset',()=>{
  assert.equal(animationDuration(animations.POWER),1);assert.equal(animationDuration(animations.ENEMY_DEATH),32/60);assert.equal(shotSound('CANNON_PREHISTORY'),'SHOOT');assert.equal(shotSound('CANNON_LASER'),'LASER');assert.equal(shotSound('CANNON_CASTLE'),'SHOOT');assert.equal(shotSound('CANNON_EGYPT'),'SHOOT');assert.equal(shotSound('CANNON_PIRATES'),'CANNON');assert.equal(shotSound('custom','CANNONBALL_FUTURE'),'LASER');
});
