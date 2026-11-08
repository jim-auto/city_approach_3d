export const RHYTHM = { bpm:112, leadIn:3, travel:1.7, perfect:.095, good:.23, duration:24.5 };
export const TALK_LANES = [
 {key:'joke',icon:'✦',label:'ボケる',hand:'rock',color:'#ffb1ce'},
 {key:'groove',icon:'♪',label:'ノる',hand:'scissors',color:'#b7b3ff'},
 {key:'listen',icon:'♡',label:'聞く',hand:'paper',color:'#a6e3c9'},
];
const phrases=['「ちょっとお話ししても？」','「なんだか楽しくなってきたね」','「ふふっ、気が合うかも」','「もう少し一緒にいたいな」','「このあと、どうしようか？」'];
export function createTalkRhythm(variant=0){
 const pattern=[2,0,2,1, 1,2,0,1, 0,1,2,0, 2,1,0,2, 1,0,2,1];
 const beats=[0,2,3,6,8,9,12,14,16,18,19,22,24,26,27,30,32,34,36,38];
 return {elapsed:0,combo:0,maxCombo:0,hits:0,misses:0,weight:0,points:0,finished:false,
  notes:pattern.map((lane,i)=>({id:i,lane:(lane+variant)%3,time:RHYTHM.leadIn+beats[i]*60/RHYTHM.bpm,grade:null}))};
}
export function rhythmPhrase(run){return phrases[Math.min(4,Math.max(0,Math.floor((run.elapsed-RHYTHM.leadIn)/(8*60/RHYTHM.bpm))))];}
function resolve(run,note,grade,offset){
 note.grade=grade;run.combo=grade==='miss'?0:run.combo+1;
 run.maxCombo=Math.max(run.maxCombo,run.combo);run.hits+=Number(grade!=='miss');run.misses+=Number(grade==='miss');
 run.weight+=grade==='perfect'?1:grade==='good'?.75:0;run.points=Math.round(350*run.weight/run.notes.length);
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
 const favor=Math.max(0,Math.min(100,opening.favor+run.hits*3-run.misses));
 const discomfort=Math.max(0,Math.min(100,opening.discomfort+run.misses*2-run.hits*1.5));
 return {favor,discomfort,accepted:run.finished&&run.hits>=Math.ceil(run.notes.length*.6)&&favor>=68&&discomfort<60};
}
