const { spawn } = require('child_process');
const fs = require('fs');
const robotjs = require('robotjs');
const socketManager = require('../server/socketManager');
const captureManager = require('./captureManager');

// 변수 초기화
let store;
let mainWindow;
let autoClickEnabled = true;

/**
 * 클로드 앱 관리자 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 */
function init(configStore, window) {
  store = configStore;
  mainWindow = window;
}

/**
 * 특정 텍스트가 있는 버튼 찾기 및 클릭 함수
 */
async function findAndClickButton() {
  if (!autoClickEnabled) return;

  try {
    // 화면 캡처
    const img = await captureManager.captureAIResponseArea();
    
    // 이미지 처리를 통해 버튼 위치 찾기
    // 실제 구현에서는 이미지 처리 라이브러리(예: OpenCV, Tesseract OCR)를 사용하여 
    // "권한 허용" 또는 "계속하기" 텍스트가 있는 버튼 영역을 찾아야 함
    
    // 여기서는 예시로, 버튼이 항상 특정 위치에 있다고 가정
    const buttonPositions = [
      // "권한 허용" 버튼 추정 위치 (x, y)
      { x: 700, y: 500, text: "권한 허용" },
      // "계속하기" 버튼 추정 위치 (x, y)
      { x: 700, y: 550, text: "계속하기" }
    ];
    
    // 실제 구현에서는 화면에서 버튼을 찾아야 함
    // 예시: 이미지 인식을 통해 찾은 버튼 위치
    const foundButtons = buttonPositions; // 실제 구현에서는 이미지 인식 결과
    
    // 각 버튼 위치로 마우스 이동 및 클릭
    for (const button of foundButtons) {
      console.log(`'${button.text}' 버튼을 찾았습니다. 클릭 시도...`);
      
      // 마우스 이동 및 클릭
      robotjs.moveMouse(button.x, button.y);
      robotjs.mouseClick();
      
      // 이벤트 로그
      if (mainWindow) {
        mainWindow.webContents.send('auto-click-event', {
          text: button.text,
          x: button.x,
          y: button.y,
          timestamp: new Date().toISOString()
        });
      }
      
      // 버튼 간 클릭 지연
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    console.error('자동 버튼 클릭 오류:', err);
  }
}

/**
 * 클로드 앱 제어 함수
 * @param {string} command 실행할 명령어
 * @param {string} clientId 클라이언트 ID
 * @returns {boolean} 명령 실행 성공 여부
 */
async function controlClaudeApp(command, clientId) {
  try {
    // 설정에서 클로드 앱 경로 가져오기
    const claudePath = store.get('claudePath') || '';
    const captureDelay = store.get('captureDelay') || 2; // 기본 2초 딜레이
    const autoCapture = store.get('autoCaptureAfter') !== false; // 기본값 true
    
    // 클라이언트에게 명령 처리 시작 알림
    socketManager.sendToClient(clientId, 'command-processing', {
      command,
      timestamp: new Date().toISOString()
    });
    
    // 데스크탑 앱에 명령 실행 알림
    if (mainWindow) {
      const clientInfo = socketManager.getClient(clientId);
      mainWindow.webContents.send('command-processing', {
        clientId,
        username: clientInfo ? clientInfo.username : '알 수 없음',
        command,
        timestamp: new Date().toISOString()
      });
    }
    
    // 클로드 앱 존재 여부 확인
    let claudeAppExists = true;
    if (claudePath && claudePath.trim() !== '') {
      try {
        fs.accessSync(claudePath, fs.constants.F_OK);
      } catch (e) {
        claudeAppExists = false;
        throw new Error('클로드 앱 경로가 올바르지 않습니다. 설정에서 경로를 확인해주세요.');
      }
    } else {
      // 경로가 설정되지 않은 경우 기본값 사용
      claudeAppExists = false;
    }
    
    // 클로드 앱 실행 (실제 경로로 변경 필요)
    if (claudeAppExists) {
      spawn('start', [claudePath], { shell: true });
    } else {
      // 개발 단계에서는 앱이 없어도 진행
      console.log('클로드 앱 경로가 설정되지 않았습니다. 개발 모드로 진행합니다.');
    }
    
    // 잠시 대기 후 명령어 입력 (앱 로딩 시간 고려)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 채팅창에 명령어 입력
    robotjs.typeString(command);
    // 엔터키 입력
    robotjs.keyTap('enter');
    
    // 자동 버튼 클릭 모니터링 시작
    const checkInterval = setInterval(async () => {
      await findAndClickButton();
    }, 2000); // 2초마다 확인
    
    // AI 응답 대기 후 캡처
    const captureDelayMs = captureDelay * 1000;
    setTimeout(async () => {
      // 자동 버튼 클릭 모니터링 종료
      clearInterval(checkInterval);
      
      // 자동 캡처 설정이 활성화된 경우만 캡처 진행
      if (autoCapture) {
        const screenshotImg = await captureManager.captureAIResponseArea();
        if (screenshotImg) {
          // 클라이언트에게 스크린샷 전송
          captureManager.sendCaptureToClient(clientId, screenshotImg, command);
        }
      }
      
      // 명령 처리 완료 알림
      socketManager.sendToClient(clientId, 'command-completed', {
        command,
        timestamp: new Date().toISOString()
      });
      
      // 데스크탑 앱에 명령 완료 알림
      if (mainWindow) {
        const clientInfo = socketManager.getClient(clientId);
        mainWindow.webContents.send('command-completed', {
          clientId,
          username: clientInfo ? clientInfo.username : '알 수 없음',
          command,
          timestamp: new Date().toISOString()
        });
      }
      
    }, captureDelayMs + 8000); // 기본 8초 + 설정된 딜레이 (AI 응답 시간 고려)
    
    return true;
  } catch (err) {
    console.error('클로드 앱 제어 오류:', err);
    
    // 클라이언트에게 오류 알림
    socketManager.sendToClient(clientId, 'command-error', {
      command,
      error: err.message,
      timestamp: new Date().toISOString()
    });
    
    // 데스크탑 앱에 오류 알림
    if (mainWindow) {
      const clientInfo = socketManager.getClient(clientId);
      mainWindow.webContents.send('command-error', {
        clientId,
        username: clientInfo ? clientInfo.username : '알 수 없음',
        command,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    
    return false;
  }
}

/**
 * 자동 버튼 클릭 기능 활성화/비활성화
 * @param {boolean} enabled 활성화 여부
 */
function setAutoClickEnabled(enabled) {
  autoClickEnabled = enabled;
}

/**
 * 자동 버튼 클릭 상태 가져오기
 * @returns {boolean} 활성화 여부
 */
function getAutoClickEnabled() {
  return autoClickEnabled;
}

// 모듈 내보내기
module.exports = {
  init,
  controlClaudeApp,
  setAutoClickEnabled,
  getAutoClickEnabled
};