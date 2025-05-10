/**
 * capture.js
 * 캡처 관련 기능
 */

const { ipcRenderer } = require('electron');
const { showToast } = require('../ui/toast');
const { showConfirmModal } = require('../ui/modal');
const { formatDateTime } = require('../utils/formatters');

// DOM 요소
let selectCaptureAreaBtn, autoDetectBtn, testCaptureBtn, resetCaptureAreaBtn;
let captureSelectorOverlay, captureSelection;
let captureX, captureY, captureWidth, captureHeight, captureAreaPreview;
let captureQuality, captureDelay, autoCapture, autoSend, saveCaptureSettings;
let recentCaptures;

// 상태 변수
let captureArea = null;
let captureSelectorActive = false;
let selectionStart = { x: 0, y: 0 };
let captureHistoryData = [];

/**
 * 캡처 관련 DOM 요소 초기화
 */
function initCaptureElements() {
  selectCaptureAreaBtn = document.getElementById('select-capture-area-btn');
  autoDetectBtn = document.getElementById('auto-detect-btn');
  testCaptureBtn = document.getElementById('test-capture-btn');
  resetCaptureAreaBtn = document.getElementById('reset-capture-area-btn');
  captureSelectorOverlay = document.getElementById('capture-selector-overlay');
  captureSelection = document.getElementById('capture-selection');
  captureX = document.getElementById('capture-x');
  captureY = document.getElementById('capture-y');
  captureWidth = document.getElementById('capture-width');
  captureHeight = document.getElementById('capture-height');
  captureAreaPreview = document.getElementById('capture-area-preview');
  captureQuality = document.getElementById('capture-quality');
  captureDelay = document.getElementById('capture-delay');
  autoCapture = document.getElementById('auto-capture');
  autoSend = document.getElementById('auto-send');
  saveCaptureSettings = document.getElementById('save-capture-settings');
  recentCaptures = document.getElementById('recent-captures');
  
  // 이벤트 리스너 설정
  selectCaptureAreaBtn.addEventListener('click', showCaptureSelector);
  autoDetectBtn.addEventListener('click', detectCaptureArea);
  testCaptureBtn.addEventListener('click', testCapture);
  resetCaptureAreaBtn.addEventListener('click', resetCaptureArea);
  saveCaptureSettings.addEventListener('click', saveCaptureSettingsToStore);
}

/**
 * 캡처 영역 로드
 */
function loadCaptureArea() {
  ipcRenderer.send('get-capture-area');
  
  // 캡처 영역 로드 결과 이벤트 리스너
  ipcRenderer.once('capture-area', (event, area) => {
    captureArea = area;
    setCaptureAreaPreview(area);
  });
  
  // 캡처 설정 로드
  ipcRenderer.send('get-capture-settings');
  
  // 캡처 설정 로드 결과 이벤트 리스너
  ipcRenderer.once('capture-settings', (event, settings) => {
    captureQuality.value = settings.quality || 'medium';
    captureDelay.value = settings.delay || 2;
    autoCapture.checked = settings.autoCapture !== false;
    autoSend.checked = settings.autoSend !== false;
  });
}

/**
 * 최근 캡처 목록 로드
 */
function loadRecentCaptures() {
  ipcRenderer.send('get-capture-history');
  
  // 캡처 기록 로드 결과 이벤트 리스너
  ipcRenderer.once('capture-history', (event, history) => {
    captureHistoryData = history;
    renderCaptureHistory();
  });
}

/**
 * 캡처 기록 렌더링
 */
function renderCaptureHistory() {
  recentCaptures.innerHTML = '';
  
  if (captureHistoryData.length === 0) {
    // 캡처 기록이 없는 경우
    recentCaptures.innerHTML = '<div class="empty-list-message">캡처 기록이 없습니다</div>';
  } else {
    // 캡처 기록 생성 (최신 5개만 표시)
    captureHistoryData.slice(0, 5).forEach(capture => {
      const captureItem = document.createElement('div');
      captureItem.className = 'capture-item';
      
      const captureImage = document.createElement('img');
      captureImage.className = 'capture-image';
      captureImage.src = capture.imageData;
      captureImage.alt = '캡처 이미지';
      
      const captureInfo = document.createElement('div');
      captureInfo.className = 'capture-info';
      
      const captureTime = document.createElement('div');
      captureTime.className = 'capture-time';
      captureTime.textContent = formatDateTime(capture.timestamp);
      
      captureInfo.appendChild(captureTime);
      
      const captureActions = document.createElement('div');
      captureActions.className = 'capture-actions';
      
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-icon';
      viewBtn.title = '보기';
      viewBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
      viewBtn.addEventListener('click', () => {
        showCaptureImage(capture);
      });
      
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-icon';
      saveBtn.title = '저장';
      saveBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>';
      saveBtn.addEventListener('click', () => {
        saveCapture(capture);
      });
      
      captureActions.appendChild(viewBtn);
      captureActions.appendChild(saveBtn);
      
      captureItem.appendChild(captureImage);
      captureItem.appendChild(captureInfo);
      captureItem.appendChild(captureActions);
      
      recentCaptures.appendChild(captureItem);
    });
  }
}

/**
 * 캡처 이미지 표시
 * @param {Object} capture 캡처 정보
 */
function showCaptureImage(capture) {
  // 모달 제목 설정
  const modalTitle = document.getElementById('modal-title');
  modalTitle.textContent = '캡처 이미지';
  
  // 모달 내용 생성
  const modalBody = document.getElementById('modal-body');
  const content = `
    <div class="capture-view">
      <img src="${capture.imageData}" alt="캡처 이미지" class="capture-view-image">
      <div class="capture-view-info">
        <div>캡처 시간: ${formatDateTime(capture.timestamp)}</div>
      </div>
    </div>
  `;
  
  // 모달 내용 설정
  modalBody.innerHTML = content;
  
  // 모달 푸터 버튼 이벤트 설정
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  modalConfirmBtn.textContent = '저장';
  modalConfirmBtn.onclick = () => {
    saveCapture(capture);
  };
  
  // 모달 표시
  require('../ui/modal').showModal();
}

/**
 * 캡처 저장
 * @param {Object} capture 캡처 정보
 */
function saveCapture(capture) {
  ipcRenderer.send('save-capture', capture);
  
  // 캡처 저장 결과 이벤트 리스너
  ipcRenderer.once('save-capture-result', (event, result) => {
    if (result.success) {
      showToast('캡처 이미지가 저장되었습니다.', 'success');
    } else {
      showToast('캡처 이미지 저장에 실패했습니다.', 'error');
    }
  });
}

/**
 * 캡처 영역 미리보기 설정
 * @param {Object} area 캡처 영역 정보
 */
function setCaptureAreaPreview(area) {
  if (!area) {
    captureX.textContent = '0';
    captureY.textContent = '0';
    captureWidth.textContent = '0';
    captureHeight.textContent = '0';
    captureAreaPreview.style.width = '0';
    captureAreaPreview.style.height = '0';
    captureAreaPreview.style.left = '0';
    captureAreaPreview.style.top = '0';
    return;
  }
  
  // 영역 정보 표시
  captureX.textContent = area.x;
  captureY.textContent = area.y;
  captureWidth.textContent = area.width;
  captureHeight.textContent = area.height;
  
  // 미리보기 크기 및 위치 조정
  const previewContainer = document.querySelector('.capture-preview');
  const containerWidth = previewContainer.clientWidth;
  const containerHeight = previewContainer.clientHeight;
  
  // 화면 크기 비율 계산
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // 비율 계산
  const widthRatio = containerWidth / screenWidth;
  const heightRatio = containerHeight / screenHeight;
  const ratio = Math.min(widthRatio, heightRatio);
  
  // 미리보기 영역 크기 및 위치 설정
  const previewWidth = area.width * ratio;
  const previewHeight = area.height * ratio;
  const previewLeft = area.x * ratio;
  const previewTop = area.y * ratio;
  
  captureAreaPreview.style.width = `${previewWidth}px`;
  captureAreaPreview.style.height = `${previewHeight}px`;
  captureAreaPreview.style.left = `${previewLeft}px`;
  captureAreaPreview.style.top = `${previewTop}px`;
}

/**
 * 캡처 영역 선택기 표시
 */
function showCaptureSelector() {
  // 캡처 선택기 오버레이 표시
  captureSelectorOverlay.style.display = 'block';
  captureSelectorActive = true;
  
  // 캡처 선택기 상태 초기화
  captureSelection.style.width = '0';
  captureSelection.style.height = '0';
  captureSelection.style.left = '0';
  captureSelection.style.top = '0';
  
  // 마우스 이벤트 리스너 등록
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
  
  // 토스트 메시지 표시
  showToast('캡처할 영역을 마우스로 선택하세요. (ESC 키를 누르면 취소)', 'info');
}

/**
 * 캡처 선택기 닫기
 */
function closeCaptureSelector() {
  captureSelectorOverlay.style.display = 'none';
  captureSelectorActive = false;
  
  // 이벤트 리스너 제거
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);
}

/**
 * 마우스 다운 이벤트 처리
 * @param {MouseEvent} e 마우스 이벤트
 */
function handleMouseDown(e) {
  if (!captureSelectorActive) return;
  
  // 마우스 시작 위치 저장
  selectionStart = {
    x: e.clientX,
    y: e.clientY
  };
  
  // 선택 영역 표시 시작
  captureSelection.style.left = `${selectionStart.x}px`;
  captureSelection.style.top = `${selectionStart.y}px`;
  captureSelection.style.width = '0';
  captureSelection.style.height = '0';
  captureSelection.style.display = 'block';
}

/**
 * 마우스 무브 이벤트 처리
 * @param {MouseEvent} e 마우스 이벤트
 */
function handleMouseMove(e) {
  if (!captureSelectorActive || !selectionStart) return;
  
  // 현재 마우스 위치
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  // 선택 영역 크기 계산
  const width = Math.abs(currentX - selectionStart.x);
  const height = Math.abs(currentY - selectionStart.y);
  
  // 선택 영역 좌표 계산
  const left = Math.min(currentX, selectionStart.x);
  const top = Math.min(currentY, selectionStart.y);
  
  // 선택 영역 스타일 업데이트
  captureSelection.style.width = `${width}px`;
  captureSelection.style.height = `${height}px`;
  captureSelection.style.left = `${left}px`;
  captureSelection.style.top = `${top}px`;
}

/**
 * 마우스 업 이벤트 처리
 * @param {MouseEvent} e 마우스 이벤트
 */
function handleMouseUp(e) {
  if (!captureSelectorActive || !selectionStart) return;
  
  // 현재 마우스 위치
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  // 선택 영역 크기 계산
  const width = Math.abs(currentX - selectionStart.x);
  const height = Math.abs(currentY - selectionStart.y);
  
  // 선택 영역 좌표 계산
  const left = Math.min(currentX, selectionStart.x);
  const top = Math.min(currentY, selectionStart.y);
  
  // 최소 크기 확인 (최소 10x10 픽셀 이상)
  if (width < 10 || height < 10) {
    showToast('캡처 영역이 너무 작습니다. 더 크게 선택해 주세요.', 'error');
    return;
  }
  
  // 슬라이더 전체 영역의 좌표와 크기 계산
  const screenX = Math.round(left);
  const screenY = Math.round(top);
  const screenWidth = Math.round(width);
  const screenHeight = Math.round(height);
  
  // 캡처 영역 설정
  const captureArea = {
    x: screenX,
    y: screenY,
    width: screenWidth,
    height: screenHeight
  };
  
  // 캡처 영역 저장
  ipcRenderer.send('set-capture-area', captureArea);
  
  // 캡처 영역 미리보기 업데이트
  setCaptureAreaPreview(captureArea);
  
  // 캡처 선택기 닫기
  closeCaptureSelector();
  
  // 토스트 메시지 표시
  showToast('캡처 영역이 설정되었습니다.', 'success');
}

/**
 * 키 입력 이벤트 처리
 * @param {KeyboardEvent} e 키보드 이벤트
 */
function handleKeyDown(e) {
  if (!captureSelectorActive) return;
  
  // ESC 키를 누르면 캡처 선택기 닫기
  if (e.key === 'Escape') {
    closeCaptureSelector();
    showToast('캡처 영역 선택이 취소되었습니다.', 'info');
  }
  
  // Enter 키를 누르면 현재 선택된 영역 적용
  if (e.key === 'Enter') {
    // 현재 선택된 영역 정보 가져오기
    const style = captureSelection.style;
    const left = parseInt(style.left, 10);
    const top = parseInt(style.top, 10);
    const width = parseInt(style.width, 10);
    const height = parseInt(style.height, 10);
    
    // 최소 크기 확인
    if (width < 10 || height < 10) {
      showToast('캡처 영역이 너무 작습니다. 더 크게 선택해 주세요.', 'error');
      return;
    }
    
    // 캡처 영역 설정
    const captureArea = {
      x: left,
      y: top,
      width: width,
      height: height
    };
    
    // 캡처 영역 저장
    ipcRenderer.send('set-capture-area', captureArea);
    
    // 캡처 영역 미리보기 업데이트
    setCaptureAreaPreview(captureArea);
    
    // 캡처 선택기 닫기
    closeCaptureSelector();
    
    // 토스트 메시지 표시
    showToast('캡처 영역이 설정되었습니다.', 'success');
  }
}

/**
 * 캡처 영역 자동 감지
 */
function detectCaptureArea() {
  ipcRenderer.send('detect-capture-area');
  
  // 토스트 메시지 표시
  showToast('캡처 영역을 자동으로 감지 중입니다...', 'info');
  
  // 캡처 영역 감지 결과 이벤트 리스너
  ipcRenderer.once('detect-capture-area-result', (event, result) => {
    if (result.success) {
      captureArea = result.area;
      setCaptureAreaPreview(result.area);
      showToast('캡처 영역이 자동으로 감지되었습니다.', 'success');
    } else {
      showToast('캡처 영역 자동 감지에 실패했습니다.', 'error');
    }
  });
}

/**
 * 테스트 캡처 수행
 */
function testCapture() {
  if (!captureArea) {
    showToast('캡처 영역이 설정되지 않았습니다. 먼저 캡처 영역을 선택하세요.', 'error');
    return;
  }
  
  ipcRenderer.send('test-capture');
  
  // 토스트 메시지 표시
  showToast('테스트 캡처를 수행 중입니다...', 'info');
  
  // 테스트 캡처 결과 이벤트 리스너
  ipcRenderer.once('test-capture-result', (event, result) => {
    if (result.success) {
      // 이미지 정보 저장
      const captureInfo = {
        id: Date.now().toString(),
        timestamp: result.timestamp,
        imageData: result.image
      };
      
      // 캡처 기록에 추가
      addCaptureHistory(captureInfo);
      
      showToast('테스트 캡처가 완료되었습니다.', 'success');
    } else {
      showToast('테스트 캡처에 실패했습니다.', 'error');
    }
  });
}

/**
 * 캡처 기록에 추가
 * @param {Object} capture 캡처 정보
 */
function addCaptureHistory(capture) {
  // 캡처 기록에 추가
  captureHistoryData.unshift(capture);
  
  // 최대 20개까지만 유지
  if (captureHistoryData.length > 20) {
    captureHistoryData = captureHistoryData.slice(0, 20);
  }
  
  // 캡처 기록 저장
  ipcRenderer.send('save-capture-history', captureHistoryData);
  
  // 캡처 기록 렌더링
  renderCaptureHistory();
}

/**
 * 캡처 영역 초기화
 */
function resetCaptureArea() {
  // 캡처 영역 초기화 전 확인
  showConfirmModal(
    '캡처 영역 초기화',
    '캡처 영역을 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.',
    () => {
      ipcRenderer.send('reset-capture-area');
      
      // 캡처 영역 초기화
      captureArea = null;
      setCaptureAreaPreview(null);
      
      showToast('캡처 영역이 초기화되었습니다.', 'info');
    }
  );
}

/**
 * 캡처 설정 저장
 */
function saveCaptureSettingsToStore() {
  // 캡처 설정 저장 요청
  ipcRenderer.send('save-capture-settings', {
    quality: captureQuality.value,
    delay: parseFloat(captureDelay.value),
    autoCapture: autoCapture.checked,
    autoSend: autoSend.checked
  });
  
  // 토스트 메시지 표시
  showToast('캡처 설정이 저장되었습니다.', 'success');
}

module.exports = {
  initCaptureElements,
  loadCaptureArea,
  loadRecentCaptures,
  setCaptureAreaPreview,
  showCaptureSelector,
  closeCaptureSelector,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleKeyDown,
  detectCaptureArea,
  testCapture,
  resetCaptureArea,
  saveCaptureSettingsToStore,
  addCaptureHistory
};
