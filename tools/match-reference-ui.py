"""Locate original selector artwork in the captured native frame (masked SSE).

This records measured placement; it does not hand-design another selector.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def locate(target,rgba):
    h,w=target.shape[:2];th,tw=rgba.shape[:2]
    mask=(rgba[:,:,3]>250).astype(float);template=rgba[:,:,:3].astype(float)
    size=(h+th-1,w+tw-1)
    def corr(a,k):return np.fft.irfft2(np.fft.rfft2(a,size)*np.fft.rfft2(k[::-1,::-1],size),s=size)[th-1:h,tw-1:w]
    score=np.zeros((h-th+1,w-tw+1));norm=mask.sum()*3
    for c in range(3):score+=corr(target[:,:,c]**2,mask)-2*corr(target[:,:,c],mask*template[:,:,c])+(mask*template[:,:,c]**2).sum()
    y,x=np.unravel_index(np.argmin(score),score.shape)
    return int(x),int(y),float(score[y,x]/norm)

def main():
    target=np.array(Image.open(ROOT/'analysis/native-reference/select/level-select.png').convert('RGB'),dtype=float)
    out=[]
    for i,name in enumerate(['prehistoria','egipto','castillo','piratas','futuro']):
        path=f'assets/lang/images/seleccionar_nivel/boton_{name}.png';im=Image.open(ROOT/path).convert('RGBA')
        region=im.crop((440,0,im.width,im.height));bbox=region.getbbox();x,y,r,b=bbox
        cropped=region.crop(bbox);scaled=cropped.resize((round(cropped.width*2/3),round(cropped.height*2/3)),Image.Resampling.BILINEAR)
        px,py,error=locate(target,np.array(scaled));print(name,px,py,'mean squared error',round(error,3))
        out.append({'image':path,'card':{'x':40+i*225,'y':195,'w':220,'h':540},'hero':{'sx':440+x,'sy':y,'w':r-x,'h':b-y,'x':px*1.5,'y':py*1.5},'matchingMSE':error})
    (ROOT/'assets/data/selection.json').write_text(json.dumps(out,indent=2),encoding='utf8')

if __name__=='__main__':main()
