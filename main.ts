import{readdirSync as r,readFileSync as f,mkdirSync as m,writeFileSync as w}from"fs"
const T=` 1a$&*+/pppppppp)))))))%)))%)))p)))ppppppppppppp@DD@ ppppppppppp%(pppppppppppppp$$!$`,F=[(a,b)=>a+b|0,(a,b)=>a-b|0,Math.imul,(a,b)=>a/b|0,(a,b)=>a%b|0,(a,b)=>(a>>>0)/(b>>>0)|0,(a,b)=>(a>>>0)%(b>>>0)|0,,(a,b)=>a&b,(a,b)=>a|b,(a,b)=>a^b,,(a,b)=>a<<(b&31),(a,b)=>a>>(b&31),(a,b)=>a>>>(b&31)|0,,(a,b)=>a==b?1:0,(a,b)=>a<b?1:0,(a,b)=>a>>>0<b>>>0?1:0]
function R(P,Q){let D=new Int32Array(256),C=D.slice(),M=D.slice(),O=new Uint8Array(65536),o=0,p=0,d=0,c=0,s=0,j=0,n=P.length,E=e=>({o:O.slice(0,o),c:e})
for(;;){if(s==1e6)return E(10)
if(p<0||p>=n)return E(9)
let b=P[p],v=T.charCodeAt(b)-32
if(!(v<80))return E(5)
let i=v>>4,q=v>>2&3
if(p+i>=n)return E(9)
s++
let x=p+1+i
if(d<q)return E(2)
if(d-q+(v&3)>256)return E(3)
p=x
if(b<3){if(!b)return E(0)
D[d++]=b<2?(P[x-1]<<24)>>24:P[x-4]|P[x-3]<<8|P[x-2]<<16|P[x-1]<<24}else if(b<8){if(b==3)d--
else if(b==4)D[d]=D[d-1],d++
else if(b==5){let t=D[d-1];D[d-1]=D[d-2];D[d-2]=t}else if(b==6)D[d]=D[d-2],d++
else{let a=D[d-3];D[d-3]=D[d-2];D[d-2]=D[d-1];D[d-1]=a}}else if(b<35){if(b==23)D[d-1]=-D[d-1]|0
else if(b==27)D[d-1]=~D[d-1]
else{let y=D[d-1];if(b>18&&b<23&&!y)return E(4);D[d-2]=F[b-16](D[d-2],y);d--}}else if(b<53){let g=(P[x-2]|P[x-1]<<8)<<16>>16
if(b<49)p=x+g
else if(b<51){let y=D[--d];if((b==49)==!y)p=x+g}else if(b==51){if(c==64)return E(7);C[c++]=x;p=P[x-2]|P[x-1]<<8}else{if(!c)return E(8);p=C[--c]}}else if(b<66){let a=D[d-1]
if(a<0||a>255)return E(6)
if(b==64)D[d-1]=M[a]
else d-=2,M[a]=D[d]}else{if(b==80){let t=""+D[d-1];if(o+t.length>65536)return E(11);d--;for(let k=0;k<t.length;k++)O[o++]=t.charCodeAt(k)}else if(b==81){if(o>65535)return E(11);O[o++]=D[--d]&255}else if(b==82)D[d++]=j<Q.length?Q[j++]:-1
else return E(D[--d]&255)}}}
let I=process.env.MAKEFUN_INPUT_DIR||"/input",O=process.env.MAKEFUN_OUTPUT_DIR||"/output"
for(let i of r(I).sort()){let t=R(f(I+"/"+i+"/program.bin"),f(I+"/"+i+"/input.bin"));m(O+"/"+i,{recursive:!0});w(O+"/"+i+"/stdout.bin",t.o);w(O+"/"+i+"/exit.txt",t.c+"\n")}
