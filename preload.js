// preload.js
const { ipcRenderer } = require('electron');

// IPC 통신 기능을 전역 변수에 노출
window.electronAPI = {
  // 사용자 관리
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (userData) => ipcRenderer.send('add-user', userData),
  updateUser: (index, userData) => ipcRenderer.send('update-user', { index, userData }),
  deleteUser: (index) => ipcRenderer.send('delete-user', index),
  
  // 이벤트 리스너
  onUsersData: (callback) => ipcRenderer.on('users-data', (_, data) => callback(data)),
  onAddUserResult: (callback) => ipcRenderer.on('add-user-result', (_, result) => callback(result)),
  onUpdateUserResult: (callback) => ipcRenderer.on('update-user-result', (_, result) => callback(result)),
  onDeleteUserResult: (callback) => ipcRenderer.on('delete-user-result', (_, result) => callback(result)),
  
  // 클라이언트 연결 관련
  onClientsUpdate: (callback) => ipcRenderer.on('clients-update', (_, clients) => callback(clients)),
  onCommandExecuted: (callback) => ipcRenderer.on('command-executed', (_, data) => callback(data)),
};
