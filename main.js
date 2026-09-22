const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const OutputWindowManager = require('./OutputWindowManager');

let mainWindow;
let outputWindowManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false, // safer, contextIsolation is true by default
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  // In production, you would point this to your built Next.js server.
  // In dev, we point it to localhost:3000 where Next is running.
  const baseUrl = process.env.NEXT_DEV_URL || 'http://localhost:3000';
  mainWindow.loadURL(baseUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  outputWindowManager = new OutputWindowManager();
  outputWindowManager.registerIpcHandlers();

  createWindow();

  // Auto launch outputs if configured in settings
  setTimeout(() => {
    if (outputWindowManager) {
      outputWindowManager.autoLaunchIfConfigured();
    }
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

