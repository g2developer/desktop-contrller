// Dashboard.js
// 대시보드 페이지 관리 모듈

/**
 * 대시보드 페이지 관리 모듈
 * @module Dashboard
 */

const { ipcRenderer } = require('electron');
const ServerStatus = require('./ServerStatus');
const ClientList = require('./ClientList');

/**
 * 대시보드 클래스
 */
class Dashboard {
  /**
   * 대시보드 생성자
   */
  constructor() {
    this.initComponents();
    this.initEventListeners();
  }
  
  /**
   * 컴포넌트 초기화
   */
  initComponents() {
    // 서버 상태 컴포넌트 초기화
    this.serverStatus = new ServerStatus({
      indicator: document.getElementById('server-status-indicator'),
      message: document.getElementById('server-status-message'),
      ipAddress: document.getElementById('server-ip-address'),
      port: document.getElementById('server-port'),
      clientCount: document.getElementById('client-count'),
      startButton: document.getElementById('start-server-btn'),
      stopButton: document.getElementById('stop-server-btn')
    });
    
    // 클라이언트 목록 컴포넌트 초기화
    this.clientList = new ClientList(
      document.getElementById('client-list')
    );
    
    // 활동 로그 컨테이너
    this.activityLog = document.getElementById('activity-log');
    
    // 명령어 기록 컨테이너
    this.commandHistory = document.getElementById('command-history');
    
    // 최대 로그/명령어 개수
    this.maxActivityLogs = 100;
    this.maxCommandHistory = 10;
    
    // 로그 및 명령어 데이터
    this.activityLogData = [];
    this.commandHistoryData = [];
  }
  
  /**
   * 이벤트 리스너 초기화
   */
  initEventListeners() {
    // 새로고침 버튼
    const refreshClientsBtn = document.getElementById('refresh-clients');
    if (refreshClientsBtn) {
      refreshClientsBtn.addEventListener('click', () => {
        this.clientList.refreshClientList();
      });
    }
    
    // 로그 지우기 버튼
    const clearLogsBtn = document.getElementById('clear-logs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        this.clearActivityLog();
      });
    }
    
    // IP 주소 복사 버튼
    const copyIpBtn = document.getElementById('copy-ip');
    if (copyIpBtn) {
      copyIpBtn.addEventListener('click', () => {
        this.serverStatus.copyServerAddress();
      });
    }
    
    // 활동 로그 이벤트 리스너
    ipcRenderer.on('activity-log', (event, log) => {
      this.addActivityLog(log);
    });
    
    // 명령어 실행 이벤트 리스너
    ipcRenderer.on('command-executed', (event, command) => {
      this.addCommandHistory(command);
    });
  }
  
  /**
   * 활동 로그 추가
   * @param {Object} log - 로그 데이터
   */
  addActivityLog(log) {
    // 로그 데이터 추가
    this.activityLogData.push(log);
    
    // 로그 데이터 크기 제한
    if (this.activityLogData.length > this.maxActivityLogs) {
      this.activityLogData.shift();
    }
    
    // UI에 로그 추가
    this.addLogToUI(log);
  }
  
  /**
   * UI에 로그 추가
   * @param {Object} log - 로그 데이터
   */
  addLogToUI(log) {
    // 로그 항목이 없는 경우 빈 메시지 제거
    const emptyMessage = this.activityLog.querySelector('.empty-list-message');
    if (emptyMessage) {
      this.activityLog.removeChild(emptyMessage);
    }
    
    // 로그 항목 생성
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    
    // 시간 정보
    const logTime = document.createElement('div');
    logTime.className = 'log-time';
    logTime.textContent = this.formatDateTime(log.timestamp);
    
    // 로그 내용
    const logMessage = document.createElement('div');
    logMessage.className = 'log-message';
    
    // 로그 유형 태그
    const logType = document.createElement('span');
    logType.className = `log-type ${log.type}`;
    
    switch (log.type) {
      case 'connection':
        logType.textContent = '연결';
        break;
      case 'disconnect':
        logType.textContent = '연결 해제';
        break;
      case 'login':
        logType.textContent = '로그인';
        break;
      case 'login-fail':
        logType.textContent = '로그인 실패';
        break;
      case 'command':
        logType.textContent = '명령어';
        break;
      case 'error':
        logType.textContent = '오류';
        break;
      default:
        logType.textContent = log.type;
    }
    
    logMessage.appendChild(logType);
    logMessage.appendChild(document.createTextNode(log.message));
    
    logItem.appendChild(logTime);
    logItem.appendChild(logMessage);
    
    // 최신 항목이 위에 오도록 추가
    this.activityLog.insertBefore(logItem, this.activityLog.firstChild);
    
    // 로그 항목 수 제한
    const logItems = this.activityLog.querySelectorAll('.log-item');
    if (logItems.length > this.maxActivityLogs) {
      this.activityLog.removeChild(logItems[logItems.length - 1]);
    }
  }
  
  /**
   * 활동 로그 지우기
   */
  clearActivityLog() {
    this.activityLog.innerHTML = '<div class="empty-list-message">활동 로그가 없습니다</div>';
    this.activityLogData = [];
  }
  
  /**
   * 명령어 기록 추가
   * @param {Object} command - 명령어 데이터
   */
  addCommandHistory(command) {
    // 명령어 데이터 추가
    this.commandHistoryData.unshift(command);
    
    // 명령어 데이터 크기 제한
    if (this.commandHistoryData.length > this.maxCommandHistory) {
      this.commandHistoryData.pop();
    }
    
    // UI 업데이트
    this.updateCommandHistoryUI();
  }
  
  /**
   * 명령어 기록 UI 업데이트
   */
  updateCommandHistoryUI() {
    this.commandHistory.innerHTML = '';
    
    if (this.commandHistoryData.length === 0) {
      this.commandHistory.innerHTML = '<div class="empty-list-message">명령어 기록이 없습니다</div>';
      return;
    }
    
    // 명령어 항목 생성
    this.commandHistoryData.forEach(command => {
      const commandItem = document.createElement('div');
      commandItem.className = 'command-item';
      
      // 명령어 헤더
      const commandHeader = document.createElement('div');
      commandHeader.className = 'command-header';
      
      // 명령어 소스
      const commandSource = document.createElement('span');
      commandSource.className = 'command-source';
      commandSource.textContent = command.source || '알 수 없음';
      
      // 명령어 시간
      const commandTime = document.createElement('span');
      commandTime.className = 'command-time';
      commandTime.textContent = this.formatDateTime(command.timestamp);
      
      commandHeader.appendChild(commandSource);
      commandHeader.appendChild(commandTime);
      
      // 명령어 텍스트
      const commandText = document.createElement('div');
      commandText.className = 'command-text';
      commandText.textContent = command.command || command.content || '빈 명령어';
      
      commandItem.appendChild(commandHeader);
      commandItem.appendChild(commandText);
      
      this.commandHistory.appendChild(commandItem);
    });
  }
  
  /**
   * 날짜/시간 포맷
   * @param {string} dateTimeStr - 날짜/시간 문자열
   * @returns {string} 포맷된 날짜/시간 문자열
   */
  formatDateTime(dateTimeStr) {
    try {
      const date = new Date(dateTimeStr);
      
      // 날짜가 유효하지 않은 경우
      if (isNaN(date.getTime())) {
        return dateTimeStr;
      }
      
      // 날짜 포맷
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (err) {
      console.error('날짜/시간 포맷 오류:', err);
      return dateTimeStr;
    }
  }
}

module.exports = Dashboard;
