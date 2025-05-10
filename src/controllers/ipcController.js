// ipcController.js
// Electron 프로세스 간 통신(IPC) 이벤트 처리

const { ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

// 추가 모듈
let commandProcessor;

// 로컬 IP 주소 가져오기 함수
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 내부 IP만 필터링 (IPv4)
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // 기본값
}

// 공개 IP 주소 가져오기 함수
async function getPublicIpAddress() {
  try {
    // 동적 import 사용
    const { publicIpv4 } = await import('public-ip');
    return await publicIpv4();
  } catch (err) {
    console.error('공개 IP 가져오기 오류:', err);
    return getLocalIpAddress(); // 오류 발생 시 로컬 IP 반환
  }
}

// 메인 윈도우 변수 (전역)
let mainWindow = null;

// 캡처 히스토리 및 명령어 히스토리
let captureHistory = [];
let commandHistory = [];
let activityLog = [];

/**
 * IPC 컨트롤러 초기화
 * @param {BrowserWindow} window 메인 윈도우 객체
 * @param {Object} userMgr 사용자 관리자
 * @param {Object} serverMgr 서버 관리자
 * @param {Object} captureMgr 캡처 관리자
 * @param {Object} claudeMgr 클로드 앱 관리자
 * @param {Store} store 설정 저장소
 */
function init(window, userMgr, serverMgr, captureMgr, claudeMgr, store) {
  // 메인 윈도우 설정 (전역 변수에 할당)
  mainWindow = window;
  
  // 명령어 처리기 모듈 가져오기
  commandProcessor = require('../services/commandProcessor');
  
  // 서버 시작 요청
  ipcMain.on('start-server', (event) => {
    const result = serverMgr.startServer();
    event.reply('start-server-result', { success: result });
    
    if (result) {
      // 활동 로그 추가
      addActivityLog({
        type: 'server',
        message: '서버가 시작되었습니다.',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 서버 중지 요청
  ipcMain.on('stop-server', (event) => {
    const result = serverMgr.stopServer();
    event.reply('stop-server-result', { success: result });
    
    if (result) {
      // 활동 로그 추가
      addActivityLog({
        type: 'server',
        message: '서버가 중지되었습니다.',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 서버 정보 요청
  ipcMain.on('get-server-info', (event) => {
    const serverStatus = serverMgr.getServerStatus();
    
    // 공개 IP 주소 가져오기 (비동기)
    getPublicIpAddress().then(publicIp => {
      // 서버 상태와 공개 IP 포함하여 응답
      event.reply('server-info', {
        ...serverStatus,
        ip: publicIp,
        localIp: getLocalIpAddress()
      });
    }).catch(err => {
      // 오류 발생 시 로컬 IP만 사용
      event.reply('server-info', {
        ...serverStatus,
        ip: getLocalIpAddress()
      });
    });
    
    // 비동기 처리를 위해 여기서 리턴
    return;
  });
  
  // 클라이언트 목록 요청
  ipcMain.on('get-clients', (event) => {
    // 서버가 실행 중이 아니면 빈 배열 반환
    if (!serverMgr.isRunning()) {
      event.reply('clients-list', []);
      return;
    }
    
    // Socket Manager에서 클라이언트 목록 가져오기
    const socketManager = require('../server/socketManager');
    const clients = socketManager.getAllClients();
    
    // 클라이언트 정보 변환
    const formattedClients = clients.map(client => ({
      id: client.id,
      user: client.username || '익명',
      device: client.device || '알 수 없음',
      ip: client.ip,
      connectedAt: client.connectTime,
      authenticated: client.authenticated
    }));
    
    event.reply('clients-list', formattedClients);
  });
  
  // 클라이언트 연결 해제 요청
  ipcMain.on('disconnect-client', (event, clientId) => {
    // 서버가 실행 중이 아니면 오류 반환
    if (!serverMgr.isRunning()) {
      event.reply('disconnect-client-result', { 
        success: false, 
        message: '서버가 실행 중이 아닙니다.' 
      });
      return;
    }
    
    // Socket Manager에서 클라이언트 연결 해제
    const socketManager = require('../server/socketManager');
    const result = socketManager.disconnectClient(clientId);
    
    event.reply('disconnect-client-result', { 
      success: result, 
      message: result ? '연결이 해제되었습니다.' : '연결 해제에 실패했습니다.' 
    });
    
    if (result) {
      // 활동 로그 추가
      addActivityLog({
        type: 'server',
        message: `클라이언트 ${clientId}의 연결이 해제되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 사용자 목록 요청
  ipcMain.on('get-users', (event) => {
    // UserManager에서 사용자 목록 가져오기
    const users = userMgr.getUserData();
    
    // 민감한 정보 (비밀번호) 제거
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name || user.id,
      lastLogin: user.lastLogin,
      status: user.status || 'active',
      active: user.status === 'active'
    }));
    
    event.reply('users-list', formattedUsers);
  });
  
  // 특정 사용자 정보 요청
  ipcMain.on('get-user', (event, userId) => {
    // UserManager에서 사용자 정보 가져오기
    const user = userMgr.getUser(userId);
    
    if (user) {
      // 사용자 정보에서 비밀번호 제거
      const { password, ...userData } = user;
      event.reply(`user-data-${userId}`, userData);
    } else {
      event.reply(`user-data-${userId}`, null);
    }
  });
  
  // 사용자 추가 요청
  ipcMain.on('add-user', (event, userData) => {
    // UserManager에서 사용자 추가
    const result = userMgr.addUser(userData);
    
    event.reply('user-added', result);
    
    if (result.success) {
      // 활동 로그 추가
      addActivityLog({
        type: 'user',
        message: `사용자 ${userData.id}가 추가되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 사용자 수정 요청
  ipcMain.on('update-user', (event, data) => {
    console.log('사용자 수정 요청 수신:', data);
    // UserManager에서 사용자 수정
    // data의 형식을 올바르게 처리
    const userId = data.id;
    const userData = data.userData;
    
    const result = userMgr.updateUser(userId, userData);
    
    event.reply('user-updated', result);
    
    if (result.success) {
      // 활동 로그 추가
      addActivityLog({
        type: 'user',
        message: `사용자 ${userId}의 정보가 수정되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 사용자 삭제 요청
  ipcMain.on('delete-user', (event, userId) => {
    // UserManager에서 사용자 삭제
    const result = userMgr.deleteUser(userId);
    
    event.reply('user-deleted', result);
    
    if (result.success) {
      // 활동 로그 추가
      addActivityLog({
        type: 'user',
        message: `사용자 ${userId}가 삭제되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 캡처 영역 선택 요청
  ipcMain.on('select-capture-area', (event) => {
    // CaptureManager에서 캡처 영역 선택
    captureMgr.selectCaptureArea()
      .then(area => {
        if (area) {
          store.set('captureArea', area);
          event.reply('capture-area-selected', { success: true, area });
          
          // 활동 로그 추가
          addActivityLog({
            type: 'capture',
            message: '캡처 영역이 설정되었습니다.',
            timestamp: new Date().toISOString()
          });
        } else {
          event.reply('capture-area-selected', { success: false, message: '영역 선택이 취소되었습니다.' });
        }
      })
      .catch(err => {
        event.reply('capture-area-selected', { success: false, message: err.message });
      });
  });
  
  // 테스트 캡처 요청
  ipcMain.on('test-capture', (event) => {
    // 캡처 영역이 설정되었는지 확인
    const captureArea = store.get('captureArea');
    if (!captureArea) {
      event.reply('test-capture-result', null);
      return;
    }
    
    // CaptureManager를 사용하여 화면 캡처
    captureMgr.captureScreen()
      .then(imgData => {
        // 캡처 이미지를 렌더러로 전송
        event.reply('test-capture-result', imgData);
        
        // 캡처 히스토리에 추가
        const captureId = Date.now().toString();
        captureHistory.push({
          id: captureId,
          timestamp: new Date().toISOString(),
          size: imgData ? imgData.length : 0,
          sent: false
        });
        
        // 활동 로그 추가
        addActivityLog({
          type: 'capture',
          message: '테스트 화면이 캡처되었습니다.',
          timestamp: new Date().toISOString()
        });
      })
      .catch(err => {
        console.error('테스트 캡처 오류:', err);
        event.reply('test-capture-result', null);
      });
  });
  
  // 캡처 목록 요청
  ipcMain.on('get-captures', (event) => {
    event.reply('captures-list', captureHistory);
  });
  
  // 캡처 설정 저장 요청
  ipcMain.on('save-capture-settings', (event, settings) => {
    store.set('captureSettings', settings);
    event.reply('capture-settings-saved', { success: true });
  });
  
  // 캡처 설정 요청
  ipcMain.on('get-capture-settings', (event) => {
    const settings = store.get('captureSettings') || {
      quality: 'medium',
      autoCapture: true,
      autoSend: true
    };
    
    event.reply('capture-settings-data', settings);
  });
  
  // 전체 설정 저장 요청
  ipcMain.on('save-all-settings', (event, settings) => {
    try {
      console.log('전체 설정 저장 시도:', settings);
      
      // 각 설정을 개별적으로 저장
      if (settings.serverPort) store.set('serverPort', settings.serverPort);
      if (settings.hasOwnProperty('autoStart')) store.set('autoStart', settings.autoStart);
      if (settings.hasOwnProperty('minimizeToTray')) store.set('minimizeToTray', settings.minimizeToTray);
      if (settings.hasOwnProperty('maxCommandLength')) store.set('maxCommandLength', settings.maxCommandLength);
      if (settings.hasOwnProperty('maxHistory')) store.set('maxHistory', settings.maxHistory);
      if (settings.hasOwnProperty('claudePath')) store.set('claudePath', settings.claudePath);
      if (settings.hasOwnProperty('useClipboardForInput')) store.set('useClipboardForInput', settings.useClipboardForInput);
      if (settings.hasOwnProperty('logLevel')) store.set('logLevel', settings.logLevel);
      if (settings.hasOwnProperty('logRetention')) store.set('logRetention', settings.logRetention);
      
      console.log('전체 설정 저장 성공. 저장된 serverPort:', store.get('serverPort'));
      
      // 성공 응답
      event.reply('save-all-settings-result', { success: true });
      
      // 활동 로그 추가
      addActivityLog({
        type: 'settings',
        message: '전체 설정이 저장되었습니다.',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('전체 설정 저장 오류:', err);
      
      // 오류 응답
      event.reply('save-all-settings-result', { 
        success: false,
        message: '설정 저장 중 오류가 발생했습니다.' 
      });
    }
  });
  
  // 템플릿 목록 요청
  ipcMain.on('get-templates', (event) => {
    // 명령어 처리기에서 템플릿 목록 가져오기
    const templates = commandProcessor.getTemplates();
    event.reply('templates-list', templates);
  });
  
  // 템플릿 추가 요청
  ipcMain.on('add-template', (event, { name, content }) => {
    // 템플릿 추가
    const success = commandProcessor.addTemplate(name, content);
    event.reply('template-added', { 
      success, 
      message: success ? '템플릿가 추가되었습니다.' : '템플릿 추가에 실패했습니다.' 
    });
    
    if (success) {
      // 활동 로그 추가
      addActivityLog({
        type: 'template',
        message: `${name} 템플릿이 추가되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 템플릿 삭제 요청
  ipcMain.on('delete-template', (event, name) => {
    // 템플릿 삭제
    const success = commandProcessor.deleteTemplate(name);
    event.reply('template-deleted', { 
      success, 
      message: success ? '템플릿가 삭제되었습니다.' : '템플릿 삭제에 실패했습니다.' 
    });
    
    if (success) {
      // 활동 로그 추가
      addActivityLog({
        type: 'template',
        message: `${name} 템플릿이 삭제되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 설정 가져오기 요청
  ipcMain.on('get-settings', (event) => {
    try {
      // 전체 설정을 개별적으로 가져와서 응답
      const settings = {
        serverPort: store.get('serverPort') || 8000,
        autoStart: store.get('autoStart') !== false,
        minimizeToTray: store.get('minimizeToTray') === true,
        maxCommandLength: store.get('maxCommandLength') || 10000,
        maxHistory: store.get('maxHistory') || 100,
        claudePath: store.get('claudePath') || '',
        useClipboardForInput: store.get('useClipboardForInput') !== false,
        logLevel: store.get('logLevel') || 'info',
        logRetention: store.get('logRetention') || 7
      };
      
      console.log('가져온 전체 설정:', settings);
      event.reply('settings-data', settings);
    } catch (err) {
      console.error('설정 가져오기 오류:', err);
      // 기본 설정 응답
      event.reply('settings-data', {
        serverPort: 8000,
        autoStart: true,
        minimizeToTray: false,
        maxCommandLength: 10000,
        maxHistory: 100,
        claudePath: '',
        useClipboardForInput: true,
        logLevel: 'info',
        logRetention: 7
      });
    }
  });
  
  // 설정 초기화 요청
  ipcMain.on('reset-settings', (event) => {
    // 기본 설정
    const defaultSettings = {
      // 서버 설정
      serverPort: 8000,
      socketTimeout: 30,
      autoStart: true,
      
      // 클로드 앱 설정
      claudePath: '',
      autoLaunch: true,
      autoCaptureAfter: true,
      captureDelay: 2,
      
      // 보안 설정
      sessionTimeout: 30,
      passwordPolicy: {
        minLength: true,
        requireNumbers: true,
        requireSpecial: false
      },
      loginAttempts: 5,
      
      // 캡처 설정
      captureSettings: {
        quality: 'medium',
        autoCapture: true,
        autoSend: true
      }
    };
    
    // 기본 설정으로 초기화
    Object.keys(defaultSettings).forEach(key => {
      store.set(key, defaultSettings[key]);
    });
    
    event.reply('reset-settings-result', { success: true });
    
    // 활동 로그 추가
    addActivityLog({
      type: 'settings',
      message: '설정이 초기화되었습니다.',
      timestamp: new Date().toISOString()
    });
  });
  
  // 파일 대화상자 열기 요청
  ipcMain.on('open-file-dialog', (event, options = {}) => {
    const dialogOptions = {
      properties: ['openFile'],
      filters: []
    };
    
    // 대화상자 유형에 따른 필터 설정
    if (options.type === 'executable') {
      // 실행 파일
      dialogOptions.filters = [
        { name: '실행 파일', extensions: ['exe'] },
        { name: '모든 파일', extensions: ['*'] }
      ];
    } else if (options.type === 'text') {
      // 텍스트 파일
      dialogOptions.filters = [
        { name: '텍스트 파일', extensions: ['txt', 'md', 'json', 'csv', 'xml'] },
        { name: '코드 파일', extensions: ['js', 'ts', 'py', 'html', 'css', 'java', 'c', 'cpp', 'php'] },
        { name: '모든 파일', extensions: ['*'] }
      ];
    } else if (options.type === 'image') {
      // 이미지 파일
      dialogOptions.filters = [
        { name: '이미지 파일', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: '모든 파일', extensions: ['*'] }
      ];
    } else {
      // 기본 필터
      dialogOptions.filters = [
        { name: '실행 파일', extensions: ['exe'] },
        { name: '모든 파일', extensions: ['*'] }
      ];
    }
    
    // 대화상자 표시
    dialog.showOpenDialog(mainWindow, dialogOptions).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        
        // 파일 내용을 명령어로 변환 요청
        if (options.processToCommand) {
          commandProcessor.processFileToCommand(filePath)
            .then(commandText => {
              event.reply('file-processed-to-command', { 
                success: true, 
                filePath,
                command: commandText
              });
            })
            .catch(err => {
              console.error('파일 처리 오류:', err);
              event.reply('file-processed-to-command', { 
                success: false, 
                filePath,
                error: err.message
              });
            });
        } else {
          // 일반 파일 선택 결과 반환
          event.reply('selected-file', filePath);
        }
      }
    }).catch(err => {
      console.error('파일 대화상자 오류:', err);
      
      if (options.processToCommand) {
        event.reply('file-processed-to-command', { 
          success: false, 
          error: err.message
        });
      }
    });
  });
  
  // 명령 목록 요청
  ipcMain.on('get-commands', (event, { page = 1, searchTerm = '' }) => {
    // 페이지당 항목 수
    const itemsPerPage = 10;
    
    // 검색 필터링
    let filteredCommands = commandHistory;
    if (searchTerm) {
      filteredCommands = commandHistory.filter(cmd => 
        cmd.command.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // 정렬 (최신순)
    filteredCommands.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 페이지네이션
    const total = filteredCommands.length;
    const totalPages = Math.ceil(total / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageCommands = filteredCommands.slice(startIndex, endIndex);
    
    event.reply('commands-list', {
      commands: pageCommands,
      page,
      totalPages,
      total
    });
  });
  
  // 명령 결과 요청
  ipcMain.on('get-command-result', (event, commandId) => {
    // 명령 ID로 명령 찾기
    const command = commandHistory.find(cmd => cmd.id === commandId);
    
    if (command) {
      event.reply(`command-result-${commandId}`, command);
    } else {
      event.reply(`command-result-${commandId}`, null);
    }
  });
  
  // 명령 재전송 요청
  ipcMain.on('resend-command', (event, commandId) => {
    // 명령 ID로 명령 찾기
    const command = commandHistory.find(cmd => cmd.id === commandId);
    
    if (command && command.command) {
      // 클로드 앱에 명령 재전송
      claudeMgr.controlClaudeApp(command.command, null);
      
      // 활동 로그 추가
      addActivityLog({
        type: 'command',
        message: `"${command.command}" 명령이 재전송되었습니다.`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 명령 기록 삭제 요청
  ipcMain.on('clear-commands', (event) => {
    commandHistory = [];
    event.reply('commands-cleared');
    
    // 활동 로그 추가
    addActivityLog({
      type: 'command',
      message: '모든 명령 기록이 삭제되었습니다.',
      timestamp: new Date().toISOString()
    });
  });
  
  // 활동 로그 요청
  ipcMain.on('get-activity-log', (event) => {
    // 최근 20개 활동만 반환
    const recentActivities = activityLog.slice(0, 20);
    event.reply('activity-log', recentActivities);
  });
}

/**
 * 명령 기록 추가
 * @param {Object} command 명령 객체
 */
function addCommandHistory(command) {
  commandHistory.push(command);
  
  // 명령 기록이 100개를 초과하면 가장 오래된 것 삭제
  if (commandHistory.length > 100) {
    commandHistory.shift();
  }
}

/**
 * 활동 로그 추가
 * @param {Object} activity 활동 로그 객체
 */
function addActivityLog(activity) {
  activityLog.unshift(activity);
  
  // 활동 로그가 100개를 초과하면 가장 오래된 것 삭제
  if (activityLog.length > 100) {
    activityLog.pop();
  }
  
  // 최근 20개 활동만 UI에 전송
  if (mainWindow) {
    const recentActivities = activityLog.slice(0, 20);
    mainWindow.webContents.send('activity-log', recentActivities);
  }
}

// 모듈 내보내기
module.exports = {
  init,
  addCommandHistory,
  addActivityLog
};