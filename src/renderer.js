// DOM 요소
const connectionStatusElement = document.getElementById('connection-status');
const ipAddressElement = document.getElementById('ip-address');
const connectionUrlElement = document.getElementById('connection-url');
const copyUrlButton = document.getElementById('copy-url');
const connectedClientsList = document.getElementById('connected-clients');

// Socket.io 클라이언트 초기화
let socket;
let localIp;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  initApp();
});

// 애플리케이션 초기화
async function initApp() {
  // 시스템 정보 가져오기
  const systemInfo = window.electronAPI.getSystemInfo();
  localIp = systemInfo.ipAddress;
  
  // IP 주소 표시
  ipAddressElement.textContent = localIp;
  
  // 연결 URL 업데이트
  const connectionUrl = `http://${localIp}:3000`;
  connectionUrlElement.textContent = connectionUrl;
  
  // QR 코드 생성 (실제 구현 시 QR 코드 라이브러리 필요)
  generateQRCode(connectionUrl);
  
  // 클립보드 복사 버튼 이벤트 리스너
  copyUrlButton.addEventListener('click', () => {
    navigator.clipboard.writeText(connectionUrl)
      .then(() => {
        copyUrlButton.textContent = '복사됨!';
        setTimeout(() => {
          copyUrlButton.textContent = '복사';
        }, 2000);
      })
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
      });
  });
  
  // Socket.io 이벤트 리스너 설정
  setupSocketListeners();
}

// QR 코드 생성 함수 (실제 구현 필요)
function generateQRCode(text) {
  // 여기에 QR 코드 생성 라이브러리 코드 추가
  console.log('QR 코드 생성:', text);
  
  // 예: QRCode.toCanvas(document.getElementById('qrcode'), text, function (error) {
  //   if (error) console.error(error);
  //   console.log('QR 코드 생성 성공!');
  // });
}

// Socket.io 리스너 설정
function setupSocketListeners() {
  // 서버와 연결 시도
  socket = io(`http://localhost:3000`);
  
  // 연결 성공 이벤트
  socket.on('connect', () => {
    connectionStatusElement.textContent = '연결됨';
    connectionStatusElement.className = 'connected';
    console.log('서버에 연결됨');
  });
  
  // 연결 종료 이벤트
  socket.on('disconnect', () => {
    connectionStatusElement.textContent = '연결 끊김';
    connectionStatusElement.className = '';
    console.log('서버 연결 끊김');
    // 연결된 클라이언트 목록 초기화
    connectedClientsList.innerHTML = '';
  });
  
  // 클라이언트 목록 업데이트 이벤트
  socket.on('clientsUpdate', (clients) => {
    updateClientsList(clients);
  });
  
  // 오류 이벤트
  socket.on('connect_error', (error) => {
    console.error('연결 오류:', error);
    connectionStatusElement.textContent = '연결 오류';
  });
}

// 연결된 클라이언트 목록 업데이트
function updateClientsList(clients) {
  // 목록 초기화
  connectedClientsList.innerHTML = '';
  
  // 클라이언트가 없는 경우
  if (clients.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = '연결된 기기가 없습니다.';
    connectedClientsList.appendChild(emptyItem);
    return;
  }
  
  // 각 클라이언트를 목록에 추가
  clients.forEach(client => {
    const listItem = document.createElement('li');
    listItem.textContent = `${client.name || '익명'} (${client.id})`;
    
    // 연결 해제 버튼 추가
    const disconnectButton = document.createElement('button');
    disconnectButton.textContent = '연결 해제';
    disconnectButton.className = 'disconnect-button';
    disconnectButton.addEventListener('click', () => {
      // 클라이언트 연결 해제 요청
      socket.emit('disconnectClient', client.id);
    });
    
    listItem.appendChild(disconnectButton);
    connectedClientsList.appendChild(listItem);
  });
}

// 애플리케이션 종료 시 정리 작업
window.addEventListener('beforeunload', () => {
  if (socket) {
    socket.disconnect();
  }
});