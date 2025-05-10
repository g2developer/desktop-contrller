/**
 * settings.js
 * 설정 관련 기능
 */

const { ipcRenderer } = require('electron');
const { showToast } = require('../ui/toast');

// DOM 요소
let serverPortInput, autoStartServer, minimizeToTray;
let claudePath, selectClaudePathBtn, testClaudeBtn, useClipboardInput;
let maxCommandLength, maxHistory;
let logLevel, logRetention;
let exportSettingsBtn, importSettingsBtn, saveAllSettingsBtn, exportLogsBtn;

/**
 * 설정 관련 DOM 요소 초기화
 */
function initSettingsElements() {
  // 서버 설정
  serverPortInput = document.getElementById('server-port-input');
  autoStartServer = document.getElementById('auto-start-server');
  minimizeToTray = document.getElementById('minimize-to-tray');
  
  // 클로드 앱 설정
  claudePath = document.getElementById('claude-path');
  selectClaudePathBtn = document.getElementById('select-claude-path');
  testClaudeBtn = document.getElementById('test-claude-btn');
  useClipboardInput = document.getElementById('use-clipboard-input');
  
  // 명령어 설정
  maxCommandLength = document.getElementById('max-command-length');
  maxHistory = document.getElementById('max-history');
  
  // 로그 설정
  logLevel = document.getElementById('log-level');
  logRetention = document.getElementById('log-retention');
  
  // 버튼
  exportSettingsBtn = document.getElementById('export-settings-btn');
  importSettingsBtn = document.getElementById('import-settings-btn');
  saveAllSettingsBtn = document.getElementById('save-all-settings');
  exportLogsBtn = document.getElementById('export-logs-btn');
  
  // 이벤트 리스너 설정
  selectClaudePathBtn.addEventListener('click', selectClaudAppPath);
  testClaudeBtn.addEventListener('click', testClaudeApp);
  exportSettingsBtn.addEventListener('click', exportSettings);
  importSettingsBtn.addEventListener('click', importSettings);
  saveAllSettingsBtn.addEventListener('click', saveAllSettings);
  exportLogsBtn.addEventListener('click', exportLogs);
}

/**
 * 설정 로드
 */
function loadSettings() {
  console.log('전체 설정 로드 요청...');
  ipcRenderer.send('get-settings');
  
  // 응답 비동기 처리
  setTimeout(() => {
    console.log('설정 로드 타임아웃: 얄당시 설정이 로드되지 않았습니다.');
  }, 5000);
}

/**
 * 설정 UI 업데이트
 * @param {Object} settings 설정 정보
 */
function updateSettingsUI(settings) {
  console.log('설정 UI 업데이트 시도:', settings);
  
  if (!settings) {
    console.error('설정 데이터가 없습니다.');
    return;
  }
  
  // 서버 설정
  if (serverPortInput) {
    console.log('서버 포트 설정 값:', settings.serverPort, typeof settings.serverPort);
    serverPortInput.value = settings.serverPort || 8000;
  }
  if (autoStartServer) {
    console.log('자동 시작 설정 값:', settings.autoStart);
    autoStartServer.checked = settings.autoStart !== false;
  }
  if (minimizeToTray) {
    console.log('트레이 최소화 설정 값:', settings.minimizeToTray);
    minimizeToTray.checked = settings.minimizeToTray === true;
  }
  
  // 명령어 설정
  if (maxCommandLength) maxCommandLength.value = settings.maxCommandLength || 10000;
  if (maxHistory) maxHistory.value = settings.maxHistory || 100;
  
  // 클로드 앱 설정
  if (claudePath) claudePath.value = settings.claudePath || '';
  if (useClipboardInput) useClipboardInput.checked = settings.useClipboardForInput !== false;
  
  // 로그 설정
  if (logLevel) logLevel.value = settings.logLevel || 'info';
  if (logRetention) logRetention.value = settings.logRetention || 7;
  
  console.log('설정 UI 업데이트 완료');
}

/**
 * 모든 설정 저장
 */
function saveAllSettings() {
  const settings = {
    // 서버 설정
    serverPort: parseInt(serverPortInput.value, 10),
    autoStart: autoStartServer.checked,
    minimizeToTray: minimizeToTray.checked,
    
    // 명령어 설정
    maxCommandLength: parseInt(maxCommandLength.value, 10),
    maxHistory: parseInt(maxHistory.value, 10),
    
    // 클로드 앱 설정
    claudePath: claudePath.value,
    useClipboardForInput: useClipboardInput.checked,
    
    // 로그 설정
    logLevel: logLevel.value,
    logRetention: parseInt(logRetention.value, 10)
  };
  
  // 각 설정을 개별적으로 전송
  console.log('설정 저장 시도:', settings);
  
  // 전체 설정 저장 요청
  console.log('전체 설정 저장 요청:', settings);
  ipcRenderer.send('save-all-settings', settings);
  
  // 토스트 메시지 표시
  showToast('모든 설정이 저장되었습니다.', 'success');
}

/**
 * 설정 내보내기
 */
function exportSettings() {
  ipcRenderer.send('export-settings');
  
  // 설정 내보내기 결과 이벤트 리스너
  ipcRenderer.once('export-settings-result', (event, result) => {
    if (result.success) {
      showToast('설정이 내보내기되었습니다.', 'success');
    } else {
      showToast('설정 내보내기에 실패했습니다.', 'error');
    }
  });
}

/**
 * 설정 가져오기
 */
function importSettings() {
  ipcRenderer.send('import-settings');
  
  // 설정 가져오기 결과 이벤트 리스너
  ipcRenderer.once('import-settings-result', (event, result) => {
    if (result.success) {
      updateSettingsUI(result.settings);
      showToast('설정이 가져오기되었습니다.', 'success');
    } else {
      showToast('설정 가져오기에 실패했습니다.', 'error');
    }
  });
}

/**
 * 로그 내보내기
 */
function exportLogs() {
  ipcRenderer.send('export-logs');
  
  // 로그 내보내기 결과 이벤트 리스너
  ipcRenderer.once('export-logs-result', (event, result) => {
    if (result.success) {
      showToast('로그가 내보내기되었습니다.', 'success');
    } else {
      showToast('로그 내보내기에 실패했습니다.', 'error');
    }
  });
}

/**
 * 클로드 앱 경로 선택
 */
function selectClaudAppPath() {
  ipcRenderer.send('select-claude-path');
  
  // 클로드 앱 경로 선택 결과 이벤트 리스너
  ipcRenderer.once('select-claude-path-result', (event, result) => {
    if (result.success) {
      claudePath.value = result.path;
      showToast('클로드 앱 경로가 선택되었습니다.', 'success');
    } else {
      showToast('클로드 앱 경로 선택이 취소되었습니다.', 'info');
    }
  });
}

/**
 * 클로드 앱 테스트
 */
function testClaudeApp() {
  ipcRenderer.send('test-claude-app');
  
  // 토스트 메시지 표시
  showToast('클로드 앱 연결 테스트 중...', 'info');
  
  // 클로드 앱 테스트 결과 이벤트 리스너
  ipcRenderer.once('test-claude-app-result', (event, result) => {
    if (result.success) {
      showToast('클로드 앱 연결 테스트에 성공했습니다.', 'success');
    } else {
      showToast(`클로드 앱 연결 테스트에 실패했습니다: ${result.message}`, 'error');
    }
  });
}

/**
 * 클로드 앱 정보 업데이트
 * @param {Object} info 클로드 앱 정보
 */
function updateClaudeAppInfo(info) {
  // 클로드 앱 정보 업데이트 (추후 구현)
}

module.exports = {
  initSettingsElements,
  loadSettings,
  updateSettingsUI,
  saveAllSettings,
  exportSettings,
  importSettings,
  exportLogs,
  selectClaudAppPath,
  testClaudeApp,
  updateClaudeAppInfo
};
