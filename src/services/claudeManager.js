// claudeManager.js
// 클로드 앱 제어 모듈

const { exec } = require('child_process');
// const robot = require('robotjs');
const robot = require('@jitsi/robotjs');
const path = require('path');
const fs = require('fs');

// 변수 초기화
let mainWindow;
let store;
let commandQueue = [];
let isProcessing = false;

/**
 * 클로드 앱 매니저 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 */
function init(configStore, window) {
  store = configStore;
  mainWindow = window;
}

/**
 * 클로드 앱 실행 함수
 * @returns {Promise<boolean>} 실행 성공 여부
 */
async function launchClaudeApp() {
  return new Promise((resolve, reject) => {
    try {
      // 클로드 앱 경로 가져오기
      const claudePath = store.get('claudePath');
      
      // 경로가 없으면 실패
      if (!claudePath) {
        reject(new Error('클로드 앱 경로가 설정되지 않았습니다.'));
        return;
      }
      
      // 앱 실행
      exec(`"${claudePath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('클로드 앱 실행 오류:', error);
          reject(error);
          return;
        }
        
        // 앱이 시작될 때까지 대기 (실제 구현에서는 앱 실행 확인 로직 필요)
        setTimeout(() => {
          resolve(true);
        }, 2000);
      });
    } catch (err) {
      console.error('클로드 앱 실행 중 오류:', err);
      reject(err);
    }
  });
}

/**
 * 클로드 앱 찾기 함수
 * @returns {Promise<boolean>} 앱 찾기 성공 여부
 */
async function findClaudeWindow() {
  // 이 함수는 실제 구현에서 운영 체제별로 클로드 앱 창을 찾는 코드 추가 필요
  // 예: Windows에서는 사용자32.dll API, macOS에서는 AppleScript 등
  
  // 임시 구현: 항상 성공으로 처리
  return true;
}

/**
 * 클로드 앱 활성화 함수
 * @returns {Promise<boolean>} 활성화 성공 여부
 */
async function activateClaudeWindow() {
  try {
    // 앱 창 찾기
    const found = await findClaudeWindow();
    if (!found) {
      // 앱을 못 찾으면 실행
      await launchClaudeApp();
    }
    
    // 이 함수는 실제 구현에서 운영 체제별로 클로드 앱 창을 활성화하는 코드 추가 필요
    // 예: Windows에서는 SetForegroundWindow API, macOS에서는 AppleScript 등
    
    // 임시 구현: 항상 성공으로 처리
    return true;
  } catch (err) {
    console.error('클로드 앱 활성화 오류:', err);
    return false;
  }
}

/**
 * 클로드 앱 입력 필드 찾기 함수
 * @returns {boolean} 입력 필드 찾기 성공 여부
 */
function findInputField() {
  try {
    // 이 함수는 실제 구현에서 클로드 앱의 입력 필드 위치를 찾는 코드 추가 필요
    // 예: 화면 인식이나 미리 지정된 좌표 사용
    
    // 임시 구현: 화면 하단 중앙을 입력 필드로 가정하고 클릭
    const { width, height } = robot.getScreenSize();
    robot.moveMouse(width / 2, height - 100);
    robot.mouseClick();
    
    // 성공 반환
    return true;
  } catch (err) {
    console.error('입력 필드 찾기 오류:', err);
    return false;
  }
}

/**
 * 클로드 앱에 명령 입력 함수
 * @param {string} command 입력할 명령어
 * @returns {boolean} 입력 성공 여부
 */
function typeCommand(command) {
  try {
    // 텍스트 입력
    robot.typeString(command);
    
    // 엔터키 입력
    robot.keyTap('enter');
    
    return true;
  } catch (err) {
    console.error('명령 입력 오류:', err);
    return false;
  }
}

/**
 * 클로드 앱 응답 영역 캡처 함수
 * @returns {Promise<string|null>} 캡처된 이미지 데이터 (Base64) 또는 null
 */
async function captureResponse() {
  try {
    // 캡처 매니저 가져오기
    const captureManager = require('./captureManager');
    
    // 캡처 딜레이 설정 가져오기
    const captureDelay = store.get('captureDelay') || 2;
    
    // 응답이 표시될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, captureDelay * 1000));
    
    // 화면 캡처
    const imageData = await captureManager.captureScreen();
    
    return imageData;
  } catch (err) {
    console.error('응답 캡처 오류:', err);
    return null;
  }
}

/**
 * 클로드 앱 제어 함수 (메인)
 * @param {string} command 실행할 명령어
 * @param {string} socketId 요청한 클라이언트 소켓 ID
 */
async function controlClaudeApp(command, socketId) {
  // 명령을 큐에 추가
  commandQueue.push({ command, socketId, timestamp: new Date() });
  
  // 이미 처리 중이면 대기
  if (isProcessing) {
    return;
  }
  
  // 명령 처리 시작
  processCommandQueue();
}

/**
 * 명령 큐 처리 함수
 */
async function processCommandQueue() {
  // 처리 중 상태로 설정
  isProcessing = true;
  
  // 큐가 비어있으면 종료
  if (commandQueue.length === 0) {
    isProcessing = false;
    return;
  }
  
  // 큐에서 첫 번째 명령 가져오기
  const { command, socketId, timestamp } = commandQueue.shift();
  
  try {
    // 명령 처리 상태 업데이트
    if (mainWindow) {
      mainWindow.webContents.send('command-processing', {
        command,
        socketId,
        timestamp: timestamp.toISOString()
      });
    }
    
    // 소켓 매니저 가져오기
    const socketManager = require('../server/socketManager');
    
    // 클라이언트에게 처리 시작 알림
    if (socketId) {
      socketManager.sendToClient(socketId, 'command-processing', {
        command,
        timestamp: new Date().toISOString()
      });
    }
    
    // 클로드 앱 활성화
    const activated = await activateClaudeWindow();
    if (!activated) {
      throw new Error('클로드 앱 활성화에 실패했습니다.');
    }
    
    // 입력 필드 찾기
    const inputFound = findInputField();
    if (!inputFound) {
      throw new Error('입력 필드를 찾을 수 없습니다.');
    }
    
    // 명령 입력
    const typed = typeCommand(command);
    if (!typed) {
      throw new Error('명령 입력에 실패했습니다.');
    }
    
    // 자동 캡처 설정 확인
    const autoCapture = store.get('captureSettings')?.autoCapture !== false;
    const autoSend = store.get('captureSettings')?.autoSend !== false;
    
    // 캡처 및 전송
    if (autoCapture) {
      // 응답 캡처
      const imageData = await captureResponse();
      
      // 명령 정보 생성
      const commandResult = {
        id: Date.now().toString(),
        command,
        socketId,
        timestamp: timestamp.toISOString(),
        capturedAt: new Date().toISOString(),
        response: '클로드 앱 응답 이미지',
        imageData,
        status: 'completed'
      };
      
      // 명령 기록 추가
      const ipcController = require('../controllers/ipcController');
      ipcController.addCommandHistory(commandResult);
      
      // 명령 처리 완료 알림
      if (mainWindow) {
        mainWindow.webContents.send('command-completed', commandResult);
      }
      
      // 클라이언트에게 응답 전송
      if (socketId && autoSend && imageData) {
        // 캡처 매니저로 이미지 전송
        const captureManager = require('./captureManager');
        captureManager.sendCaptureToClient(socketId, imageData);
      }
    }
    
    // 활동 로그 추가
    if (mainWindow) {
      mainWindow.webContents.send('activity-log', {
        type: 'command',
        message: `명령 "${command}" 실행 완료`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('명령 처리 오류:', err);
    
    // 명령 처리 오류 알림
    if (mainWindow) {
      mainWindow.webContents.send('command-error', {
        command,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // 클라이언트에게 오류 알림
    if (socketId) {
      const socketManager = require('../server/socketManager');
      socketManager.sendToClient(socketId, 'command-error', {
        command,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // 활동 로그 추가
    if (mainWindow) {
      mainWindow.webContents.send('activity-log', {
        type: 'error',
        message: `명령 "${command}" 실행 오류: ${err.message}`,
        timestamp: new Date().toISOString()
      });
    }
  } finally {
    // 다음 명령 처리
    setTimeout(() => {
      processCommandQueue();
    }, 500);
  }
}

// 모듈 내보내기
module.exports = {
  init,
  launchClaudeApp,
  activateClaudeWindow,
  controlClaudeApp
};