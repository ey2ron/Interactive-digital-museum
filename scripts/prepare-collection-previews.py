"""Build collection previews from Waneella's public originals. Tools/raw files stay in TEMP."""
import json, re, os, sys, subprocess, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(os.environ['TEMP']) / 'RVAAnimatedCollection'
sys.path.insert(0, str(WORK / 'tools'))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageStat

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT = ROOT / 'public/assets/collection-motion'
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
VIDEOS = [
    ('Glass Cube','5piIiFmF5l0'), ('City 4','G91pUsel_4k'), ('No Sleep Again','zK9HSXrvUMg'),
    ('On The Hill','7AnVttbtTvs'), ('Rose Waves','sycRWW1aajo'), ('Rain','Wq9IeRx3-F8'),
    ('Return','vfOfspwiFQ0'), ('Faraway Point','H5fDPf2ExvA'), ('Nice View','Vhap-9YhEWU'),
    ('Dark Corners','XFR-iH3mxoU'), ('Fragments','iiCtXPTywYk'), ('Heat','W1RvvQQnifM')
]
NOTES = [
    ('An amber-lit room enclosed by glass and structural beams, with a desk, monitors and shelves.', 'Glass and metal frame a room filled with warm light. Desks, screens and shelves turn the enclosed space into a small inhabited world, with tiny movements revealing themselves as the scene unfolds.'),
    ('A blue and violet city intersection with illuminated shop signs beneath a golden sky.', 'Deep blue streets meet a golden sky in a city assembled from signs, stairs and stacked buildings. The wide view gives the architecture room to breathe while scattered lights keep the scene quietly alive.'),
    ('A dim room crowded with old televisions, computer screens, a sofa and tangled everyday objects.', 'A collection of screens glows inside a dim, cluttered room. Cables, shelves and familiar objects surround their cool light, holding the interior in the restless stillness of another sleepless night.'),
    ('A quiet sloping street with a glowing corner shop, trees and apartment buildings in the dusk.', 'A corner shop warms a quiet street beneath trees and apartment blocks. The road curves away into the distance, letting the lights of the neighbourhood draw a gentle path through the evening.'),
    ('A city street with red lanterns, a large tree and layered buildings beneath a pink evening sky.', 'A rose-coloured sky settles over lanterns, shop windows and a broad tree. Warm and cool lights gather along the street, giving this dense urban corner the softness of a passing evening.'),
    ('A dark interior with red furniture, small screens and a tall window looking onto falling rain.', 'Rain fills a tall window beyond the red and blue glow of a small interior. The room feels sheltered and close, while the moving weather outside makes its quiet details feel warmer.'),
    ('A railway platform with overhead structures, a vending machine and a pastel sky beyond the tracks.', 'A railway platform opens towards tracks and a pale evening sky. Overhead beams and nearby buildings frame the view, leaving a quiet space that seems ready for a familiar journey home.'),
    ('A snowy city corner with glowing signs, red lanterns and a violet sky above tightly packed buildings.', 'Snow gathers beneath illuminated signs and red lanterns. A distant glow softens the violet sky, turning a cold street corner into a place that feels both remote and quietly welcoming.'),
    ('A teal city passage overlooking a huge orange sun, distant towers and hanging shop signs.', 'A huge orange sun appears between dark teal buildings. Signs, railings and overhead structures frame the distant skyline, making an ordinary passage feel like a lookout over another world.'),
    ('A shadowy control room filled with monitors, consoles, overhead cables and a red-lit doorway.', 'Monitors and control panels break up the shadows of a tightly packed room. Cool screens and a red-lit doorway offer competing points of light, inviting a slow look into its darker corners.'),
    ('A blue-lit urban courtyard with hanging cables, a glass roof and illuminated shops beyond a wet floor.', 'Cool light filters through a roof of glass and cables into an enclosed urban space. Shopfronts and reflections scatter small fragments of colour across the wet ground below.'),
    ('A warm amber room with a small computer, shelves, plants, overhead pipes and a room beyond.', 'Amber light gathers around a small computer and shelves of everyday objects. Plants, pipes and an open doorway give the room depth, while its steady glow turns a busy interior into a place to linger.')
]

def fetch(url, path):
    if not path.exists():
        req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=180) as response:
            data = response.read()
        temp = path.with_suffix(path.suffix+'.part')
        temp.write_bytes(data); temp.replace(path)
    return path.read_bytes()

known_works = {art['title']:art for art in json.loads((ROOT/'public/assets/collection-artworks.json').read_text(encoding='utf-8'))}

def command(args):
    return subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-threads','1',*args], check=True, capture_output=True).stdout

def prepare(item):
    index, (title, youtube) = item
    identifier = re.sub('[^a-z0-9]+','_',title.lower())
    original = known_works[title]
    media_url = original['mediaSource']
    raw = WORK/(identifier+'.mp4')
    fetch(media_url, raw)
    # Compare candidate 8–12 second boundaries at four samples per second.
    frames = command(['-ss','8','-i',str(raw),'-t','16','-vf','fps=4,scale=64:32','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    frame_size = 64*32*3
    samples = [frames[i:i+frame_size] for i in range(0,len(frames)-frame_size+1,frame_size)]
    candidates=[]
    for start in (0,8,16):
        for end in range(start+32,min(start+49,len(samples))):
            error=sum(abs(a-b) for a,b in zip(samples[start],samples[end]))/frame_size
            candidates.append((error,start,end))
    error,start,end=min(candidates)
    start_seconds=8+start/4; duration=(end-start)/4
    clip=OUT/(identifier+'.mp4'); poster=OUT/(identifier+'.jpg')
    for width,crf in ((960,23),(800,25),(640,27)):
        command(['-y','-ss',str(start_seconds),'-i',str(raw),'-t',str(duration),'-an','-vf',f'fps=20,scale={width}:540:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=neighbor','-c:v','libx264','-threads','1','-preset','medium','-crf',str(crf),'-pix_fmt','yuv420p','-movflags','+faststart',str(clip)])
        if clip.stat().st_size<1_000_000: break
    assert clip.stat().st_size<2_000_000, title+' exceeds preview budget'
    command(['-y','-i',str(clip),'-frames:v','1','-q:v','2',str(poster)])
    with Image.open(poster) as im:
        pixels=list(im.size)
        assert sum(ImageStat.Stat(im).var)>100, title+' has a blank poster'
    # Decode the completed output, verifying motion and duration rather than metadata alone.
    decoded=command(['-i',str(clip),'-vf','fps=2,scale=64:32','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    unique={decoded[i:i+frame_size] for i in range(0,len(decoded),frame_size)}
    assert len(unique)>1, title+' has no motion'
    alt,description=NOTES[index]
    print(f'{title}: {duration}s, {pixels}, {clip.stat().st_size} bytes, boundary error {error:.2f}',flush=True)
    return dict(id=identifier,title=title,artist='Waneella',source=f'https://www.youtube.com/watch?v={youtube}',artworkSource=original['artworkSource'],mediaSource=media_url,preview='assets/collection-motion/'+clip.name,thumbnail='assets/collection-motion/'+poster.name,pixels=pixels,duration=duration,excerptStart=start_seconds,note=dict(alt=alt,description=description,credit='Gallery description'))

with ThreadPoolExecutor(max_workers=2) as pool:
    works=list(pool.map(prepare,enumerate(VIDEOS)))
(ROOT/'public/assets/collection-artworks.json').write_text(json.dumps(works,indent=2)+'\n',encoding='utf-8')
sheet=Image.new('RGB',(1200,1000),(22,28,28)); draw=ImageDraw.Draw(sheet)
for i,art in enumerate(works):
    im=Image.open(ROOT/'public'/art['thumbnail']); im.thumbnail((380,200))
    x=i%3*400; y=i//3*250
    draw.text((x+8,y+5),art['title'],fill='white'); sheet.paste(im,(x+8,y+30))
sheet.save(WORK/'contact.jpg')
(WORK/'report.json').write_text(json.dumps(works,indent=2))
print('Preview contact sheet:',WORK/'contact.jpg',flush=True)
