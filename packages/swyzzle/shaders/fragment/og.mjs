export default `
  precision highp float;
  const float seed = ${Math.random()};

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uCursor; // 0 -> 1
  uniform vec2 uCursorVelocity;
  uniform vec3 uColor; // color under cursor in range [0,1]
  uniform sampler2D uImage; 

  varying vec2 vUV;
  varying vec2 vTexCoord;

  // 2D pseudorandom
  float random(vec2 v) {
    return fract(sin(dot(v,vec2(12.9898,78.233)))*seed);
  }

  float noiseOverTime(vec2 v) {
    vec2 iUv = floor(v*12.1)*(1.0+sin(uTime/1.0));
    vec2 fUv = fract(v*12.1)*(1.0+sin(uTime/1.0));

    // Four corners in 2D of a tile
    float a = random(iUv);
    float b = random(iUv + vec2(1.0, 0.0));
    float c = random(iUv + vec2(0.0, 1.0));
    float d = random(iUv + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.0,1.0,fUv);

    return mix(a,b, u.x) + (c-a)* u.y * (1.0-u.x) + (d - b) *u.x*u.y;
  }

    float noiseWithoutTime(vec2 v) {
    vec2 iUv = floor(v*10.1);//*(1.0+sin(uTime/1.0));
    vec2 fUv = fract(v*10.1);//*(1.0+sin(uTime/1.0));

    // Four corners in 2D of a tile
    float a = random(iUv);
    float b = random(iUv + vec2(1.0, 0.0));
    float c = random(iUv + vec2(0.0, 1.0));
    float d = random(iUv + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.0,1.0,fUv);

    return mix(a,b, u.x) + (c-a)* u.y * (1.0-u.x) + (d - b) *u.x*u.y;
  }

  void main() {
    vec2 uv = vec2(vTexCoord.x, vTexCoord.y);
    vec2 uCursor2 = vec2(uCursor.x*uAspect, uCursor.y);

    float dist = distance(uv, uCursor);
    
    vec2 transformedUV = uv + 0.0001*uCursorVelocity/pow(dist,2.0);
    transformedUV.y -= uTime/100000.*(seed*tan(uv.x+0.5 + noiseWithoutTime(sin(uv.x)*uv.xy*1.)))*0.0001*noiseWithoutTime(uv*1.);
    // transformedUV.y -= uTime / 10000000.;
    transformedUV.x -= uTime/100000.*(tan(uv.x+0.5 + noiseWithoutTime(seed*tan(uv.x)*uv.xy*1.)))*0.0001*noiseWithoutTime(uv*1.);

    vec2 transformedUV2 = uv + 0.0001*uCursorVelocity/pow(dist,2.0);
    transformedUV2.y = transformedUV.y - (uv.x*1.0 + noiseOverTime(uv.xy*1.))*0.01*noiseOverTime(uv*1.);

    // transformedUV.x = transformedUV.x - clamp(sin(uv.y*10.),0.0, 1.0)*0.002*noise(uv*1.);
    // transformedUV *= (1.0 + sign(random(floor(uv*1.0))-0.5)*distance(uv,vec2(0.5))*0.01*sin(uTime/90000.9123)*5.0*noise(uv));
    vec4 tex = texture2D(uImage, transformedUV);
    vec4 texOff = texture2D(uImage, transformedUV+.0001);
    vec4 texOff2 = texture2D(uImage, transformedUV2);
    // tex.a = 0.1;

    gl_FragColor = mix(tex, texOff2, 0.01);
  }
  `;
