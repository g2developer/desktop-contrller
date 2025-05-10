/**
 * navigation.js
 * 내비게이션 관련 기능
 */

// DOM 요소
let navItems, pages, pageTitle;
let currentPage = 'dashboard';

/**
 * 내비게이션 DOM 요소 초기화
 */
function initNavElements() {
  navItems = document.querySelectorAll('.nav-item');
  pages = document.querySelectorAll('.page');
  pageTitle = document.getElementById('page-title');
  
  console.log(`내비게이션 요소 초기화: ${navItems.length}개 탭, ${pages.length}개 페이지 발견`);
}

/**
 * 내비게이션 초기화
 */
function initNavigation() {
  initNavElements();
  
  // 여러 탭이 동시에 활성화되는 문제 방지를 위한 CSS 스타일 추가
  addNavigationStyle();
  
  // 기존 탭 이벤트 리스너를 포함한 각 탭을 복제하여 교체
  navItems.forEach(item => {
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
    
    // 새로운 탭에 이벤트 리스너 추가
    newItem.addEventListener('click', () => {
      const page = newItem.getAttribute('data-page');
      console.log(`탭 클릭됨: ${page}`);
      navigateToPage(page);
    });
  });
  
  // 탭 참조 다시 가져오기
  navItems = document.querySelectorAll('.nav-item');
  
  // 처음 로드될 때 기본 탭으로 설정
  setTimeout(() => {
    // 이미 활성화된 페이지가 있는지 확인
    const activePage = document.querySelector('.page:not(.hidden)');
    if (!activePage) {
      // 대시보드로 기본 설정
      navigateToPage('dashboard');
    }
  }, 500);
  
  console.log('내비게이션 초기화 완료');
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

/**
 * 페이지 이동
 * @param {string} page 페이지 ID
 */
function navigateToPage(page) {
  // 모든 탭에서 active 클래스 제거
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // 해당 탭에 active 클래스 추가
  const selectedTab = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // 디버깅 확인
  const activeTabs = document.querySelectorAll('.nav-item.active');
  console.log(`활성화된 탭 수: ${activeTabs.length}개`);
  
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
        if (window.electronAPI && window.electronAPI.initDashboard) {
          window.electronAPI.initDashboard();
        }
        // 서버 상태 및 클라이언트 목록 업데이트
        getServerStatus();
        if (window.electronAPI && window.electronAPI.getClients) {
          window.electronAPI.getClients();
        }
      } else if (page === 'users') {
        // 사용자 관리 페이지 진입 시
        if (window.electronAPI && window.electronAPI.loadUsers) {
          window.electronAPI.loadUsers();
        }
      } else if (page === 'capture') {
        // 캡처 설정 페이지 진입 시
        if (window.electronAPI && window.electronAPI.loadCaptureArea) {
          window.electronAPI.loadCaptureArea();
        }
        if (window.electronAPI && window.electronAPI.loadRecentCaptures) {
          window.electronAPI.loadRecentCaptures();
        }
      } else if (page === 'logs') {
        // 활동 로그 페이지 진입 시
        if (window.electronAPI && window.electronAPI.renderFullActivityLog) {
          window.electronAPI.renderFullActivityLog();
        }
      } else if (page === 'settings') {
        // 설정 페이지 진입 시
        if (window.electronAPI && window.electronAPI.loadSettings) {
          window.electronAPI.loadSettings();
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

/**
 * 서버 상태 조회 (electronAPI 사용)
 */
function getServerStatus() {
  try {
    if (window.electronAPI && window.electronAPI.getServerStatus) {
      window.electronAPI.getServerStatus();
    } else {
      console.error('서버 상태 API를 찾을 수 없음');
    }
  } catch (error) {
    console.error('서버 상태 요청 실패:', error);
  }
}

module.exports = {
  initNavElements,
  initNavigation,
  navigateToPage,
  getServerStatus,
  getCurrentPage: () => currentPage
};
