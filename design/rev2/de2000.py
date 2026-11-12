import math
def srgb2lab(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
    r,g,b=lin(r),lin(g),lin(b)
    X=0.4124*r+0.3576*g+0.1805*b; Y=0.2126*r+0.7152*g+0.0722*b; Z=0.0193*r+0.1192*g+0.9505*b
    X/=0.95047; Z/=1.08883
    def f(t): return t**(1/3) if t>0.008856 else 7.787*t+16/116
    return 116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z))
def de2000(c1,c2):
    L1,a1,b1=srgb2lab(c1);L2,a2,b2=srgb2lab(c2)
    C1=math.hypot(a1,b1);C2=math.hypot(a2,b2);Cb=(C1+C2)/2
    G=0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7)))
    a1p=(1+G)*a1;a2p=(1+G)*a2
    C1p=math.hypot(a1p,b1);C2p=math.hypot(a2p,b2)
    h1p=math.degrees(math.atan2(b1,a1p))%360;h2p=math.degrees(math.atan2(b2,a2p))%360
    dL=L2-L1;dC=C2p-C1p
    dh=h2p-h1p
    if C1p*C2p==0: dh=0
    elif dh>180: dh-=360
    elif dh<-180: dh+=360
    dH=2*math.sqrt(C1p*C2p)*math.sin(math.radians(dh/2))
    Lb=(L1+L2)/2;Cbp=(C1p+C2p)/2
    hs=h1p+h2p
    if C1p*C2p==0: hb=hs
    elif abs(h1p-h2p)<=180: hb=hs/2
    elif hs<360: hb=(hs+360)/2
    else: hb=(hs-360)/2
    T=1-0.17*math.cos(math.radians(hb-30))+0.24*math.cos(math.radians(2*hb))+0.32*math.cos(math.radians(3*hb+6))-0.20*math.cos(math.radians(4*hb-63))
    dth=30*math.exp(-((hb-275)/25)**2)
    Rc=2*math.sqrt(Cbp**7/(Cbp**7+25**7))
    Sl=1+0.015*(Lb-50)**2/math.sqrt(20+(Lb-50)**2);Sc=1+0.045*Cbp;Sh=1+0.015*Cbp*T
    Rt=-math.sin(math.radians(2*dth))*Rc
    return math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh))
