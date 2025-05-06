// captureManager.js
// 화면 캡처 관리 모듈

const { screen, desktopCapturer } = require('electron');
const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// 변수 초기화
let mainWindow;
let store;
let captureArea = null;
let captureHistory = [];

/**
 * 캡처 관리자 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 */
function init(configStore, window) {
  store = configStore;
  mainWindow = window;
  
  // 저장된 캡처 영역 로드
  captureArea = store.get('captureArea');
  
  // 캡처 저장 디렉토리 생성
  const captureDir = path.join(app.getPath('userData'), 'captures');
  if (!fs.existsSync(captureDir)) {
    fs.mkdirSync(captureDir, { recursive: true });
  }
}

/**
 * 화면 캡처 수행
 * @returns {Promise<string|null>} 캡처된 이미지 데이터 (Base64) 또는 null
 */
async function captureScreen() {
  try {
    // 캡처 영역이 설정되지 않았으면 실패
    if (!captureArea) {
      throw new Error('캡처 영역이 설정되지 않았습니다.');
    }
    
    // 화면 캡처
    const imgPath = await screenshot({
      format: 'png'
    });
    
    // 이미지 데이터 읽기
    const imgBuffer = fs.readFileSync(imgPath);
    
    // Base64로 변환
    const imgBase64 = imgBuffer.toString('base64');
    
    // 캡처 영역에 따라 이미지 자르기
    // (실제 구현에서는 이미지 처리 라이브러리를 사용하여 이미지를 자르는 코드 추가)
    
    // 캡처 기록 추가
    const captureId = Date.now().toString();
    const captureInfo = {
      id: captureId,
      timestamp: new Date().toISOString(),
      path: path.join(app.getPath('userData'), 'captures', `${captureId}.png`),
      size: imgBuffer.length,
      sent: false
    };
    
    captureHistory.push(captureInfo);
    
    // 원본 이미지 저장 (캡처 폴더에)
    fs.writeFileSync(captureInfo.path, imgBuffer);
    
    return imgBase64;
  } catch (err) {
    console.error('화면 캡처 오류:', err);
    return null;
  }
}

/**
 * 캡처 영역 선택하기
 * @returns {Promise<Object|null>} 선택된 영역 정보 또는 null
 */
async function selectCaptureArea() {
  return new Promise((resolve, reject) => {
    try {
      // 모든 화면 캡처 시작
      desktopCapturer.getSources({ types: ['screen'] })
        .then(async sources => {
          // 첫 번째 화면 선택 (여러 모니터가 있는 경우 추가 처리 필요)
          const mainSource = sources[0];
          
          // 영역 선택 창 표시 (임시 구현: 미리 정의된 영역 반환)
          // 실제 구현에서는 영역 선택 UI를 표시하고 사용자가 영역을 직접 선택하도록 해야 함
          const displays = screen.getAllDisplays();
          const primaryDisplay = displays[0];
          
          // 기본 영역: 전체 화면의 중앙 부분
          const defaultArea = {
            x: Math.floor(primaryDisplay.bounds.width * 0.25),
            y: Math.floor(primaryDisplay.bounds.height * 0.25),
            width: Math.floor(primaryDisplay.bounds.width * 0.5),
            height: Math.floor(primaryDisplay.bounds.height * 0.5)
          };
          
          // 영역 정보 저장
          captureArea = defaultArea;
          
          // 결과 반환
          resolve(defaultArea);
        })
        .catch(err => {
          reject(err);
        });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 캡처 영역 설정하기
 * @param {Object} area 캡처 영역 정보 (x, y, width, height)
 */
function setCaptureArea(area) {
  if (!area || !area.x || !area.y || !area.width || !area.height) {
    return false;
  }
  
  captureArea = area;
  store.set('captureArea', area);
  return true;
}

/**
 * 캡처 영역 가져오기
 * @returns {Object|null} 캡처 영역 정보 또는 null
 */
function getCaptureArea() {
  return captureArea;
}

/**
 * 캡처 이미지를 클라이언트에 전송
 * @param {string} socketId 소켓 ID
 * @param {string} base64Image 이미지 데이터 (Base64)
 */
function sendCaptureToClient(socketId, base64Image) {
  try {
    // 소켓 매니저 가져오기
    const socketManager = require('../server/socketManager');
    
    // 캡처된 이미지가 없으면 오류
    if (!base64Image) {
      throw new Error('이미지 데이터가 없습니다.');
    }
    
    // 최근 캡처 정보 찾기
    const captureInfo = captureHistory[captureHistory.length - 1];
    
    // 캡처 정보 업데이트
    if (captureInfo) {
      captureInfo.sent = true;
    }
    
    // 캡처 이미지 전송
    socketManager.sendToClient(socketId, 'capture-result', {
      success: true,
      image: base64Image,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (err) {
    console.error('캡처 이미지 전송 오류:', err);
    return false;
  }
}

/**
 * 캡처 품질 설정에 따라 이미지 최적화
 * @param {string} base64Image 원본 이미지 데이터 (Base64)
 * @param {string} quality 이미지 품질 ('high', 'medium', 'low')
 * @returns {string} 최적화된 이미지 데이터 (Base64)
 */
function optimizeImage(base64Image, quality = 'medium') {
  // 이 함수는 실제 구현에서 이미지 처리 라이브러리를 사용하여
  // 이미지 크기와 품질을 조정하는 코드를 추가해야 함
  // 현재는 원본 이미지를 그대로 반환
  return base64Image;
}

/**
 * 최근 캡처 목록 가져오기
 * @param {number} limit 가져올 개수 (기본값: 10)
 * @returns {Array} 캡처 정보 배열
 */
function getRecentCaptures(limit = 10) {
  return captureHistory.slice(-limit);
}

// 모듈 내보내기
module.exports = {
  init,
  captureScreen,
  selectCaptureArea,
  setCaptureArea,
  getCaptureArea,
  sendCaptureToClient,
  optimizeImage,
  getRecentCaptures
};