import { BrowserWindow, globalShortcut, app } from 'electron'
import EventEmitter from 'events'
import trackEvent from '../lib/trackEvent'

import {
  INPUT_HEIGHT,
  WINDOW_WIDTH
} from './constants/ui'

import buildMenu from './createWindow/buildMenu'
import AppTray from './createWindow/AppTray'
import toggleWindow from './createWindow/toggleWindow'
import showWindowWithTerm from './createWindow/showWindowWithTerm'
import handleUrl from './createWindow/handleUrl'
import config from '../lib/config'

export default (url, trayIconSrc) => {
  const mainWindow = new BrowserWindow({
    alwaysOnTop: true,
    width: WINDOW_WIDTH,
    minWidth: WINDOW_WIDTH,
    height: INPUT_HEIGHT,
    frame: false,
    resizable: false,
    // Show main window on launch only when application started for the first time
    show: config.get('firstStart')
  })

  mainWindow.loadURL(url)
  mainWindow.settingsChanges = new EventEmitter()

  // Get global shortcut from app settings
  let shortcut = config.get('hotkey')

  const isDev = process.env.NODE_ENV === 'development' || config.get('developerMode')

  // Function to toggle main window
  const toggleMainWindow = () => toggleWindow(mainWindow)
  // Function to show main window
  const showMainWindow = () => {
    mainWindow.show()
    mainWindow.focus()
  }

  const tray = new AppTray({
    src: trayIconSrc,
    onToggleWindow: toggleMainWindow,
    onShowSettings: () => showWindowWithTerm(mainWindow, 'settings'),
    onListPlugins: () => showWindowWithTerm(mainWindow, 'plugins'),
    onQuit: () => app.quit()
  })

  // Setup event listeners for main window
  globalShortcut.register(shortcut, toggleMainWindow)
  if (!isDev) {
    // Hide window on blur in production
    // In development we usually use developer tools that can blur a window
    mainWindow.on('blur', () => mainWindow.hide())
  }

  // Show tray icon if it is set in configuration
  if (config.get('showInTray')) {
    tray.show()
  }

  // Change global hotkey if it is changed in app settings
  mainWindow.settingsChanges.on('hotkey', (value) => {
    globalShortcut.unregister(shortcut)
    shortcut = value
    globalShortcut.register(shortcut, toggleMainWindow)
  })

  // Show or hide menu bar icon when it is changed in setting
  mainWindow.settingsChanges.on('showInTray', (value) => (
    value ? tray.show() : tray.hide()
  ))

  // Change theme css file
  mainWindow.settingsChanges.on('theme', (value) => {
    mainWindow.webContents.send('message', {
      message: 'updateTheme',
      payload: value
    })
  })

  // Show main window when user opens application, but it is already opened
  app.on('open-file', (event, path) => handleUrl(mainWindow, path))
  app.on('open-url', (event, path) => handleUrl(mainWindow, path))
  app.on('activate', showMainWindow)

  // Track app start event
  trackEvent({
    category: 'App Start',
    event: config.get('firstStart') ? 'First' : 'Secondary'
  })

  // Save in config information, that application has been started
  config.set('firstStart', false)

  buildMenu(mainWindow, isDev)
  return mainWindow
}
