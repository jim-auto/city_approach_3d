export const REACTION_SECONDS = 1.55;
export function reactionFor(grade, hand, combo=0) {
  if(grade==='win')return combo>=3?'delight':hand==='rock'?'laugh':hand==='scissors'?'shy':'nod';
  return grade==='draw'?'curious':'awkward';
}
// All offsets fade to zero; navigation and the model root never move.
export function sampleReaction(id, elapsed, duration=REACTION_SECONDS) {
  const e=Math.max(0,Math.min(1,elapsed/.18,(duration-elapsed)/.4)), beat=Math.sin(elapsed*10);
  const p={smile:0,relaxed:0,surprise:0,blink:0,mouth:0,headX:0,headY:0,headZ:0,chestX:0,chestZ:0,lift:0,shiftX:0,turnY:0,gesture:'none',energy:e};
  if(id==='laugh'){Object.assign(p,{smile:.95*e,blink:.65*e,mouth:.32*e,headX:(-.08+beat*.035)*e,headZ:.07*e,chestX:beat*.025*e,gesture:'chest'});}
  else if(id==='nod'){Object.assign(p,{smile:.72*e,relaxed:.22*e,headX:(.09+Math.sin(elapsed*9)*.1)*e,headZ:.05*e,chestX:.025*e,gesture:'chest'});}
  else if(id==='shy'){Object.assign(p,{smile:.7*e,relaxed:.28*e,blink:.25*e,headX:.1*e,headY:.13*e,headZ:-.12*e,chestZ:-.025*e,gesture:'cheek'});}
  else if(id==='delight'){Object.assign(p,{smile:1*e,blink:.55*e,mouth:.22*e,headZ:beat*.06*e,chestZ:beat*.035*e,lift:Math.abs(beat)*.025*e,gesture:'clap'});}
  else if(id==='greet'){Object.assign(p,{smile:.8*e,headZ:Math.sin(elapsed*5)*.07*e,chestZ:.04*e,shiftX:Math.sin(elapsed*3)*.035*e,gesture:'wave'});}
  else if(id==='sway'){Object.assign(p,{smile:.95*e,blink:.4*e,headX:Math.sin(elapsed*8)*.12*e,chestZ:Math.sin(elapsed*5)*.09*e,shiftX:Math.sin(elapsed*5)*.07*e,turnY:Math.sin(elapsed*3)*.12*e,lift:Math.abs(beat)*.035*e,gesture:'clap'});}
  else if(id==='invite'){Object.assign(p,{smile:.95*e,headZ:-.08*e,headY:.1*e,chestZ:-.05*e,shiftX:.07*e,turnY:.18*e,gesture:'invite'});}
  else if(id==='celebrate'){Object.assign(p,{smile:1*e,blink:.65*e,mouth:.25*e,headZ:beat*.09*e,chestZ:beat*.08*e,lift:Math.abs(beat)*.085*e,shiftX:Math.sin(elapsed*6)*.08*e,turnY:Math.sin(elapsed*4)*.2*e,gesture:'wave'});}
  else if(id==='curious'){Object.assign(p,{smile:.35*e,surprise:.12*e,headZ:.13*e,headY:.06*e});}
  else if(id==='awkward'){Object.assign(p,{relaxed:.12*e,headY:.24*e,headX:.06*e,headZ:-.055*e});}
  return p;
}

// A continuing beat-driven pose underneath individual reactions.
export function sampleGroove(part,time){
 const beat=Math.sin(time*112/60*Math.PI*2),sway=Math.sin(time*112/60*Math.PI),energy=part===3?1.7:1;
 return {headX:beat*.04,chestZ:sway*.035*energy,turnY:sway*.055,shiftX:sway*.035*energy,lift:Math.abs(beat)*.025*energy,leg:beat*.12*energy,arm:(sway*.5+.5)*.22*energy,smile:.28+Math.abs(beat)*.15};
}
