const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 모듈 가져오기
const serverManager = require('./src/server/serverManager');
const userManager = require('./src/controllers/userManager');
const socketManager = require('./src/server/socketManager');
const captureManager = require('./src/services/captureManager');
const claudeManager = require('./src/services/claudeManager');
const ipcController = require('./src/controllers/ipcController');
const configManager = require('./src/utils/configManager');

// 설정 저장소
const store = new Store();

// 메인 윈도우 객체
let mainWindow;

// 앱 준비 완료 이벤트
app.whenReady().then(() => {
  // 설정 초기화
  configManager.init(store);
  
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // HTML 파일 로드
  mainWindow.loadFile('src/index.html');
  
  // 개발자 도구 열기 (개발 환경에서만)
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // 서버 및 소켓 관리자 초기화
  serverManager.init(store, mainWindow);
  socketManager.init(mainWindow, userManager, captureManager, claudeManager);
  captureManager.init(store, mainWindow);
  claudeManager.init(store, mainWindow);
  
  // IPC 이벤트 초기화
  ipcController.init(mainWindow, userManager, serverManager, captureManager, claudeManager, store);
  
  // 설정에서 자동 시작 여부 확인
  const autoStart = store.get('autoStart') !== false; // 기본값 true
  
  // 자동 시작 설정이 활성화된 경우 서버 시작
  if (autoStart) {
    serverManager.startServer();
  }
});

// 모든 창이 닫히면 앱 종료
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});