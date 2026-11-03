// Shader di Folder Scan Machine (archivefolder.xyz/scanmachine, machine-gpu.js), copiati senza modifiche.
const machineGPUVertex=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const machineGPUCommon=`#version 300 es
precision highp float;
precision highp int;
in vec2 uv;out vec4 outColor;
uniform sampler2D imageTex,fieldTex,noiseTex,overlayTex,curveTex;
uniform vec2 fullSize,tileOrigin,tileSize;
uniform float seed;
float hash(vec2 p,float salt){uvec2 q=uvec2(ivec2(floor(p)));uint n=q.x*1973u+q.y*9277u+uint(seed)+uint(salt)*26699u;n=(n^(n>>13u))*1274126177u;return float(n^(n>>16u))/4294967295.;}
float ns(int i){i=i&4095;return texelFetch(noiseTex,ivec2(i&255,i>>8),0).r;}
float perlin(vec3 p){p=abs(p);ivec3 a=ivec3(floor(p));vec3 f=fract(p);float sum=0.,amp=.5;
 for(int k=0;k<4;k++){int n=a.x+(a.y<<4)+(a.z<<8);vec3 t=.5*(1.-cos(f*3.14159265359));
 float lo=mix(mix(ns(n),ns(n+1),t.x),mix(ns(n+16),ns(n+17),t.x),t.y);
 n+=256;float hi=mix(mix(ns(n),ns(n+1),t.x),mix(ns(n+16),ns(n+17),t.x),t.y);
 sum+=mix(lo,hi,t.z)*amp;amp*=.5;a*=2;f*=2.;a+=ivec3(floor(f));f=fract(f);}return sum;}
vec3 quant(vec3 c){return floor(clamp(c,0.,1.)*255.+.5)/255.;}
vec2 point(){vec2 p=floor(tileOrigin+uv*tileSize);return vec2(p.x,fullSize.y-1.-p.y);}
vec2 localPoint(vec2 p){return (vec2(p.x,fullSize.y-1.-p.y)-tileOrigin+.5)/tileSize;}
vec4 sampleField(vec2 p){return texture(fieldTex,localPoint(p));}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
`;
const machineGPUShaders={
 field:machineGPUCommon+`uniform float printNoiseScale,fiberScale;uniform int cloud;
 void main(){vec2 p=point();outColor=vec4(perlin(vec3(p*.18,0.)),perlin(vec3(p*printNoiseScale,0.)),perlin(vec3(p*.11,0.)),cloud==1?perlin(vec3(p*fiberScale,.42)):.5);}`,
 base:machineGPUCommon+`uniform float contrast,brightness,vibrance,grain,threshold,blackLift,fiberAmount;uniform int bw;
 void main(){vec2 p=point();vec3 c=texture(imageTex,uv).rgb;float g=(hash(p,1.)*2.-1.)*grain;float fiber=(sampleField(p).a-.5)*fiberAmount;
 c=clamp((c-128./255.)*contrast+128./255.+brightness+(g+fiber)/255.,0.,1.);
 if(bw==1){float v=(luma(c)*255.+(hash(p,2.)*2.-1.)*34.)<threshold?18.:242.;float dust=hash(p,3.);if(dust<grain*.00018)v=hash(p,4.)>.5?0.:255.;if(dust>1.-grain*.00012)v=190.+hash(p,5.)*65.;c=vec3(v/255.);}
 else{float s=(max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)));c=clamp(mix(vec3(luma(c)),c,1.+vibrance*(1.-s*.65)),0.,1.);if(hash(p,3.)<grain*.00018)c=vec3(hash(p,4.)>.5?245./255.:0.);}
 c=mix(c,max(c,vec3(blackLift*145./255.)),blackLift);outColor=vec4(quant(c),1.);}`,
 print:machineGPUCommon+`uniform int mode,bw;uniform float amount,blacks,smear,spacing,softness,misregister,kSpacing,mSpacing,ySpacing,paperNoise,solidThreshold,solidValue,shadowPress;uniform vec4 angles,ink;
 float dotInk(float coverage,vec2 p,float sp,float angle){if(coverage<=.001)return 0.;vec2 r=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*p;vec2 cell=mod(r,sp)/sp-.5;float radius=sqrt(coverage)*.86+(sampleField(p).r*.1-.05);return 1.-smoothstep(radius-softness,radius+softness,length(cell)*2.);}
 void main(){vec2 p=point();vec3 orig=texture(imageTex,uv).rgb,c=orig;if(amount<=0.||bw==1){outColor=vec4(c,1.);return;}
 if(mode==1){float distance=floor(smear*18.*max(1.,fullSize.x/2250.)+.5);float shift=max(0.,distance+floor(sin(p.y*.071)*distance*.16+.5));
 vec2 q=clamp(p-vec2(shift,floor(distance*.2+.5)),vec2(0.),fullSize-1.);vec3 sc=texture(imageTex,localPoint(q)).rgb;
 float ci=1.-min(c.r,min(c.g,c.b)),si=1.-min(sc.r,min(sc.g,sc.b));c=mix(mix(c,vec3(1.),clamp(smear*max(0.,ci-si)*.24,0.,.2)),sc,clamp(smear*max(0.,si-ci)*1.35,0.,.9));
 float k=clamp(pow(1.-max(c.r,max(c.g,c.b)),mix(1.08,.76,blacks))*mix(.82,1.12,blacks),0.,1.);vec3 cym=clamp((1.-c-k)/max(.0001,1.-k),0.,1.);
 float broad=sampleField(p).g-.5,fine=hash(p,7.)-.5,variation=1.+broad*.07+fine*.035,cov=max(k,max(cym.r,max(cym.g,cym.b)));cym=clamp(cym*variation,0.,1.);k=clamp(k*variation,0.,1.);
 c=(250./255.)*(1.-cym*mix(.72,.88,amount))*(1.-k*mix(.78,.98,blacks))+(broad*5.+fine*2.5)*cov/255.;}
 else{float k=clamp(pow(1.-max(c.r,max(c.g,c.b)),mix(1.55,.62,blacks))*mix(.45,1.55,blacks),0.,1.);vec3 cym=clamp((1.-c-k)/max(.0001,1.-k),0.,1.);
 vec4 dots=vec4(dotInk(cym.r,p+vec2(-misregister,misregister*.4),spacing,angles.x),dotInk(cym.g,p+vec2(misregister*.7,-misregister),spacing*mSpacing,angles.y),dotInk(cym.b,p+vec2(misregister),spacing*ySpacing,angles.z),dotInk(k,p,spacing*kSpacing,angles.w));
 c=vec3((248.+(sampleField(p).g-.5)*paperNoise-dots.w*(ink.w*mix(.5,1.45,blacks)+shadowPress*blacks))/255.)-dots.rgb*ink.rgb/255.;
 if(solidThreshold>0. && k>=solidThreshold)c=mix(c,vec3(clamp((solidValue+(sampleField(p).r-.5)*24.)/255.,0.,1.)),smoothstep(solidThreshold,.98,k));}
 outColor=vec4(quant(mix(orig,c,amount)),1.);}`,
 copy:machineGPUCommon+`uniform vec4 rect;uniform int nearestSample;
 void main(){vec2 q=rect.xy+uv*rect.zw;outColor=nearestSample==1?texelFetch(imageTex,clamp(ivec2(floor(q*vec2(textureSize(imageTex,0)))),ivec2(0),textureSize(imageTex,0)-1),0):texture(imageTex,q);}`,
 blur:machineGPUCommon+`uniform vec2 axis;uniform float sigma;uniform int blurKind;
 void main(){float radius;if(blurKind==1){float samples=floor(7.*max(1.,sigma));if(mod(samples,2.)==0.)samples+=1.;radius=(samples-1.)*.5;}else radius=max(1.,floor(3.5*sigma));
 vec3 c=vec3(0.);float weights=0.;for(int i=-28;i<=28;i++){float t=float(i);if(abs(t)>=radius)continue;float w=(radius-abs(t))*(radius-abs(t));c+=texture(imageTex,uv+axis*t).rgb*w;weights+=w;}outColor=vec4(c/weights,1.);}`,
 exposure:machineGPUCommon+`uniform float mini;uniform vec4 rect;
 void main(){vec2 p=point();vec3 c=texture(imageTex,uv).rgb;if(mini>0.){float g=mix(2.,34.,mini);c=quant(c+vec3(((hash(p,8.)*2.-1.)+(sampleField(p).b-.5))*g/255.));}
 ivec3 ix=ivec3(floor(clamp(c,0.,1.)*255.+.5));c=vec3(texelFetch(curveTex,ivec2(ix.r,0),0).r,texelFetch(curveTex,ivec2(ix.g,0),0).r,texelFetch(curveTex,ivec2(ix.b,0),0).r);outColor=vec4(c,1.);}`,
 warp:machineGPUCommon+`uniform float distortion;
 void main(){vec2 p=point();float s=floor(p.y*130./fullSize.y);float shift=sin(s*.23)*distortion*.18+(hash(vec2(s,0.),9.)*2.-1.)*distortion*.08;
 float slice=fullSize.y/130.;vec2 q=vec2(p.x-shift,s*slice+(p.y+.5-s*slice)*slice/(slice+1.)-.5);outColor=(q.x<0.||q.x>=fullSize.x)?vec4(vec3(248./255.),1.):texelFetch(imageTex,clamp(ivec2(floor(localPoint(q)*tileSize)),ivec2(0),textureSize(imageTex,0)-1),0);}`,
 finish:machineGPUCommon+`uniform int cloud,blend,finalBW;uniform float cloudScale,cloudMix,cloudFineMin,cloudFineMax,cloudAlpha,opacity,cleanup;uniform vec4 overlayRect;
 void main(){vec2 p=point();vec3 c=texture(imageTex,uv).rgb;
 if(cloud==1){float v=perlin(vec3(p*cloudScale,0.))*cloudMix+mix(cloudFineMin,cloudFineMax,hash(p,10.))*(1.-cloudMix)/255.;c=mix(c,vec3(v),cloudAlpha);}
 if(opacity>0.){vec3 t=texture(overlayTex,overlayRect.xy+vec2(p.x+.5,fullSize.y-p.y-.5)/fullSize*overlayRect.zw).rgb;vec3 b;
 if(blend==1)b=max(c,t);else if(blend==2)b=min(vec3(1.),c+t*opacity);else if(blend==3)b=mix(2.*c*t,1.-2.*(1.-c)*(1.-t),step(vec3(.5),c));else if(blend==4)b=c*t;else if(blend==5)b=t;else b=1.-(1.-c)*(1.-t);
 c=blend==2?b:mix(c,b,opacity);}
 c=quant(c);float threshold=mix(248.,165.,cleanup)/255.;if(cleanup>0.)c=mix(c,vec3(1.),smoothstep(threshold,1.,luma(c))*cleanup);
 c=quant(c);if(finalBW==1)c=vec3(luma(c));outColor=vec4(quant(c),1.);}`
};

