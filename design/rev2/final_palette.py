"""Palette safety check (prototype of the P1 CI check described in DESIGN_BIBLE §8.2/§10.1).
Rules: every ally dye coat colour vs every faction swatch (10) + 먹/피/진사: dE2000 >= 20 (target 21).
Dye L* in [25, 78.8] (>=15 below the white band, >=15 above 먹). Faction swatches L* <= 78.8 (>=15 below the white band).
잿불 primary L* >= 35."""
import sys, itertools
sys.path.insert(0,'.')
from de2000 import de2000, srgb2lab
L=lambda c: srgb2lab(c)[0]
BAND='#F2EDE0'
ref={'먹':'#1E1916','피':'#8C1A13','진사':'#B3271D'}
dyes={'쪽빛(기본)':'#2B4A78','석청':'#198498','자초 보라':'#5B4A86','먹쪽':'#3A3A78','담청':'#6E94BF','황금 근위(구판, 금)':'#C8962D','군청(v2)':sys.argv[1] if len(sys.argv)>1 else '#4250B8'}
fac={'협약 녹':'#8C4F2B','협약 크림':sys.argv[2] if len(sys.argv)>2 else '#C3BDAA','딥홀드 놋':'#83642D','딥홀드 쇠':'#4E443D','실반 석록':'#3F6F55','실반 은자작':'#C3BCB1','군단 오크':'#6C7A47','군단 고블린':'#8FA457','잿불 재흙(주)':'#7B6A62','잿불 재':'#A39C90'}
bad=[]
for d,dv in dyes.items():
    if not (25<=L(dv)<=L(BAND)-15): bad.append((d,'L*',round(L(dv),1)))
    for f,fv in list(fac.items())+list(ref.items()):
        e=de2000(dv,fv)
        if e<20: bad.append((d,f,round(e,1)))
for f,fv in fac.items():
    if L(fv)>L(BAND)-15: bad.append((f,'L* vs band',round(L(fv),1)))
if L(fac['잿불 재흙(주)'])<35: bad.append(('잿불','L*<35'))
print('violations:',bad)
print('min dye-vs-swatch dE:',round(min(de2000(d,f) for d in dyes.values() for f in list(fac.values())+list(ref.values())),1))
for n,c in {**dyes,**fac}.items(): print(f'  {n:14s} {c}  L*={L(c):5.1f}')
print('군청 vs 쪽빛', round(de2000(dyes['군청(v2)'],dyes['쪽빛(기본)']),1), ' 먹쪽 vs 쪽빛', round(de2000(dyes['먹쪽'],dyes['쪽빛(기본)']),1))
print('잿불 주 vs 먹', round(de2000(fac['잿불 재흙(주)'],ref['먹']),1))
fp={'협약':['협약 녹','협약 크림'],'딥홀드':['딥홀드 놋','딥홀드 쇠'],'실반':['실반 석록','실반 은자작'],'군단':['군단 오크','군단 고블린'],'잿불':['잿불 재흙(주)','잿불 재']}
print('faction primary-vs-primary (soft >=12):')
for (a,A),(b,B) in itertools.combinations(fp.items(),2):
    print('  ',a,b,round(de2000(fac[A[0]],fac[B[0]]),1))
