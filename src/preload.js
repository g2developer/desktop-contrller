/**
 * src/preload.js
 * 렌더러 프로세스용 preload 스크립트 (백업용)
 * 
 * 이 파일은 루트의 preload.js가 로드되지 않는 경우를 대비한 백업 스크립트입니다.
 * 기본적인 기능을 제공하여 최소한의 앱 동작이 가능하도록 합니다.
 */

console.log('src/preload.js 로드됨 - 렌더러 전용 백업 프리로드 스크립트');

try {
  // Electron 모듈 불러오기
  const { contextBridge, ipcRenderer } = require('electron');
  
  // 기본 API 노출
  contextBridge.exposeInMainWorld('electronAPI', {
    // 앱 초기화 - 최소한의 UI 설정
    initApp: () => {
      console.log('백업 preload.js에서 앱 초기화');
      
      // DOM 로드 후 초기화 실행
      document.addEventListener('DOMContentLoaded', () => {
        // 상태 메시지 설정
        const statusElement = document.getElementById('server-status-message');
        if (statusElement) {
          statusElement.textContent = '백업 preload.js 사용 중 - 일부 기능이 제한됩니다';
          statusElement.style.color = '#ff9800';
        }
        
        // 서버 버튼 이벤트 설정
        const serverToggle = document.getElementById('server-toggle');
        if (serverToggle) {
          serverToggle.addEventListener('click', () => {
            ipcRenderer.send('start-server');
          });
        }
        
        // 서버 시작 버튼 이벤트 설정
        const startServerBtn = document.getElementById('start-server-btn');
        if (startServerBtn) {
          startServerBtn.addEventListener('click', () => {
            ipcRenderer.send('start-server');
          });
        }
        
        // 서버 중지 버튼 이벤트 설정
        const stopServerBtn = document.getElementById('stop-server-btn');
        if (stopServerBtn) {
          stopServerBtn.addEventListener('click', () => {
            ipcRenderer.send('stop-server');
          });
        }
        
        // 개발자 도구 버튼 설정
        const devToolsBtn = document.querySelector('.debug-tools button');
        if (devToolsBtn) {
          devToolsBtn.addEventListener('click', () => {
            ipcRenderer.send('open-dev-tools');
          });
        }
        
        // 서버 상태 확인
        ipcRenderer.send('get-server-status');
      });
    },
    
    // 토스트 메시지 표시 (간소화된 버전)
    showToast: (message, type = 'info') => {
      console.log(`토스트 메시지 (${type}):`, message);
      
      // DOM이 로드된 후에만 UI 요소 생성
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // 토스트 컨테이너 확인
        let container = document.getElementById('toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'toast-container';
          container.className = 'toast-container';
          document.body.appendChild(container);
        }
        
        // 토스트 요소 생성
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // 컨테이너에 추가
        container.appendChild(toast);
        
        // 2초 후 제거
        setTimeout(() => {
          toast.classList.add('fade-out');
          setTimeout(() => {
            if (container.contains(toast)) {
              container.removeChild(toast);
            }
          }, 300);
        }, 2000);
      }
    },
    
    // 서버 상태 확인
    getServerStatus: () => {
      console.log('서버 상태 확인');
      ipcRenderer.send('get-server-status');
    },
    
    // 개발자 도구 열기
    openDevTools: () => {
      console.log('개발자 도구 열기');
      ipcRenderer.send('open-dev-tools');
    },
    
    // 간소화된 IPC 통신 함수
    send: (channel, data) => {
      const validChannels = [
        'get-server-status', 'start-server', 'stop-server', 
        'open-dev-tools', 'get-users', 'get-clients'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    
    receive: (channel, func) => {
      const validChannels = [
        'server-status', 'start-server-result', 'stop-server-result',
        'clients-data', 'users-data', 'error'
      ];
      if (validChannels.includes(channel)) {
        const subscription = (event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
      }
    }
  });
  
  // 서버 상태 이벤트 리스너
  ipcRenderer.on('server-status', (event, status) => {
    console.log('서버 상태 업데이트:', status);
    
    // 서버 상태 표시 업데이트
    const statusIcon = document.getElementById('server-status-indicator');
    const statusText = document.getElementById('server-status-message');
    const serverInfoStatus = document.getElementById('server-info-status');
    const startServerBtn = document.getElementById('start-server-btn');
    const stopServerBtn = document.getElementById('stop-server-btn');
    
    if (statusIcon && statusText && serverInfoStatus) {
      if (status && status.running) {
        // 서버 실행 중
        statusIcon.className = 'status-icon-large online';
        statusText.textContent = '서버가 실행 중입니다';
        serverInfoStatus.textContent = '온라인';
        serverInfoStatus.className = 'server-status online';
        
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
        statusIcon.className = 'status-icon-large offline';
        statusText.textContent = '서버가 중지되었습니다';
        serverInfoStatus.textContent = '오프라인';
        serverInfoStatus.className = 'server-status offline';
        
        if (startServerBtn) startServerBtn.disabled = false;
        if (stopServerBtn) stopServerBtn.disabled = true;
      }
    }
  });
  
  // 클라이언트 목록 업데이트
  ipcRenderer.on('clients-update', (event, clients) => {
    console.log('클라이언트 목록 업데이트:', clients);
    
    const clientList = document.getElementById('client-list');
    const clientCount = document.getElementById('client-count');
    
    if (clientList && clientCount) {
      // 클라이언트 수 업데이트
      clientCount.textContent = clients.length;
      
      // 클라이언트 목록 업데이트
      clientList.innerHTML = '';
      
      if (clients.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-list-message';
        emptyMessage.textContent = '연결된 클라이언트가 없습니다';
        clientList.appendChild(emptyMessage);
      } else {
        clients.forEach(client => {
          const clientItem = document.createElement('div');
          clientItem.className = 'client-item';
          clientItem.dataset.id = client.id;
          
          const clientId = document.createElement('div');
          clientId.className = 'client-col id';
          clientId.textContent = client.id.substring(0, 8);
          
          const clientDevice = document.createElement('div');
          clientDevice.className = 'client-col device';
          clientDevice.textContent = client.device || '알 수 없음';
          
          const clientStatus = document.createElement('div');
          clientStatus.className = 'client-col status';
          
          const statusIndicator = document.createElement('span');
          statusIndicator.className = `status-indicator ${client.authenticated ? 'online' : 'offline'}`;
          
          const statusText = document.createElement('span');
          statusText.textContent = client.authenticated ? '인증됨' : '미인증';
          
          clientStatus.appendChild(statusIndicator);
          clientStatus.appendChild(statusText);
          
          const clientActions = document.createElement('div');
          clientActions.className = 'client-col actions';
          
          const disconnectBtn = document.createElement('button');
          disconnectBtn.className = 'btn-icon';
          disconnectBtn.title = '연결 종료';
          disconnectBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
          
          disconnectBtn.addEventListener('click', () => {
            ipcRenderer.send('disconnect-client', client.id);
          });
          
          clientActions.appendChild(disconnectBtn);
          
          clientItem.appendChild(clientId);
          clientItem.appendChild(clientDevice);
          clientItem.appendChild(clientStatus);
          clientItem.appendChild(clientActions);
          
          clientList.appendChild(clientItem);
        });
      }
    }
  });
  
  // 활동 로그 추가
  ipcRenderer.on('activity-log', (event, log) => {
    console.log('활동 로그:', log);
    
    // 로그 요소들 찾기
    const activityLog = document.getElementById('activity-log');
    const fullActivityLog = document.getElementById('full-activity-log');
    
    if (activityLog || fullActivityLog) {
      // 로그 아이템 생성
      const createLogItem = () => {
        // 로그 타입에 따른 클래스
        let typeClass = '';
        switch (log.type) {
          case 'info':
          case 'connection':
            typeClass = 'info';
            break;
          case 'success':
          case 'login':
            typeClass = 'success';
            break;
          case 'error':
            typeClass = 'error';
            break;
          case 'warning':
          case 'command':
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
        
        return logItem;
      };
      
      // 대시보드의 최근 활동 로그에 추가
      if (activityLog) {
        const logItem = createLogItem();
        
        // 첫 번째 자식으로 추가
        if (activityLog.querySelector('.empty-list-message')) {
          activityLog.innerHTML = '';
        }
        
        activityLog.insertBefore(logItem, activityLog.firstChild);
        
        // 최대 10개만 표시
        const maxItems = 10;
        const items = activityLog.querySelectorAll('.log-item');
        if (items.length > maxItems) {
          for (let i = maxItems; i < items.length; i++) {
            activityLog.removeChild(items[i]);
          }
        }
      }
      
      // 로그 페이지의 전체 로그에 추가
      if (fullActivityLog) {
        const logItem = createLogItem();
        
        if (fullActivityLog.querySelector('.empty-list-message')) {
          fullActivityLog.innerHTML = '';
        }
        
        fullActivityLog.insertBefore(logItem, fullActivityLog.firstChild);
      }
    }
  });
  
  // 명령어 실행 관련 이벤트 리스너
  ipcRenderer.on('command-executed', (event, command) => {
    console.log('명령어 실행:', command);
  });
  
  ipcRenderer.on('command-error', (event, error) => {
    console.error('명령어 오류:', error);
  });
  
  console.log('백업 preload.js 로드 완료');
} catch (error) {
  console.error('백업 preload.js 실행 중 오류 발생:', error);
}