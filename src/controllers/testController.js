/**
 * 테스트 컨트롤러
 * 클로드 앱 제어 테스트를 위한 IPC 이벤트 핸들러를 제공합니다.
 */

const { ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');

// 필요한 모듈
let claudeManager;
let captureManager;
let configManager;
let store;

/**
 * 테스트 컨트롤러 초기화
 * @param {Object} claudeMgr 클로드 앱 관리자
 * @param {Object} captureMgr 캡처 관리자
 * @param {Object} configMgr 설정 관리자
 * @param {Store} configStore 설정 저장소
 */
function init(claudeMgr, captureMgr, configMgr, configStore) {
  claudeManager = claudeMgr;
  captureManager = captureMgr;
  configManager = configMgr;
  store = configStore;
  
  setupIpcHandlers();
  
  logger.log('테스트 컨트롤러 초기화 완료');
}

/**
 * IPC 이벤트 핸들러 설정
 */
function setupIpcHandlers() {
  // 화면 정보 요청
  ipcMain.on('get-screen-info', (event) => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    event.reply('screen-info', {
      width,
      height,
      displays: screen.getAllDisplays().map(display => ({
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        isPrimary: display.id === primaryDisplay.id
      }))
    });
  });
  
  // 클로드 앱 경로 요청
  ipcMain.on('get-claude-path', (event) => {
    const claudePath = store.get('claudePath') || '';
    event.reply('claude-path', claudePath);
  });
  
  // 클로드 앱 경로 선택 요청
  ipcMain.on('select-claude-path', (event) => {
    dialog.showOpenDialog({
      title: '클로드 앱 선택',
      filters: [
        { name: '실행 파일', extensions: ['exe'] },
        { name: '모든 파일', extensions: ['*'] }
      ],
      properties: ['openFile']
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        
        // 설정에 저장
        store.set('claudePath', filePath);
        
        event.reply('select-claude-path-result', {
          success: true,
          path: filePath
        });
      } else {
        event.reply('select-claude-path-result', {
          success: false,
          message: '경로 선택이 취소되었습니다.'
        });
      }
    }).catch(err => {
      logger.error('클로드 앱 경로 선택 오류:', err);
      event.reply('select-claude-path-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    });
  });
  
  // 클로드 앱 경로 자동 감지 요청
  ipcMain.on('auto-detect-claude-path', (event) => {
    try {
      const detectedPath = claudeManager.findClaudeAppPath();
      
      if (detectedPath) {
        // 설정에 저장
        store.set('claudePath', detectedPath);
        
        event.reply('auto-detect-claude-path-result', {
          success: true,
          path: detectedPath
        });
      } else {
        event.reply('auto-detect-claude-path-result', {
          success: false,
          message: '클로드 앱을 찾을 수 없습니다.'
        });
      }
    } catch (err) {
      logger.error('클로드 앱 경로 자동 감지 오류:', err);
      event.reply('auto-detect-claude-path-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 클로드 앱 상태 확인 요청
  ipcMain.on('check-claude-status', (event) => {
    try {
      const isRunning = claudeManager.isClaudeRunning();
      
      // 창 정보 가져오기
      let windowInfo = null;
      if (isRunning) {
        windowInfo = claudeManager.getClaudeWindowInfo();
      }
      
      event.reply('claude-status', {
        running: isRunning,
        windowInfo
      });
    } catch (err) {
      logger.error('클로드 앱 상태 확인 오류:', err);
      event.reply('claude-status', {
        running: false,
        error: err.message
      });
    }
  });
  
  // 클로드 앱 실행 요청
  ipcMain.on('launch-claude-app', async (event) => {
    try {
      const result = await claudeManager.launchClaudeApp();
      
      event.reply('launch-claude-app-result', {
        success: result === true,
        message: result === true ? '클로드 앱 실행 성공' : '클로드 앱 실행 실패'
      });
    } catch (err) {
      logger.error('클로드 앱 실행 오류:', err);
      event.reply('launch-claude-app-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 클로드 앱 창 찾기 요청
  ipcMain.on('find-claude-window', async (event) => {
    try {
      const result = await claudeManager.findClaudeWindow();
      
      // 창 정보 가져오기
      let windowInfo = null;
      if (result) {
        windowInfo = claudeManager.getClaudeWindowInfo();
      }
      
      event.reply('find-claude-window-result', {
        success: result === true,
        windowInfo,
        message: result === true ? '클로드 앱 창 찾기 성공' : '클로드 앱 창을 찾을 수 없습니다.'
      });
    } catch (err) {
      logger.error('클로드 앱 창 찾기 오류:', err);
      event.reply('find-claude-window-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 클로드 앱 창 활성화 요청
  ipcMain.on('activate-claude-window', async (event) => {
    try {
      const result = await claudeManager.activateClaudeWindow();
      
      event.reply('activate-claude-window-result', {
        success: result === true,
        message: result === true ? '클로드 앱 창 활성화 성공' : '클로드 앱 창 활성화 실패'
      });
    } catch (err) {
      logger.error('클로드 앱 창 활성화 오류:', err);
      event.reply('activate-claude-window-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 입력 필드 위치 가져오기 요청
  ipcMain.on('get-input-field-position', (event) => {
    try {
      // 입력 필드 설정 가져오기
      const inputFieldSettings = store.get('inputFieldSettings') || {
        useAbsolutePosition: false,
        relativeX: 0.5,
        relativeY: 0.85,
        offsetX: 0,
        offsetY: 0
      };
      
      // 화면 크기 가져오기
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      // 입력 필드 위치 계산
      let x, y;
      
      if (inputFieldSettings.useAbsolutePosition && inputFieldSettings.x && inputFieldSettings.y) {
        // 절대 위치 사용
        x = inputFieldSettings.x;
        y = inputFieldSettings.y;
      } else {
        // 상대 위치 계산
        const relativeX = inputFieldSettings.relativeX || 0.5;
        const relativeY = inputFieldSettings.relativeY || 0.85;
        const offsetX = inputFieldSettings.offsetX || 0;
        const offsetY = inputFieldSettings.offsetY || 0;
        
        x = Math.floor(width * relativeX) + offsetX;
        y = Math.floor(height * relativeY) + offsetY;
      }
      
      // 위치 정보 반환
      event.reply('input-field-position', {
        ...inputFieldSettings,
        x,
        y,
        screenWidth: width,
        screenHeight: height
      });
    } catch (err) {
      logger.error('입력 필드 위치 가져오기 오류:', err);
      event.reply('input-field-position', null);
    }
  });
  
  // 입력 필드 위치 설정 요청
  ipcMain.on('set-input-field-position', (event, position) => {
    try {
      // 위치 정보 유효성 검사
      if (!position || !position.x || !position.y) {
        throw new Error('유효하지 않은 위치 정보입니다.');
      }
      
      // 입력 필드 설정 저장
      const inputFieldSettings = {
        useAbsolutePosition: position.useAbsolutePosition === true,
        x: parseInt(position.x),
        y: parseInt(position.y),
        relativeX: parseFloat(position.relativeX) || 0.5,
        relativeY: parseFloat(position.relativeY) || 0.85,
        offsetX: parseInt(position.offsetX) || 0,
        offsetY: parseInt(position.offsetY) || 0
      };
      
      store.set('inputFieldSettings', inputFieldSettings);
      
      // 캘리브레이션 함수 호출
      if (position.useAbsolutePosition) {
        claudeManager.calibrateInputFieldPosition(position.x, position.y, true);
      } else {
        claudeManager.calibrateInputFieldPosition(
          position.x, 
          position.y, 
          false
        );
      }
      
      event.reply('set-input-field-position-result', {
        success: true,
        position: inputFieldSettings
      });
    } catch (err) {
      logger.error('입력 필드 위치 설정 오류:', err);
      event.reply('set-input-field-position-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 입력 필드 위치 테스트 요청
  ipcMain.on('test-input-field-position', (event) => {
    try {
      // 클로드 앱 창 활성화
      claudeManager.activateClaudeWindow()
        .then(activated => {
          if (!activated) {
            throw new Error('클로드 앱 창을 활성화할 수 없습니다.');
          }
          
          // 잠시 대기
          setTimeout(() => {
            // 입력 필드 찾기
            const inputFound = claudeManager.findInputField();
            
            if (!inputFound) {
              throw new Error('입력 필드를 찾을 수 없습니다.');
            }
            
            event.reply('test-input-field-position-result', {
              success: true
            });
          }, 1000);
        })
        .catch(err => {
          throw err;
        });
    } catch (err) {
      logger.error('입력 필드 위치 테스트 오류:', err);
      event.reply('test-input-field-position-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 입력 필드 위치 초기화 요청
  ipcMain.on('reset-input-field-position', (event) => {
    try {
      // 화면 크기 가져오기
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      // 기본 위치 설정
      const defaultSettings = {
        useAbsolutePosition: false,
        relativeX: 0.5,
        relativeY: 0.85,
        offsetX: 0,
        offsetY: 0,
        x: Math.floor(width * 0.5),
        y: Math.floor(height * 0.85)
      };
      
      // 설정 저장
      store.set('inputFieldSettings', defaultSettings);
      
      event.reply('reset-input-field-position-result', {
        success: true,
        position: defaultSettings
      });
    } catch (err) {
      logger.error('입력 필드 위치 초기화 오류:', err);
      event.reply('reset-input-field-position-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 명령어 입력 요청
  ipcMain.on('type-command', async (event, options) => {
    try {
      // 옵션 유효성 검사
      if (!options || !options.command) {
        throw new Error('유효하지 않은 명령어입니다.');
      }
      
      // 클립보드 입력 모드 설정
      claudeManager.setClipboardInputMode(options.useClipboard !== false);
      
      // 명령어 입력
      if (options.activateFirst) {
        // 클로드 앱 창 활성화 후 입력
        const activated = await claudeManager.activateClaudeWindow();
        
        if (!activated) {
          throw new Error('클로드 앱 창을 활성화할 수 없습니다.');
        }
        
        // 입력 필드 찾기
        const inputFound = claudeManager.findInputField();
        
        if (!inputFound) {
          throw new Error('입력 필드를 찾을 수 없습니다.');
        }
        
        // 명령어 입력
        const typed = claudeManager.typeCommand(options.command);
        
        if (!typed) {
          throw new Error('명령어 입력에 실패했습니다.');
        }
      } else {
        // 바로 입력 (입력 필드가 이미 활성화되어 있다고 가정)
        const typed = claudeManager.typeCommand(options.command);
        
        if (!typed) {
          throw new Error('명령어 입력에 실패했습니다.');
        }
      }
      
      event.reply('type-command-result', {
        success: true
      });
    } catch (err) {
      logger.error('명령어 입력 오류:', err);
      event.reply('type-command-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 전체 명령어 프로세스 실행 요청
  ipcMain.on('run-full-command-process', (event, options) => {
    try {
      // 옵션 유효성 검사
      if (!options || !options.command) {
        throw new Error('유효하지 않은 명령어입니다.');
      }
      
      // 클립보드 입력 모드 설정
      claudeManager.setClipboardInputMode(options.useClipboard !== false);
      
      // 명령어 처리 시작
      claudeManager.controlClaudeApp(options.command, null)
        .then(result => {
          // 응답 반환
          event.reply('run-full-command-process-result', {
            success: true,
            message: '명령어 처리 성공',
            imageData: result?.imageData
          });
        })
        .catch(err => {
          throw err;
        });
    } catch (err) {
      logger.error('전체 명령어 프로세스 실행 오류:', err);
      event.reply('run-full-command-process-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 화면 캡처 요청
  ipcMain.on('capture-screen', async (event, options) => {
    try {
      // 캡처 설정
      const captureDelay = options?.delay || 2;
      
      // 딜레이 적용
      setTimeout(async () => {
        try {
          // 화면 캡처
          const imageData = await captureManager.captureScreen();
          
          event.reply('capture-screen-result', {
            success: true,
            imageData
          });
        } catch (err) {
          throw err;
        }
      }, captureDelay * 1000);
    } catch (err) {
      logger.error('화면 캡처 오류:', err);
      event.reply('capture-screen-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 캡처 영역 선택 요청
  ipcMain.on('select-capture-area', (event) => {
    try {
      // CaptureManager에서 캡처 영역 선택
      captureManager.selectCaptureArea()
        .then(area => {
          if (area) {
            // 캡처 영역 저장
            store.set('captureArea', area);
            
            event.reply('select-capture-area-result', {
              success: true,
              area
            });
          } else {
            event.reply('select-capture-area-result', {
              success: false,
              message: '영역 선택이 취소되었습니다.'
            });
          }
        })
        .catch(err => {
          throw err;
        });
    } catch (err) {
      logger.error('캡처 영역 선택 오류:', err);
      event.reply('select-capture-area-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
  
  // 캡처 영역 자동 감지 요청
  ipcMain.on('detect-capture-area', (event) => {
    try {
      // CaptureManager에서 캡처 영역 자동 감지
      captureManager.detectCaptureArea()
        .then(area => {
          if (area) {
            // 캡처 영역 저장
            store.set('captureArea', area);
            
            event.reply('detect-capture-area-result', {
              success: true,
              area
            });
          } else {
            event.reply('detect-capture-area-result', {
              success: false,
              message: '영역 자동 감지에 실패했습니다.'
            });
          }
        })
        .catch(err => {
          throw err;
        });
    } catch (err) {
      logger.error('캡처 영역 자동 감지 오류:', err);
      event.reply('detect-capture-area-result', {
        success: false,
        message: `오류 발생: ${err.message}`
      });
    }
  });
}

// 모듈 내보내기
module.exports = {
  init
};