// Original synthesized loop: no external recording, network request or copyrighted song.
import {RHYTHM} from './talk-rhythm.js';
export function createRhythmMusic(host=window){
 const Audio=host.AudioContext||host.webkitAudioContext;if(!Audio)return null;
 let ctx;
 try{
  ctx=new Audio();const output=ctx.createGain();output.gain.value=.18;output.connect(ctx.destination);
  const origin=ctx.currentTime+.12,beat=60/RHYTHM.bpm;
  const note=(at,freq,length,type,gain)=>{
   const osc=ctx.createOscillator(),amp=ctx.createGain();osc.type=type;osc.frequency.value=freq;
   amp.gain.setValueAtTime(.001,at);amp.gain.exponentialRampToValueAtTime(gain,at+.008);amp.gain.exponentialRampToValueAtTime(.001,at+length);
   osc.connect(amp);amp.connect(output);osc.start(at);osc.stop(at+length+.02);
  };
  const melody=[523.25,659.25,783.99,659.25,587.33,698.46,880,698.46];
  for(let i=0;i<46;i++){
   const at=origin+RHYTHM.leadIn+i*beat;if(at-origin>RHYTHM.duration)break;
   note(at,i%4===0?65.41:130.81,.16,'sine',.6);
   note(at+beat/2,1568,.035,'triangle',.12);
   if(i%2===0)note(at,melody[(i/2)%8],beat*.8,'triangle',.25);
  }
  for(let i=0;i<3;i++)note(origin+i,880,.08,'sine',.25);
  let failed=false;ctx.resume().catch(()=>{failed=true;});
  return {hit:(lane,perfect)=>{if(ctx.state!=='closed')note(ctx.currentTime+.005,[1046.5,1318.51,1567.98][lane],.06,'sine',perfect?.24:.15);},now:()=>failed?null:ctx.currentTime-origin,pause:()=>ctx.suspend().catch(()=>{}),resume:()=>ctx.resume().catch(()=>{failed=true;}),stop:()=>{output.gain.value=0;ctx.close().catch(()=>{});}};
 }catch{ctx?.close().catch(()=>{});return null;}
}
