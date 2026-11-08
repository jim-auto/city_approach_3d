export const TALK_PARTS=[
 {title:'声かけ',line:'「ちょっとお話ししても？」',qte:'tap',cue:'目が合った！輪が重なったらタップ',action:'笑顔を返す',motion:'greet',points:80,lanes:['ボケる','ノる','聞く']},
 {title:'連れ出し',line:'「一緒に歩くの、楽しいね」',qte:'swipe',cue:'歩調を合わせて、右へスワイプ',action:'一緒に進もう →',motion:'sway',points:100,lanes:['歩調','目線','うなずく']},
 {title:'ホテ前',line:'「ここまで来られて、楽しかった」',qte:'hold',cue:'もう少し一緒にいたい。0.7秒長押し',action:'気持ちを確かめる',motion:'invite',points:90,lanes:['気遣う','笑顔','聞く']},
 {title:'ゴール',line:'「一緒に来られて、うれしい！」',qte:'tap',cue:'最後は笑顔で！輪が重なったらタップ',action:'ふたりでゴール',motion:'celebrate',points:80,lanes:['目線','喜ぶ','うなずく']},
];
export function createTalkProgress(){return {index:0,cleared:[],points:0,hits:0,misses:0};}
export function clearTalkPart(progress,run,qte){
 if(progress.cleared.includes(progress.index)||!run.finished||run.hits<4||qte.status!=='passed')return false;
 progress.cleared.push(progress.index);progress.points+=run.points;progress.hits+=run.hits;progress.misses+=run.misses;return true;
}
export function nextTalkPart(progress){if(!progress.cleared.includes(progress.index)||progress.index>=TALK_PARTS.length-1)return false;progress.index++;return true;}
export function createTalkQte(kind){return {kind,elapsed:0,status:'active',holdAt:null,origin:null};}
export function advanceTalkQte(q,elapsed){
 if(q.status!=='active'||!Number.isFinite(elapsed))return q.status;
 q.elapsed=Math.max(q.elapsed,elapsed);
 if(q.elapsed>4)q.status='failed';
 else if(q.kind==='hold'&&q.holdAt!=null&&q.elapsed-q.holdAt>=.7)q.status='passed';
 return q.status;
}
export function inputTalkQte(q,action,elapsed,point={x:0,y:0}){
 advanceTalkQte(q,elapsed);if(q.status!=='active')return q.status;
 if(q.kind==='tap'&&action==='tap')q.status=Math.abs(q.elapsed-1.4)<=.5?'passed':'failed';
 if(q.kind==='hold'){
  if(action==='down'&&q.holdAt==null)q.holdAt=q.elapsed;
  if(action==='up'){q.status=q.holdAt!=null&&q.elapsed-q.holdAt>=.7?'passed':'failed';q.holdAt=null;}
 }
 if(q.kind==='swipe'){
  if(action==='down')q.origin={...point,at:q.elapsed};
  if(action==='up'&&q.origin)q.status=point.x-q.origin.x>=70&&Math.abs(point.y-q.origin.y)<90&&q.elapsed-q.origin.at<=1.2?'passed':'failed';
 }
 if(action==='cancel'){q.holdAt=null;q.origin=null;}
 return q.status;
}
