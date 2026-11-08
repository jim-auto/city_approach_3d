export const REACTION_SECONDS = 1.55;
export function reactionFor(grade, hand, combo=0) {
  if(grade==='win')return combo>=3?'delight':hand==='rock'?'laugh':hand==='scissors'?'shy':'nod';
  return grade==='draw'?'curious':'awkward';
}
// All offsets fade to zero; navigation and the model root never move.
export function sampleReaction(id, elapsed, duration=REACTION_SECONDS) {
  const e=Math.max(0,Math.min(1,elapsed/.18,(duration-elapsed)/.4)), beat=Math.sin(elapsed*10);
  const p={smile:0,relaxed:0,surprise:0,blink:0,mouth:0,headX:0,headY:0,headZ:0,chestX:0,chestZ:0,lift:0,gesture:'none',energy:e};
  if(id==='laugh'){Object.assign(p,{smile:.95*e,blink:.65*e,mouth:.32*e,headX:(-.08+beat*.035)*e,headZ:.07*e,chestX:beat*.025*e,gesture:'chest'});}
  else if(id==='nod'){Object.assign(p,{smile:.72*e,relaxed:.22*e,headX:(.09+Math.sin(elapsed*9)*.1)*e,headZ:.05*e,chestX:.025*e,gesture:'chest'});}
  else if(id==='shy'){Object.assign(p,{smile:.7*e,relaxed:.28*e,blink:.25*e,headX:.1*e,headY:.13*e,headZ:-.12*e,chestZ:-.025*e,gesture:'cheek'});}
  else if(id==='delight'){Object.assign(p,{smile:1*e,blink:.55*e,mouth:.22*e,headZ:beat*.06*e,chestZ:beat*.035*e,lift:Math.abs(beat)*.025*e,gesture:'clap'});}
  else if(id==='curious'){Object.assign(p,{smile:.35*e,surprise:.12*e,headZ:.13*e,headY:.06*e});}
  else if(id==='awkward'){Object.assign(p,{relaxed:.12*e,headY:.24*e,headX:.06*e,headZ:-.055*e});}
  return p;
}
