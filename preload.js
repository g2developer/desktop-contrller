// preload.js - 개선된 버전
console.log('preload.js 로드 시작');

try {
  const { contextBridge, ipcRenderer } = require('electron');
  
  // 설정 변수
  const DEBUG_MODE = true; // 디버그 로그 표시 여부

  // 디버그 로그 함수
  function debugLog(...args) {
    if (DEBUG_MODE) {
      console.log('[PreloadDebug]', ...args);
    }
  }

  // IPC 채널 목록
  const validSendChannels = [
    'get-server-status', 'start-server', 'stop-server', 
    'open-dev-tools', 'get-users', 'get-clients',
    'server-command', 'disconnect-client'
  ];
  
  const validReceiveChannels = [
    'server-status', 'start-server-result', 'stop-server-result',
    'clients-data', 'clients-update', 'users-data', 'activity-log'
  ];

  // 개선된 전송 함수 - 오류 처리 강화
  function safeSend(channel, data) {
    debugLog(`IPC 메시지 발송: ${channel}`, data);
    if (validSendChannels.includes(channel)) {
      try {
        ipcRenderer.send(channel, data);
        return true;
      } catch (error) {
        console.error(`IPC 메시지 발송 오류 (${channel}):`, error);
        return false;
      }
    } else {
      console.warn(`잘못된 채널: ${channel}`);
      return false;
    }
  }
  
  // 최소한의 기능만 제공하는 API 노출
  contextBridge.exposeInMainWorld('electronAPI', {
    // 앱 초기화 함수
    initApp: () => {
      debugLog('앱 초기화 함수 호출됨');
      // DOM이 로드된 후 초기화
      document.addEventListener('DOMContentLoaded', () => {
        debugLog('DOM 로드됨, 기본 UI 초기화');
        
        // 서버 상태 표시 업데이트
        const statusElement = document.getElementById('server-status-message');
        if (statusElement) {
          statusElement.textContent = '프리로드 스크립트 초기화 완료';
        }
        
        // 서버 시작 버튼
        const startServerBtn = document.getElementById('start-server-btn');
        if (startServerBtn) {
          startServerBtn.addEventListener('click', () => {
            debugLog('서버 시작 버튼 클릭');
            safeSend('start-server');
          });
        }
        
        // 서버 중지 버튼
        const stopServerBtn = document.getElementById('stop-server-btn');
        if (stopServerBtn) {
          stopServerBtn.addEventListener('click', () => {
            debugLog('서버 중지 버튼 클릭');
            // 직접 버튼 클릭 이벤트에서 IPC 전송
            safeSend('stop-server');
          });
        }
        
        // DOM 이벤트 리스너 설정 (server.js의 CustomEvent와 함께 작동)
        document.addEventListener('server-stop-request', () => {
          debugLog('DOM 이벤트로 서버 중지 요청 수신');
          safeSend('stop-server');
        });
        
        // 서버 상태 요청
        safeSend('get-server-status');
      });
      
      return true;
    },
    
    // 토스트 메시지 표시 (개선된 버전)
    showToast: (message, type) => {
      debugLog(`토스트 메시지 표시: ${message} (${type || 'info'})`);
      const toast = document.createElement('div');
      toast.className = `toast ${type || 'info'}`;
      toast.textContent = message;
      
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      
      container.appendChild(toast);
      
      // 지속 시간 설정
      const duration = type === 'error' ? 5000 : 3000; // 오류는 좀 더 오래 표시
      
      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (container.contains(toast)) {
            container.removeChild(toast);
          }
        }, 300);
      }, duration);
    },
    
    // 개발자 도구 열기
    openDevTools: () => {
      debugLog('개발자 도구 열기 요청');
      safeSend('open-dev-tools');
    },
    
    // 서버 상태 요청
    getServerStatus: () => {
      debugLog('서버 상태 요청');
      safeSend('get-server-status');
    },
    
    // IPC 전송 함수 - 개선된 오류 처리
    send: (channel, data) => {
      return safeSend(channel, data);
    },
    
    // 특별 메소드 - 서버 중지용
    stopServer: () => {
      debugLog('서버 중지 메소드 호출');
      // 보다 직접적인 접근법, 포워드만 하지 않고 직접 호출
      return safeSend('stop-server', { timestamp: Date.now() });
    },
    
    // IPC 수신 함수 - 개선된 오류 처리
    receive: (channel, callback) => {
      if (validReceiveChannels.includes(channel)) {
        debugLog(`채널 구독 시작: ${channel}`);
        
        // 이벤트 우선 하나 받아서 오류 체크
        try {
          // 이벤트 구독 설정
          const listener = (event, ...args) => {
            try {
              callback(...args);
            } catch (callbackError) {
              console.error(`콜백 실행 오류 (${channel}):`, callbackError);
            }
          };
          
          ipcRenderer.on(channel, listener);
          
          // 구독 해제 함수 반환
          return () => {
            debugLog(`채널 구독 해제: ${channel}`);
            ipcRenderer.removeListener(channel, listener);
          };
        } catch (error) {
          console.error(`채널 구독 오류 (${channel}):`, error);
          return () => {}; // 빈 함수 반환
        }
      } else {
        console.warn(`잘못된 채널: ${channel}`);
        return () => {}; // 빈 함수 반환
      }
    }
    
    // 특별 서버 중지 코드 - 버튼에 직접 연결되는 함수
    ,directStopServer: () => {
      debugLog('직접 서버 중지 호출');
      try {
        ipcRenderer.send('stop-server', { direct: true });
        return true;
      } catch (error) {
        console.error('직접 서버 중지 오류:', error);
        return false;
      }
    }
  });
  
  // 서버 상태 이벤트 구독
  ipcRenderer.on('server-status', (event, status) => {
    console.log('서버 상태 업데이트:', status);
    updateServerStatus(status);
  });
  
  // 서버 상태 업데이트 함수
  function updateServerStatus(status) {
    const statusIcon = document.getElementById('server-status-indicator');
    const statusText = document.getElementById('server-status-message');
    const serverInfoStatus = document.getElementById('server-info-status');
    const startServerBtn = document.getElementById('start-server-btn');
    const stopServerBtn = document.getElementById('stop-server-btn');
    
    if (status && status.running) {
      // 서버 실행 중
      if (statusIcon) statusIcon.className = 'status-icon-large online';
      if (statusText) statusText.textContent = '서버가 실행 중입니다';
      if (serverInfoStatus) {
        serverInfoStatus.textContent = '온라인';
        serverInfoStatus.className = 'server-status online';
      }
      
      if (startServerBtn) startServerBtn.disabled = true;
      if (stopServerBtn) stopServerBtn.disabled = false;
      
      // 서버 IP 정보 표시
      const serverIpAddress = document.getElementById('server-ip-address');
      const serverPort = document.getElementById('server-port');
      const serverIp = document.getElementById('server-ip');
      const serverIpContainer = document.getElementById('server-ip-container');
      
      if (serverIpAddress && status.ip) {
        serverIpAddress.textContent = status.ip;
      }
      
      if (serverPort && status.port) {
        serverPort.textContent = status.port;
      }
      
      if (serverIp && status.ip && status.port) {
        serverIp.textContent = `${status.ip}:${status.port}`;
        if (serverIpContainer) {
          serverIpContainer.style.display = 'flex';
        }
      }
    } else {
      // 서버 중지됨
      if (statusIcon) statusIcon.className = 'status-icon-large offline';
      if (statusText) statusText.textContent = '서버가 중지되었습니다';
      if (serverInfoStatus) {
        serverInfoStatus.textContent = '오프라인';
        serverInfoStatus.className = 'server-status offline';
      }
      
      if (startServerBtn) startServerBtn.disabled = false;
      if (stopServerBtn) stopServerBtn.disabled = true;
    }
  }
  
  // 활동 로그 추가 함수
  ipcRenderer.on('activity-log', (event, log) => {
    console.log('활동 로그:', log);
    
    const activityLog = document.getElementById('activity-log');
    if (!activityLog) return;
    
    // 로그 아이템 생성
    const logItem = document.createElement('div');
    logItem.className = `log-item ${log.type || 'info'}`;
    
    // 타임스탬프 포맷
    const date = new Date(log.timestamp || Date.now());
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
    
    // 활동 로그의 첫 번째 요소로 추가
    if (activityLog.querySelector('.empty-list-message')) {
      activityLog.innerHTML = '';
    }
    
    activityLog.insertBefore(logItem, activityLog.firstChild);
  });
  
  console.log('preload.js 로드 완료');
} catch (error) {
  console.error('preload.js 로드 중 오류 발생:', error);
}