/**
 * app.js
 * 앱 초기화 및 코어 기능
 */

// contextIsolation이 적용되었으므로 window.electronAPI 사용
const { showToast } = require('../ui/toast');
const { initModalElements } = require('../ui/modal');
const { initNavigation, getServerStatus } = require('../ui/navigation');
const serverModule = require('../features/server');
const captureModule = require('../features/capture');
const usersModule = require('../features/users');
const settingsModule = require('../features/settings');

// DOM 요소
let activityLog, fullActivityLog;
let commandHistory;
let logFilterBtn, logFilterMenu;
let clearLogsBtn, clearAllLogsBtn;

// 전역 상태
let activeLogs = [];
let commandHistoryData = [];
let currentLogFilter = 'all';

/**
 * 앱 초기화
 */
function initApp() {
  console.log('앱 초기화');
  
  // DOM 요소 초기화
  initElements();
  
  // 내비게이션 이벤트 리스너 설정
  initNavigation();
  
  // 서버 요소 초기화
  serverModule.initServerElements();
  
  // 사용자 요소 초기화
  usersModule.initUserElements();
  
  // 캡처 요소 초기화
  captureModule.initCaptureElements();
  
  // 설정 요소 초기화
  settingsModule.initSettingsElements();
  
  // 모달 요소 초기화
  initModalElements();
  
  // 버튼 이벤트 리스너 설정
  initButtonListeners();
  
  // IPC 이벤트 리스너 설정
  initIpcListeners();
  
  // 서버 상태 조회
  getServerStatus();
  
  // 사용자 목록 로드
  usersModule.loadUsers();
  
  // 설정 로드
  settingsModule.loadSettings();
  
  // 캡처 영역 로드
  captureModule.loadCaptureArea();
  
  // 드롭다운 이벤트 리스너 설정
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      // 모든 드롭다운 메뉴 닫기
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
      });
    }
  });
  
  // ESC 키 이벤트 리스너 설정
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // 캡처 선택기가 활성화되어 있으면 닫기
      if (captureModule.isCaptureActive) {
        captureModule.closeCaptureSelector();
      }
      
      // 모달이 열려있으면 닫기
      const modalContainer = document.getElementById('modal-container');
      if (modalContainer.classList.contains('active')) {
        require('../ui/modal').closeModal();
      }
    }
  });
  
  console.log('앱 초기화 완료');
}

/**
 * DOM 요소 초기화
 */
function initElements() {
  activityLog = document.getElementById('activity-log');
  fullActivityLog = document.getElementById('full-activity-log');
  commandHistory = document.getElementById('command-history');
  logFilterBtn = document.getElementById('log-filter-btn');
  logFilterMenu = document.getElementById('log-filter-menu');
  clearLogsBtn = document.getElementById('clear-logs');
  clearAllLogsBtn = document.getElementById('clear-all-logs-btn');
}

/**
 * 버튼 이벤트 리스너 초기화
 */
function initButtonListeners() {
  // 로그 지우기 버튼
  clearLogsBtn.addEventListener('click', () => {
    clearActivityLog(activityLog);
  });
  
  // 모든 로그 지우기 버튼
  clearAllLogsBtn.addEventListener('click', () => {
    require('../ui/modal').showConfirmModal(
      '로그 지우기',
      '모든 활동 로그를 지우시겠습니까? 이 작업은 취소할 수 없습니다.',
      () => {
        clearActivityLog(activityLog);
        clearActivityLog(fullActivityLog);
        activeLogs = [];
        showToast('모든 로그가 지워졌습니다.', 'info');
      }
    );
  });
  
  // 로그 필터 버튼
  logFilterBtn.addEventListener('click', toggleLogFilterMenu);
  
  // 로그 필터 메뉴 항목
  const filterItems = document.querySelectorAll('.dropdown-item');
  filterItems.forEach(item => {
    item.addEventListener('click', () => {
      const filter = item.getAttribute('data-filter');
      setLogFilter(filter);
      logFilterMenu.classList.add('hidden');
    });
  });
}

/**
 * IPC 이벤트 리스너 초기화
 */
function initIpcListeners() {
  // contextBridge를 통해 노출된 API 사용
  
  // 서버 상태 이벤트
  window.electronAPI.receive('server-status', (status) => {
    serverModule.updateServerStatus(status);
  });
  
  // 클라이언트 목록 업데이트 이벤트
  window.electronAPI.receive('clients-update', (clients) => {
    serverModule.updateClientList(clients);
  });
  
  // 활동 로그 이벤트
  window.electronAPI.receive('activity-log', (log) => {
    addActivityLog(log);
  });
  
  // 명령어 실행 이벤트
  window.electronAPI.receive('command-executed', (command) => {
    addCommandHistory(command);
  });
  
  // 명령어 오류 이벤트
  window.electronAPI.receive('command-error', (error) => {
    showToast(`명령어 실행 오류: ${error.message}`, 'error');
  });
  
  // 캡처 영역 업데이트 이벤트
  window.electronAPI.receive('capture-area-updated', (data) => {
    captureModule.setCaptureAreaPreview(data.area);
  });
  
  // 사용자 목록 이벤트
  window.electronAPI.receive('users-list', (users) => {
    usersModule.updateUserList(users);
  });
  
  // 설정 데이터 이벤트
  window.electronAPI.receive('settings-data', (settings) => {
    console.log('전체 설정 데이터 수신:', settings);
    settingsModule.updateSettingsUI(settings);
  });
  
  // 전체 설정 저장 결과 이벤트
  window.electronAPI.receive('save-all-settings-result', (result) => {
    console.log('전체 설정 저장 결과:', result);
    if (result.success) {
      showToast('설정이 성공적으로 저장되었습니다.', 'success');
      // 설정 다시 불러오기
      settingsModule.loadSettings();
    } else {
      showToast(`설정 저장 실패: ${result.message || '알 수 없는 오류'}`, 'error');
    }
  });
  
  // 캡처 이미지 이벤트
  window.electronAPI.receive('capture-image', (data) => {
    captureModule.addCaptureHistory(data);
  });
  
  // 클로드 앱 정보 이벤트
  window.electronAPI.receive('claude-app-info', (info) => {
    settingsModule.updateClaudeAppInfo(info);
  });
}

/**
 * 활동 로그 추가
 * @param {Object} log 로그 정보
 */
function addActivityLog(log) {
  // 로그 데이터 추가
  activeLogs.unshift(log);
  
  // 최대 로그 수 제한
  const MAX_ACTIVITY_LOGS = 100;
  if (activeLogs.length > MAX_ACTIVITY_LOGS) {
    activeLogs = activeLogs.slice(0, MAX_ACTIVITY_LOGS);
  }
  
  // 로그 타입에 따른 클래스
  let typeClass = '';
  switch (log.type) {
    case 'info':
      typeClass = 'info';
      break;
    case 'success':
      typeClass = 'success';
      break;
    case 'error':
      typeClass = 'error';
      break;
    case 'warning':
      typeClass = 'warning';
      break;
    default:
      typeClass = '';
  }
  
  // 로그 아이템 생성
  const logItem = document.createElement('div');
  logItem.className = `log-item ${typeClass}`;
  logItem.setAttribute('data-type', log.type);
  logItem.setAttribute('data-timestamp', log.timestamp);
  
  // 타임스탬프 포맷
  const date = new Date(log.timestamp);
  const formattedTime = date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 로그 내용 생성
  const logTime = document.createElement('span');
  logTime.className = 'log-time';
  logTime.textContent = formattedTime;
  
  const logMessage = document.createElement('span');
  logMessage.className = 'log-message';
  logMessage.textContent = log.message;
  
  logItem.appendChild(logTime);
  logItem.appendChild(logMessage);
  
  // 활동 로그에 추가
  if (activityLog) {
    // 로그 필터 적용
    if (currentLogFilter === 'all' || currentLogFilter === log.type) {
      // 첫 번째 자식으로 추가
      activityLog.insertBefore(logItem, activityLog.firstChild);
    }
  }
  
  // 전체 로그에도 추가
  if (fullActivityLog) {
    // 전체 로그에는 복제본 추가
    const logItemClone = logItem.cloneNode(true);
    fullActivityLog.insertBefore(logItemClone, fullActivityLog.firstChild);
  }
}

/**
 * 활동 로그 렌더링
 */
function renderFullActivityLog() {
  // 전체 로그 렌더링
  fullActivityLog.innerHTML = '';
  
  // 로그 아이템 생성
  activeLogs.forEach(log => {
    // 로그 타입에 따른 클래스
    let typeClass = '';
    switch (log.type) {
      case 'info':
        typeClass = 'info';
        break;
      case 'success':
        typeClass = 'success';
        break;
      case 'error':
        typeClass = 'error';
        break;
      case 'warning':
        typeClass = 'warning';
        break;
      default:
        typeClass = '';
    }
    
    // 로그 아이템 생성
    const logItem = document.createElement('div');
    logItem.className = `log-item ${typeClass}`;
    logItem.setAttribute('data-type', log.type);
    logItem.setAttribute('data-timestamp', log.timestamp);
    
    // 타임스탬프 포맷
    const date = new Date(log.timestamp);
    const formattedTime = date.toLocaleString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // 로그 내용 생성
    const logTime = document.createElement('span');
    logTime.className = 'log-time';
    logTime.textContent = formattedTime;
    
    const logMessage = document.createElement('span');
    logMessage.className = 'log-message';
    logMessage.textContent = log.message;
    
    logItem.appendChild(logTime);
    logItem.appendChild(logMessage);
    
    // 활동 로그에 추가
    fullActivityLog.appendChild(logItem);
  });
}

/**
 * 활동 로그 지우기
 * @param {HTMLElement} logElement 로그 요소
 */
function clearActivityLog(logElement) {
  if (logElement) {
    logElement.innerHTML = '';
  }
}

/**
 * 로그 필터 메뉴 토글
 */
function toggleLogFilterMenu() {
  logFilterMenu.classList.toggle('hidden');
}

/**
 * 로그 필터 설정
 * @param {string} filter 필터 유형
 */
function setLogFilter(filter) {
  // 현재 필터 설정
  currentLogFilter = filter;
  
  // 필터 버튼 텍스트 업데이트
  const filterText = document.querySelector('.filter-text');
  switch (filter) {
    case 'info':
      filterText.textContent = '정보';
      break;
    case 'success':
      filterText.textContent = '성공';
      break;
    case 'error':
      filterText.textContent = '오류';
      break;
    case 'warning':
      filterText.textContent = '경고';
      break;
    default:
      filterText.textContent = '전체';
  }
  
  // 로그 아이템 필터링
  const logItems = activityLog.querySelectorAll('.log-item');
  logItems.forEach(item => {
    const itemType = item.getAttribute('data-type');
    if (filter === 'all' || itemType === filter) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * 명령어 기록에 추가
 * @param {Object} command 명령어 정보
 */
function addCommandHistory(command) {
  // 명령어 데이터 추가
  commandHistoryData.unshift(command);
  
  // 최대 명령어 수 제한
  const MAX_COMMAND_HISTORY = 10;
  if (commandHistoryData.length > MAX_COMMAND_HISTORY) {
    commandHistoryData = commandHistoryData.slice(0, MAX_COMMAND_HISTORY);
  }
  
  // 명령어 기록 렌더링
  renderCommandHistory();
}

/**
 * 명령어 기록 렌더링
 */
function renderCommandHistory() {
  // 요소가 없으면 리턴
  if (!commandHistory) return;
  
  // 명령어 기록 초기화
  commandHistory.innerHTML = '';
  
  // 명령어 기록 렌더링
  if (commandHistoryData.length === 0) {
    // 명령어 기록이 없는 경우
    commandHistory.innerHTML = '<div class="empty-list-message">명령어 기록이 없습니다</div>';
  } else {
    // 명령어 아이템 생성
    commandHistoryData.forEach(command => {
      const commandItem = document.createElement('div');
      commandItem.className = 'command-item';
      
      const commandText = document.createElement('div');
      commandText.className = 'command-text';
      commandText.textContent = command.text;
      
      const commandTime = document.createElement('div');
      commandTime.className = 'command-time';
      
      const date = new Date(command.timestamp);
      const formattedTime = date.toLocaleString('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      commandTime.textContent = formattedTime;
      
      commandItem.appendChild(commandText);
      commandItem.appendChild(commandTime);
      
      commandHistory.appendChild(commandItem);
    });
  }
}

module.exports = {
  initApp,
  addActivityLog,
  renderFullActivityLog,
  clearActivityLog,
  toggleLogFilterMenu,
  setLogFilter,
  addCommandHistory,
  renderCommandHistory
};