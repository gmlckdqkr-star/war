import sys, itertools
sys.path.insert(0,'.')
from de2000 import de2000, srgb2lab
def L(c): return srgb2lab(c)[0]
def C(c): a,b=srgb2lab(c)[1:]; return (a*a+b*b)**.5
fac={'협약녹':'#8C4F2B','협약크림':'#D9C59C','딥홀드놋':'#A87A33','딥홀드쇠':'#5C6068','실반석록':'#3F6F55','실반은자작':'#D3CDBE','오크':'#6C7A47','고블린':'#949C4E','잿불숯':'#2B2523','잿불재':'#A39C90'}
dyes={'쪽빛':'#2B4A78','석청':'#2F6E73','자초':'#5B4A86','상아':'#D8D0B8','먹쪽':'#1F2A44','담청':'#6E94BF','자황':'#C2A03A','old_gold':'#c9a227','금':'#C8962D'}
other={'먹':'#1E1916','종이':'#E8DFCB','피':'#8C1A13','진사':'#B3271D','흰띠':'#F2EDE0'}
for n,c in {**fac,**dyes,**other}.items(): print(f'{n:6s} {c} L={L(c):5.1f} C={C(c):5.1f}')
print()
for d,dv in dyes.items():
    print(d, [(f,round(de2000(dv,fv),1)) for f,fv in {**fac,'먹':other['먹'],'피':other['피'],'진사':other['진사']}.items() if de2000(dv,fv)<20])
