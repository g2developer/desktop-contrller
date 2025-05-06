const screenshot = require('screenshot-desktop');
const socketManager = require('../server/socketManager');

// 변수 초기화
let store;
let mainWindow;
let captureArea = { x: 0, y: 0, width: 800, height: 600 };

/**
 * 캡처 매니저 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 */
function init(configStore, window) {
  store = configStore;
  mainWindow = window;
  
  // 저장된 캡처 영역 가져오기
  captureArea = store.get('captureArea') || { x: 0, y: 0, width: 800, height: 600 };
}

/**
 * AI 응답 영역 캡처 함수
 * @returns {Buffer|null} 캡처 이미지 버퍼 또는 null
 */
async function captureAIResponseArea() {
  try {
    // 전체 화면 캡처
    const fullScreenshot = await screenshot();
    
    // 저장된 캡처 영역 좌표 사용
    const { x, y, width, height } = captureArea;
    
    // 이미지 처리를 위한 추가 라이브러리 필요
    // 여기서는 단순 전체 스크린샷만 반환하지만,
    // 실제로는 이미지 처리 라이브러리(예: jimp, sharp)를 사용하여 특정 영역만 추출해야 함
    // 예시: const croppedImage = await sharp(fullScreenshot).extract({ left: x, top: y, width, height }).toBuffer();
    
    // 개발 단계에서는 전체 스크린샷 반환
    return fullScreenshot;
  } catch (err) {
    console.error('화면 캡처 오류:', err);
    if (mainWindow) {
      mainWindow.webContents.send('capture-error', {
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    return null;
  }
}

/**
 * 캡처 영역 설정
 * @param {Object} area 캡처 영역 {x, y, width, height}
 * @returns {Object} 결과 객체 {success, message, area}
 */
function setCaptureArea(area) {
  try {
    // 유효성 검사
    if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' || 
        typeof area.width !== 'number' || typeof area.height !== 'number') {
      return { success: false, message: '유효하지 않은 캡처 영역입니다.' };
    }
    
    // 캡처 영역 저장
    captureArea = area;
    store.set('captureArea', area);
    
    return { success: true, area };
  } catch (err) {
    console.error('캡처 영역 설정 오류:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 캡처 영역 가져오기
 * @returns {Object} 캡처 영역 {x, y, width, height}
 */
function getCaptureArea() {
  return captureArea;
}

/**
 * 캡처한 이미지를 클라이언트에게 전송
 * @param {string} clientId 클라이언트 ID
 * @param {Buffer} imageBuffer 이미지 버퍼
 * @param {string} command 실행 명령어
 * @returns {boolean} 전송 성공 여부
 */
function sendCaptureToClient(clientId, imageBuffer, command) {
  try {
    if (!imageBuffer) return false;
    
    // 클라이언트에게 스크린샷 전송
    const success = socketManager.sendToClient(clientId, 'ai-response', { 
      image: imageBuffer.toString('base64'), 
      timestamp: new Date().toISOString(),
      command
    });
    
    if (success && mainWindow) {
      // 화면 캡처 기록 저장
      const clientInfo = socketManager.getClient(clientId);
      const captureRecord = {
        commandId: new Date().getTime().toString(),
        clientId,
        username: clientInfo ? clientInfo.username : '알 수 없음',
        command,
        timestamp: new Date().toISOString(),
        size: Math.round(imageBuffer.length / 1024) + ' KB',
        status: 'sent'
      };
      
      // 데스크탑 앱에 캡처 알림
      mainWindow.webContents.send('capture-taken', captureRecord);
    }
    
    return success;
  } catch (err) {
    console.error('캡처 전송 오류:', err);
    return false;
  }
}

// 모듈 내보내기
module.exports = {
  init,
  captureAIResponseArea,
  setCaptureArea,
  getCaptureArea,
  sendCaptureToClient
};