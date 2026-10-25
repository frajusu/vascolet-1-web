"""Publish compact, scoped evidence of native observation and visual comparisons."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def main():
    comparisons=json.loads((ROOT/'analysis/web-reference/scene-comparison.json').read_text())
    browser=json.loads((ROOT/'test-results/browser-report.json').read_text())
    summary={'binarySha256':'7f4b9ff4d18846214a33793989ca15171e0f56fa39094596b24fd646f587fd71','scope':comparisons['scope'],'rooms':comparisons['rooms'],'levels':{},'uiAndEntryComparisons':browser['nativeComparisons'],'browserChecksPassed':browser['ok']}
    for name in ['prehistory','egypt','castle','pirates','future']:
        native=json.loads((ROOT/f'analysis/native-reference/world/{name}/scenes.json').read_text());report=json.loads((ROOT/f'analysis/native-reference/world/{name}/report.json').read_text());rows=[r for r in comparisons['records'] if r['level']==name]
        summary['levels'][name]={'capturedRooms':len(native['rooms']),'nativeRoomConfirmed':sum(r['sameRoom'] for r in native['rooms']),'staticMAE':sum(r['staticMAE'] for r in rows)/len(rows),'maximumStaticMAE':max(r['staticMAE'] for r in rows),'minimumComparedPixels':min(r['staticPixels'] for r in rows),'fixtureDepenetrationRoomDifferences':sum(r['simulationRoom']!=r['actualRoom'] for r in rows),'inputDesktopUnchanged':report['desktopBefore']==report['desktopAfter']}
    summary['limits']=['Dynamic actors, HUD and text are excluded from the 434-room static score.','Reference room is pinned for rendering; depenetration differences in solid-fill fixtures are retained above.','No natural full-campaign playthrough or exact AI equivalence is certified.']
    (ROOT/'analysis/native-validation.json').write_text(json.dumps(summary,indent=2))
    (ROOT/'analysis/scene-comparison.json').write_text(json.dumps(comparisons,indent=2))
    rows=[('Menú','analysis/native-reference/boot/boot-2s.png','test-results/menu.png'),('Prehistoria','analysis/native-reference/game/prehistory-start.png','test-results/era-0.png'),('Futuro','analysis/native-reference/future/future-start.png','test-results/era-4.png')]
    sheet=Image.new('RGB',(1600,3*636),'#0a0a0c');draw=ImageDraw.Draw(sheet)
    try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
    except OSError:font=ImageFont.load_default()
    for i,(name,original,web) in enumerate(rows):
        y=i*636;draw.text((12,y+8),name+' · Windows original',fill='white',font=font);draw.text((812,y+8),name+' · port web',fill='white',font=font)
        sheet.paste(Image.open(ROOT/original).convert('RGB'),(0,y+36));sheet.paste(Image.open(ROOT/web).convert('RGB'),(800,y+36))
    (ROOT/'docs').mkdir(exist_ok=True);sheet.save(ROOT/'docs/native-comparison.jpg',quality=92)
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
