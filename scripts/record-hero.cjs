/* Isolated headless recording. Never connects to an existing browser or user profile.
 * Requires playwright (or NODE_PATH pointing to an installed copy) and a local Vite server.
 * BASE_URL, HERO_OUT and PLAYWRIGHT_CHROMIUM_EXECUTABLE may be overridden.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
(async()=>{
  const out=process.env.HERO_OUT||'artifacts/hero';await fs.mkdir(out,{recursive:true});
  await fs.rm(path.join(out,'recording.json'),{force:true});
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1,isMobile:true,hasTouch:true,recordVideo:{dir:out,size:{width:960,height:600}}});
  const t0=Date.now(), marks={}, errors=[];let rawVideo;
  const mark=name=>{marks[name]=(Date.now()-t0)/1000;console.log(name,marks[name]);};
  let page;
  try{
    page=await context.newPage();rawVideo=page.video();page.on('pageerror',e=>errors.push(e.message));
    const pause=ms=>page.waitForTimeout(ms);
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:4188/',{waitUntil:'domcontentloaded'});
    await page.locator('#start').waitFor({state:'visible',timeout:90000});
    await page.locator('#start').click();await pause(4500);mark('street');await pause(1800);
    for(let attempt=0;attempt<30;attempt++){
      await page.locator('#nearby-person').click();await pause(500);
      if(await page.locator('#inspect').isVisible())break;
    }
    await page.locator('#inspect').waitFor({state:'visible'});
    console.log('partner',await page.locator('#person-name').innerText());
    await page.waitForFunction(()=>!document.getElementById('inspect').hidden&&!document.getElementById('approach-start').disabled,null,{timeout:30000});
    mark('approach');await pause(1400);
    await page.locator('#approach-start').click();mark('conversation');await pause(1200);
    console.log('parts',await require('./play-talk-ui.cjs')(page,{mark}));
    mark('invite');await pause(600);
    await page.locator('[data-destination="hotel-i"]').click();await pause(350);
    if(!(await page.locator('#invite-confirm').isVisible())){mark('decline');await pause(1000);await page.locator('[data-destination="customa"]').click();}
    mark('accepted');await pause(1400);await page.locator('#invite-confirm').click();
    const journey=await require('./play-talk-ui.cjs')(page,{mark,finish:'result'});console.log('journey',journey);const cues=journey.presses;
    await page.locator('#goal-memory').waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(()=>document.getElementById('goal-photo').complete&&document.getElementById('goal-photo').naturalWidth>0);
    mark('goal');await pause(300);await pause(1400);await page.locator('#date-rank').scrollIntoViewIfNeeded();mark('score');await pause(1700);mark('end');
    const result={marks,cues,errors,score:await page.locator('#result-points').innerText(),rank:await page.locator('#date-rank').innerText(),title:await page.locator('#result-title').innerText()};
    if(errors.length)throw Error(errors.join('\n'));
    await fs.writeFile(path.join(out,'recording.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}finally{
    await context.close();if(rawVideo)await rawVideo.saveAs(path.join(out,'gameplay-raw.webm'));await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
