/* Isolated headless recording. Never connects to an existing browser or user profile.
 * Requires playwright (or NODE_PATH pointing to an installed copy) and a local Vite server.
 * BASE_URL, HERO_OUT and PLAYWRIGHT_CHROMIUM_EXECUTABLE may be overridden.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
(async()=>{
  const out=process.env.HERO_OUT||'artifacts/hero';await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:out,size:{width:960,height:600}}});
  const t0=Date.now(), marks={}, errors=[];let rawVideo;
  const mark=name=>{marks[name]=(Date.now()-t0)/1000;console.log(name,marks[name]);};
  let page;
  try{
    page=await context.newPage();rawVideo=page.video();page.on('pageerror',e=>errors.push(e.message));
    const pause=ms=>page.waitForTimeout(ms);
    const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:4188/',{waitUntil:'domcontentloaded'});
    await page.locator('#start').waitFor({state:'visible',timeout:90000});
    await page.locator('#start').click();await pause(4500);mark('street');await shot('street');await pause(1800);
    await page.locator('#nearby-person').click();await page.locator('#inspect').waitFor({state:'visible'});
    console.log('partner',await page.locator('#person-name').innerText());
    await page.waitForFunction(()=>!document.getElementById('inspect').hidden&&!document.getElementById('approach-start').disabled,null,{timeout:30000});
    mark('approach');await shot('approach');await pause(1400);
    await page.locator('#approach-start').click();mark('conversation');await shot('conversation');await pause(1200);
    for(const key of ['listen','empathy','empathy','listen','proposal']){
      await page.locator(`[data-response="${key}"]`).click();
      await page.waitForFunction(()=>document.getElementById('app').dataset.mode==='invite'||!document.querySelector('[data-response]').disabled,null,{timeout:15000});
      await pause(250);
    }
    mark('invite');await pause(600);
    await page.locator('[data-destination="hotel-i"]').click();await pause(350);
    if(!(await page.locator('#invite-confirm').isVisible())){mark('decline');await shot('decline');await pause(1800);}
    await page.locator('[data-destination="customa"]').click();mark('accepted');await shot('accepted');await pause(1400);
    await page.locator('#invite-confirm').click();await pause(500);await page.locator('#goal-walk').click();mark('walking');
    let cues=0;const deadline=Date.now()+150000;
    while(Date.now()<deadline){
      const mode=await page.locator('#app').getAttribute('data-mode');if(mode==='result')break;
      const button=page.locator('#walk-response');
      if(await button.isVisible()&&await button.isEnabled()){
        mark(`cue${++cues}`);await shot(`cue${cues}`);await pause(650);await button.click();await pause(900);await shot(`combo${cues}`);
        if(await page.locator('#app').getAttribute('data-mode')==='escort')await page.locator('#goal-walk').click();
      }else await pause(150);
    }
    if(await page.locator('#app').getAttribute('data-mode')!=='result')throw Error('Goal was not reached');
    await page.locator('#goal-memory').waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(()=>document.getElementById('goal-photo').complete&&document.getElementById('goal-photo').naturalWidth>0);
    mark('goal');await pause(300);await shot('goal');await pause(1400);await page.locator('#date-rank').scrollIntoViewIfNeeded();mark('score');await shot('score');await pause(1700);mark('end');
    const result={marks,cues,errors,score:await page.locator('#result-points').innerText(),rank:await page.locator('#date-rank').innerText(),title:await page.locator('#result-title').innerText()};
    if(errors.length)throw Error(errors.join('\n'));
    await fs.writeFile(path.join(out,'recording.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}finally{
    await context.close();if(rawVideo)await rawVideo.saveAs(path.join(out,'gameplay-raw.webm'));await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
