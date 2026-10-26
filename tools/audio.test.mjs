import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAudioSystem} from '../js/audio.js';
const manifest=JSON.parse(await readFile(new URL('../assets/data/audio.json',import.meta.url),'utf8'));
function harness(){
  let time=0,allowed=false;const events=new Map(),requests=[],warnings=[];
  class Node {connect(){}disconnect(){this.disconnected=true;}}
  class Source extends Node {start(){this.started=true;}stop(){this.stopped=true;this.onended?.();}}
  class Context {constructor(){this.state='suspended';this.destination={};this.decoded=0;}createGain(){const n=new Node();n.gain={value:1};return n;}createBufferSource(){return new Source();}async decodeAudioData(){this.decoded++;return {duration:1};}async resume(){this.state='running';}async close(){this.state='closed';}}
  class Media {constructor(){this.paused=true;this.volume=1;}play(){if(!allowed)return Promise.reject(Object.assign(Error('gesture required'),{name:'NotAllowedError'}));this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const settings={musicVolume:.5,effectsVolume:.5,musicOn:true,effectsOn:true};
  const target={AudioContext:Context,Audio:Media,console:{warn:(...x)=>warnings.push(x)},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
  const audio=createAudioSystem({target,settings:()=>settings,now:()=>time,fetcher:async url=>{requests.push(String(url));return {ok:true,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(8)};}});
  return {audio,settings,events,requests,warnings,allow(){allowed=true;},advance(ms){time+=ms;}};
}
test('effects are decoded once; gestures retry blocked music and unlock WebAudio',async()=>{
  const h=harness(),a=h.audio;a.init();await a.preloadEffects();assert.equal(a.buffers.size,21);assert.equal(a.ctx.decoded,21);assert.equal(h.requests.length,22);
  await a.playMusic('andy');assert.ok(a._pendingMusic);assert.ok(a.music.paused);
  h.allow();h.events.get('pointerdown')();await new Promise(resolve=>setImmediate(resolve));assert.equal(a.ctx.state,'running');assert.equal(a.music.paused,false);
  const voice=a.effect('JUMP');assert.equal(voice.key,'JUMP');assert.equal(voice.source.buffer,a.buffers.get('jump_vascolet'));assert.equal(h.requests.length,22);assert.deepEqual(h.warnings,[]);
});
test('native named voices restart without layering duplicates or losing newer voices',async()=>{
  const h=harness(),a=h.audio;await a.preloadEffects();await a.unlock();const first=a.effect('ITEM'),second=a.effect('item');assert.ok(first.source.stopped);assert.equal(a.active.size,1);assert.equal(a._voices.get('ITEM'),second);first.source.onended();assert.equal(a._voices.get('ITEM'),second);assert.ok(Math.abs(second.gain.gain.value-.6)<1e-6);assert.equal(a.stats.byKey.ITEM,2);
});
test('master volume/mute affect existing effects independently of streamed music',async()=>{
  const h=harness(),a=h.audio;await a.preloadEffects();await a.unlock();h.allow();await a.playMusic('andy');a.effect('ITEM');h.settings.effectsVolume=.2;h.settings.musicVolume=.7;a.volume();assert.equal(a.master.gain.value,.2);assert.equal(a.music.volume,.7);
  h.settings.effectsOn=false;a.volume();assert.equal(a.master.gain.value,0);assert.equal(a.effect('JUMP'),null);assert.equal(a.stats.started,1);assert.equal(a.music.volume,.7);
});
test('pause cancels stale effects; gestures cannot restart paused music or replay a backlog',async()=>{
  const h=harness(),a=h.audio;a.init();await a.preloadEffects();a.effect('ITEM');h.advance(200);await a.unlock();assert.equal(a.stats.started,0);assert.equal(a.stats.dropped,1);
  h.allow();await a.playMusic('andy');a.effect('STEP_1');a.suspend();assert.equal(a.active.size,0);await a.unlock();assert.ok(a.music.paused);
  // Death stops the music but must still be able to play its own one-shot.
  assert.ok(a.effect('DEATH_1'));a.resume();await new Promise(resolve=>setImmediate(resolve));assert.equal(a.music.paused,false);assert.equal(a.stats.byKey.DEATH_1,1);
});
