const {app, Menu} = require('electron');
const electron = require('electron');
const url = require('url');
const path = require('path');


const BrowserWindow = electron.BrowserWindow;

const template = [
  {
    label: app.getName(),
    submenu: [
      {
        label: 'Preferences',
        accelerator: process.platform === 'darwin' ? 'Command+,' : 'Ctrl+,',
        click: openPreferences
      },
      {
        role: 'quit'
      },
      {
        role: 'services'
      },
      {
        role: 'close'
      },
      {
        label: 'reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload();
        }
      },
      {
        label: 'Toggle Dev Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.webContents.toggleDevTools();
        }
      }
    ]
  }
]

let preferencesWindow;


function openPreferences() {
  if (preferencesWindow == null) {
    preferencesWindow = new BrowserWindow({
      show: false,
      width: 500,
      height: 500,
      x: 100,
      y: 100,
    });
    // preferences always on top because the main window is also always on top and would block preferences windows without this
    preferencesWindow.setAlwaysOnTop(true);

    // gracefully show the preferences window
    preferencesWindow.once('ready-to-show', () => {
      preferencesWindow.show();
    });

    // preferencesWindow.webContents.openDevTools();
    preferencesWindow.on('closed', () => {
      preferencesWindow = null;
    });
  }

  preferencesWindow.loadURL(url.format({
    pathname: path.join(__dirname, './preferences/preferences.html'),
    protocol: 'file:',
    slashes: true,
  }))
}
const menu = Menu.buildFromTemplate(template)

module.exports = menu;