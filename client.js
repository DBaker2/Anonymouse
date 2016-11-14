const canvasGL = document.createElement("canvas");
const screenHeight = screen.availHeight;
const screenWidth = screen.availWidth;
const startTime = Date.now();
let timer = 0;
let oldMouse = newMouse = [0.5, 0.5];
let mouseVelocity = [0, 0];

/* =========================================================
                COMMUNICATION w/ MAIN PROCESS
 ========================================================= */
const ipc = require('electron').ipcRenderer;

ipc.on('cursor', function (event, cursor) {
      newMouse = [cursor.pos.x/screenWidth, cursor.pos.y/screenHeight];
      // uniforms.uMouse.value = new THREE.Vector2(arg.x/screenWidth, arg.y/screenHeight);//.x = evt.clientX/width;  

      // neeed to make sure these values are being updated even if the main window isn't open which prevents window.request animation frame from being called
      timer = Date.now() - startTime;
      gl.uniform1f(uniforms.uTime, timer);
      gl.uniform2f(uniforms.uCursor, newMouse[0], newMouse[1]);
      gl.uniform3f(uniforms.uColor, cursor.color.r, cursor.color.g, cursor.color.b);
      // uniforms.uTime.value = timer * 0.001;

      // update mouse speed and...
      mouseVelocity = [newMouse[0] - oldMouse[0], newMouse[1] - oldMouse[1]]
      gl.uniform2f(uniforms.uCursorVelocity, -mouseVelocity[0],-mouseVelocity[1]);
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
`
const fragmentShaderSource = `
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform vec2 uCursor; // 0 -> 1
uniform vec2 uCursorVelocity;
uniform vec3 uColor; // color under cursor in range [0,1]
uniform sampler2D uImage; 

varying vec2 vUV;
varying vec2 vTexCoord;

void main() {
  vec2 uv = vec2(vUV.x*uAspect, vUV.y);
  vec2 uCursor2 = vec2(uCursor.x*uAspect, uCursor.y);

  float dist = distance(uv, uCursor2);
  
  vec2 transformedUV = vUV + 0.0001*uCursorVelocity/pow(dist,2.0);
  vec4 tex = texture2D(uImage, transformedUV);
  // tex.a*= 0.9;
  if (dist < 0.006) {
    // tex = mix(vec4(uColor, 0.05),tex,0.001);
    tex.rgb = uColor;
    // if (length(tex.rgb) > 2.0) tex.rgb /= length(tex.rgb);
    //  tex.a = 0.01/dist;//100.0/pow(dist*10.0, 5.0);
  }
  // tex.a = 0.0001;
  gl_FragColor = tex;
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
  aTexCoordLocation:  gl.getAttribLocation(program, 'aTexCoord')
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
gl.viewport(0,0, gl.canvas.width, gl.canvas.height);

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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, new ImageData(screenWidth, screenHeight));

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
gl.uniform1f(uniforms.uAspect, screenWidth/screenHeight);
/* =========================================================
                         RENDERING
 ========================================================= */

// clear the canvas
gl.clearColor(0,0,0,0.0);
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
const count = positions.length/2; // number of indices to be rendered (4 === 1 in each corner)

let ind = 0;

gl.bindTexture(gl.TEXTURE_2D, textures[0]);
render();

function render() {
  // we don't need to flip y in the framebuffers (also note that bools can be set as either floating point or integers)
    gl.uniform1f(uniforms.uFlipY, false);
    // ping pong through the effects
      ind++;
      setFramebuffer(framebuffers[ind%2], screenWidth, screenHeight)

      gl.drawArrays(primitiveType, first, count);

      // for the next draw, use the texture we just rendered to
      gl.bindTexture(gl.TEXTURE_2D, textures[ind%2]);
    
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
  gl.clearColor(0,0,0,0.0);
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
  gl.attachShader(program,vertexShader);
  gl.attachShader(program,fragmentShader);
  gl.linkProgram(program);
  const successfulLink = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (successfulLink) {
    return program;
  } else {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }  
}