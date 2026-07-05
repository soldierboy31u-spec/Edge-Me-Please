import zlib, struct, os, glob, sys
CAP = 640
def decode(path):
    d=open(path,'rb').read(); pos=8; w=h=ct=None; idat=b''
    while pos<len(d):
        ln=struct.unpack('>I',d[pos:pos+4])[0]; typ=d[pos+4:pos+8]; body=d[pos+8:pos+8+ln]
        if typ==b'IHDR': w,h,_bd,ct=struct.unpack('>IIBB',body[:10])
        elif typ==b'IDAT': idat+=body
        pos+=12+ln
    raw=zlib.decompress(idat); ch={0:1,2:3,3:1,4:2,6:4}[ct]; stride=w*ch
    out=bytearray(w*h*ch); prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; p+=1; line=bytearray(raw[p:p+stride]); p+=stride
        if f==1:
            for i in range(ch,stride): line[i]=(line[i]+line[i-ch])&255
        elif f==2:
            for i in range(stride): line[i]=(line[i]+prev[i])&255
        elif f==3:
            for i in range(stride): line[i]=(line[i]+((line[i-ch] if i>=ch else 0)+prev[i])//2)&255
        elif f==4:
            for i in range(stride):
                a=line[i-ch] if i>=ch else 0; b=prev[i]; c=prev[i-ch] if i>=ch else 0
                pa,pb,pc=abs(b-c),abs(a-c),abs(a+b-2*c)
                line[i]=(line[i]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
        out[y*stride:(y+1)*stride]=line; prev=line
    return w,h,ch,out
def enc(path,w,h,buf):  # buf is RGBA
    def chunk(t,dd): c=struct.pack('>I',len(dd))+t+dd; return c+struct.pack('>I',zlib.crc32(t+dd)&0xffffffff)
    raw=bytearray(); st=w*4
    for y in range(h): raw.append(0); raw+=buf[y*st:(y+1)*st]
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b''))
def to_rgba(w,h,ch,buf):
    if ch==4: return buf
    out=bytearray(w*h*4)
    for i in range(w*h):
        if ch==3: out[i*4]=buf[i*3]; out[i*4+1]=buf[i*3+1]; out[i*4+2]=buf[i*3+2]; out[i*4+3]=255
        elif ch==1: v=buf[i]; out[i*4]=out[i*4+1]=out[i*4+2]=v; out[i*4+3]=255
        elif ch==2: v=buf[i*2]; out[i*4]=out[i*4+1]=out[i*4+2]=v; out[i*4+3]=buf[i*2+1]
    return out
def downscale(path):
    w,h,ch,buf=decode(path); buf=to_rgba(w,h,ch,buf)
    m=max(w,h)
    if m<=CAP: return None
    s=CAP/m; nw=max(1,round(w*s)); nh=max(1,round(h*s))
    nb=bytearray(nw*nh*4)
    # area-average with premultiplied alpha
    for ny in range(nh):
        sy0=ny*h//nh; sy1=max(sy0+1,(ny+1)*h//nh)
        for nx in range(nw):
            sx0=nx*w//nw; sx1=max(sx0+1,(nx+1)*w//nw)
            pr=pg=pb=pa=0; n=0
            for sy in range(sy0,sy1):
                base=(sy*w+sx0)*4
                for sx in range(sx0,sx1):
                    a=buf[base+3]; pr+=buf[base]*a; pg+=buf[base+1]*a; pb+=buf[base+2]*a; pa+=a; n+=1
                    base+=4
            di=(ny*nw+nx)*4
            if pa>0:
                nb[di]=min(255,round(pr/pa)); nb[di+1]=min(255,round(pg/pa)); nb[di+2]=min(255,round(pb/pa)); nb[di+3]=round(pa/n)
            else:
                nb[di]=nb[di+1]=nb[di+2]=nb[di+3]=0
    enc(path,nw,nh,nb)
    return (w,h,nw,nh)
folders=['assets/iso/buildings','assets/iso/props','assets/iso/landmarks']
root=r"C:\Users\cjk19\Desktop\RDR22dversion"
for f in folders:
    for p in sorted(glob.glob(os.path.join(root,f.replace('/',os.sep),'*.png'))):
        r=downscale(p)
        if r: print(f'{os.path.basename(p):28} {r[0]}x{r[1]} -> {r[2]}x{r[3]}')
        else: print(f'{os.path.basename(p):28} (already <= {CAP}, skipped)')
