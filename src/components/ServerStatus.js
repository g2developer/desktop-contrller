// ServerStatus.js
// 서버 상태를 표시하는 컴포넌트

/**
 * 서버 상태 관리 모듈
 * @module ServerStatus
 */

const { ipcRenderer } = require('electron');

/**
 * 서버 상태 컴포넌트
 */
class ServerStatus {
  /**
   * 서버 상태 컴포넌트 생성자
   * @param {Object} elements - 서버 상태 표시에 사용될 DOM 요소들
   * @param {Element} elements.indicator - 서버 상태 표시 아이콘
   * @param {Element} elements.message - 서버 상태 메시지
   * @param {Element} elements.ipAddress - 서버 IP 주소 표시 요소
   * @param {Element} elements.port - 서버 포트 표시 요소
   * @param {Element} elements.clientCount - 클라이언트 수 표시 요소
   * @param {Element} elements.startButton - 서버 시작 버튼
   * @param {Element} elements.stopButton - 서버 중지 버튼
   */
  constructor(elements) {
    this.elements = elements;
    this.serverRunning = false;
    this.serverAddress = '';
    this.serverPort = '';
    this.clientCount = 0;
    
    // 서버 상태 업데이트 이벤트 등록
    ipcRenderer.on('server-status', (event, status) => {
      this.updateServerStatus(status);
    });
    
    // 클라이언트 목록 업데이트 이벤트 등록
    ipcRenderer.on('clients-update', (event, clients) => {
      this.updateClientCount(clients.length);
    });
    
    // 버튼 이벤트 등록
    if (this.elements.startButton) {
      this.elements.startButton.addEventListener('click', () => this.startServer());
    }
    
    if (this.elements.stopButton) {
      this.elements.stopButton.addEventListener('click', () => this.stopServer());
    }
    
    // 초기 서버 상태 요청
    this.getServerStatus();
  }
  
  /**
   * 서버 상태 조회
   */
  getServerStatus() {
    ipcRenderer.send('get-server-status');
  }
  
  /**
   * 서버 상태 업데이트
   * @param {Object} status - 서버 상태 정보
   */
  updateServerStatus(status) {
    this.serverRunning = status.running;
    
    if (this.serverRunning) {
      // 서버 실행 중
      this.serverAddress = status.ip || 'localhost';
      this.serverPort = status.port || '';
      
      // 상태 표시 업데이트
      if (this.elements.indicator) {
        this.elements.indicator.className = 'status-icon-large online';
      }
      
      if (this.elements.message) {
        this.elements.message.textContent = '서버가 실행 중입니다';
      }
      
      // IP 주소 및 포트 표시
      if (this.elements.ipAddress) {
        this.elements.ipAddress.textContent = this.serverAddress;
      }
      
      if (this.elements.port) {
        this.elements.port.textContent = this.serverPort;
      }
      
      // 버튼 상태 업데이트
      if (this.elements.startButton) {
        this.elements.startButton.disabled = true;
      }
      
      if (this.elements.stopButton) {
        this.elements.stopButton.disabled = false;
      }
    } else {
      // 서버 중지됨
      this.serverAddress = '';
      this.serverPort = '';
      
      // 상태 표시 업데이트
      if (this.elements.indicator) {
        this.elements.indicator.className = 'status-icon-large offline';
      }
      
      if (this.elements.message) {
        this.elements.message.textContent = '서버가 중지되었습니다';
      }
      
      // IP 주소 및 포트 표시 초기화
      if (this.elements.ipAddress) {
        this.elements.ipAddress.textContent = '-';
      }
      
      if (this.elements.port) {
        this.elements.port.textContent = '-';
      }
      
      // 버튼 상태 업데이트
      if (this.elements.startButton) {
        this.elements.startButton.disabled = false;
      }
      
      if (this.elements.stopButton) {
        this.elements.stopButton.disabled = true;
      }
    }
    
    // 클라이언트 수 업데이트
    this.updateClientCount(status.clientCount || 0);
  }
  
  /**
   * 클라이언트 수 업데이트
   * @param {number} count - 클라이언트 수
   */
  updateClientCount(count) {
    this.clientCount = count;
    
    if (this.elements.clientCount) {
      this.elements.clientCount.textContent = count;
    }
  }
  
  /**
   * 서버 시작
   */
  startServer() {
    ipcRenderer.send('start-server');
    
    // 연결 중 상태로 UI 업데이트
    if (this.elements.indicator) {
      this.elements.indicator.className = 'status-icon-large connecting';
    }
    
    if (this.elements.message) {
      this.elements.message.textContent = '서버 연결 중...';
    }
    
    // 토스트 메시지 표시
    this.showToast('서버를 시작하는 중입니다...', 'info');
  }
  
  /**
   * 서버 중지
   */
  stopServer() {
    // 서버 중지 전 확인
    this.showConfirmModal(
      '서버 중지',
      '서버를 중지하면 연결된 모든 클라이언트의 연결이 끊어집니다. 계속하시겠습니까?',
      () => {
        ipcRenderer.send('stop-server');
        this.showToast('서버를 중지하는 중입니다...', 'info');
      }
    );
  }
  
  /**
   * 서버 IP 주소 복사
   */
  copyServerAddress() {
    if (this.serverAddress && this.serverPort) {
      const address = `http://${this.serverAddress}:${this.serverPort}`;
      
      navigator.clipboard.writeText(address)
        .then(() => {
          this.showToast('서버 주소가 클립보드에 복사되었습니다.', 'success');
        })
        .catch(err => {
          this.showToast('클립보드 복사 실패: ' + err, 'error');
        });
    }
  }
  
  /**
   * 확인 모달 표시
   * @param {string} title - 모달 제목
   * @param {string} message - 모달 메시지
   * @param {Function} onConfirm - 확인 콜백 함수
   */
  showConfirmModal(title, message, onConfirm) {
    // 모달 요소 가져오기
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    
    // 모달 제목 설정
    modalTitle.textContent = title;
    
    // 모달 내용 생성
    const content = `<p>${message}</p>`;
    
    // 모달 내용 설정
    modalBody.innerHTML = content;
    
    // 모달 푸터 버튼 이벤트 설정
    modalCancelBtn.textContent = '취소';
    modalCancelBtn.style.display = 'block';
    modalCancelBtn.onclick = () => {
      modalContainer.classList.remove('active');
    };
    
    modalConfirmBtn.textContent = '확인';
    modalConfirmBtn.style.backgroundColor = '';
    modalConfirmBtn.className = 'btn primary';
    modalConfirmBtn.onclick = () => {
      modalContainer.classList.remove('active');
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    };
    
    // 모달 표시
    modalContainer.classList.add('active');
  }
  
  /**
   * 토스트 메시지 표시
   * @param {string} message - 토스트 메시지
   * @param {string} type - 토스트 유형 (info, success, error, warning)
   */
  showToast(message, type = 'info') {
    // 토스트 컨테이너 확인
    const toastContainer = document.getElementById('toast-container');
    
    // 토스트 아이템 생성
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 토스트 내용
    const toastContent = document.createElement('div');
    toastContent.className = 'toast-content';
    toastContent.textContent = message;
    
    // 토스트 닫기 버튼
    const toastClose = document.createElement('button');
    toastClose.className = 'toast-close';
    toastClose.innerHTML = '&times;';
    toastClose.addEventListener('click', () => {
      toast.remove();
    });
    
    toast.appendChild(toastContent);
    toast.appendChild(toastClose);
    
    // 토스트 컨테이너에 추가
    toastContainer.appendChild(toast);
    
    // 토스트 자동 제거 (3초 후)
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }
}

module.exports = ServerStatus;
