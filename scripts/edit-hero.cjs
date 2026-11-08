/* Turn a real recording into a short README GIF and a shareable MP4.
 * Requires ffmpeg/ffprobe and a Japanese font; no generated gameplay or scores.
 */
const fs=require('node:fs/promises');const path=require('node:path');const {execFileSync}=require('node:child_process');
(async()=>{
 const root=process.env.HERO_OUT||'artifacts/hero', output='media';await fs.mkdir(output,{recursive:true});
 const info=JSON.parse(await fs.readFile(path.join(root,'recording.json'),'utf8')),m=info.marks;
 if(info.errors.length||!info.title.includes('GOAL CLEAR')||!info.cues)throw Error('Recording must finish a real goal with at least one walking cue');
 const font=process.env.HERO_FONT||'/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
 const raw=path.resolve(root,'gameplay-raw.webm'), clips=[];
 const add=(label,start,duration,speed=1)=>clips.push({label,start:Math.max(0,start),duration,speed});
 add('歌舞伎町で、ナンパしてみた。',m.street,1.6);
 add('声をかけて、返事を選ぶ。',m.approach,1.1);
 add('会話で、少しずつ距離が縮まる。',m.conversation+.7,1.1);
 if(m.decline)add('ホテルの誘い、普通に断られた。',m.decline,1.4);
 add('「もう少し話したい。場所変えない？」',m.accepted+.4,1.15);
 add('ふたりで歩いて、会話コンボ。',Math.max(m.walking,m.cue1-.6),4.8,1.8);
 if(m.cue2)add('歩調を合わせて、コンボをつなぐ。',m.cue4||m.cue3||m.cue2,4.5,2);
 add('置いていかず、一緒にゴール。',Math.max(m.walking,m.goal-4.4),4.4,2.8);
 add('ゴールで、ふたりの記念写真。',m.goal+.6,1.0);
 add('スマホ・PCで、すぐ遊べる。',m.score,1.5);
 const segments=[];
 for(const [i,c] of clips.entries()){
  const textfile=path.resolve(root,`caption-${i}.txt`), file=path.resolve(root,`clip-${i}.mp4`);await fs.writeFile(textfile,c.label);
  const filter=`setpts=(PTS-STARTPTS)/${c.speed},fps=24,scale=960:600:flags=lanczos,setsar=1,pad=960:660:0:60:color=0x111b29,drawtext=fontfile='${font}':textfile='${textfile}':fontcolor=0xf2f1e9:fontsize=25:x=22:y=14,drawtext=fontfile='${font}':text='CITY APPROACH 3D':fontcolor=0xa2dfc5:fontsize=16:x=w-tw-22:y=14,drawtext=fontfile='${font}':text='実プレイ / 一部早送り':fontcolor=0xaab7c4:fontsize=11:x=w-tw-22:y=38`;
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(c.start),'-t',String(c.duration),'-i',raw,'-vf',filter,'-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',file],{stdio:'inherit'});segments.push(file);
 }
 const concat=path.resolve(root,'concat.txt');await fs.writeFile(concat,segments.map(file=>`file '${file}'`).join('\n'));
 const mp4=path.join(output,'hero-gameplay.mp4'),gif=path.join(output,'hero-gameplay.gif');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',mp4],{stdio:'inherit'});
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',mp4,'-filter_complex','fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',gif],{stdio:'inherit'});
 const poster='public/share/hero-gameplay.jpg';await fs.mkdir(path.dirname(poster),{recursive:true});
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','0.6','-i',mp4,'-frames:v','1','-q:v','2',poster],{stdio:'inherit'});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=width,height,r_frame_rate','-of','json',gif],{encoding:'utf8'}));
 const manifest={capturedAt:new Date().toISOString(),source:'Actual local game, isolated headless browser; UI clicks and normal movement only.',viewport:{width:960,height:600},edits:clips,result:{score:info.score,rank:info.rank,title:info.title,walkingCues:info.cues},gif:probe};
 await fs.writeFile(path.join(output,'hero-gameplay.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({gif,mp4,poster,probe},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
