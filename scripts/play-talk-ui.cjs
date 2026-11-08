// Exercise only the visible chart and normal buttons/keys/pointer gestures.
module.exports=async function playTalkUi(page,{mark=()=>{},finish='invite'}={}){
 const played=new Set(),cleared=new Set();let presses=0,retries=0;const until=Date.now()+240000;
 const firstPart=Number(await page.locator('#conversation').getAttribute('data-part'));
 await page.locator('#rhythm-start').click();await mark(firstPart===0?'rhythm':'walking');
 while(Date.now()<until && await page.locator('#app').getAttribute('data-mode')==='talk'){
  const dialog=page.locator('#conversation'),phase=await dialog.getAttribute('data-phase'),part=Number(await dialog.getAttribute('data-part')),lap=Number(await dialog.getAttribute('data-lap'));
  if(!played.has(`scene:${part}`)){played.add(`scene:${part}`);await mark(`scene${part+1}`);}
  if(phase==='rhythm'){
   const target=await page.evaluate(()=>[...document.querySelectorAll('#rhythm-notes i')].filter(n=>!n.hidden).map(n=>({id:n.dataset.note,y:parseFloat(n.style.top),lane:Math.round(parseFloat(n.style.left)*3/100-.5)})).find(n=>n.y>=89&&n.y<=106));
   if(target&&!played.has(`${part}:${lap}:${target.id}`)){
    played.add(`${part}:${lap}:${target.id}`);await page.keyboard.press(String(target.lane+1));presses++;
    if(presses===1){await mark(firstPart===0?'reaction1':'travelHit');if(firstPart===0)await mark('reaction');}if(presses===7)await mark('travelLoop');
   }
  }else if(phase==='qte'){
   await mark(`qte${part+1}`);const kind=await page.locator('#qte-button').getAttribute('data-kind');
   if(kind==='tap'){
    const box=await page.locator('#qte-button').boundingBox();
    await page.waitForFunction(()=>document.getElementById('conversation').dataset.phase!=='qte'||document.getElementById('qte-button').dataset.ready==='true');
    if(await dialog.getAttribute('data-phase')==='qte')await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
   }else if(kind==='hold'){
    const box=await page.locator('#qte-button').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(850);await page.mouse.up();
   }else{
    const box=await page.locator('#qte-button').boundingBox();
    await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.75,box.y+box.height*.5,{steps:1});await page.mouse.up();
   }
  }else if(phase==='clear'){
   if(!cleared.has(part)){cleared.add(part);await mark(`clear${part+1}`);await page.waitForTimeout(650);}
   if(part>0&&part<3)await page.locator('#part-next').click();
  }else if(phase==='retry'){
   retries++;if(retries>12)throw Error('Too many UI retries');played.clear();await page.locator('#part-retry').click();
  }
  await page.waitForTimeout(15);
 }
 await page.locator(finish==='result'?'#result':'#invite-options').waitFor({state:'visible',timeout:10000});return {presses,retries,cleared:[...cleared]};
};
