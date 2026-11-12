import sys, math, itertools
sys.path.insert(0,'.')
from de2000 import de2000, srgb2lab
def lab2hex(L,a,b):
    fy=(L+16)/116; fx=fy+a/500; fz=fy-b/200
    def finv(t): return t**3 if t**3>0.008856 else (t-16/116)/7.787
    X=finv(fx)*0.95047; Y=finv(fy); Z=finv(fz)*1.08883
    r= 3.2406*X-1.5372*Y-0.4986*Z; g=-0.9689*X+1.8758*Y+0.0415*Z; bb=0.0557*X-0.2040*Y+1.0570*Z
    def gam(c): return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
    out=[gam(c) for c in (r,g,bb)]
    if any(c<-0.002 or c>1.002 for c in out): return None
    return '#'+''.join(f'{max(0,min(255,round(c*255))):02X}' for c in out)
def L(c): return srgb2lab(c)[0]
# fixed
DYES_FIXED={'쪽빛':'#2B4A78','자초':'#5B4A86','담청':'#6E94BF','금(구판 황금 근위)':'#C8962D','군청(v2)':'#2E3F8F'}
ref={'먹':'#1E1916','피':'#8C1A13','진사':'#B3271D'}
fac={'협약녹':'#8C4F2B','협약크림':'#D9C59C','딥홀드놋':'#A87A33','딥홀드쇠':'#5C6068','실반석록':'#3F6F55','실반은자작':'#D3CDBE','오크':'#6C7A47','고블린':'#949C4E','잿불주색':'#6E5F55','잿불재':'#A39C90'}
dyes={**DYES_FIXED,'석청':'#2F6E73','먹쪽':'#1F2A44'}
var_f=['딥홀드놋','딥홀드쇠','고블린','협약크림','잿불주색','실반은자작']
var_d=['석청','먹쪽']
def ok_dye(dv, facs):
    if not (25<=L(dv)<=79): return False
    return all(de2000(dv,f)>=21 for f in list(facs.values())+list(ref.values()))
def score_all(fac,dyes):
    bad=[]
    for d,dv in dyes.items():
        for f,fv in list(fac.items())+list(ref.items()):
            e=de2000(dv,fv)
            if e<20: bad.append((d,f,round(e,1)))
        if not 25<=L(dv)<=79: bad.append((d,'L*',round(L(dv),1)))
    return bad
def neigh(c, rng=16, step=2):
    L0,a0,b0=srgb2lab(c)
    C0=math.hypot(a0,b0); h0=math.atan2(b0,a0)
    for dL in range(-rng,rng+1,step):
        for dC in range(-rng,rng+1,step):
            for dh in range(-20,21,4):
                Ln=L0+dL; Cn=max(0,C0+dC); hn=h0+math.radians(dh)
                hx=lab2hex(Ln,Cn*math.cos(hn),Cn*math.sin(hn))
                if hx: yield hx
# greedy: adjust variable dyes first then factions
for it in range(3):
    for d in var_d:
        others={k:v for k,v in dyes.items() if k!=d}
        best=None
        for cand in neigh(dyes[d],rng=20):
            if ok_dye(cand,fac):
                dist=de2000(cand,dyes[d] if it==0 else dyes[d])
                if best is None or dist<best[0]: best=(dist,cand)
        if best: dyes[d]=best[1]
    for f in var_f:
        best=None
        orig=fac[f]
        for cand in neigh(orig,rng=18):
            if f=='잿불주색' and L(cand)<35: continue
            if L(cand)>78: continue
            if all(de2000(dv,cand)>=21 for dv in dyes.values()) and de2000(cand,ref['먹'])>=20:
                # soft: stay away from other factions' primaries
                sep=min(de2000(cand,fv) for k,fv in fac.items() if k.split('주')[0][:2]!=f[:2] and k!=f)
                dist=de2000(cand,orig) - 0.3*min(sep,15)
                if best is None or dist<best[0]: best=(dist,cand)
        if best: fac[f]=best[1]
print('faction:',fac)
print('dyes:',dyes)
print('violations:',score_all(fac,dyes))
for n,c in {**fac,**dyes}.items(): print(f'{n:14s} {c} L={L(c):5.1f}')
print('min dye-faction dE:',round(min(de2000(d,f) for d in dyes.values() for f in fac.values()),1))
print('잿불주색 vs 먹', round(de2000(fac['잿불주색'],ref['먹']),1))
# cross-faction primary separation
prim={'협약':['협약녹','협약크림'],'딥홀드':['딥홀드놋','딥홀드쇠'],'실반':['실반석록','실반은자작'],'군단':['오크','고블린'],'잿불':['잿불주색','잿불재']}
for (a,A),(b,B) in itertools.combinations(prim.items(),2):
    m=min((de2000(fac[x],fac[y]),x,y) for x in A for y in B)
    print(a,b,round(m[0],1),m[1],m[2])
print('은자작 vs 흰띠',round(de2000(fac['실반은자작'],'#F2EDE0'),1))
