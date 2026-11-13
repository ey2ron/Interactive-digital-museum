"""Prepare Yoiyami's CC0 ambient piano as a local, crossfaded background loop."""
import array, hashlib, json, math, os, subprocess, wave
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
WORK=Path(os.environ['TEMP'])/'RVAMusicPreparation'
ffmpeg=next((Path(os.environ['TEMP'])/'RVAAnimatedCollection/tools/imageio_ffmpeg/binaries').glob('ffmpeg*.exe'))
original=WORK/'first-light-particles-original.wav'
out=ROOT/'public/assets/audio'; out.mkdir(parents=True,exist_ok=True)
def run(args):
    return subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-threads','1',*args],capture_output=True,check=True).stdout
pcm=array.array('f',run(['-i',str(original),'-af','loudnorm=I=-18:TP=-1.5:LRA=11','-ar','44100','-ac','2','-f','f32le','pipe:1']))
rate=44100; block=4410*2
active=[]
for i in range(0,len(pcm)-block,block):
    if math.sqrt(sum(x*x for x in pcm[i:i+block])/block)>.004: active.append(i)
start=max(0,active[0]-block); end=min(len(pcm),active[-1]+block*2)
pcm=pcm[start:end]
crossfade=rate*2*2
tail=pcm[-crossfade:]; head=pcm[:crossfade]
blend=array.array('f')
for i in range(crossfade):
    t=(i//2)/(crossfade//2-1)
    blend.append(tail[i]*(1-t)+head[i]*t)
loop=pcm[crossfade:-crossfade]+blend
# Place the actual file boundary at a quiet, low-slope point in the continuous loop.
window=4410*2
quiet=min(range(0,len(loop)-window,window),key=lambda i:sum(x*x for x in loop[i:i+window]))
cut=min(range(max(2,quiet+window//2-400),min(len(loop)-2,quiet+window//2+400),2),key=lambda i:abs(loop[i]-loop[i-2])+abs(loop[i+1]-loop[i-1])+abs(loop[i])+abs(loop[i+1]))
loop=loop[cut:]+loop[:cut]
wav=WORK/'first-light-particles-loop.wav'
samples=array.array('h',(max(-32767,min(32767,round(x*32767))) for x in loop))
with wave.open(str(wav),'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(rate); f.writeframes(samples.tobytes())
mp3=out/'first-light-particles-loop.mp3'
run(['-y','-i',str(wav),'-c:a','libmp3lame','-q:a','4','-write_xing','1','-metadata','title=First Light Particles (gallery loop)','-metadata','artist=Yoiyami','-metadata','copyright=CC0 1.0',str(mp3)])
decoded=array.array('f',run(['-i',str(mp3),'-ar','44100','-ac','2','-f','f32le','pipe:1']))
boundary=max(abs(decoded[-2+i]-decoded[i]) for i in (0,1))
assert boundary<.02, f'Unexpected loop boundary discontinuity: {boundary}'
assert mp3.stat().st_size<3_000_000
assert max(abs(x) for x in decoded)<1
duration=len(decoded)/rate/2
assert duration>30
metadata={'title':'First Light Particles','artist':'Yoiyami','source':'https://opengameart.org/content/first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track','originalFile':'https://opengameart.org/sites/default/files/first_light_particles_0.wav','license':'CC0 1.0 Universal','licenseUrl':'https://creativecommons.org/publicdomain/zero/1.0/','file':'assets/audio/first-light-particles-loop.mp3','duration':duration,'bytes':mp3.stat().st_size,'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),'edit':'Silence trimmed, loudness normalized to -18 LUFS, two-second linear tail-to-head crossfade and quiet loop boundary; gapless MP3 metadata retained.','defaultVolume':.2,'seamPeakStep':boundary}
(out/'music-credit.json').write_text(json.dumps(metadata,indent=2)+'\n')
# Three repeated boundary excerpts for listening checks, kept out of the app assets.
excerpt=decoded[-rate*4:]+decoded[:rate*4]
review=array.array('h',(max(-32767,min(32767,round(x*32767))) for x in excerpt*3))
with wave.open(str(WORK/'three-boundaries.wav'),'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(rate); f.writeframes(review.tobytes())
print(json.dumps({'duration':duration,'bytes':mp3.stat().st_size,'boundary_peak_step':boundary,'review':str(WORK/'three-boundaries.wav')}))
