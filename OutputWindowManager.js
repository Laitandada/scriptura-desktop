const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

class OutputWindowManager {
  constructor() {
    this.mainOutputWindow = null;
    this.alternateOutputWindow = null;
    this.settingsPath = path.join(app.getPath('userData'), 'scriptura-output-settings.json');
    this.settings = this.loadSettings();

    this.setupDisplayListeners();
  }

  getDefaultSettings() {
    return {
      mainOutput: {
        enabled: true,
        displayId: null,
        autoLaunch: false,
      },
      alternateOutput: {
        enabled: false,
        displayId: null,
        autoLaunch: false,
      },
    };
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...this.getDefaultSettings(),
          ...parsed,
          mainOutput: { ...this.getDefaultSettings().mainOutput, ...(parsed.mainOutput || {}) },
          alternateOutput: { ...this.getDefaultSettings().alternateOutput, ...(parsed.alternateOutput || {}) },
        };
      }
    } catch (err) {
      console.error('Failed to load output settings, using defaults:', err);
    }
    return this.getDefaultSettings();
  }

  saveSettings(newSettings) {
    try {
      this.settings = {
        ...this.settings,
        ...newSettings,
        mainOutput: { ...this.settings.mainOutput, ...(newSettings.mainOutput || {}) },
        alternateOutput: { ...this.settings.alternateOutput, ...(newSettings.alternateOutput || {}) },
      };
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');
      this.broadcastStatusChange();
      return { success: true, settings: this.settings };
    } catch (err) {
      console.error('Failed to save output settings:', err);
      return { success: false, error: err.message };
    }
  }

  getDisplays() {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    return displays.map((display, index) => {
      const isPrimary = display.id === primaryDisplay.id;
      const isBuiltIn = isPrimary && process.platform === 'darwin';
      const label = display.label || (isBuiltIn ? 'Built-in Display' : `Display ${index + 1}`);

      return {
        id: String(display.id),
        rawId: display.id,
        name: `Display ${index + 1} (${label})`,
        label: label,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        isPrimary: isPrimary,
        resolution: `${display.bounds.width} × ${display.bounds.height}`,
      };
    });
  }

  findDisplay(targetDisplayId) {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    if (!targetDisplayId) {
      // Find an external display (one that isn't primary/at 0,0) or fallback to primary
      const external = displays.find((d) => d.id !== primaryDisplay.id || d.bounds.x !== 0 || d.bounds.y !== 0);
      return external || primaryDisplay;
    }

    // Try finding by exact id match (handling string vs number)
    const matched = displays.find((d) => String(d.id) === String(targetDisplayId));
    return matched || null;
  }

  setupDisplayListeners() {
    const handleDisplayChange = () => {
      this.broadcastDisplaysChanged();
      this.broadcastStatusChange();
    };

    screen.on('display-added', handleDisplayChange);
    screen.on('display-removed', handleDisplayChange);
    screen.on('display-metrics-changed', handleDisplayChange);
  }

  broadcastDisplaysChanged() {
    const displays = this.getDisplays();
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('outputs:displays-changed', displays);
      }
    });
  }

  broadcastStatusChange() {
    const status = this.getStatus();
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('outputs:status-changed', status);
      }
    });
  }

  getStatus() {
    const displays = screen.getAllDisplays();

    const mainActive = this.mainOutputWindow && !this.mainOutputWindow.isDestroyed();
    const mainTargetDisplay = this.findDisplay(this.settings.mainOutput.displayId);
    let mainStatus = 'not-running';
    if (mainActive) {
      mainStatus = 'active';
    } else if (this.settings.mainOutput.enabled) {
      mainStatus = mainTargetDisplay ? 'connected' : 'unavailable';
    }

    const alternateActive = this.alternateOutputWindow && !this.alternateOutputWindow.isDestroyed();
    const alternateTargetDisplay = this.findDisplay(this.settings.alternateOutput.displayId);
    let alternateStatus = 'not-running';
    if (alternateActive) {
      alternateStatus = 'active';
    } else if (this.settings.alternateOutput.enabled) {
      alternateStatus = alternateTargetDisplay ? 'connected' : 'unavailable';
    }

    return {
      mainOutput: {
        active: mainActive,
        status: mainStatus,
        displayId: this.settings.mainOutput.displayId,
        displayFound: Boolean(mainTargetDisplay),
        autoLaunch: this.settings.mainOutput.autoLaunch,
        enabled: this.settings.mainOutput.enabled,
      },
      alternateOutput: {
        active: alternateActive,
        status: alternateStatus,
        displayId: this.settings.alternateOutput.displayId,
        displayFound: Boolean(alternateTargetDisplay),
        autoLaunch: this.settings.alternateOutput.autoLaunch,
        enabled: this.settings.alternateOutput.enabled,
      },
    };
  }

  openMainOutput(displayId = null) {
    const targetId = displayId || this.settings.mainOutput.displayId;
    const targetDisplay = this.findDisplay(targetId);

    if (!targetDisplay) {
      console.warn('Main Output display unavailable:', targetId);
      return { success: false, error: 'Configured display unavailable' };
    }

    if (this.mainOutputWindow && !this.mainOutputWindow.isDestroyed()) {
      this.mainOutputWindow.setBounds(targetDisplay.bounds);
      this.mainOutputWindow.setFullscreen(true);
      this.mainOutputWindow.focus();
      return { success: true, action: 'repositioned' };
    }

    const baseUrl = process.env.NEXT_DEV_URL || 'http://localhost:3000';

    this.mainOutputWindow = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      fullscreen: true,
      frame: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    this.mainOutputWindow.loadURL(`${baseUrl}/presentation`);

    this.mainOutputWindow.on('closed', () => {
      this.mainOutputWindow = null;
      this.broadcastStatusChange();
    });

    this.broadcastStatusChange();
    return { success: true, action: 'created' };
  }

  closeMainOutput() {
    if (this.mainOutputWindow && !this.mainOutputWindow.isDestroyed()) {
      this.mainOutputWindow.close();
      this.mainOutputWindow = null;
      this.broadcastStatusChange();
      return { success: true };
    }
    return { success: false, error: 'Main output is not running' };
  }

  openAlternateOutput(displayId = null) {
    const targetId = displayId || this.settings.alternateOutput.displayId;
    const targetDisplay = this.findDisplay(targetId);

    if (!targetDisplay) {
      console.warn('Alternate Output display unavailable:', targetId);
      return { success: false, error: 'Configured display unavailable' };
    }

    if (this.alternateOutputWindow && !this.alternateOutputWindow.isDestroyed()) {
      this.alternateOutputWindow.setBounds(targetDisplay.bounds);
      this.alternateOutputWindow.setFullscreen(true);
      this.alternateOutputWindow.focus();
      return { success: true, action: 'repositioned' };
    }

    const baseUrl = process.env.NEXT_DEV_URL || 'http://localhost:3000';

    this.alternateOutputWindow = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      fullscreen: true,
      frame: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    this.alternateOutputWindow.loadURL(`${baseUrl}/alternate-output`);

    this.alternateOutputWindow.on('closed', () => {
      this.alternateOutputWindow = null;
      this.broadcastStatusChange();
    });

    this.broadcastStatusChange();
    return { success: true, action: 'created' };
  }

  closeAlternateOutput() {
    if (this.alternateOutputWindow && !this.alternateOutputWindow.isDestroyed()) {
      this.alternateOutputWindow.close();
      this.alternateOutputWindow = null;
      this.broadcastStatusChange();
      return { success: true };
    }
    return { success: false, error: 'Alternate output is not running' };
  }

  autoLaunchIfConfigured() {
    if (this.settings.mainOutput.enabled && this.settings.mainOutput.autoLaunch) {
      const display = this.findDisplay(this.settings.mainOutput.displayId);
      if (display) {
        this.openMainOutput();
      } else {
        console.warn('Auto-launch Main Output skipped: display unavailable');
      }
    }

    if (this.settings.alternateOutput.enabled && this.settings.alternateOutput.autoLaunch) {
      const display = this.findDisplay(this.settings.alternateOutput.displayId);
      if (display) {
        this.openAlternateOutput();
      } else {
        console.warn('Auto-launch Alternate Output skipped: display unavailable');
      }
    }
  }

  registerIpcHandlers() {
    ipcMain.handle('outputs:get-displays', () => this.getDisplays());
    ipcMain.handle('outputs:get-status', () => this.getStatus());
    ipcMain.handle('outputs:get-settings', () => this.settings);
    ipcMain.handle('outputs:save-settings', (_event, newSettings) => this.saveSettings(newSettings));
    ipcMain.handle('outputs:open-main', (_event, displayId) => this.openMainOutput(displayId));
    ipcMain.handle('outputs:close-main', () => this.closeMainOutput());
    ipcMain.handle('outputs:open-alternate', (_event, displayId) => this.openAlternateOutput(displayId));
    ipcMain.handle('outputs:close-alternate', () => this.closeAlternateOutput());

    // Legacy IPC fallback
    ipcMain.on('launch-projector', () => this.openMainOutput());
  }
}

module.exports = OutputWindowManager;
