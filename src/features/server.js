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
  
  // 이벤트 리스너 설정
  serverToggle.addEventListener('click', toggleServer);
  startServerBtn.addEventListener('click', startServer);
  stopServerBtn.addEventListener('click', stopServer);
  copyIpBtn.addEventListener('click', copyServerAddress);
  refreshClientsBtn.addEventListener('click', () => {
    ipcRenderer.send('get-clients');
  });
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
 */
function stopServer() {
  console.log('서버 중지 요청 전송');
  try {
    // 직접 메인 프로세스 이벤트 로깅 추가
    console.log('stop-server 이벤트 전송 시도');
    
    // window.electronAPI를 통한 전송 시도
    if (window.electronAPI && typeof window.electronAPI.send === 'function') {
      console.log('electronAPI를 통해 stop-server 이벤트 전송');
      window.electronAPI.send('stop-server');
      showToast('서버를 중지합니다... (electronAPI 사용)', 'info');
      return;
    }
    
    // ipcRenderer를 통한 전송 시도
    if (ipcRenderer && typeof ipcRenderer.send === 'function') {
      console.log('ipcRenderer를 통해 stop-server 이벤트 전송');
      ipcRenderer.send('stop-server');
      showToast('서버를 중지합니다... (ipcRenderer 사용)', 'info');
      return;
    }
    
    // 두 방법 모두 실패한 경우
    console.error('이벤트 전송 방법을 찾을 수 없습니다.');
    showToast('서버 중지를 위한 통신 방법이 없습니다.', 'error');
    
    // 직접적인 DOM 이벤트를 사용해 볼 수 있는 대안 추가
    const event = new CustomEvent('server-stop-request');
    document.dispatchEvent(event);
    console.log('DOM 이벤트를 통한 서버 중지 요청 시도');
  } catch (error) {
    console.error('서버 중지 중 오류:', error);
    showToast('서버 중지 중 오류가 발생했습니다: ' + error.message, 'error');
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
  initServerElements,
  toggleServer,
  startServer,
  stopServer,
  updateServerStatus,
  copyServerAddress,
  updateClientList,
  disconnectClient,
  getServerStatus: () => serverRunning
};
