// main.js 파일 시작
// 한글 인코딩 유틸리티 먼저 로드
require('./src/utils/consoleEncoding');

// 한글 인코딩 설정
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

// Windows에서 chcp 명령어로 콘솔 페이지 코드 변경 시도
// 필수적으로 코드 페이지 변경 시도
try {
  if (process.platform === 'win32') {
    // 비동기 실행을 실행시간을 비동기로 처리하도록 바꾼다
    const { exec } = require('child_process');
    const chcpProcess = exec('chcp 65001', (error, stdout, stderr) => {
      if (!error) {
        console.log('콘솔 페이지 코드를 UTF-8(65001)로 변경했습니다.');
        // 한글 출력 테스트
        console.log('한글 출력 테스트: 안녕하세요!');
      }
    });
    
    // 비동기적으로 작업이 해제되었는지 확인하기 위한 이벤트 전파 메커니즘
    chcpProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('콘솔 페이지 코드 변경이 성공적으로 완료되었습니다.');
      } else {
        console.error(`콘솔 페이지 코드 변경 실패 (code: ${code})`);
      }
    });
  }
} catch (err) {
  // 오류 발생 시 로그 출력
  console.error('콘솔 페이지 코드 변경 중 오류 발생:', err.message);
}

// 먼저 모든 모듈 가져오기
const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 한글 인코딩 문제 해결을 위한 추가 설정
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

// 추가 모듈 가져오기
let logManager, serverManager, userManager, socketManager, captureManager;
let captureStreamManager, claudeManager, commandProcessor, ipcController, testController, configManager;
let store;
let mainWindow;
let KoreanMessages;

// 메인 윈도우 객체 (초기화는 나중에)
// 스트리밍 관련 변수
let streamingTimer = null;
let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL = 1000; // 최소 캡처 간격 (1초)

// 이제 ipcMain을 사용한 이벤트 리스너 등록
// 서버 상태 확인 디버깅 코드
ipcMain.on('get-server-status', (event) => {
  console.log('메인 프로세스: get-server-status 이벤트 수신');
  try {
    // 서버 상태 가져오기
    const serverStatus = serverManager.getServerStatus();
    console.log('서버 상태:', serverStatus);
    
    // 클라이언트에게 응답
    event.reply('server-status', serverStatus);
    
    // 모든 클라이언트에게 방송
    mainWindow.webContents.send('server-status', serverStatus);
    
    // 로그 추가
    console.log('서버 상태 전송 완료');
  } catch (error) {
    console.error('서버 상태 조회 오류:', error);
    event.reply('server-status', { running: false, error: error.message });
  }
});

// 서버 시작 디버깅 코드
ipcMain.on('start-server', (event) => {
  console.log('메인 프로세스: start-server 이벤트 수신');
  try {
    const result = serverManager.startServer();
    console.log('서버 시작 결과:', result);
    event.reply('start-server-result', { success: result });

    if (result) {
      // 서버 상태 업데이트
      const serverStatus = serverManager.getServerStatus();
      console.log('서버 상태 전송:', serverStatus);
      mainWindow.webContents.send('server-status', {
        running: true,
        ...serverStatus
      });
    }
  } catch (error) {
    console.error('서버 시작 오류:', error);
    event.reply('start-server-result', { success: false, error: error.message });
  }
});

// 서버 중지 디버깅 코드 (개선된 버전)
ipcMain.on('stop-server', (event, data) => {
  // 디버깅 정보 추가
  console.log('메인 프로세스: stop-server 이벤트 수신', data ? '데이터: ' + JSON.stringify(data) : '');
  
  // 서버 상태 확인
  if (!serverManager.isRunning()) {
    console.log('서버가 이미 중지되어 있습니다.');
    event.reply('stop-server-result', { success: true, message: '서버가 이미 중지되어 있습니다.' });
    mainWindow.webContents.send('server-status', { running: false });
    return;
  }
  
  try {
    console.log('서버 중지 시도...');
    // 서버 중지 실행
    const result = serverManager.stopServer();
    console.log('서버 중지 결과:', result);
    
    // 결과 전송
    event.reply('stop-server-result', { success: result });
    
    if (result) {
      // 서버 상태 업데이트
      console.log('서버 상태 업데이트: 중지됨');
      mainWindow.webContents.send('server-status', { running: false });
      
      // 활동 로그 추가
      if (logManager) {
        logManager.info('서버가 성공적으로 중지되었습니다.');
      }
    } else {
      console.error('서버 중지 실패');
      event.reply('stop-server-result', { 
        success: false, 
        error: '서버 중지 실패 - 자세한 오류 로그를 확인하세요.' 
      });
    }
  } catch (error) {
    console.error('서버 중지 오류:', error);
    event.reply('stop-server-result', { success: false, error: error.message });
  }
});

/**
 * 스트리밍 타이머 시작
 */
function startStreamingTimer() {
  // 이미 captureStreamManager를 사용하여 스트리밍 시작
  if (captureStreamManager.isStreaming()) {
    logManager.info(KoreanMessages.STREAMING_ALREADY_ACTIVE);
    captureStreamManager.stopStreaming();
  }
  
  logManager.info(KoreanMessages.STREAMING_START);
  
  // 캡처 설정 가져오기
  const captureSettings = store.get('captureSettings') || {};
  const captureInterval = (captureSettings.streamingInterval || 2) * 1000; // 기본값 2초
  const captureQuality = captureSettings.imageQuality || 'medium';
  
  // 스트리밍 설정
  const streamSettings = {
    interval: Math.max(captureInterval, MIN_CAPTURE_INTERVAL),
    quality: captureQuality,
    maxFps: captureSettings.maxFps || 1
  };
  
  // 스트리밍 시작
  captureStreamManager.startStreaming(streamSettings);
}

/**
 * 스트리밍 타이머 중지
 */
function stopStreamingTimer() {
  if (captureStreamManager.isStreaming()) {
    logManager.info(KoreanMessages.STREAMING_STOP);
    captureStreamManager.stopStreaming();
  }
}

/**
 * 메뉴 생성 함수
 */
function createMenu() {
  const menu = new Menu();
  
  // 파일 메뉴
  menu.append(new MenuItem({
    label: '파일',
    submenu: [
      {
        label: '종료',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  }));
  
  // 보기 메뉴
  menu.append(new MenuItem({
    label: '보기',
    submenu: [
      {
        label: '개발자 도구',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          mainWindow.webContents.toggleDevTools();
        }
      },
      { type: 'separator' },
      {
        label: '클로드 앱 제어 테스트',
        click: () => {
          mainWindow.loadFile('src/views/claudeTest.html');
        }
      },
      {
        label: '메인 화면으로 돌아가기',
        click: () => {
          mainWindow.loadFile('src/index.html');
        }
      },
      { type: 'separator' },
      {
        label: '로그 뷰어 열기',
        click: () => {
          logManager.openLogViewer(app, path.join(__dirname, 'src/views/logViewer.html'));
        }
      }
    ]
  }));
  
  // 도구 메뉴
  menu.append(new MenuItem({
    label: '도구',
    submenu: [
      {
        label: '서버 시작',
        click: () => {
          serverManager.startServer();
        }
      },
      {
        label: '서버 중지',
        click: () => {
          serverManager.stopServer();
        }
      },
      { type: 'separator' },
      {
        label: '클로드 앱 실행',
        click: async () => {
          await claudeManager.launchClaudeApp();
        }
      },
      {
        label: '클로드 앱 찾기',
        click: async () => {
          const found = await claudeManager.findClaudeWindow();
          if (found) {
            await claudeManager.activateClaudeWindow();
          }
        }
      }
    ]
  }));
  
  return menu;
}

// 앱 시작시 필요한 모듈 초기화
function initializeModules() {
  // 의존성 모듈 불러오기
  logManager = require('./src/utils/logManager');
  const { KoreanMessages: Messages } = require('./src/utils/unicodeHelper');
  KoreanMessages = Messages;
  serverManager = require('./src/server/serverManager');
  userManager = require('./src/controllers/userManager');
  socketManager = require('./src/server/socketManager');
  captureManager = require('./src/services/captureManager');
  captureStreamManager = require('./src/services/captureStreamManager');
  claudeManager = require('./src/services/claudeManager');
  commandProcessor = require('./src/services/commandProcessor');
  ipcController = require('./src/controllers/ipcController');
  testController = require('./src/controllers/testController');
  configManager = require('./src/utils/configManager');

  // 설정 저장소
  store = new Store();
}

// 앱 준비 완료 이벤트
app.whenReady().then(() => {
  // 모듈 초기화
  initializeModules();
  
  // 설정 초기화
  configManager.init(store);
  
  // 메인 윈도우 생성
  // 프리로드 경로 확인 및 로그 출력
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('프리로드 경로:', preloadPath);
  console.log('프리로드 파일 존재 여부:', require('fs').existsSync(preloadPath) ? '있음' : '없음');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // 샌드박스 비활성화
      preload: preloadPath
    }
  });
  
  // 오류 발생시 preload.js 파일 로드 오류 처리
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('페이지 로드 실패:', errorCode, errorDescription, validatedURL);
  });
  
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('프리로드 스크립트 로드 오류:', preloadPath, error);
  });

  // 추가 옵션 설정
  // 테스트 페이지를 메뉴에 추가
  mainWindow.setMenu(createMenu());
  
  app.commandLine.appendSwitch('lang', 'ko-KR');
  app.commandLine.appendSwitch('force-text-direction', 'auto');
  app.commandLine.appendSwitch('auto-detect-utf8', 'true');
  
  // 한글 인코딩 문제 해결을 위한 출력 인코딩 설정
  process.env.LANG = 'ko_KR.UTF-8';

  // HTML 파일 로드
  mainWindow.loadFile('src/index.html');
  
  // 개발자 도구 열기 (개발 환경에서만)
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // 개발자 도구 항상 열기 (디버깅용)
  mainWindow.webContents.openDevTools();
  
  // 로그 관리자 초기화
  logManager.init(ipcMain, mainWindow);
  logManager.info(KoreanMessages.MAIN_PROCESS_START);
  logManager.info(`${KoreanMessages.LOG_FILE_PATH}: ${logManager.getLogFilePath()}`);
  
  // 서버 및 소켓 관리자 초기화
  serverManager.init(store, mainWindow);
  socketManager.init(mainWindow, userManager, captureManager, claudeManager);
  captureManager.init(store, mainWindow);
  captureStreamManager.init(logManager); // logger 대신 logManager 사용
  claudeManager.init(store, mainWindow, logManager); // logger 대신 logManager 사용
  commandProcessor.init(store, logManager, claudeManager); // logger 대신 logManager 사용
  
  // IPC 이벤트 초기화
  ipcController.init(mainWindow, userManager, serverManager, captureManager, claudeManager, store);
  testController.init(claudeManager, captureManager, configManager, store);
  
  // 개발자 도구 열기 이벤트
  ipcMain.on('open-dev-tools', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
      logManager.info('Developer Tools opened by user');
    }
  });

  // 설정에서 자동 시작 여부 확인
  const autoStart = store.get('autoStart') !== false; // 기본값 true
  
  // 자동 시작 설정이 활성화된 경우 서버 시작
  if (autoStart) {
    // 짧은 지연 후 서버 시작 (다른 초기화가 완료된 후)
    setTimeout(() => {
      logManager.info(KoreanMessages.SERVER_START);
      const started = serverManager.startServer();
      logManager.info(started ? KoreanMessages.SERVER_START_SUCCESS : KoreanMessages.SERVER_START_FAIL);
      
      // 서버가 시작되면 스트리밍 설정 확인
      if (started) {
        const captureSettings = store.get('captureSettings') || {};
        const enableStreaming = captureSettings.enableStreaming !== false; // 기본값은 true
        
        if (enableStreaming) {
          // 스트리밍 시작
          startStreamingTimer();
          logManager.info(KoreanMessages.STREAMING_AUTO_START);
        }
      }
    }, 1000);
  }
});

// 모든 창이 닫히면 앱 종료
app.on('window-all-closed', () => {
  // 서버 중지 시도
  try {
    if (serverManager.isRunning()) {
      logManager.info(KoreanMessages.SERVER_STOP);
      serverManager.stopServer();
    }
    
    // 스트리밍 타이머 중지
    stopStreamingTimer();
  } catch (err) {
    logManager.error(`${KoreanMessages.ERROR}: ` + err.message);
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 앱 종료 직전 이벤트
app.on('before-quit', () => {
  // 서버 중지 확인
  try {
    if (serverManager.isRunning()) {
      logManager.info(KoreanMessages.SERVER_STOP);
      serverManager.stopServer();
    }
    
    // 스트리밍 타이머 중지
    stopStreamingTimer();
  } catch (err) {
    logManager.error(`${KoreanMessages.ERROR}: ` + err.message);
  }
});
