export function animationDuration(animation){return animation?.frames.reduce((n,f)=>n+f.duration,0)/animation?.fps||0;}
export function sampleAnimation(animation,time){
  if(!animation?.frames.length)return null;
  const total=animation.frames.reduce((n,f)=>n+f.duration,0),ticks=time*animation.fps;
  let tick=animation.loop?((ticks%total)+total)%total:Math.max(0,Math.min(ticks,total-.001));
  for(const frame of animation.frames){if(tick<frame.duration)return frame;tick-=frame.duration;}return animation.frames.at(-1);
}
// Entering a frame while climbing backwards occurs at its END boundary, not its
// start. Emit from simulation time only; extra render frames never repeat SFX.
export function crossedAnimationFrames(animation,from,to,indices){
  if(!animation?.frames.length||!Number.isFinite(from)||!Number.isFinite(to)||from===to)return [];
  const starts=[];let total=0;for(const f of animation.frames){starts.push(total);total+=f.duration;}
  const forward=to>from,a=from*animation.fps,b=to*animation.fps,lo=Math.min(a,b),hi=Math.max(a,b),events=[],epsilon=1e-9;
  for(const index of indices){
    if(!animation.frames[index])continue;
    const base=starts[index]+(forward?0:animation.frames[index].duration);
    const first=animation.loop?Math.floor((lo-base)/total)-1:0,last=animation.loop?Math.ceil((hi-base)/total)+1:0;
    for(let cycle=first;cycle<=last;cycle++){
      const tick=base+cycle*total;
      if(forward?tick>a+epsilon&&tick<=b+epsilon:tick<=a+epsilon&&tick>b+epsilon)events.push({index,time:tick/animation.fps});
    }
  }
  return events.sort((x,y)=>forward?x.time-y.time:y.time-x.time);
}
