import {Save} from './save.js';
const root=new URL('../',import.meta.url);
const level=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;

// Decode effects once and start buffer sources at the simulation event. Music
// remains streamed. Native 0041d380 restarts one sound instance per named key.
export function createAudioSystem({target=globalThis.window??globalThis,settings=()=>Save.data.settings,fetcher=url=>target.fetch(url),now=()=>target.performance.now()}={}){
  return {
    ctx:null,master:null,music:null,track:'',active:new Set(),buffers:new Map(),definitions:new Map(),errors:new Map(),
    stats:{started:0,dropped:0,byKey:{}},_voices:new Map(),_loads:new Map(),_queue:[],_epoch:0,_pendingMusic:false,_musicPaused:false,_preloading:null,_initialized:false,
    init(){
      if(this._initialized)return;this._initialized=true;this._gesture=()=>{void this.unlock();};
      target.addEventListener?.('pointerdown',this._gesture,true);target.addEventListener?.('keydown',this._gesture,true);
    },
    _report(key,error){if(this.errors.has(key))return;this.errors.set(key,String(error?.message??error));(target.console??console).warn('Audio '+key+':',error);},
    _context(){
      if(this.ctx)return this.ctx;const Context=target.AudioContext??target.webkitAudioContext;if(!Context)return null;
      try{this.ctx=new Context({latencyHint:'interactive'});this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.volume();return this.ctx;}catch(e){this._report('context',e);return null;}
    },
    configureEffects(manifest){
      for(const entry of manifest.effects){const name=entry.path.split('/').at(-1).replace(/\.ogg$/,'');const definition={...entry,name,url:new URL(entry.path,root).href};this.definitions.set(entry.key,definition);this.definitions.set(name,definition);}
    },
    preloadEffects(){
      if(this._preloading)return this._preloading;
      this._preloading=(async()=>{
        const context=this._context();if(!context)return false;
        try{const response=await fetcher(new URL('assets/data/audio.json',root));if(!response.ok)throw Error('HTTP '+response.status);this.configureEffects(await response.json());}
        catch(e){this._report('manifest',e);return false;}
        const unique=[...new Map([...this.definitions.values()].map(d=>[d.name,d])).values()];
        await Promise.all(unique.map(d=>this._load(d)));return unique.every(d=>this.buffers.has(d.name));
      })();return this._preloading;
    },
    _load(definition){
      if(this.buffers.has(definition.name))return Promise.resolve(this.buffers.get(definition.name));
      if(this._loads.has(definition.name))return this._loads.get(definition.name);
      const pending=(async()=>{
        try{const context=this._context();if(!context)return null;const response=await fetcher(definition.url);if(!response.ok)throw Error('HTTP '+response.status);const buffer=await context.decodeAudioData(await response.arrayBuffer());this.buffers.set(definition.name,buffer);this._flush();return buffer;}
        catch(e){this._report(definition.name,e);return null;}
      })();this._loads.set(definition.name,pending);return pending;
    },
    async unlock(){
      // Both calls start synchronously inside the trusted gesture, before await.
      const music=this._pendingMusic&&!this._musicPaused?this._playMusic():Promise.resolve(false),context=this._context();
      try{if(context&&context.state!=='running')await context.resume();}catch(e){if(e.name!=='NotAllowedError')this._report('resume',e);}
      this._flush();await music;return context?.state==='running';
    },
    effect(name,volume=1){
      const s=settings();if(s.effectsOn===false||level(s.effectsVolume??.5)===0)return null;
      const definition=this.definitions.get(name);if(!definition){if(this._initialized)this._report(name,Error('Unknown native sound'));return null;}
      const event={definition,volume:level(volume),time:now(),epoch:this._epoch};const context=this._context();
      if(context?.state==='running'&&this.buffers.has(definition.name))return this._start(event);
      this._queue.push(event);if(this._queue.length>32){this._queue.shift();this.stats.dropped++;}void this._load(definition);return null;
    },
    _flush(){
      const queued=this._queue;this._queue=[];
      for(const event of queued){
        if(event.epoch!==this._epoch||now()-event.time>150){this.stats.dropped++;continue;}
        if(this.ctx?.state==='running'&&this.buffers.has(event.definition.name))this._start(event);else this._queue.push(event);
      }
    },
    _release(voice){
      if(voice.released)return;voice.released=true;this.active.delete(voice);
      if(this._voices.get(voice.key)===voice)this._voices.delete(voice.key);voice.source.disconnect();voice.gain.disconnect();
    },
    _stop(voice){try{voice.source.stop();}catch{}this._release(voice);},
    _start(event){
      const s=settings();if(s.effectsOn===false||level(s.effectsVolume??.5)===0)return null;
      const d=event.definition,previous=this._voices.get(d.key);if(previous)this._stop(previous);
      try{
        const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers.get(d.name);gain.gain.value=d.gain*event.volume;source.connect(gain);gain.connect(this.master);
        const voice={key:d.key,source,gain,released:false};source.onended=()=>this._release(voice);this.active.add(voice);this._voices.set(d.key,voice);source.start();
        this.stats.started++;this.stats.byKey[d.key]=(this.stats.byKey[d.key]??0)+1;return voice;
      }catch(e){this._report(d.key,e);return null;}
    },
    async playMusic(name){
      this.init();this._musicPaused=false;
      if(name!==this.track||!this.music){this.music?.pause();this.track=name;this.music=new target.Audio(new URL(`assets/audio/music/${name}.ogg`,root));this.music.loop=true;this.music.preload='auto';this.music.onerror=()=>this._report('music:'+name,Error('Media load failed'));}
      this.volume();this._pendingMusic=true;return this._playMusic();
    },
    async _playMusic(){
      const music=this.music;if(!music||this._musicPaused)return false;
      try{await music.play();if(music!==this.music||this._musicPaused){music.pause();return false;}this._pendingMusic=false;return true;}
      catch(e){if(music===this.music){this._pendingMusic=e.name==='NotAllowedError'||e.name==='AbortError';if(!this._pendingMusic)this._report('music:'+this.track,e);}return false;}
    },
    volume(){const s=settings();if(this.music)this.music.volume=s.musicOn===false?0:level(s.musicVolume??.5);if(this.master)this.master.gain.value=s.effectsOn===false?0:level(s.effectsVolume??.5);},
    stopEffects(){this._epoch++;this._queue=[];for(const voice of [...this.active])this._stop(voice);},
    suspend(){this._musicPaused=true;this._pendingMusic=false;this.music?.pause();this.stopEffects();},
    resume(){this._musicPaused=false;this._pendingMusic=!!this.music;void this._playMusic();},
    dispose(){this.suspend();target.removeEventListener?.('pointerdown',this._gesture,true);target.removeEventListener?.('keydown',this._gesture,true);void this.ctx?.close();}
  };
}
export const AudioSystem=createAudioSystem();
