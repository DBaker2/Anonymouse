const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

console.log('electron version', process.versions.electron)
console.log('electron architecture', process.arch)
const path = require('path')
const url = require('url')
const robot = require('robotjs');


let mainWindow

function createWindow () {

  
  // Create the browser window.
  mainWindow = new BrowserWindow({
    // width: 500,
    // height: 500,
    width: electron.screen.getPrimaryDisplay().size.width,
    height: electron.screen.getPrimaryDisplay().size.height,
    transparent: true,
    frame: false,
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  // mainWindow.setIgnoreMouseEvents(true);
  mainWindow.setAlwaysOnTop(true);

    var img = robot.screen.capture(0, 0, electron.screen.getPrimaryDisplay().size.width, electron.screen.getPrimaryDisplay().size.height);
    // Support for higher density screens.
    setTimeout(() => {
      mainWindow.webContents.send('screen', {image: img});
      mainWindow.webContents.send('test', 'testing');
    }, 1000)
    console.log(img);

  console.log('electron.screen', electron.screen.getCursorScreenPoint());
  let cursorPos, cursorColor, cursorRGB;
  setInterval(()=>{
    cursorPos = electron.screen.getCursorScreenPoint();
    cursorColor = robot.getPixelColor(cursorPos.x, cursorPos.y);
    // split up color values and convert to 0 -> 1
    cursorRGB = {
      r: parseInt(cursorColor[0].concat(cursorColor[1]), 16)/255,
      g: parseInt(cursorColor[2].concat(cursorColor[3]), 16)/255,
      b: parseInt(cursorColor[4].concat(cursorColor[5]), 16)/255
    };
    if (mainWindow) mainWindow.webContents.send('cursor', {pos: cursorPos, color: cursorRGB});
    // console.log(robot.getPixelColor(robot.getMousePos().x, robot.getMousePos().y))
  }, 16)

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
