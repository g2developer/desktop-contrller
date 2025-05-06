const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// 모듈 초기화 관련 변수
let mainWindow;
let userManager;
let serverManager;
let captureManager;
let claudeManager;
let store;

/**
 * IPC 컨트롤러 초기화
 * @param {BrowserWindow} window 메인 윈도우 객체
 * @param {Object} userMgr 사용자 관리자
 * @param {Object} serverMgr 서버 관리자
 * @param {Object} captureMgr 캡처 관리자
 * @param {Object} claudeMgr 클로드 앱 관리자
 * @param {Store} configStore 설정 저장소
 */
function init(window, userMgr, serverMgr, captureMgr, claudeMgr, configStore) {
  mainWindow = window;
  userManager = userMgr;
  serverManager = serverMgr;
  captureManager = captureMgr;
  claudeManager = claudeMgr;
  store = configStore;
  
  // IPC 이벤트 핸들러 등록
  setupIpcHandlers();
}

/**
 * IPC 이벤트 핸들러 등록
 */
function setupIpcHandlers() {
  // 사용자 관리 이벤트
  setupUserManagementHandlers();
  
  // 서버 관리 이벤트
  setupServerManagementHandlers();
  
  // 캡처 관련 이벤트
  setupCaptureHandlers();
  
  // 설정 관련 이벤트
  setupSettingsHandlers();
  
  // 클로드 앱 관련 이벤트
  setupClaudeControlHandlers();
  
  // 파일 시스템 이벤트
  setupFileSystemHandlers();
}

/**
 * 사용자 관리 이벤트 핸들러 등록
 */
function setupUserManagementHandlers() {
  // 사용자 데이터 요청
  ipcMain.on('get-users', (event) => {
    event.reply('users-data', userManager.getUserData());
  });

  // 사용자 추가
  ipcMain.on('add-user', (event, userData) => {
    try {
      const result = userManager.addUser(userData);
      
      if (result.success) {
        event.reply('add-user-result', { success: true });
        event.reply('users-data', userManager.getUserData());
      } else {
        event.reply('add-user-result', { success: false, message: result.message });
      }
    } catch (err) {
      console.error('사용자 추가 오류:', err);
      event.reply('add-user-result', { success: false, message: err.message });
    }
  });

  // 사용자 수정
  ipcMain.on('update-user', (event, { userId, userData }) => {
    try {
      const result = userManager.updateUser(userId, userData);
      
      if (result.success) {
        event.reply('update-user-result', { success: true });
        event.reply('users-data', userManager.getUserData());
      } else {
        event.reply('update-user-result', { success: false, message: result.message });
      }
    } catch (err) {
      console.error('사용자 수정 오류:', err);
      event.reply('update-user-result', { success: false, message: err.message });
    }
  });

  // 사용자 삭제
  ipcMain.on('delete-user', (event, userId) => {
    try {
      const result = userManager.deleteUser(userId);
      
      if (result.success) {
        event.reply('delete-user-result', { success: true });
        event.reply('users-data', userManager.getUserData());
      } else {
        event.reply('delete-user-result', { success: false, message: result.message });
      }
    } catch (err) {
      console.error('사용자 삭제 오류:', err);
      event.reply('delete-user-result', { success: false, message: err.message });
    }
  });
}

/**
 * 서버 관리 이벤트 핸들러 등록
 */
function setupServerManagementHandlers() {
  // 서버 시작 요청
  ipcMain.on('start-server', (event) => {
    const result = serverManager.startServer();
    event.reply('start-server-result', { success: result });
  });
  
  // 서버 중지 요청
  ipcMain.on('stop-server', (event) => {
    const result = serverManager.stopServer();
    event.reply('stop-server-result', { success: result });
  });
  
  // 서버 상태 요청
  ipcMain.on('get-server-status', (event) => {
    event.reply('server-status', serverManager.getServerStatus());
  });
  
  // 클라이언트 정보 요청
  ipcMain.on('get-clients', (event) => {
    const socketManager = require('../server/socketManager');
    event.reply('clients-data', socketManager.getAllClients());
  });
  
  // 클라이언트 연결 해제 요청
  ipcMain.on('disconnect-client', (event, clientId) => {
    try {
      const socketManager = require('../server/socketManager');
      const success = socketManager.disconnectClient(clientId);
      
      // 클라이언트 목록 업데이트
      event.reply('clients-data', socketManager.getAllClients());
      event.reply('disconnect-client-result', { success });
    } catch (err) {
      console.error('클라이언트 연결 해제 오류:', err);
      event.reply('disconnect-client-result', { success: false, message: err.message });
    }
  });
}

/**
 * 캡처 관련 이벤트 핸들러 등록
 */
function setupCaptureHandlers() {
  // 화면 캡처 요청
  ipcMain.on('capture-screen', async (event) => {
    try {
      const screenshotImg = await captureManager.captureAIResponseArea();
      if (screenshotImg) {
        event.reply('capture-result', {
          success: true,
          image: screenshotImg.toString('base64'),
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('화면 캡처 실패');
      }
    } catch (err) {
      console.error('화면 캡처 오류:', err);
      event.reply('capture-result', { success: false, message: err.message });
    }
  });
  
  // 캡처 영역 설정
  ipcMain.on('set-capture-area', (event, area) => {
    try {
      const result = captureManager.setCaptureArea(area);
      event.reply('set-capture-area-result', result);
    } catch (err) {
      console.error('캡처 영역 설정 오류:', err);
      event.reply('set-capture-area-result', { success: false, message: err.message });
    }
  });
  
  // 캡처 영역 요청
  ipcMain.on('get-capture-area', (event) => {
    event.reply('capture-area', captureManager.getCaptureArea());
  });
  
  // 영역 선택 모드 시작
  ipcMain.on('start-area-selection', (event) => {
    try {
      // 영역 선택 기능 구현
      // (실제로는 별도의 창을 열어 영역 선택 UI를 제공해야 함)
      // 임시로 대화상자를 통해 좌표 입력
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '영역 선택',
        message: '영역 선택 모드가 시작되었습니다.\n' +
                 '(임시 구현: 개발 단계에서는 기본 영역을 사용합니다)',
        buttons: ['확인']
      }).then(() => {
        // 임시 응답
        event.reply('area-selection-result', { 
          success: true, 
          area: captureManager.getCaptureArea()
        });
      });
    } catch (err) {
      console.error('영역 선택 오류:', err);
      event.reply('area-selection-result', { success: false, message: err.message });
    }
  });
}

/**
 * 설정 관련 이벤트 핸들러 등록
 */
function setupSettingsHandlers() {
  // 설정 저장
  ipcMain.on('save-settings', (event, settings) => {
    try {
      // 유효성 검사
      if (!settings) {
        throw new Error('유효하지 않은 설정 데이터입니다.');
      }
      
      // 서버 설정
      if (settings.server) {
        // 포트 변경 확인
        const newPort = parseInt(settings.server.port);
        const oldPort = store.get('serverPort') || 3000;
        
        if (newPort !== oldPort && serverManager.isRunning()) {
          // 서버가 실행 중이면 재시작 필요 알림
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '서버 재시작 필요',
            message: '포트 변경을 적용하려면 서버를 재시작해야 합니다.',
            buttons: ['확인']
          });
        }
        
        // 설정 저장
        store.set('serverPort', newPort);
        store.set('timeout', settings.server.timeout);
        store.set('autoStart', settings.server.autoStart);
      }
      
      // 클로드 앱 설정
      if (settings.claude) {
        store.set('claudePath', settings.claude.path);
        store.set('autoLaunch', settings.claude.autoLaunch);
        store.set('autoCaptureAfter', settings.claude.autoCaptureAfter);
        store.set('captureDelay', settings.claude.captureDelay);
      }
      
      // 보안 설정
      if (settings.security) {
        store.set('sessionTimeout', settings.security.sessionTimeout);
        store.set('passwordPolicy', settings.security.passwordPolicy);
        store.set('loginAttempts', settings.security.loginAttempts);
      }
      
      event.reply('save-settings-result', { success: true });
    } catch (err) {
      console.error('설정 저장 오류:', err);
      event.reply('save-settings-result', { success: false, message: err.message });
    }
  });
  
  // 설정 요청
  ipcMain.on('get-settings', (event) => {
    const settings = {
      server: {
        port: store.get('serverPort') || 3000,
        timeout: store.get('timeout') || 30,
        autoStart: store.get('autoStart') !== false
      },
      claude: {
        path: store.get('claudePath') || '',
        autoLaunch: store.get('autoLaunch') !== false,
        autoCaptureAfter: store.get('autoCaptureAfter') !== false,
        captureDelay: store.get('captureDelay') || 2
      },
      security: {
        sessionTimeout: store.get('sessionTimeout') || 30,
        passwordPolicy: store.get('passwordPolicy') || {
          minLength: true,
          requireNumbers: true,
          requireSpecial: false
        },
        loginAttempts: store.get('loginAttempts') || 5
      }
    };
    
    event.reply('settings-data', settings);
  });
}

/**
 * 클로드 앱 관련 이벤트 핸들러 등록
 */
function setupClaudeControlHandlers() {
  // 자동 버튼 클릭 기능 토글
  ipcMain.on('toggle-auto-click', (event, enabled) => {
    claudeManager.setAutoClickEnabled(enabled);
    event.reply('auto-click-status', { enabled: claudeManager.getAutoClickEnabled() });
  });
}

/**
 * 파일 시스템 이벤트 핸들러 등록
 */
function setupFileSystemHandlers() {
  // 파일 읽기
  ipcMain.handle('fs-read-file', async (event, filePath, options) => {
    try {
      return await fs.promises.readFile(filePath, options);
    } catch (err) {
      console.error('파일 읽기 오류:', err);
      throw err;
    }
  });
  
  // 파일 쓰기
  ipcMain.handle('fs-write-file', async (event, filePath, data, options) => {
    try {
      await fs.promises.writeFile(filePath, data, options);
      return true;
    } catch (err) {
      console.error('파일 쓰기 오류:', err);
      throw err;
    }
  });
}

// 모듈 내보내기
module.exports = {
  init
};