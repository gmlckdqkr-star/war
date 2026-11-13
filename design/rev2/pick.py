import sys, itertools
sys.path.insert(0,'.')
from de2000 import de2000, srgb2lab
L=lambda c: srgb2lab(c)[0]
ref={'먹':'#1E1916','피':'#8C1A13','진사':'#B3271D'}
dyes={'쪽빛':'#2B4A78','자초':'#5B4A86','담청':'#6E94BF','금':'#C8962D','군청':'#2E3F8F','석청':'#198498'}
fac={'협약녹':'#8C4F2B','협약크림':'#C0BDA4','딥홀드놋':'#83642D','실반석록':'#3F6F55','실반은자작':'#C3BCB1','오크':'#6C7A47','고블린':'#8FA457','잿불주색':'#6E5F55','잿불재':'#A39C90'}
iron=['#5E5248','#4F4A45','#6B6058','#5A5550','#625548','#574C44','#665A50','#4E443D','#706458','#6A5A4C','#5B4E42','#74675C']
night=['#2A3566','#283A6A','#30386E','#263A70','#33306A','#2C3A72','#2F3570','#36346E','#273C6E','#2B3462','#323C74','#3A3A78']
ash=['#6E5F55','#7A6658','#76675F','#80695A','#7B6A62','#85705F','#7A5F52','#8A7466','#6F5A4F','#776258']
res=[]
for i in iron:
  for n in night:
    for a in ash:
      f={**fac,'딥홀드쇠':i,'잿불주색':a}
      d={**dyes,'먹쪽':n}
      if L(n)<25 or L(a)<35: continue
      m=min(de2000(x,y) for x in d.values() for y in list(f.values())+list(ref.values()))
      sep_ia=de2000(i,a)
      sep_a_gr=min(de2000(a,f['협약녹']),de2000(a,f['딥홀드놋']))
      if m>=21: res.append((round(min(sep_ia,sep_a_gr),1),round(m,1),i,n,a))
res.sort(reverse=True)
for r in res[:15]: print(r)
