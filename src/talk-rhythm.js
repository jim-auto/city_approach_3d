import {TALK_PARTS} from './talk-parts.js';
export const RHYTHM = { bpm:112, leadIn:1.8, travel:1.7, perfect:.095, good:.23, duration:7.2 };
export const TALK_LANES = [
 {key:'joke',icon:'✦',label:'ボケる',hand:'rock',color:'#ffb1ce'},
 {key:'groove',icon:'♪',label:'ノる',hand:'scissors',color:'#b7b3ff'},
 {key:'listen',icon:'♡',label:'聞く',hand:'paper',color:'#a6e3c9'},
];
export function createTalkRhythm(variant=0,part=0){
 const pattern=[[2,0,2,1,0,1],[1,2,0,1,2,0],[0,1,2,0,2,1],[2,1,0,1,2,0]][part];
 const beats=[0,1.5,3,5,7,8.5];
 return {part,elapsed:0,combo:0,maxCombo:0,hits:0,misses:0,weight:0,points:0,finished:false,
  notes:pattern.map((lane,i)=>({id:i,lane:(lane+variant)%3,time:RHYTHM.leadIn+beats[i]*60/RHYTHM.bpm,grade:null}))};
}
export function rhythmPhrase(run){return TALK_PARTS[run.part].line;}
function resolve(run,note,grade,offset){
 note.grade=grade;run.combo=grade==='miss'?0:run.combo+1;
 run.maxCombo=Math.max(run.maxCombo,run.combo);run.hits+=Number(grade!=='miss');run.misses+=Number(grade==='miss');
 run.weight+=grade==='perfect'?1:grade==='good'?.75:0;run.points=Math.round(TALK_PARTS[run.part].points*run.weight/run.notes.length);
 return {id:note.id,lane:note.lane,grade,offset,combo:run.combo,points:run.points};
}
export function advanceTalkRhythm(run,elapsed){
 if(run.finished||!Number.isFinite(elapsed))return [];
 run.elapsed=Math.max(run.elapsed,elapsed);const events=[];
 for(const n of run.notes)if(!n.grade&&run.elapsed>n.time+RHYTHM.good)events.push(resolve(run,n,'miss',run.elapsed-n.time));
 if(run.elapsed>=RHYTHM.duration)run.finished=true;
 return events;
}
export function tapTalkRhythm(run,key,elapsed){
 if(run.finished||!Number.isFinite(elapsed)||!TALK_LANES.some(l=>l.key===key))return null;
 const overdue=advanceTalkRhythm(run,elapsed);
 if(run.finished)return {events:overdue,hit:null};
 const note=run.notes.filter(n=>!n.grade&&Math.abs(n.time-run.elapsed)<=RHYTHM.good).sort((a,b)=>Math.abs(a.time-run.elapsed)-Math.abs(b.time-run.elapsed))[0];
 const lane=TALK_LANES.findIndex(l=>l.key===key),offset=note?run.elapsed-note.time:0;
 return {events:overdue,hit:note?resolve(run,note,note.lane!==lane?'miss':Math.abs(offset)<=RHYTHM.perfect?'perfect':'good',offset):null};
}
export function rhythmOutcome(run,opening){
 const favor=Math.max(0,Math.min(100,opening.favor+run.hits*7-run.misses*2));
 const discomfort=Math.max(0,Math.min(100,opening.discomfort+run.misses*2-run.hits*1.5));
 return {favor,discomfort,accepted:run.finished&&run.completedParts===4&&run.hits>=16&&favor>=68&&discomfort<60};
}
