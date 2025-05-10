/**
 * renderer.js
 * 렌더러 프로세스 진입점
 * 
 * 이 파일은 HTML 파일에서 로드되는 렌더러 프로세스의 진입점으로,
 * 앱 초기화를 담당합니다.
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
  
  // 네비게이션 초기화 요소 찾기
  const navItems = document.querySelectorAll('.nav-item');
  console.log('네비게이션 아이템 발견:', navItems.length);
  
  // 페이지 요소 찾기
  const pages = document.querySelectorAll('.page');
  console.log('페이지 발견:', pages.length);
  
  try {
    // electronAPI 확인
    if (!window.electronAPI) {
      throw new Error('electronAPI를 찾을 수 없습니다. preload.js가 정상적으로 로드되었는지 확인하세요.');
    }
    
    console.log('electronAPI 확인:', !!window.electronAPI);
    
    // 앱 초기화 함수 호출
    if (window.electronAPI.initApp) {
      // 비동기 처리를 위한 Promise 래핑
      Promise.resolve(window.electronAPI.initApp())
        .then(result => {
          console.log('앱 초기화 결과:', result);
          
          // 직접 네비게이션 초기화
          initNavigation();
          
          // 서버 상태 요청
          if (window.electronAPI.getServerStatus) {
            console.log('서버 상태 요청');
            window.electronAPI.getServerStatus();
          }
          
          console.log('앱 초기화 성공');
        })
        .catch(error => {
          console.error('앱 초기화 프로미스 오류:', error);
          showErrorMessage(`앱 초기화 실패: ${error.message}`);
          setupBackupUI();
        });
    } else {
      throw new Error('앱 초기화 함수가 없습니다.');
    }
  } catch (error) {
    console.error('앱 초기화 오류:', error.message);
    showErrorMessage(`앱 초기화 실패: ${error.message}`);
    
    // 기본 기능 구현
    setupBackupUI();
  }
});

/**
 * 내비게이션 초기화 함수
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('page-title');
  let currentPage = 'dashboard';
  
  console.log(`내비게이션 요소 초기화: ${navItems.length}개 탭, ${pages.length}개 페이지 발견`);
  
  // 탭 스타일 관련 CSS 추가
  addNavigationStyle();
  
  // 각 탭에 이벤트 리스너 추가
  navItems.forEach(item => {
    // 기존 이벤트 리스너 제거 (이벤트 중복 방지)
    item.removeEventListener('click', navigateTabHandler);
    
    // 새 이벤트 리스너 추가
    item.addEventListener('click', navigateTabHandler);
    
    console.log(`탭 이벤트 리스너 추가: ${item.getAttribute('data-page')}`);
  });
  
  // 초기 페이지 로드
  setTimeout(() => {
    // 이미 활성화된 페이지가 있는지 확인
    const activePage = document.querySelector('.page:not(.hidden)');
    if (!activePage) {
      // 대시보드로 기본 설정
      navigateToPage('dashboard');
    }
  }, 500);
  
  console.log('내비게이션 초기화 완료');
  
  /**
   * 탭 클릭 이벤트 핸들러
   * @param {Event} event 클릭 이벤트
   */
  function navigateTabHandler(event) {
    const page = this.getAttribute('data-page');
    console.log(`탭 클릭됨: ${page}`);
    
    if (page) {
      navigateToPage(page);
    }
  }
  
  /**
   * 페이지 이동
   * @param {string} page 페이지 ID
   */
  function navigateToPage(page) {
    console.log(`페이지 전환 시작: ${page}`);
    
    // 모든 탭에서 active 클래스 제거
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // 해당 탭에 active 클래스 추가
    const selectedTab = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (selectedTab) {
      selectedTab.classList.add('active');
    } else {
      console.error(`해당 페이지의 탭을 찾을 수 없음: ${page}`);
    }
    
    // 디버깅 확인
    const activeTabs = document.querySelectorAll('.nav-item.active');
    console.log(`활성화된 탭 수: ${activeTabs.length}개`);
    activeTabs.forEach(tab => {
      console.log(`- 활성화된 탭: ${tab.getAttribute('data-page')}`);
    });
    
    // 모든 페이지 숨기기
    document.querySelectorAll('.page').forEach(p => {
      p.classList.add('hidden');
    });
    
    // 선택한 페이지 표시
    const selectedPage = document.getElementById(`${page}-page`);
    if (selectedPage) {
      selectedPage.classList.remove('hidden');
      
      // 페이지 제목 업데이트
      if (pageTitle) {
        switch (page) {
          case 'dashboard':
            pageTitle.textContent = '대시보드';
            break;
          case 'users':
            pageTitle.textContent = '사용자 관리';
            break;
          case 'capture':
            pageTitle.textContent = '캡처 설정';
            break;
          case 'logs':
            pageTitle.textContent = '활동 로그';
            break;
          case 'settings':
            pageTitle.textContent = '설정';
            break;
          default:
            pageTitle.textContent = '데스크탑 컨트롤러';
        }
      }
      
      // 페이지별 초기화 함수들을 electronAPI를 통해 호출
      try {
        if (page === 'dashboard') {
          // 대시보드 페이지 진입 시
          if (window.electronAPI && window.electronAPI.getServerStatus) {
            window.electronAPI.getServerStatus();
          }
        } else if (page === 'users') {
          // 사용자 관리 페이지 진입 시
          if (window.electronAPI && window.electronAPI.send) {
            window.electronAPI.send('get-users');
          }
        } else if (page === 'capture') {
          // 캡처 설정 페이지 진입 시
          if (window.electronAPI && window.electronAPI.send) {
            window.electronAPI.send('load-capture-area');
            window.electronAPI.send('load-recent-captures');
          }
        } else if (page === 'logs') {
          // 활동 로그 페이지 진입 시
          if (window.electronAPI && window.electronAPI.send) {
            window.electronAPI.send('get-full-activity-log');
          }
        } else if (page === 'settings') {
          // 설정 페이지 진입 시
          if (window.electronAPI && window.electronAPI.send) {
            window.electronAPI.send('load-settings');
          }
        }
      } catch (error) {
        console.error(`${page} 페이지 초기화 실패:`, error);
        // 사용자에게 오류 메시지 표시
        showPageError(page, error);
      }
    } else {
      console.error(`페이지를 찾을 수 없음: ${page}-page`);
    }
    
    // 현재 페이지 업데이트
    currentPage = page;
    
    console.log(`페이지 전환 완료: ${page}`);
  }
  
  /**
   * 페이지 초기화 오류 시 사용자에게 메시지 표시
   * @param {string} page 페이지 이름
   * @param {Error} error 발생한 오류
   */
  function showPageError(page, error) {
    // 페이지 이름 한글화
    let pageName = '';
    switch (page) {
      case 'dashboard': pageName = '대시보드'; break;
      case 'users': pageName = '사용자 관리'; break;
      case 'capture': pageName = '캡처 설정'; break;
      case 'logs': pageName = '활동 로그'; break;
      case 'settings': pageName = '설정'; break;
      default: pageName = page;
    }
    
    // 오류 메시지 요소 생성
    const errorDiv = document.createElement('div');
    errorDiv.className = 'page-error-message';
    errorDiv.innerHTML = `
      <div class="alert alert-warning">
        <h4>페이지 초기화 오류</h4>
        <p>${pageName} 페이지를 초기화하는 중 문제가 발생했습니다.</p>
        <p><small>${error.message}</small></p>
        <button class="btn btn-sm btn-outline-secondary retry-btn">다시 시도</button>
      </div>
    `;
    
    // 페이지 상단에 오류 메시지 삽입
    const selectedPage = document.getElementById(`${page}-page`);
    if (selectedPage) {
      // 기존 오류 메시지가 있으면 제거
      const existingError = selectedPage.querySelector('.page-error-message');
      if (existingError) {
        existingError.remove();
      }
      
      // 페이지의 맨 위에 삽입
      selectedPage.prepend(errorDiv);
      
      // 다시 시도 버튼에 이벤트 리스너 추가
      const retryBtn = errorDiv.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          // 오류 메시지 제거
          errorDiv.remove();
          // 페이지 다시 초기화
          navigateToPage(page);
        });
      }
    }
  }
}

/**
 * 탭 스타일 관련 CSS 추가
 */
function addNavigationStyle() {
  // 기존 스타일이 있는지 확인
  let existingStyle = document.getElementById('nav-fix-styles');
  if (existingStyle) {
    existingStyle.parentNode.removeChild(existingStyle);
  }
  
  // 새 스타일 요소 생성
  const style = document.createElement('style');
  style.id = 'nav-fix-styles';
  style.textContent = `
    /* 네비게이션 탭 강화 스타일 */
    .nav-item {
      color: var(--gray-300) !important;
      background-color: transparent !important;
      cursor: pointer !important;
    }
    
    .nav-item:hover {
      color: white !important;
      background-color: var(--gray-700) !important;
    }
    
    .nav-item.active {
      color: white !important;
      background-color: var(--primary-dark) !important;
    }
    
    /* 페이지 표시 제어 */
    .page {
      display: none !important;
    }
    
    .page:not(.hidden) {
      display: block !important;
    }
  `;
  
  // 문서에 스타일 추가
  document.head.appendChild(style);
  console.log('네비게이션 스타일 추가됨');
}

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
  
  // 네비게이션 백업 초기화
  try {
    // 기본 네비게이션 백업 로직 구현
    initNavigation();
  } catch (navError) {
    console.error('백업 네비게이션 초기화 오류:', navError);
    // 완전 백업 네비게이션
    initBackupNavigation();
  }
}

// 완전 백업 네비게이션 초기화 함수
function initBackupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  
  console.log('완전 백업 네비게이션 초기화: 탭 수', navItems.length);
  
  // 초기 페이지 표시
  if (pages.length > 0) {
    pages.forEach(page => page.classList.add('hidden'));
    if (pages[0]) {
      pages[0].classList.remove('hidden');
    }
  }
  
  // 네비게이션 아이템 이벤트 리스너 추가
  navItems.forEach(item => {
    // 이미 있을 수 있는 이벤트 리스너 제거
    const newItem = item.cloneNode(true); // 깊은 복제 (모든 자식 요소 포함)
    item.parentNode.replaceChild(newItem, item);
    
    // 새 요소에 이벤트 리스너 추가
    newItem.addEventListener('click', function() {
      const pageId = this.getAttribute('data-page');
      if (!pageId) return;
      
      // 모든 탭 비활성화
      navItems.forEach(tab => tab.classList.remove('active'));
      
      // 선택된 탭 활성화
      this.classList.add('active');
      
      // 모든 페이지 숨기기
      pages.forEach(page => page.classList.add('hidden'));
      
      // 선택된 페이지 표시
      const targetPage = document.getElementById(`${pageId}-page`);
      if (targetPage) {
        targetPage.classList.remove('hidden');
      }
      
      // 페이지 제목 업데이트
      const pageTitle = document.getElementById('page-title');
      if (pageTitle) {
        switch (pageId) {
          case 'dashboard': pageTitle.textContent = '대시보드'; break;
          case 'users': pageTitle.textContent = '사용자 관리'; break;
          case 'capture': pageTitle.textContent = '캡처 설정'; break;
          case 'logs': pageTitle.textContent = '활동 로그'; break;
          case 'settings': pageTitle.textContent = '설정'; break;
          default: pageTitle.textContent = '데스크탑 컨트롤러';
        }
      }
    });
  });
  
  // 첫 번째 탭 활성화
  const firstTab = document.querySelector('.nav-item');
  if (firstTab) {
    firstTab.classList.add('active');
  }
  
  // 네비게이션 스타일 직접 추가
  addNavigationStyle();
  
  console.log('완전 백업 네비게이션 초기화 완료');
}