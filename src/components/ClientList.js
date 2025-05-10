// ClientList.js
// 연결된 클라이언트 목록을 표시하는 컴포넌트

/**
 * 클라이언트 목록 관리 모듈
 * @module ClientList
 */

const { ipcRenderer } = require('electron');

/**
 * 클라이언트 목록 컴포넌트
 */
class ClientList {
  /**
   * 클라이언트 목록 컴포넌트 생성자
   * @param {Element} container - 클라이언트 목록을 표시할 컨테이너 요소
   */
  constructor(container) {
    this.container = container;
    this.clients = [];
    this.emptyMessage = '<div class="empty-list-message">연결된 클라이언트가 없습니다</div>';
    
    // 클라이언트 목록 업데이트 이벤트 등록
    ipcRenderer.on('clients-update', (event, clients) => {
      this.updateClientList(clients);
    });
    
    // 초기 클라이언트 목록 요청
    this.refreshClientList();
  }
  
  /**
   * 클라이언트 목록 새로고침
   */
  refreshClientList() {
    ipcRenderer.send('get-clients');
  }
  
  /**
   * 클라이언트 목록 업데이트
   * @param {Array} clients - 클라이언트 목록 데이터
   */
  updateClientList(clients) {
    this.clients = clients;
    this.render();
  }
  
  /**
   * 클라이언트 연결 해제
   * @param {string} clientId - 연결 해제할 클라이언트 ID
   */
  disconnectClient(clientId) {
    // 클라이언트 연결 해제 확인 모달 표시
    this.showConfirmModal(
      '클라이언트 연결 해제',
      '이 클라이언트의 연결을 해제하시겠습니까?',
      () => {
        ipcRenderer.send('disconnect-client', { clientId });
        this.showToast('클라이언트 연결 해제 중...', 'info');
      }
    );
  }
  
  /**
   * 클라이언트 정보 조회
   * @param {string} clientId - 정보를 조회할 클라이언트 ID
   */
  viewClientInfo(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;
    
    // 클라이언트 정보 모달 표시
    this.showClientInfoModal(client);
  }
  
  /**
   * 클라이언트 정보 모달 표시
   * @param {Object} client - 클라이언트 정보
   */
  showClientInfoModal(client) {
    // 모달 요소 가져오기
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    
    // 모달 제목 설정
    modalTitle.textContent = '클라이언트 정보';
    
    // 클라이언트 정보 생성
    const connectionTime = new Date(client.connectedAt || Date.now()).toLocaleString('ko-KR');
    const lastActivityTime = client.lastActivity 
      ? new Date(client.lastActivity).toLocaleString('ko-KR') 
      : '없음';
    
    // 모달 내용 생성
    const content = `
      <div class="client-info">
        <div class="info-row">
          <div class="info-label">ID:</div>
          <div class="info-value">${client.id || '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">사용자:</div>
          <div class="info-value">${client.username || '인증되지 않음'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">기기:</div>
          <div class="info-value">${client.device || '알 수 없음'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">IP 주소:</div>
          <div class="info-value">${client.ip || '-'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">연결 시간:</div>
          <div class="info-value">${connectionTime}</div>
        </div>
        <div class="info-row">
          <div class="info-label">마지막 활동:</div>
          <div class="info-value">${lastActivityTime}</div>
        </div>
        <div class="info-row">
          <div class="info-label">상태:</div>
          <div class="info-value">
            <span class="client-status ${client.authenticated ? 'authenticated' : 'unauthenticated'}">
              ${client.authenticated ? '인증됨' : '인증 안됨'}
            </span>
          </div>
        </div>
      </div>
      <style>
        .client-info {
          margin-top: 10px;
        }
        .info-row {
          display: flex;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--gray-200);
        }
        .info-label {
          flex: 0 0 120px;
          font-weight: 500;
          color: var(--gray-700);
        }
        .info-value {
          flex: 1;
        }
        .client-status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
        .client-status.authenticated {
          background-color: var(--success-color);
          color: white;
        }
        .client-status.unauthenticated {
          background-color: var(--warning-color);
          color: white;
        }
      </style>
    `;
    
    // 모달 내용 설정
    modalBody.innerHTML = content;
    
    // 모달 푸터 버튼 이벤트 설정
    modalCancelBtn.textContent = '닫기';
    modalCancelBtn.onclick = () => {
      modalContainer.classList.remove('active');
    };
    
    // 연결 해제 버튼 설정
    modalConfirmBtn.textContent = '연결 해제';
    modalConfirmBtn.style.backgroundColor = 'var(--error-color)';
    modalConfirmBtn.onclick = () => {
      modalContainer.classList.remove('active');
      this.disconnectClient(client.id);
    };
    
    // 모달 표시
    modalContainer.classList.add('active');
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
  
  /**
   * 클라이언트 목록 렌더링
   */
  render() {
    // 클라이언트 목록이 비어있는 경우
    if (!this.clients || this.clients.length === 0) {
      this.container.innerHTML = this.emptyMessage;
      return;
    }
    
    // 클라이언트 목록 HTML 생성
    let html = '';
    
    this.clients.forEach(client => {
      const deviceInfo = client.device || 'Unknown';
      const username = client.username || 'Anonymous';
      
      html += `
        <div class="client-item" data-id="${client.id}">
          <div class="client-col id">${username}</div>
          <div class="client-col device">${deviceInfo}</div>
          <div class="client-col status">
            <div class="status-icon ${client.authenticated ? 'online' : 'offline'}"></div>
            <span>${client.authenticated ? '인증됨' : '인증 안됨'}</span>
          </div>
          <div class="client-col actions">
            <button class="btn-icon view-client" title="상세 정보">
              <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
            </button>
            <button class="btn-icon disconnect-client" title="연결 해제">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
      `;
    });
    
    // 클라이언트 목록 업데이트
    this.container.innerHTML = html;
    
    // 버튼 이벤트 등록
    const viewButtons = this.container.querySelectorAll('.view-client');
    const disconnectButtons = this.container.querySelectorAll('.disconnect-client');
    
    viewButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const clientItem = e.target.closest('.client-item');
        const clientId = clientItem.getAttribute('data-id');
        this.viewClientInfo(clientId);
      });
    });
    
    disconnectButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const clientItem = e.target.closest('.client-item');
        const clientId = clientItem.getAttribute('data-id');
        this.disconnectClient(clientId);
      });
    });
  }
}

module.exports = ClientList;
