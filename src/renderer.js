/**
 * renderer.js
 * 렌더러 프로세스 진입점
 * 
 * 이 파일은 HTML 파일에서 로드되는 렌더러 프로세스의 진입점으로,
 * 앱 모듈을 불러와 초기화만 담당합니다.
 */

// 전역 오류 처리 설정
window.onerror = function(message, source, lineno, colno, error) {
  console.error('전역 오류 발생:', { message, source, lineno, colno, error });
  showErrorMessage(`오류 발생: ${message}`);
  return true; // 오류 처리됨으로 표시
};

// 미처리 프로미스 오류 처리
window.addEventListener('unhandledrejection', function(event) {
  console.error('미처리 프로미스 오류:', event.reason);
  showErrorMessage(`비동기 오류: ${event.reason.message || event.reason}`);
});

// 오류 메시지 표시 함수
function showErrorMessage(message) {
  console.log('오류 메시지 표시:', message);
  
  // DOM이 로드되었는지 확인
  if (document.readyState !== 'loading') {
    addErrorToDOM(message);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      addErrorToDOM(message);
    });
  }
}

// DOM에 오류 메시지 추가
function addErrorToDOM(message) {
  // 오류 컨테이너 확인 또는 생성
  let errorContainer = document.getElementById('error-container');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      width: 80%;
      max-width: 500px;
    `;
    document.body.appendChild(errorContainer);
  }
  
  // 오류 메시지 요소 생성
  const errorElement = document.createElement('div');
  errorElement.style.cssText = `
    background-color: #f44336;
    color: white;
    padding: 12px 16px;
    margin-bottom: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  // 메시지 텍스트
  const messageText = document.createElement('span');
  messageText.textContent = message;
  
  // 닫기 버튼
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    margin-left: 10px;
  `;
  
  closeButton.addEventListener('click', () => {
    errorContainer.removeChild(errorElement);
  });
  
  // 요소 조합
  errorElement.appendChild(messageText);
  errorElement.appendChild(closeButton);
  errorContainer.appendChild(errorElement);
  
  // 10초 후 자동 제거
  setTimeout(() => {
    if (errorContainer.contains(errorElement)) {
      errorContainer.removeChild(errorElement);
    }
  }, 10000);
}

// 렌더러 프로세스 시작 로그
console.log('렌더러 프로세스 시작');

// DOM이 로드된 후 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 로드 완료');
  
  try {
    // electronAPI 확인
    if (!window.electronAPI) {
      throw new Error('electronAPI를 찾을 수 없습니다. preload.js가 정상적으로 로드되었는지 확인하세요.');
    }
    
    console.log('electronAPI 확인:', !!window.electronAPI);
    
    // 앱 초기화 함수 호출
    if (window.electronAPI.initApp) {
      const result = window.electronAPI.initApp();
      console.log('앱 초기화 결과:', result);
    } else {
      throw new Error('앱 초기화 함수가 없습니다.');
    }
    
    // 서버 상태 요청
    if (window.electronAPI.getServerStatus) {
      console.log('서버 상태 요청');
      window.electronAPI.getServerStatus();
    }
    
    console.log('앱 초기화 성공');
  } catch (error) {
    console.error('앱 초기화 오류:', error.message);
    showErrorMessage(`앱 초기화 실패: ${error.message}`);
    
    // 기본 기능 구현
    setupBackupUI();
  }
});

// 백업 UI 설정 (electronAPI 실패 시)
function setupBackupUI() {
  console.log('백업 UI 설정');
  
  // 상태 메시지 설정
  const statusMessage = document.getElementById('server-status-message');
  if (statusMessage) {
    statusMessage.textContent = 'API 로드 실패 - 일부 기능만 사용 가능합니다';
    statusMessage.style.color = '#f44336';
  }
  
  // 서버 버튼 설정
  const serverToggle = document.getElementById('server-toggle');
  if (serverToggle) {
    serverToggle.addEventListener('click', () => {
      console.log('서버 토글 클릭 (백업 UI)');
      fetch('/api/toggle-server', { method: 'POST' })
        .catch(err => console.error('서버 토글 요청 실패:', err));
    });
  }
  
  // 개발자 도구 버튼 설정
  const devToolsBtn = document.querySelector('.debug-tools button');
  if (devToolsBtn) {
    devToolsBtn.addEventListener('click', () => {
      console.log('개발자 도구 버튼 클릭 (백업 UI)');
      // 개발자 도구 열기를 시도하는 메시지 표시
      showErrorMessage('백업 모드에서는 개발자 도구를 열 수 없습니다. 앱을 재시작하세요.');
    });
  }
}