/**
 * server.js
 * 서버 관련 기능
 */

let ipcRenderer;
try {
  const electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
} catch (error) {
  console.error('Electron IPC 로드 오류:', error);
  // 아래는 로드가 실패했을 때의 fallback 처리
  ipcRenderer = {
    send: (channel, data) => {
      console.log(`IPC 메시지 발송 ${channel}:`, data);
      if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send(channel, data);
      } else {
        console.error('electronAPI를 찾을 수 없습니다.');
      }
    }
  };
}
const { showToast } = require('../ui/toast');

// DOM 요소
let serverToggle, serverStatusIcon, serverStatusText, serverInfoStatus;
let serverIpContainer, serverIp, serverStatusIndicator, serverStatusMessage;
let serverIpAddress, serverPort, clientCount;
let startServerBtn, stopServerBtn, copyIpBtn;
let clientList, refreshClientsBtn;

// 상태 변수
let serverRunning = false;
let serverAddress = '';
let connectedClients = [];

/**
 * 서버 관련 기능 초기화
 */
function initServerFeatures() {
  // 그래도 문제가 있을 수 있으므로 인라인 스크립트를 페이지에 직접 삽입
  injectServerFixScript();
  
  // DOM 요소 초기화
  initServerElements();
}

/**
 * 서버 중지 관련 인라인 스크립트 삽입
 */
function injectServerFixScript() {
  try {
    console.log('서버 중지 관련 스크립트 삽입 시도');
    const script = document.createElement('script');
    script.id = 'server-fix-inline';
    script.textContent = `
      // 서버 중지 버튼 인라인 스크립트
      (function() {
        console.log('서버 중지 버튼 인라인 스크립트 로드 완료');
        
        // DOM 로드 완료 이후 실행
        document.addEventListener('DOMContentLoaded', function() {
          // 1초 뒤 실행 (다른 스크립트가 먼저 실행될 수 있도록)
          setTimeout(function() {
            const stopBtn = document.getElementById('stop-server-btn');
            if (stopBtn) {
              stopBtn.addEventListener('click', function() {
                console.log('서버 중지 버튼 인라인 클릭 핸들러');
                if (window.electronAPI) {
                  window.electronAPI.send('stop-server', {source: 'inline'});
                }
              });
              console.log('인라인 이벤트 리스너 추가 성공');
            } else {
              console.error('서버 중지 버튼을 찾을 수 없어 인라인 스크립트 실패');
            }
          }, 1000);
        });
      })();
    `;
    
    // 기존 스크립트가 있으면 제거
    const existingScript = document.getElementById('server-fix-inline');
    if (existingScript) {
      existingScript.parentNode.removeChild(existingScript);
    }
    
    // 문서에 스크립트 추가
    document.head.appendChild(script);
    console.log('서버 중지 관련 스크립트 삽입 완료');
  } catch (error) {
    console.error('스크립트 삽입 실패:', error);
  }
}
/**
 * 서버 관련 DOM 요소 초기화
 */
function initServerElements() {
  serverToggle = document.getElementById('server-toggle');
  serverStatusIcon = document.getElementById('server-status-icon');
  serverStatusText = document.getElementById('server-status-text');
  serverInfoStatus = document.getElementById('server-info-status');
  serverIpContainer = document.getElementById('server-ip-container');
  serverIp = document.getElementById('server-ip');
  serverStatusIndicator = document.getElementById('server-status-indicator');
  serverStatusMessage = document.getElementById('server-status-message');
  serverIpAddress = document.getElementById('server-ip-address');
  serverPort = document.getElementById('server-port');
  clientCount = document.getElementById('client-count');
  startServerBtn = document.getElementById('start-server-btn');
  stopServerBtn = document.getElementById('stop-server-btn');
  copyIpBtn = document.getElementById('copy-ip');
  clientList = document.getElementById('client-list');
  refreshClientsBtn = document.getElementById('refresh-clients');
  
  console.log('서버 관련 DOM 요소 초기화 완료');
  
  // 이벤트 리스너 설정
  serverToggle.addEventListener('click', toggleServer);
  startServerBtn.addEventListener('click', startServer);
  
  // 서버 중지 버튼에 대한 특별 처리 - 기존 이벤트 리스너 제거 및 새로운 이벤트 리스너 추가
  patchStopServerButton();
  
  copyIpBtn.addEventListener('click', copyServerAddress);
  refreshClientsBtn.addEventListener('click', () => {
    ipcRenderer.send('get-clients');
  });
  
  // 서버 중지 관련 추가 사용자 정의 이벤트 리스너 추가
  document.addEventListener('server-stop-request', function() {
    console.log('server-stop-request 사용자 정의 이벤트 찐츠됨');
    stopServer({source: 'custom_event'});
  });
}

/**
 * 서버 중지 버튼 패치 - direct-fix.js에서 통합
 */
function patchStopServerButton() {
  // 1. 원래 버튼 참조 가져오기
  const originalStopBtn = document.getElementById('stop-server-btn');
  if (!originalStopBtn) {
    console.error('서버 중지 버튼을 찾을 수 없습니다');
    
    // 1초 후 다시 시도
    setTimeout(patchStopServerButton, 1000);
    return;
  }
  
  console.log('서버 중지 버튼을 찾았습니다. 이벤트 리스너 추가 중...');
  
  // 2. 기존 이벤트 리스너 제거 (모든 이벤트)
  const newButton = originalStopBtn.cloneNode(true);
  originalStopBtn.parentNode.replaceChild(newButton, originalStopBtn);
  
  // 3. 새 버튼에 강화된 이벤트 리스너 추가
  newButton.addEventListener('click', function(event) {
    console.log('서버 중지 버튼 클릭됨 (강화된 이벤트 핸들러)');
    
    // 서버 중지 함수 호출
    stopServer({source: 'patched_button'});
    
    // 이벤트 버블링 방지
    event.preventDefault();
    event.stopPropagation();
  });
  
  // 패치 적용 확인을 위한 스타일 변경
  newButton.style.color = '#ff5722';
  setTimeout(() => {
    newButton.style.color = '';
  }, 2000);
  
  // 이제 stopServerBtn 변수가 갱신된 버튼을 참조하도록 업데이트
  stopServerBtn = newButton;
  
  console.log('서버 중지 버튼 패치 완료');
}

/**
 * 서버 토글
 */
function toggleServer() {
  if (serverRunning) {
    stopServer();
  } else {
    startServer();
  }
}

/**
 * 서버 시작
 */
function startServer() {
  console.log('서버 시작 요청 전송');
  try {
    if (window.electronAPI && window.electronAPI.send) {
      console.log('electronAPI를 통해 start-server 이벤트 전송');
      window.electronAPI.send('start-server');
    } else if (ipcRenderer && ipcRenderer.send) {
      console.log('ipcRenderer를 통해 start-server 이벤트 전송');
      ipcRenderer.send('start-server');
    } else {
      console.error('이벤트 전송 방법을 찾을 수 없습니다.');
      alert('서버 시작을 위한 통신 마팁이 없습니다.');
      return;
    }
    showToast('서버를 시작합니다...', 'info');
  } catch (error) {
    console.error('서버 시작 중 오류:', error);
    alert('서버 시작 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 서버 중지
 * @param {Object} options 선택적 설정 (소스 등)
 */
function stopServer(options = {}) {
  console.log(`서버 중지 요청 발생 (소스: ${options.source || 'button'})`);
  
  try {
    let methodUsed = false;
    
    // 1. directStopServer 메서드 시도 (직접 연결 메서드)
    if (window.electronAPI && typeof window.electronAPI.directStopServer === 'function') {
      console.log('1. electronAPI.directStopServer() 호출 시도');
      window.electronAPI.directStopServer();
      showToast('서버를 중지합니다... (directStopServer 메서드)', 'info');
      methodUsed = true;
    }
    
    // 2. send 메서드 시도 (electronAPI)
    if (!methodUsed && window.electronAPI && typeof window.electronAPI.send === 'function') {
      console.log('2. electronAPI.send("stop-server") 호출 시도');
      window.electronAPI.send('stop-server', { 
        source: options.source || 'server_js', 
        timestamp: Date.now() 
      });
      showToast('서버를 중지합니다... (electronAPI.send 메서드)', 'info');
      methodUsed = true;
    }
    
    // 3. stopServer 메서드 시도 (전용 중지 메서드)
    if (!methodUsed && window.electronAPI && typeof window.electronAPI.stopServer === 'function') {
      console.log('3. electronAPI.stopServer() 호출 시도');
      window.electronAPI.stopServer();
      showToast('서버를 중지합니다... (stopServer 메서드)', 'info');
      methodUsed = true;
    }
    
    // 4. ipcRenderer 시도 (일반적인 Electron 방식)
    if (!methodUsed && ipcRenderer && typeof ipcRenderer.send === 'function') {
      console.log('4. ipcRenderer.send("stop-server") 호출 시도');
      ipcRenderer.send('stop-server', { 
        source: options.source || 'server_js_ipc', 
        timestamp: Date.now() 
      });
      showToast('서버를 중지합니다... (ipcRenderer 사용)', 'info');
      methodUsed = true;
    }
    
    // 5. 사용자 정의 DOM 이벤트 사용
    if (!methodUsed) {
      console.log('5. CustomEvent 사용 시도');
      const event = new CustomEvent('server-stop-request', {
        detail: { source: options.source || 'dom_event', timestamp: Date.now() }
      });
      document.dispatchEvent(event);
      showToast('서버를 중지합니다... (DOM 이벤트 사용)', 'info');
      methodUsed = true;
    }
    
    // 모든 방법이 실패한 경우
    if (!methodUsed) {
      throw new Error('어떤 서버 중지 방법도 실행할 수 없습니다');
    }
    
    // 6. 상태 UI 처리 - 응답이 도착하기 전에 임시로 표시
    setTimeout(() => {
      // 응답이 오지 않았다면 일시적으로 버튼 상태 업데이트
      if (serverRunning) {
        startServerBtn.disabled = false;
        stopServerBtn.disabled = true;
      }
    }, 1000);
    
  } catch (error) {
    console.error('서버 중지 중 오류:', error);
    showToast(`서버 중지 중 오류가 발생했습니다: ${error.message}`, 'error');
    
    // 메시지 박스로 사용자에게 알림
    if (options.showAlert !== false) {
      try {
        alert(`서버 중지 요청 중 오류가 발생했습니다: ${error.message}\n\n새로고침하거나 개발자 도구를 실행하여 문제를 해결하세요.`);
      } catch (alertError) {
        console.error('Alert 표시 오류:', alertError);
      }
    }
  }
}

/**
 * 서버 상태 업데이트
 * @param {Object} status 서버 상태 정보
 */
function updateServerStatus(status) {
  serverRunning = status.running;
  
  if (status.running) {
    // 서버 실행 중
    serverStatusIndicator.className = 'status-indicator running';
    serverStatusMessage.textContent = '실행 중';
    serverStatusText.textContent = '실행 중';
    serverStatusIcon.className = 'icon server-on';
    serverToggle.checked = true;
    
    // 서버 정보 표시
    serverAddress = status.address;
    serverIpAddress.textContent = status.address;
    serverPort.textContent = status.port;
    
    // IP 주소 컨테이너 표시
    serverIpContainer.classList.remove('hidden');
    
    // 버튼 상태 업데이트
    startServerBtn.disabled = true;
    stopServerBtn.disabled = false;
    
    // 클라이언트 수 업데이트
    updateClientCount(status.clients ? status.clients.length : 0);
  } else {
    // 서버 중지됨
    serverStatusIndicator.className = 'status-indicator stopped';
    serverStatusMessage.textContent = '중지됨';
    serverStatusText.textContent = '중지됨';
    serverStatusIcon.className = 'icon server-off';
    serverToggle.checked = false;
    
    // IP 주소 컨테이너 숨기기
    serverIpContainer.classList.add('hidden');
    
    // 버튼 상태 업데이트
    startServerBtn.disabled = false;
    stopServerBtn.disabled = true;
    
    // 클라이언트 수 초기화
    updateClientCount(0);
  }
}

/**
 * 클라이언트 수 업데이트
 * @param {number} count 클라이언트 수
 */
function updateClientCount(count) {
  clientCount.textContent = count;
}

/**
 * 서버 주소 복사
 */
function copyServerAddress() {
  if (!serverAddress) {
    showToast('서버 주소가 없습니다.', 'error');
    return;
  }
  
  navigator.clipboard.writeText(serverAddress)
    .then(() => {
      showToast('서버 주소가 복사되었습니다.', 'success');
    })
    .catch(err => {
      showToast('서버 주소 복사에 실패했습니다.', 'error');
      console.error('서버 주소 복사 오류:', err);
    });
}

/**
 * 클라이언트 목록 업데이트
 * @param {Array} clients 클라이언트 목록
 */
function updateClientList(clients) {
  // 클라이언트 데이터 업데이트
  connectedClients = clients;
  
  // 클라이언트 수 업데이트
  updateClientCount(clients.length);
  
  // 클라이언트 목록 UI 업데이트
  clientList.innerHTML = '';
  
  if (clients.length === 0) {
    // 클라이언트가 없는 경우
    clientList.innerHTML = '<div class="empty-list-message">연결된 클라이언트가 없습니다</div>';
  } else {
    // 클라이언트 목록 생성
    clients.forEach(client => {
      const clientItem = document.createElement('div');
      clientItem.className = 'client-item';
      
      const clientInfo = document.createElement('div');
      clientInfo.className = 'client-info';
      
      const clientName = document.createElement('div');
      clientName.className = 'client-name';
      clientName.textContent = client.name || '익명';
      
      const clientId = document.createElement('div');
      clientId.className = 'client-id';
      clientId.textContent = client.id;
      
      clientInfo.appendChild(clientName);
      clientInfo.appendChild(clientId);
      
      const clientIp = document.createElement('div');
      clientIp.className = 'client-ip';
      clientIp.textContent = client.ip;
      
      const clientStatus = document.createElement('div');
      clientStatus.className = 'client-status';
      
      const statusSpan = document.createElement('span');
      statusSpan.className = `status-badge ${client.authenticated ? 'active' : 'inactive'}`;
      statusSpan.textContent = client.authenticated ? '인증됨' : '미인증';
      
      clientStatus.appendChild(statusSpan);
      
      const clientActions = document.createElement('div');
      clientActions.className = 'client-actions';
      
      const disconnectBtn = document.createElement('button');
      disconnectBtn.className = 'btn-icon';
      disconnectBtn.title = '연결 끊기';
      disconnectBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
      disconnectBtn.addEventListener('click', () => {
        disconnectClient(client.id);
      });
      
      clientActions.appendChild(disconnectBtn);
      
      clientItem.appendChild(clientInfo);
      clientItem.appendChild(clientIp);
      clientItem.appendChild(clientStatus);
      clientItem.appendChild(clientActions);
      
      clientList.appendChild(clientItem);
    });
  }
}

/**
 * 클라이언트 연결 끊기
 * @param {string} clientId 클라이언트 ID
 */
function disconnectClient(clientId) {
  ipcRenderer.send('disconnect-client', clientId);
  showToast('클라이언트 연결을 끊는 중...', 'info');
}

module.exports = {
  initServerFeatures,
  initServerElements,
  patchStopServerButton,
  toggleServer,
  startServer,
  stopServer,
  updateServerStatus,
  copyServerAddress,
  updateClientList,
  disconnectClient,
  getServerStatus: () => serverRunning
};
