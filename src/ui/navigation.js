/**
 * navigation.js
 * 내비게이션 관련 기능
 */

const { ipcRenderer } = require('electron');

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
}

/**
 * 내비게이션 초기화
 */
function initNavigation() {
  initNavElements();
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      navigateToPage(page);
    });
  });
}

/**
 * 페이지 이동
 * @param {string} page 페이지 ID
 */
function navigateToPage(page) {
  // 현재 활성화된 내비게이션 아이템에서 active 클래스 제거
  navItems.forEach(item => {
    item.classList.remove('active');
    
    // 클릭한 내비게이션 아이템에 active 클래스 추가
    if (item.getAttribute('data-page') === page) {
      item.classList.add('active');
    }
  });
  
  // 모든 페이지 숨기기
  pages.forEach(p => {
    p.classList.add('hidden');
  });
  
  // 선택한 페이지 표시
  const selectedPage = document.getElementById(`${page}-page`);
  if (selectedPage) {
    selectedPage.classList.remove('hidden');
    
    // 페이지 제목 업데이트
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
    
    // 페이지별 초기화
    if (page === 'dashboard') {
      // 대시보드 페이지 진입 시 대시보드 초기화 (아직 초기화되지 않은 경우)
      if (!window.dashboard) {
        window.dashboard = new (require('../components/Dashboard'))();
      } else {
        // 서버 상태 및 클라이언트 목록 업데이트
        getServerStatus();
        ipcRenderer.send('get-clients');
      }
    } else if (page === 'users') {
      // 사용자 관리 페이지 진입 시 사용자 목록 로드
      require('../features/users').loadUsers();
    } else if (page === 'capture') {
      // 캡처 설정 페이지 진입 시 캡처 영역 로드
      require('../features/capture').loadCaptureArea();
      require('../features/capture').loadRecentCaptures();
    } else if (page === 'logs') {
      // 활동 로그 페이지 진입 시 전체 로그 표시
      renderFullActivityLog();
    } else if (page === 'settings') {
      // 설정 페이지 진입 시 설정 로드
      require('../features/settings').loadSettings();
    }
  }
  
  // 현재 페이지 업데이트
  currentPage = page;
}

// 서버 상태 조회
function getServerStatus() {
  ipcRenderer.send('get-server-status');
}

module.exports = {
  initNavElements,
  initNavigation,
  navigateToPage,
  getServerStatus,
  getCurrentPage: () => currentPage
};
