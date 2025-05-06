// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Electron API를 window 객체에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 사용자 관리
  getUsers: () => ipcRenderer.send('get-users'),
  addUser: (userData) => ipcRenderer.send('add-user', userData),
  updateUser: (userId, userData) => ipcRenderer.send('update-user', { userId, userData }),
  deleteUser: (userId) => ipcRenderer.send('delete-user', userId),
  
  // 서버 관리
  startServer: () => ipcRenderer.send('start-server'),
  stopServer: () => ipcRenderer.send('stop-server'),
  getServerStatus: () => ipcRenderer.send('get-server-status'),
  getClients: () => ipcRenderer.send('get-clients'),
  disconnectClient: (clientId) => ipcRenderer.send('disconnect-client', clientId),
  
  // 캡처 기능
  captureScreen: () => ipcRenderer.send('capture-screen'),
  setCaptureArea: (area) => ipcRenderer.send('set-capture-area', area),
  getCaptureArea: () => ipcRenderer.send('get-capture-area'),
  startAreaSelection: () => ipcRenderer.send('start-area-selection'),
  
  // 설정 관리
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  getSettings: () => ipcRenderer.send('get-settings'),
  
  // 클로드 앱 제어
  toggleAutoClick: (enabled) => ipcRenderer.send('toggle-auto-click', enabled),
  
  // IPC 이벤트 구독
  onUsersData: (callback) => ipcRenderer.on('users-data', (_, data) => callback(data)),
  onAddUserResult: (callback) => ipcRenderer.on('add-user-result', (_, result) => callback(result)),
  onUpdateUserResult: (callback) => ipcRenderer.on('update-user-result', (_, result) => callback(result)),
  onDeleteUserResult: (callback) => ipcRenderer.on('delete-user-result', (_, result) => callback(result)),
  
  onServerStatus: (callback) => ipcRenderer.on('server-status', (_, status) => callback(status)),
  onStartServerResult: (callback) => ipcRenderer.on('start-server-result', (_, result) => callback(result)),
  onStopServerResult: (callback) => ipcRenderer.on('stop-server-result', (_, result) => callback(result)),
  onClientsData: (callback) => ipcRenderer.on('clients-data', (_, data) => callback(data)),
  onClientsUpdate: (callback) => ipcRenderer.on('clients-update', (_, data) => callback(data)),
  onDisconnectClientResult: (callback) => ipcRenderer.on('disconnect-client-result', (_, result) => callback(result)),
  
  onCaptureResult: (callback) => ipcRenderer.on('capture-result', (_, result) => callback(result)),
  onSetCaptureAreaResult: (callback) => ipcRenderer.on('set-capture-area-result', (_, result) => callback(result)),
  onCaptureArea: (callback) => ipcRenderer.on('capture-area', (_, area) => callback(area)),
  onAreaSelectionResult: (callback) => ipcRenderer.on('area-selection-result', (_, result) => callback(result)),
  onCaptureTaken: (callback) => ipcRenderer.on('capture-taken', (_, data) => callback(data)),
  onCaptureError: (callback) => ipcRenderer.on('capture-error', (_, error) => callback(error)),
  
  onSettingsData: (callback) => ipcRenderer.on('settings-data', (_, data) => callback(data)),
  onSaveSettingsResult: (callback) => ipcRenderer.on('save-settings-result', (_, result) => callback(result)),
  
  onAutoClickStatus: (callback) => ipcRenderer.on('auto-click-status', (_, status) => callback(status)),
  onAutoClickEvent: (callback) => ipcRenderer.on('auto-click-event', (_, event) => callback(event)),
  
  onCommandProcessing: (callback) => ipcRenderer.on('command-processing', (_, data) => callback(data)),
  onCommandCompleted: (callback) => ipcRenderer.on('command-completed', (_, data) => callback(data)),
  onCommandError: (callback) => ipcRenderer.on('command-error', (_, error) => callback(error)),
  
  onActivityLog: (callback) => ipcRenderer.on('activity-log', (_, log) => callback(log)),
  
  // 이벤트 구독 해제
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});