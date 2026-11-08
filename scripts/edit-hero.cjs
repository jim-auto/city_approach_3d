/* Turn a real recording into a short README GIF and a shareable MP4.
 * Requires ffmpeg/ffprobe and a Japanese font; no generated gameplay or scores.
 */
const fs=require('node:fs/promises');const path=require('node:path');const {execFileSync}=require('node:child_process');
(async()=>{
 const root=process.env.HERO_OUT||'artifacts/hero', output='media';await fs.mkdir(output,{recursive:true});
 const info=JSON.parse(await fs.readFile(path.join(root,'recording.json'),'utf8')),m=info.marks;
 if(info.errors.length||!info.title.includes('GOAL CLEAR')||!info.cues)throw Error('Recording must finish a real goal with at least one travel rhythm input');
 const font=process.env.HERO_FONT||'/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
 const raw=path.resolve(root,'gameplay-raw.webm'), clips=[];
 // Video starts during page creation, slightly after the recorder's wall clock.
 const rawSeconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',raw],{encoding:'utf8'}));
 const timingOffset=Math.max(0,m.end-rawSeconds);
 const add=(label,start,duration,speed=1)=>clips.push({label,start:Math.max(0,start-timingOffset),duration,speed});
 add('歌舞伎町で、ナンパしてみた。',m.street,1.2);
 add('声かけ → 連れ出し → ホテ前 → ゴール！',m.approach,.8);
 add('リズムに合わせて、ふたりが動く。',m.rhythm+2.1,2.2);
 if(m.qte1)add('目が合ったら、タイミングタップ。',m.qte1+.15,1.2);
 if(m.clear1)add('声かけ CLEAR！場所を変えて、もう少し。',m.clear1+.2,.5,.625);
 add('「もう少し話したい。場所変えない？」',m.accepted+.2,.9);
 add('道中もリズム！歩調を合わせて進もう。',m.walking+2.0,3.6,1.5);
 if(m.travelLoop)add('ふたりで実際の道を歩いて、入口へ。',m.travelLoop,3.0,1.8);
 if(m.scene3)add('ホテ前も、リズムで気持ちを確かめる。',m.scene3+2.0,2.1);
 if(m.qte3)add('最後は、笑顔でうなずく長押し。',m.qte3,1.0);
 if(m.scene4)add('ゴールのステージで、喜びのステップ！',m.scene4+2.0,2.2);
 if(m.qte4)add('タイミングを合わせて、ふたりでゴール。',m.qte4+.2,1.2);
 add('ゴールで、ふたりの記念写真。',m.goal+.6,1.0);
 add('スマホ・PCで、すぐ遊べる。',m.score,1.3);
 const segments=[];
 for(const [i,c] of clips.entries()){
  const textfile=path.resolve(root,`caption-${i}.txt`), file=path.resolve(root,`clip-${i}.mp4`);await fs.writeFile(textfile,c.label);
  const filter=`setpts=(PTS-STARTPTS)/${c.speed},fps=24,scale=960:600:flags=lanczos,setsar=1,pad=960:660:0:60:color=0x111b29,drawtext=fontfile='${font}':textfile='${textfile}':fontcolor=0xf2f1e9:fontsize=25:x=22:y=14,drawtext=fontfile='${font}':text='CITY APPROACH 3D':fontcolor=0xa2dfc5:fontsize=16:x=w-tw-22:y=14,drawtext=fontfile='${font}':text='実プレイ / 一部速度調整':fontcolor=0xaab7c4:fontsize=11:x=w-tw-22:y=38`;
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(c.start),'-t',String(c.duration),'-i',raw,'-vf',filter,'-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',file],{stdio:'inherit'});segments.push(file);
 }
 const concat=path.resolve(root,'concat.txt');await fs.writeFile(concat,segments.map(file=>`file '${file}'`).join('\n'));
 const mp4=path.join(output,'hero-gameplay.mp4'),gif=path.join(output,'hero-gameplay.gif');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',mp4],{stdio:'inherit'});
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',mp4,'-filter_complex','fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',gif],{stdio:'inherit'});
 const poster='public/share/hero-gameplay.jpg';await fs.mkdir(path.dirname(poster),{recursive:true});
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','0.6','-i',mp4,'-frames:v','1','-q:v','2',poster],{stdio:'inherit'});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=width,height,r_frame_rate','-of','json',gif],{encoding:'utf8'}));
 const manifest={capturedAt:new Date().toISOString(),source:'Actual local game, isolated headless browser; UI clicks and normal movement only.',viewport:{width:960,height:600},timingOffset,edits:clips,result:{score:info.score,rank:info.rank,title:info.title,travelNotes:info.cues},gif:probe};
 await fs.writeFile(path.join(output,'hero-gameplay.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({gif,mp4,poster,probe},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
