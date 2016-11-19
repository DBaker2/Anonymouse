const canvasGL = document.createElement("canvas");
const screenHeight = screen.availHeight;
const screenWidth = screen.availWidth;
const startTime = Date.now();
let timer = 0;
let oldMouse = newMouse = [0.5, 0.5];
let mouseVelocity = [0, 0];

const ipc = require('electron').ipcRenderer;
const robot = require('robotjs');
console.log(robot)



/* =========================================================
 COMMUNICATION w/ MAIN PROCESS —— receiving screen capture
 ========================================================= */
let screenImage;
ipc.on('screen', function (event, screenCapture) {
  let imgData = screenCapture.image;
  // for some reason, it seems that the rgb data being sent through robot js is actually ordered bgra...so we need to swizzle
  for (let i = 0; i < imgData.length; i += 4) {
    const tmp = imgData[i * 1];
    imgData[i * 1] = imgData[i * 1 + 2];
    imgData[i * 1 + 2] = tmp;
  }

  // For higher density screens (Macs) the resulting screen capture could be larger than the area requested. 
  // You can work around this by dividing the image size by the requested size
  const scaledImageData = [];
  const multi = screenCapture.width / screenWidth;
  let ind = 0;
  if (screenWidth * screenHeight * 4 < imgData.length) {
    for (let row = 0; row < screenCapture.height; row += multi) {
      for (let col = 0; col < screenCapture.width; col += multi) {
        scaledImageData[ind] = imgData[row * 4 * screenCapture.width + col * 4];
        scaledImageData[ind + 1] = imgData[row * 4 * screenCapture.width + col * 4 + 1];
        scaledImageData[ind + 2] = imgData[row * 4 * screenCapture.width + col * 4 + 2];
        scaledImageData[ind + 3] = imgData[row * 4 * screenCapture.width + col * 4 + 3];
        ind += 4;
      }
    }
    imgData = scaledImageData;
  }

  screenImage = new ImageData(screenWidth, screenHeight);
  screenImage.data.set(imgData);
  init();
})


function init() {
  /* =========================================================
  COMMUNICATION w/ MAIN PROCESS -- receiving mouse posiiton
  ========================================================= */
  ipc.on('cursor', function (event, cursor) {
    newMouse = [cursor.pos.x / screenWidth, cursor.pos.y / screenHeight];
    // uniforms.uMouse.value = new THREE.Vector2(arg.x/screenWidth, arg.y/screenHeight);//.x = evt.clientX/width;  

    // neeed to make sure these values are being updated even if the main window isn't open which prevents window.request animation frame from being called
    timer = Date.now() - startTime;
    gl.uniform1f(uniforms.uTime, timer);
    gl.uniform2f(uniforms.uCursor, newMouse[0], newMouse[1]);
    gl.uniform3f(uniforms.uColor, cursor.color.r, cursor.color.g, cursor.color.b);
    // uniforms.uTime.value = timer * 0.001;

    // update mouse speed and...
    mouseVelocity = [newMouse[0] - oldMouse[0], newMouse[1] - oldMouse[1]]
    gl.uniform2f(uniforms.uCursorVelocity, -mouseVelocity[0], -mouseVelocity[1]);
    // ...update old mouse position
    oldMouse = newMouse;
  })


  /* =========================================================
                        INITIALIZATION
  ========================================================= */
  let gl = canvasGL.getContext("webgl", {
    antialias: false,
    alpha: true,
    // premultipliedAlpha: false
  });
  canvasGL.width = screenWidth;
  canvasGL.height = screenHeight
  canvasGL.style.position = 'fixed'
  canvasGL.style.left = 0,
    canvasGL.style.top = 0,
    canvasGL.style.zIndex = 10000;
  // canvasGL.style.pointerEvents = 'none'

  document.body.appendChild(canvasGL);

  const vertexShaderSource = `
  precision mediump float;

  uniform vec2 uResolution;
  uniform bool uFlipY;

  attribute vec2 aPosPixels;
  attribute vec2 aTexCoord;

  varying vec2 vUV;

  void main() {
    // pixels to clip-space
    // convert position from pixels to 0 -> 1
    vec2 zeroToOne = aPosPixels / uResolution;

    // convert form 0 -> 1 to 0 -> 2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // convert from 0 -> 2 to -1 -> 1
    vec2 clipSpace = zeroToTwo - 1.0; 

    // map the top left corner to pixel coordinate (0, 0)
    if (uFlipY) clipSpace.y *= -1.0;

    vUV = vec2(zeroToOne.x,  zeroToOne.y);

    gl_Position = vec4(clipSpace, 0.0, 1.0);
  }
  `;
  const fragmentShaderSource = `
  precision highp float;
  const float seed = ${Math.random()};

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uCursor; // 0 -> 1
  uniform vec2 uCursorVelocity;
  uniform vec3 uColor; // color under cursor in range [0,1]
  uniform sampler2D uImage; 
  uniform bool uJustReceivedCapture;

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
    vec2 uv = vec2(vUV.x*uAspect, vUV.y);
    vec2 uCursor2 = vec2(uCursor.x*uAspect, uCursor.y);

    float dist = distance(uv, uCursor2);
    
    vec2 transformedUV = vUV + 0.0001*uCursorVelocity/pow(dist,2.0);
    transformedUV.y -= uTime/100000.*(seed*tan(vUV.x+0.5 + noiseWithoutTime(sin(vUV.x)*vUV.xy*1.)))*0.0001*noiseWithoutTime(vUV*1.);
    // transformedUV.y -= uTime / 10000000.;
    transformedUV.x -= uTime/100000.*(tan(vUV.x+0.5 + noiseWithoutTime(seed*tan(vUV.x)*vUV.xy*1.)))*0.0001*noiseWithoutTime(vUV*1.);

    vec2 transformedUV2 = vUV + 0.0001*uCursorVelocity/pow(dist,2.0);
    transformedUV2.y = transformedUV.y - (vUV.x*1.0 + noiseOverTime(vUV.xy*1.))*0.001*noiseOverTime(vUV*1.);

    // transformedUV.x = transformedUV.x - clamp(sin(vUV.y*10.),0.0, 1.0)*0.002*noise(vUV*1.);
    // transformedUV *= (1.0 + sign(random(floor(vUV*1.0))-0.5)*distance(vUV,vec2(0.5))*0.01*sin(uTime/90000.9123)*5.0*noise(vUV));
    vec4 tex = texture2D(uImage, transformedUV);
    vec4 texOff = texture2D(uImage, transformedUV+.0001);
    vec4 texOff2 = texture2D(uImage, transformedUV2);
    // tex.a = 0.2;
    gl_FragColor = mix(tex, texOff2, 0.01);
  }
  `
  // create shaders
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  // create program
  const program = createProgram(gl, vertexShader, fragmentShader);

  // look up the location (within the webgl program) of the attributes and uniforms
  const attributes = {
    aPosPixelsLocation: gl.getAttribLocation(program, 'aPosPixels'),
    aTexCoordLocation: gl.getAttribLocation(program, 'aTexCoord')
  };
  const uniforms = {
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uCursor: gl.getUniformLocation(program, 'uCursor'),
    uCursorVelocity: gl.getUniformLocation(program, 'uCursorVelocity'),
    uColor: gl.getUniformLocation(program, 'uColor'),
    uAspect: gl.getUniformLocation(program, 'uAspect'),
    uFlipY: gl.getUniformLocation(program, 'uFlipY'),
  };

  // attributes get their date from buffers, so we need to create a buffer...
  const aPosPixelsBuffer = gl.createBuffer();
  // ...and bind it to the ARRAY_BUFFER binding point, which is for vertex attributes...
  gl.bindBuffer(gl.ARRAY_BUFFER, aPosPixelsBuffer);
  // ...and then add data by referencing it through the bind point
  const positions = [
    0, 0,
    screenWidth, 0,
    screenWidth, screenHeight,
    screenWidth, screenHeight,
    0, screenHeight,
    0, 0
  ]
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // map the -1 to 1 clip space to 0 -> canvas width, 0 -> canvas height
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const aTexCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, aTexCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const textures = [];
  const framebuffers = [];

  /* function for creating and setting up a texture */
  function createAndSetupTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // set up texture so we can render any size image and so we are working in pixels
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
  }

  // create 2 textures and attach them to framebuffers
  for (let i = 0; i < 2; i++) {
    const texture = createAndSetupTexture(gl);
    textures.push(texture);

    // make texture same size as image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screenImage);

    // create a framebuffer...
    const fbo = gl.createFramebuffer();
    framebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    // ...and attach a texture to it
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }

  // tell webgl to use our shader program (we only have 1, so we don't need to do this in the render loop)
  gl.useProgram(program);

  // set the value of resolution uniform
  gl.uniform2f(uniforms.uResolution, screenWidth, screenHeight);
  gl.uniform1f(uniforms.uAspect, screenWidth / screenHeight);
  /* =========================================================
                          RENDERING
  ========================================================= */

  // clear the canvas
  gl.clearColor(0, 0, 0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  /* take data from the buffer we set up above and supply it to the attribute in the shader */
  // turn the attribute on at a given index position
  gl.enableVertexAttribArray(attributes.aPosPixelsLocation);

  // bind position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, aPosPixelsBuffer);

  // tell the attribute how to get data out of the buffer
  const size = 2;         // 2 components per iteration
  const type = gl.FLOAT;  // the data is 32 bit floats
  const normalize = false;// don't normalize data
  const stride = 0;       // specify the size in bytes of the offset between the beginng of consecurtive vertex attributes
  const offset = 0;       // offset in bytes of the first component in the vertex attribute ARRAY_BUFFER

  // bind attribute to aPosBuffer, so that we're now free to bind something else to the ARRAY_BUFFER bind point. This attribute will continue to use positionBuffer.
  gl.vertexAttribPointer(attributes.aPosPixelsLocation, size, type, normalize, stride, offset);

  /* NB: Our vertex shader used to be expecting aPos to be a vec4 (but then we changed it vec2). We set size = 2, so this attribute will get its first 2 values from our buffer. Attributes default to 0,0,0,1, so the last two components will be 0, 1.*/

  // turn on the texCoord attribute
  gl.enableVertexAttribArray(attributes.aTexCoordLocation);
  // bind the tex coord buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, aTexCoordBuffer);
  // bint attribute to aTexCoordBuffer
  gl.vertexAttribPointer(attributes.aTexCoordLocation, size, type, normalize, stride, offset);

  /* =============================
    Execute our GLSL program 
  ============================= */
  const primitiveType = gl.TRIANGLES; // draws a triangle for a group of three vertices
  const first = 0; // starting index in array of vector points
  const count = positions.length / 2; // number of indices to be rendered (4 === 1 in each corner)

  let ind = 0;

  gl.bindTexture(gl.TEXTURE_2D, textures[0]);
  render();

  function render() {
    // we don't need to flip y in the framebuffers (also note that bools can be set as either floating point or integers)
    gl.uniform1f(uniforms.uFlipY, false);
    // ping pong through the effects
    ind++;
    setFramebuffer(framebuffers[ind % 2], screenWidth, screenHeight)

    gl.drawArrays(primitiveType, first, count);

    // for the next draw, use the texture we just rendered to
    gl.bindTexture(gl.TEXTURE_2D, textures[ind % 2]);

    // finally draw the result to the canvas by setting the framebuffer to null
    setFramebuffer(null, canvasGL.width, canvasGL.height);
    gl.uniform1f(uniforms.uFlipY, true);
    gl.drawArrays(primitiveType, first, count);

    function setFramebuffer(fbo, width, height) {
      // make this the frame buffer we are rendering to 
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      // tell the shader the resolution of the framebuffer
      gl.uniform2f(uniforms.uResolution, width, height); // tell webgl the viewport setting needed for framebuffer
      gl.viewport(0, 0, width, height);
    }

    // clear the canvas
    gl.clearColor(0, 0, 0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(primitiveType, first, count);

    window.requestAnimationFrame(render);
  }












  /* function for creating vertex and fragment shaders */
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const successfulCompile = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
    if (successfulCompile) {
      return shader;
    } else {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
    }
  }

  /* function for linking together shaders into program */
  function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const successfulLink = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (successfulLink) {
      return program;
    } else {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
    }
  }
}