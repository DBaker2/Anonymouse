/* =========================================================
 COMMUNICATION w/ MAIN PROCESS —— receiving screen capture
 ========================================================= */
const receiveScreenCapture = function (event, screenCapture, screenWidth, screenHeight) {
  let imgData = screenCapture.image;
  // for some reason, it seems that the rgb data being sent through robot js is actually ordered bgra...so we need to swizzle -- hence the name swyzzle
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
  return screenImage;
};

/* =========================================================
COMMUNICATION w/ MAIN PROCESS -- receiving mouse posiiton
========================================================= */
const receiveCursorPosition = function (event, cursor, oldMouse, screenWidth, screenHeight, timer, startTime, currentProgram) {

  const newMouse = [cursor.pos.x / screenWidth, cursor.pos.y / screenHeight];

  // neeed to make sure these values are being updated even if the main window isn't open which prevents window.request animation frame from being called
  timer = Date.now() - startTime;

  if ('uTime' in currentProgram.uniforms)
    currentProgram.setUniform('uTime', timer);
  if ('uCursor' in currentProgram.uniforms)
    currentProgram.setUniform('uCursor', newMouse[0], newMouse[1]);
  // TODO figure out why ucolor aint working
  // currentProgram.setUniform('uColor', cursor.color.r, cursor.color.g, cursor.color.b);


  // update mouse speed and...
  mouseVelocity = [newMouse[0] - oldMouse[0], newMouse[1] - oldMouse[1]];
  if ('uCursorVelocity' in currentProgram.uniforms)
    currentProgram.setUniform('uCursorVelocity', -mouseVelocity[0], -mouseVelocity[1]);
  // ...update old mouse position
  return [newMouse, timer];
};

module.exports = {
  receiveScreenCapture: receiveScreenCapture,
  receiveCursorPosition: receiveCursorPosition
};