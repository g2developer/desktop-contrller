/**
 * 클로드 앱 제어 모듈
 * 데스크탑에 설치된 클로드 앱을 제어하는 기능을 제공합니다.
 */

const { exec, execSync } = require('child_process');
const robot = require('@jitsi/robotjs');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 변수 초기화
let mainWindow;
let store;
let commandQueue = [];
let isProcessing = false;
let lastProcessedTime = 0;
let processedCommandCount = 0;
let logger;

// 클로드 앱 관련 상수
const CLAUDE_APP_NAME = 'Claude';
const CLAUDE_APP_CLASS = 'Chrome_WidgetWin_1';
const CLAUDE_PROCESS_NAME_WINDOWS = 'Claude.exe';
const CLAUDE_DESKTOP_ENTRY_LINUX = 'claude.desktop';
const CLAUDE_DEFAULT_PATHS = {
  windows: [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Claude', 'Claude.exe'),
    path.join('C:', 'Program Files', 'Claude', 'Claude.exe'),
    path.join('C:', 'Program Files (x86)', 'Claude', 'Claude.exe')
  ],
  mac: [
    '/Applications/Claude.app',
    path.join(os.homedir(), 'Applications', 'Claude.app')
  ],
  linux: [
    '/usr/bin/claude',
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.local', 'bin', 'claude')
  ]
};

/**
 * 클로드 앱 매니저 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 * @param {Object} loggerModule 로거 모듈(선택적)
 */
function init(configStore, window, loggerModule) {
  store = configStore;
  mainWindow = window;
  
  // 로거 설정
  logger = loggerModule || {
    log: (...args) => console.log('[Claude Manager]', ...args),
    warn: (...args) => console.warn('[Claude Manager]', ...args),
    error: (...args) => console.error('[Claude Manager]', ...args)
  };
  
  // 저장된 앱 경로 확인
  checkClaudePath();
  
  logger.log('클로드 앱 매니저 초기화 완료');
}

/**
 * 클로드 앱 경로 확인 및 업데이트
 */
function checkClaudePath() {
  // 저장된 경로 가져오기
  let claudePath = store.get('claudePath');
  
  // 경로가 없거나 파일이 존재하지 않으면 기본 경로에서 검색
  if (!claudePath || !fs.existsSync(claudePath)) {
    logger.log('클로드 앱 경로를 찾는 중...');
    claudePath = findClaudeAppPath();
    
    // 찾은 경로가 있으면 저장
    if (claudePath) {
      logger.log('클로드 앱 경로 발견 및 저장:', claudePath);
      store.set('claudePath', claudePath);
    } else {
      logger.warn('클로드 앱 경로를 찾을 수 없습니다.');
    }
  } else {
    logger.log('저장된 클로드 앱 경로 확인:', claudePath);
  }
  
  return claudePath;
}

/**
 * 클로드 앱 경로 찾기
 * @returns {string|null} 클로드 앱 경로 또는 null
 */
function findClaudeAppPath() {
  // 운영체제 확인
  const platform = os.platform();
  let paths = [];
  
  if (platform === 'win32') {
    paths = CLAUDE_DEFAULT_PATHS.windows;
  } else if (platform === 'darwin') {
    paths = CLAUDE_DEFAULT_PATHS.mac;
  } else if (platform === 'linux') {
    paths = CLAUDE_DEFAULT_PATHS.linux;
  }
  
  // 기본 경로에서 파일 확인
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  
  // 기본 경로에 없으면 프로그램 목록에서 검색 (Windows 전용)
  if (platform === 'win32') {
    try {
      // Program Files 폴더 스캔
      const programDirs = [
        'C:\\Program Files',
        'C:\\Program Files (x86)',
        path.join(os.homedir(), 'AppData', 'Local', 'Programs')
      ];
      
      for (const dir of programDirs) {
        if (!fs.existsSync(dir)) continue;
        
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const entryPath = path.join(dir, entry);
          if (entry.includes('Claude') && fs.statSync(entryPath).isDirectory()) {
            // Claude 폴더 발견
            const exePath = path.join(entryPath, 'Claude.exe');
            if (fs.existsSync(exePath)) {
              return exePath;
            }
          }
        }
      }
    } catch (err) {
      logger.error('프로그램 목록 검색 오류:', err);
    }
    
    // 레지스트리에서 검색 시도
    try {
      const regOutput = execSync('reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Claude.exe /ve', { encoding: 'utf8' });
      const match = regOutput.match(/REG_SZ\s+([^\r\n]+)/);
      if (match && match[1]) {
        const exePath = match[1].trim();
        if (fs.existsSync(exePath)) {
          return exePath;
        }
      }
    } catch (err) {
      // 레지스트리 검색 실패는 무시
    }
  } else if (platform === 'darwin') {
    // macOS Spotlight 검색 시도
    try {
      const result = execSync('mdfind "kMDItemKind == Application AND kMDItemDisplayName == Claude"', { encoding: 'utf8' });
      if (result.trim()) {
        const appPath = result.trim().split('\n')[0];
        if (fs.existsSync(appPath)) {
          return appPath;
        }
      }
    } catch (err) {
      // Spotlight 검색 실패는 무시
    }
  }
  
  // 찾지 못함
  return null;
}

/**
 * 클로드 앱 실행 상태 확인
 * @returns {boolean} 실행 중 여부
 */
function isClaudeRunning() {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      // Windows
      const result = execSync('tasklist /FI "IMAGENAME eq Claude.exe" /FO CSV', { encoding: 'utf8' });
      return result.toLowerCase().includes('claude.exe');
    } else if (platform === 'darwin') {
      // macOS
      const result = execSync('pgrep -f "Claude.app"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      return result.trim() !== '';
    } else if (platform === 'linux') {
      // Linux
      const result = execSync('pgrep -f "claude"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      return result.trim() !== '';
    }
  } catch (err) {
    // 프로세스가 실행 중이지 않으면 오류가 발생할 수 있음
    return false;
  }
  
  return false;
}

/**
 * 클로드 앱 실행 함수
 * @returns {Promise<boolean>} 실행 성공 여부
 */
async function launchClaudeApp() {
  return new Promise((resolve, reject) => {
    try {
      // 이미 실행 중인지 확인
      if (isClaudeRunning()) {
        logger.log('클로드 앱이 이미 실행 중입니다.');
        resolve(true);
        return;
      }
      
      // 클로드 앱 경로 가져오기
      const claudePath = store.get('claudePath') || findClaudeAppPath();
      
      // 경로가 없으면 실패
      if (!claudePath) {
        reject(new Error('클로드 앱 경로를 찾을 수 없습니다.'));
        return;
      }
      
      logger.log('클로드 앱 실행 중...', claudePath);
      
      // 앱 실행
      const child = exec(`"${claudePath}"`, (error, stdout, stderr) => {
        if (error) {
          logger.error('클로드 앱 실행 오류:', error);
          reject(error);
          return;
        }
      });
      
      // 실행 지연 - 앱이 시작될 때까지 약간의 시간이 필요
      setTimeout(() => {
        // 실행 상태 다시 확인
        if (isClaudeRunning()) {
          logger.log('클로드 앱 실행 성공');
          resolve(true);
        } else {
          logger.warn('클로드 앱 실행 실패 또는 시간 초과');
          reject(new Error('클로드 앱 실행 시간 초과'));
        }
      }, 5000); // 5초 대기
    } catch (err) {
      logger.error('클로드 앱 실행 중 오류:', err);
      reject(err);
    }
  });
}

/**
 * 클로드 앱 창 찾기 함수 (Windows 전용)
 * @returns {Object|null} 창 정보 또는 null
 */
function findClaudeWindowWindows() {
  try {
    // Windows 전용 코드
    // 매번 새로 로드하여 동적 로딩 오류 방지
    let WindowsProcesses;
    try {
      const windowsUtils = require('../utils/windowsUtils');
      WindowsProcesses = windowsUtils.WindowsProcesses;
    } catch (err) {
      logger.error('windowsUtils 로드 오류:', err);
      return null;
    }
    
    if (!WindowsProcesses || !WindowsProcesses.getAllWindows) {
      logger.error('WindowsProcesses 유틸리티 사용 불가:', 'getAllWindows 함수가 없습니다.');
      return null;
    }
    
    // 클로드 창 찾기
    let windows = [];
    try {
      windows = WindowsProcesses.getAllWindows() || [];
    } catch (winErr) {
      logger.error('getAllWindows 호출 오류:', winErr);
      return null;
    }
    
    // 창 리스트 유효성 검사
    if (!Array.isArray(windows)) {
      logger.warn('windows가 배열이 아닙니다:', windows);
      windows = [];
    }
    
    if (windows.length === 0) {
      logger.warn('열려 있는 창이 없습니다.');
      return null;
    }
    
    let claudeWindow = null;
    
    for (const window of windows) {
      if (!window) continue; // null 값 건너뛰기
      
      // 클로드 앱 창 찾기 (다양한 방법으로 시도)
      try {
        const processNameMatch = window.processName && typeof window.processName === 'string' && window.processName.includes('Claude');
        const classNameMatch = window.className === CLAUDE_APP_CLASS && window.title && window.title.includes('Claude');
        const titleMatch = window.title && typeof window.title === 'string' && window.title.includes('Claude') && window.visible;
        
        if (processNameMatch || classNameMatch || titleMatch) {
          claudeWindow = window;
          break;
        }
      } catch (windowErr) {
        logger.warn('창 객체 처리 오류 - 무시하고 계속:', windowErr);
        continue; // 현재 창에 오류가 있어도 계속 진행
      }
    }
    
    if (claudeWindow) {
      // 창 정보 유효성 검사
      if (!claudeWindow.rect || typeof claudeWindow.rect !== 'object') {
        logger.warn('창 크기 정보가 없습니다:', claudeWindow);
        return null;
      }
      
      logger.log('클로드 앱 창 발견:', claudeWindow.title || 'Unknown Title');
      return claudeWindow;
    }
    
    logger.warn('클로드 앱 창을 찾을 수 없습니다.');
    return null;
  } catch (err) {
    logger.error('클로드 앱 창 찾기 오류 (Windows):', err);
    return null;
  }
}

/**
 * 클로드 앱 찾기 함수
 * @returns {Promise<boolean>} 앱 찾기 성공 여부
 */
async function findClaudeWindow() {
  const platform = os.platform();
  
  try {
    // 먼저 프로세스 확인
    if (!isClaudeRunning()) {
      logger.warn('클로드 앱이 실행되지 않았습니다.');
      return false;
    }
    
    // 운영체제별 구현
    if (platform === 'win32') {
      // Windows
      return findClaudeWindowWindows() !== null;
    } else if (platform === 'darwin') {
      // macOS - AppleScript를 사용하여 앱 창 확인
      try {
        execSync('osascript -e \'tell application "System Events" to exists (window 1 of process "Claude")\'');
        return true;
      } catch (err) {
        return false;
      }
    } else if (platform === 'linux') {
      // Linux - wmctrl을 사용하여 창 확인
      try {
        const result = execSync('wmctrl -l | grep -i claude', { encoding: 'utf8' });
        return result.trim() !== '';
      } catch (err) {
        return false;
      }
    }
    
    // 기본 구현: 실행 중이면 창이 있다고 가정
    return true;
  } catch (err) {
    logger.error('클로드 앱 창 찾기 오류:', err);
    return false;
  }
}

/**
 * 클로드 앱 활성화 함수 (Windows 전용)
 * @returns {boolean} 활성화 성공 여부
 */
function activateClaudeWindowWindows() {
  try {
    // Windows 전용 코드
    const { WindowsProcesses } = require('../utils/windowsUtils');
    
    // 클로드 창 찾기
    const claudeWindow = findClaudeWindowWindows();
    if (!claudeWindow) {
      return false;
    }
    
    // 창 활성화
    return WindowsProcesses.setForegroundWindow(claudeWindow.hwnd);
  } catch (err) {
    logger.error('클로드 앱 활성화 오류 (Windows):', err);
    return false;
  }
}

/**
 * 클로드 앱 활성화 함수
 * @returns {Promise<boolean>} 활성화 성공 여부
 */
async function activateClaudeWindow() {
  const platform = os.platform();
  
  try {
    // 앱 창 찾기
    const found = await findClaudeWindow();
    
    if (!found) {
      logger.log('클로드 앱 창을 찾을 수 없어 실행을 시도합니다.');
      
      // 앱을 못 찾으면 실행
      try {
        await launchClaudeApp();
        
        // 앱이 시작될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 다시 찾기 시도
        const foundAfterLaunch = await findClaudeWindow();
        if (!foundAfterLaunch) {
          logger.error('클로드 앱을 실행했지만 창을 찾을 수 없습니다.');
          return false;
        }
      } catch (err) {
        logger.error('클로드 앱 실행 실패:', err);
        return false;
      }
    }
    
    // 운영체제별 구현
    if (platform === 'win32') {
      // Windows
      return activateClaudeWindowWindows();
    } else if (platform === 'darwin') {
      // macOS - AppleScript를 사용하여 앱 활성화
      try {
        // 먼저 클로드 앱이 실행 중인지 확인
        try {
          const psResult = execSync('ps -A | grep -i "Claude.app"', { encoding: 'utf8' });
          if (!psResult || !psResult.includes('Claude')) {
            logger.warn('macOS: 클로드 앱이 실행 중이 아닙니다. 실행을 시도합니다.');
            // 프로세스 시작
            await launchClaudeApp();
            await new Promise(resolve => setTimeout(resolve, 2000)); // 실행 대기
          }
        } catch (psErr) {
          // ps 명령 실패는 무시
        }
        
        // 클로드 앱 활성화 시도 (Pascal Case)
        try {
          logger.log('macOS: AppleScript로 클로드 앱 활성화 시도 (Pascal Case)');
          execSync('osascript -e \'tell application "Claude" to activate\'', { stdio: ['ignore', 'pipe', 'ignore'] });
          await new Promise(resolve => setTimeout(resolve, 500)); // 활성화 대기
          return true;
        } catch (err) {
          logger.warn('macOS: Claude (Pascal Case) 활성화 실패, 다른 방법 시도:', err.message);
          
          // 소문자로 다시 시도
          try {
            logger.log('macOS: AppleScript로 클로드 앱 활성화 시도 (lowercase)');
            execSync('osascript -e \'tell application "claude" to activate\'', { stdio: ['ignore', 'pipe', 'ignore'] });
            await new Promise(resolve => setTimeout(resolve, 500)); // 활성화 대기
            return true;
          } catch (lowerErr) {
            logger.warn('macOS: claude (lowercase) 활성화 실패, 다른 방법 시도:', lowerErr.message);
            
            // 불리는 실제 경로 사용
            try {
              const claudePath = store.get('claudePath');
              if (claudePath && fs.existsSync(claudePath)) {
                logger.log(`macOS: 해당 경로로 클로드 앱 활성화 시도: ${claudePath}`);
                execSync(`open "${claudePath}"`, { stdio: ['ignore', 'pipe', 'ignore'] });
                await new Promise(resolve => setTimeout(resolve, 1000)); // 실행 대기
                return true;
              }
            } catch (openErr) {
              logger.error('macOS: 경로로 실행 시도 실패:', openErr.message);
            }
            
            // 마지막 방법 - Spotlight를 통한 진행
            try {
              logger.log('macOS: Spotlight를 통한 앱 실행 시도');
              execSync('osascript -e \'tell application "Finder" to open location "file:///Applications/Claude.app"\'', { stdio: ['ignore', 'pipe', 'ignore'] });
              await new Promise(resolve => setTimeout(resolve, 1000)); // 실행 대기
              return true;
            } catch (finderErr) {
              logger.error('macOS: Finder로 실행 시도 실패:', finderErr.message);
              return false;
            }
          }
        }
      } catch (err) {
        logger.error('클로드 앱 활성화 오류 (macOS):', err.message);
        return false;
      }
    } else if (platform === 'linux') {
      // Linux - wmctrl을 사용하여 창 활성화
      try {
        logger.log('Linux: wmctrl로 클로드 앱 활성화 시도');
        
        // 정확한 창 제목 또는 PID를 가져오기 위한 명령어
        const windowList = execSync('wmctrl -l', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const claudeWindowLine = windowList.split('\n').find(line => line.toLowerCase().includes('claude'));
        
        if (claudeWindowLine) {
          // 창 ID 추출
          const windowId = claudeWindowLine.split(' ')[0];
          if (windowId) {
            // 해당 창 ID로 활성화
            execSync(`wmctrl -i -a ${windowId}`, { stdio: ['ignore', 'pipe', 'ignore'] });
            return true;
          }
        }
        
        // 이름으로 시도
        execSync('wmctrl -a Claude', { stdio: ['ignore', 'pipe', 'ignore'] });
        
        // 성공으로 간주
        return true;
      } catch (err) {
        logger.warn('Linux: wmctrl 활성화 실패, 다른 방법 시도:', err.message);
        
        // xdotool 시도
        try {
          logger.log('Linux: xdotool로 클로드 앱 활성화 시도');
          
          // 클로드 창 찾기
          const windowId = execSync('xdotool search --name "Claude" | head -1', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
          
          if (windowId && windowId.trim()) {
            // 해당 창 활성화
            execSync(`xdotool windowactivate ${windowId.trim()}`, { stdio: ['ignore', 'pipe', 'ignore'] });
            return true;
          }
          
          // 창 모든 창 무시하고 실행
          execSync(`xdotool search --class "Claude" windowactivate`, { stdio: ['ignore', 'pipe', 'ignore'] });
          return true;
        } catch (xdoErr) {
          logger.warn('Linux: xdotool 활성화 실패:', xdoErr.message);
          
          // 실행 시도
          try {
            const claudePath = store.get('claudePath');
            if (claudePath && fs.existsSync(claudePath)) {
              logger.log(`Linux: 해당 경로로 클로드 앱 실행 시도: ${claudePath}`);
              execSync(`"${claudePath}"`, { stdio: ['ignore', 'pipe', 'ignore'] });
              await new Promise(resolve => setTimeout(resolve, 2000)); // 실행 대기
              return true;
            }
          } catch (execErr) {
            logger.error('Linux: 실행 활성화 실패:', execErr.message);
          }
          
          // 모든 방법 실패
          logger.error('Linux: 모든 활성화 시도 실패');
          return false;
        }
      }
    }
    
    logger.warn('지원되지 않는 운영체제:', platform);
    return false;
  } catch (err) {
    logger.error('클로드 앱 활성화 오류:', err);
    return false;
  }
}

/**
 * 클로드 앱 입력 필드 자동 감지 및 찾기 함수
 * @returns {boolean} 입력 필드 찾기 성공 여부
 */
function findInputField() {
  try {
    // 운영체제별 화면 크기 및 입력 필드 위치 계산
    const { width, height } = robot.getScreenSize();
    
    // 자동 감지 기능 사용 여부 확인
    const useAutoDetect = store.get('useAutoDetectInputField');
    
    // 입력 필드 위치 정보 가져오기
    const inputFieldSettings = store.get('inputFieldSettings') || {};
    
    // 입력 필드 위치 계산
    let inputX, inputY;
    
    if (useAutoDetect) {
      // 자동 감지 시도
      logger.log('입력 필드 자동 감지 시도...');
      const detected = detectInputField();
      
      if (detected && detected.x && detected.y) {
        inputX = detected.x;
        inputY = detected.y;
        logger.log(`입력 필드 자동 감지 성공: (${inputX}, ${inputY})`);
      } else {
        logger.warn('입력 필드 자동 감지 실패, 설정된 위치 사용');
        // 자동 감지 실패 시 저장된 설정 사용
        if (inputFieldSettings.useAbsolutePosition && inputFieldSettings.x && inputFieldSettings.y) {
          inputX = inputFieldSettings.x;
          inputY = inputFieldSettings.y;
        } else {
          // 보정 계수
          const offsetX = inputFieldSettings.offsetX || 0;
          const offsetY = inputFieldSettings.offsetY || 0;
          
          // 상대적 위치 계산을 위한 인자
          const relativeX = inputFieldSettings.relativeX || 0.5; // 기본값: 화면 중앙
          const relativeY = inputFieldSettings.relativeY || 0.85; // 기본값: 화면 하단 85% 위치
          
          inputX = Math.floor(width * relativeX) + offsetX;
          inputY = Math.floor(height * relativeY) + offsetY;
        }
      }
    } else if (inputFieldSettings.useAbsolutePosition && inputFieldSettings.x && inputFieldSettings.y) {
      // 절대 좌표 사용
      inputX = inputFieldSettings.x;
      inputY = inputFieldSettings.y;
      logger.log(`입력 필드 찾기 (절대 좌표: ${inputX}, ${inputY})`);
    } else {
      // 상대 좌표 사용
      // 보정 계수
      const offsetX = inputFieldSettings.offsetX || 0;
      const offsetY = inputFieldSettings.offsetY || 0;
      
      // 상대적 위치 계산을 위한 인자
      const relativeX = inputFieldSettings.relativeX || 0.5; // 기본값: 화면 중앙
      const relativeY = inputFieldSettings.relativeY || 0.85; // 기본값: 화면 하단 85% 위치
      
      inputX = Math.floor(width * relativeX) + offsetX;
      inputY = Math.floor(height * relativeY) + offsetY;
      logger.log(`입력 필드 찾기 (상대 좌표: ${inputX}, ${inputY}, 화면 크기: ${width}x${height})`);
    }
    
    // 좌표 범위 확인
    if (inputX < 0 || inputX >= width || inputY < 0 || inputY >= height) {
      logger.warn(`입력 필드 좌표가 화면 범위를 벗어남: (${inputX}, ${inputY}), 기본값으로 조정`);
      // 기본값으로 되돌림
      inputX = Math.floor(width * 0.5);
      inputY = Math.floor(height * 0.85);
    }
    
    // 마우스 이동 및 클릭
    robot.setMouseDelay(20);
    
    // 부드러운 마우스 이동 사용 (가능한 경우)
    try {
      robot.moveMouseSmooth(inputX, inputY, 1);
    } catch (moveErr) {
      logger.warn('부드러운 마우스 이동 실패, 일반 이동 시도:', moveErr);
      robot.moveMouse(inputX, inputY);
    }
    
    // 잠시 대기 후 클릭
    setTimeout(() => {
      robot.mouseClick();
      robot.setMouseDelay(100);
    }, 300);
    
    // 성공 반환
    return true;
  } catch (err) {
    logger.error('입력 필드 찾기 오류:', err);
    return false;
  }
}

/**
 * 입력 필드 위치를 캘리브레이션하기 위한 함수
 * @param {number} x X 좌표
 * @param {number} y Y 좌표
 * @param {boolean} useAbsolute 절대 좌표 사용 여부
 * @returns {boolean} 성공 여부
 */
function calibrateInputFieldPosition(x, y, useAbsolute = true) {
  try {
    const { width, height } = robot.getScreenSize();
    
    // 설정 가져오기
    const inputFieldSettings = store.get('inputFieldSettings') || {};
    
    if (useAbsolute) {
      // 절대 좌표 설정
      inputFieldSettings.useAbsolutePosition = true;
      inputFieldSettings.x = x;
      inputFieldSettings.y = y;
      logger.log(`입력 필드 위치 설정 (절대 좌표: ${x}, ${y})`);
    } else {
      // 상대 좌표 계산 및 설정
      const relativeX = x / width;
      const relativeY = y / height;
      
      inputFieldSettings.useAbsolutePosition = false;
      inputFieldSettings.relativeX = relativeX;
      inputFieldSettings.relativeY = relativeY;
      inputFieldSettings.offsetX = 0;
      inputFieldSettings.offsetY = 0;
      
      logger.log(`입력 필드 위치 설정 (상대 좌표: ${relativeX.toFixed(3)}, ${relativeY.toFixed(3)})`);
    }
    
    // 설정 저장
    store.set('inputFieldSettings', inputFieldSettings);
    
    // 즉시 테스트 (옵션)
    robot.setMouseDelay(20);
    robot.moveMouse(x, y);
    
    return true;
  } catch (err) {
    logger.error('입력 필드 위치 캘리브레이션 오류:', err);
    return false;
  }
}

/**
 * 클립보드를 통한 명령 입력 함수
 * @param {string} command 입력할 명령어
 * @returns {boolean} 입력 성공 여부
 */
function pasteCommand(command) {
  try {
    const platform = os.platform();
    
    // 클립보드에 복사
    if (platform === 'win32') {
      // Windows
      try {
        // Electron의 clipboard API 사용
        const { clipboard } = require('electron');
        clipboard.writeText(command);
      } catch (clipboardErr) {
        // 예비 방법: 명령줄 도구 사용
        logger.warn('Electron 클립보드 접근 오류, 대체 방식 사용:', clipboardErr);
        try {
          const escapedText = command.replace(/"/g, '\"');
          execSync(`echo ${escapedText} | clip`, { windowsHide: true });
        } catch (cmdErr) {
          logger.error('명령줄 클립보드 접근 오류:', cmdErr);
          return false;
        }
      }
      
      // 잠시 대기 후 Ctrl+V 붙여넣기
      robot.setKeyboardDelay(300);
      robot.keyTap('v', ['control']);
    } else if (platform === 'darwin') {
      // macOS
      try {
        // Electron의 clipboard API 사용
        const { clipboard } = require('electron');
        clipboard.writeText(command);
      } catch (clipboardErr) {
        // 예비 방법: 명령줄 도구 사용
        logger.warn('Electron 클립보드 접근 오류, 대체 방식 사용:', clipboardErr);
        try {
          const escapedText = command.replace(/"/g, '\\"');
          execSync(`echo "${escapedText}" | pbcopy`, { shell: '/bin/bash' });
        } catch (cmdErr) {
          logger.error('명령줄 클립보드 접근 오류:', cmdErr);
          return false;
        }
      }
      
      // 잠시 대기 후 Command+V 붙여넣기
      robot.setKeyboardDelay(300);
      robot.keyTap('v', ['command']);
    } else {
      // Linux 및 기타
      try {
        // Electron의 clipboard API 사용
        const { clipboard } = require('electron');
        clipboard.writeText(command);
      } catch (clipboardErr) {
        // 예비 방법: 명령줄 도구 사용
        logger.warn('Electron 클립보드 접근 오류, 대체 방식 사용:', clipboardErr);
        try {
          const escapedText = command.replace(/"/g, '\\"');
          execSync(`echo "${escapedText}" | xclip -selection clipboard`, { shell: '/bin/bash' });
        } catch (cmdErr) {
          logger.error('명령줄 클립보드 접근 오류:', cmdErr);
          return false;
        }
      }
      
      // 잠시 대기 후 Ctrl+V 붙여넣기
      robot.setKeyboardDelay(300);
      robot.keyTap('v', ['control']);
    }
    
    // 붙여넣기 후 약간의 시간을 기다림
    robot.setKeyboardDelay(500);
    
    // 엔터키 입력
    robot.keyTap('enter');
    
    return true;
  } catch (err) {
    logger.error('클립보드 명령 입력 오류:', err);
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
    // 한글 및 특수문자 문제로 클립보드 사용 방식 우선
    const useClipboard = store.get('useClipboardForInput') !== false;
    
    if (useClipboard) {
      return pasteCommand(command);
    }
    
    // 명령어 길이 확인
    if (command.length > 1000) {
      logger.warn('명령어가 너무 깁니다. 클립보드 방식으로 전환합니다.');
      return pasteCommand(command);
    }
    
    // 특수 문자 확인 (한글, 이모지, 특수 기호 등)
    const hasSpecialChars = /[^\x00-\x7F]|[\^\{\}\[\]\\|]/.test(command);
    if (hasSpecialChars) {
      logger.warn('명령어에 특수 문자가 포함되어 있습니다. 클립보드 방식으로 전환합니다.');
      return pasteCommand(command);
    }
    
    // 클립보드를 사용하지 않는 경우 직접 타이핑
    // 텍스트 입력 전 딜레이
    robot.setKeyboardDelay(50);  // 더 빠른 타이핑을 위해 딜레이 줄임
    
    // 텍스트 입력 (100자씩 나눠서 입력하여 안정성 향상)
    const chunkSize = 100;
    for (let i = 0; i < command.length; i += chunkSize) {
      const chunk = command.substring(i, i + chunkSize);
      robot.typeString(chunk);
      
      // 청크 간 짧은 딜레이
      if (i + chunkSize < command.length) {
        robot.setKeyboardDelay(50);
      }
    }
    
    // 입력 후 딜레이
    robot.setKeyboardDelay(500);
    
    // 엔터키 입력
    robot.keyTap('enter');
    
    return true;
  } catch (err) {
    logger.error('명령 입력 오류:', err);
    
    // 기본 방식 실패 시 클립보드 방식 시도
    try {
      logger.log('직접 입력 실패, 클립보드 방식 시도');
      return pasteCommand(command);
    } catch (pasteErr) {
      logger.error('클립보드 방식도 실패:', pasteErr);
      
      // 마지막 시도: 단순 엔터키 입력 (이미 텍스트가 입력되었을 수 있음)
      try {
        robot.keyTap('enter');
        return true;
      } catch (enterErr) {
        logger.error('엔터키 입력 실패:', enterErr);
        return false;
      }
    }
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
    logger.error('응답 캡처 오류:', err);
    return null;
  }
}

/**
 * 클로드 앱 제어 함수 (메인)
 * @param {string} command 실행할 명령어
 * @param {string} socketId 요청한 클라이언트 소켓 ID
 * @param {Object} options 추가 옵션
 * @param {boolean} options.skipQueue 큐 처리를 건너뛰고 즉시 실행할지 여부
 * @param {boolean} options.autoCapture 자동 캡처 여부
 * @param {boolean} options.broadcastToAll 모든 클라이언트에게 응답 방송 여부
 * @returns {Promise<void>}
 */
async function controlClaudeApp(command, socketId, options = {}) {
  // 옵션 기본값 설정
  const { skipQueue = false, autoCapture = true, broadcastToAll = false } = options;
  
  // 즉시 실행 모드인 경우
  if (skipQueue) {
    try {
      // 클로드 앱 활성화
      const activated = await activateClaudeWindow();
      if (!activated) {
        throw new Error('클로드 앱 활성화에 실패했습니다.');
      }
      
      // 명령 실행
      await executeCommand(command);
      
      // 활동 로그 추가
      if (mainWindow) {
        mainWindow.webContents.send('activity-log', {
          type: 'command',
          message: `즉시 명령 "${command}" 실행 완료`,
          timestamp: new Date().toISOString()
        });
      }
      
      // 클라이언트에 알림
      if (socketId) {
        const socketManager = require('../server/socketManager');
        socketManager.sendToClient(socketId, 'command-completed', {
          command,
          timestamp: new Date().toISOString()
        });
      }
      
      // 자동 캡처 및 전송
      if (autoCapture) {
      // 캡처 매니저 가져오기
      const captureManager = require('./captureManager');
      const socketManager = require('../server/socketManager');
      const captureStreamManager = require('./captureStreamManager');
      
      // 응답 캡처
      const imageData = await captureResponse();
      
      if (imageData) {
      if (broadcastToAll) {
      // 모든 스트리밍 클라이언트에게 이미지 전송
      const streamingClients = socketManager.getStreamingClients();
      if (streamingClients && streamingClients.length > 0) {
      logger.log(`모든 스트리밍 클라이언트(${streamingClients.length}개)에게 캡처 이미지 전송`);
        await captureManager.streamImageToClients(streamingClients, imageData, { optimize: true });
          
        // 다음 자동 캡처를 위해 스트리밍과정 활성화
        if (!captureStreamManager.isStreaming()) {
          logger.log('명령 실행 후 스트리밍 시작');
            captureStreamManager.startStreaming();
            } else {
                // 캡처 분석 및 전송 한 번 수행
                  captureStreamManager.singleCaptureAndStream();
                }
              }
            } else if (socketId) {
              // 특정 클라이언트에게만 전송
              logger.log(`클라이언트(${socketId})에게 캡처 이미지 전송`);
              await captureManager.sendCaptureToClient(socketId, imageData, { optimize: true });
              
              // 해당 클라이언트가 스트리밍 클라이언트인지 확인
              const client = socketManager.getClient(socketId);
              if (client && client.streaming) {
                // 스트리밍 클라이언트라면 자동 스트리밍 활성화
                if (!captureStreamManager.isStreaming()) {
                  logger.log('명령 실행 후 스트리밍 시작');
                  captureStreamManager.startStreaming();
                }
              }
            }
          }
        }
      
      return;
    } catch (err) {
      logger.error('즉시 명령 실행 오류:', err);
      
      // 클라이언트에 오류 알림
      if (socketId) {
        const socketManager = require('../server/socketManager');
        socketManager.sendToClient(socketId, 'command-error', {
          command,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
      
      return;
    }
  }
  
  // 명령을 큐에 추가
  commandQueue.push({ command, socketId, timestamp: new Date(), options });
  
  // 이미 처리 중이면 대기
  if (isProcessing) {
    logger.log('이미 명령 처리 중, 큐에 추가됨');
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
  
  // 너무 빠른 연속 처리 방지
  const now = Date.now();
  const timeSinceLastProcess = now - lastProcessedTime;
  const minProcessInterval = store.get('commandInterval') || 2000; // 최소 처리 간격 (기본값 2초)
  
  if (timeSinceLastProcess < minProcessInterval) {
    const waitTime = minProcessInterval - timeSinceLastProcess;
    logger.log(`명령 처리 간격 유지를 위해 ${waitTime}ms 대기`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // 처리할 명령어 수가 너무 많으면 경고
  if (commandQueue.length > 10) {
    logger.warn(`처리 대기 중인 명령어가 많습니다: ${commandQueue.length}개`);
  }
  
  // 큐에서 첫 번째 명령 가져오기
  const { command, socketId, timestamp, options = {} } = commandQueue.shift();
  
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
    logger.log('클로드 앱 활성화 시도...');
    const activated = await activateClaudeWindow();
    if (!activated) {
      throw new Error('클로드 앱 활성화에 실패했습니다.');
    }
    
    // 앱 활성화 후 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 입력 필드 찾기
    logger.log('입력 필드 찾기 시도...');
    const inputFound = findInputField();
    if (!inputFound) {
      throw new Error('입력 필드를 찾을 수 없습니다.');
    }
    
    // 입력 필드 찾은 후 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 명령 입력 (executeCommand 함수 사용)
    logger.log('명령 입력 시도...');
    const executed = await executeCommand(command);
    if (!executed) {
      throw new Error('명령 입력에 실패했습니다.');
    }
    
    // 자동 캡처 설정 확인
    const autoCapture = options.autoCapture ?? store.get('captureSettings')?.autoCapture !== false;
    const autoSend = store.get('captureSettings')?.autoSend !== false;
    const broadcastToAll = options.broadcastToAll ?? store.get('captureSettings')?.broadcastToAll === true;
    
    // 캡처 및 전송
    if (autoCapture) {
      logger.log('응답 캡처 중...');
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
      try {
        const ipcController = require('../controllers/ipcController');
        ipcController.addCommandHistory(commandResult);
      } catch (err) {
        logger.error('명령 기록 추가 오류:', err);
      }
      
      // 명령 처리 완료 알림
      if (mainWindow) {
        mainWindow.webContents.send('command-completed', commandResult);
      }
      
      // 캡처 매니저 가져오기
      const captureManager = require('./captureManager');
      
      // 이미지 전송 옵션
      const sendOptions = {
        optimize: true,
        quality: options.quality || 'medium'
      };
      
      if (imageData) {
        if (broadcastToAll) {
          // 모든 스트리밍 클라이언트에게 전송
          const streamingClients = socketManager.getStreamingClients();
          if (streamingClients && streamingClients.length > 0) {
            logger.log(`모든 스트리밍 클라이언트(${streamingClients.length}개)에게 캡처 이미지 전송`);
            await captureManager.streamImageToClients(streamingClients, imageData, sendOptions);
          }
        } else if (socketId && autoSend) {
          // 특정 클라이언트에게만 전송
          logger.log(`클라이언트(${socketId})에게 캡처 이미지 전송`);
          await captureManager.sendCaptureToClient(socketId, imageData, sendOptions);
        }
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
    
    // 명령 처리 성공 카운트 증가
    processedCommandCount++;
    logger.log(`명령 처리 완료 (총 ${processedCommandCount}개 명령 처리됨)`);
  } catch (err) {
    logger.error('명령 처리 오류:', err);
    
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
    // 최종 처리 시간 기록
    lastProcessedTime = Date.now();
    
    // 다음 명령 처리
    setTimeout(() => {
      processCommandQueue();
    }, 1000);
  }
}

/**
 * 클로드 앱 창 위치 정보 가져오기
 * @returns {Object|null} 창 위치 정보 또는 null
 */
function getClaudeWindowInfo() {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      // Windows
      const claudeWindow = findClaudeWindowWindows();
      if (claudeWindow) {
        return {
          title: claudeWindow.title,
          position: {
            x: claudeWindow.rect.left,
            y: claudeWindow.rect.top,
            width: claudeWindow.rect.right - claudeWindow.rect.left,
            height: claudeWindow.rect.bottom - claudeWindow.rect.top
          },
          visible: claudeWindow.visible,
          processId: claudeWindow.processId
        };
      }
    }
    
    // 기본 정보
    return {
      running: isClaudeRunning(),
      screenSize: robot.getScreenSize()
    };
  } catch (err) {
    logger.error('클로드 앱 창 정보 가져오기 오류:', err);
    return null;
  }
}

/**
 * 입력 필드 위치 설정 (오프셋 조정)
 * @param {number} x X 좌표 오프셋
 * @param {number} y Y 좌표 오프셋
 * @returns {boolean} 설정 성공 여부
 */
function setInputFieldPosition(x, y) {
  try {
    // 입력 필드 설정 가져오기
    const inputFieldSettings = store.get('inputFieldSettings') || {};
    
    // 오프셋 적용
    inputFieldSettings.offsetX = x;
    inputFieldSettings.offsetY = y;
    
    // 설정 저장
    store.set('inputFieldSettings', inputFieldSettings);
    
    logger.log(`입력 필드 오프셋 설정: (${x}, ${y})`);
    return true;
  } catch (err) {
    logger.error('입력 필드 위치 설정 오류:', err);
    return false;
  }
}

/**
 * 클립보드 입력 방식 설정
 * @param {boolean} useClipboard 클립보드 사용 여부
 * @returns {boolean} 설정 성공 여부
 */
function setClipboardInputMode(useClipboard) {
  try {
    store.set('useClipboardForInput', useClipboard);
    return true;
  } catch (err) {
    logger.error('클립보드 입력 방식 설정 오류:', err);
    return false;
  }
}

/**
 * 현재 큐 상태 가져오기
 * @returns {Object} 큐 상태 정보
 */
function getQueueStatus() {
  return {
    isProcessing,
    queueLength: commandQueue.length,
    processedCount: processedCommandCount,
    lastProcessedTime: lastProcessedTime ? new Date(lastProcessedTime) : null
  };
}

/**
 * 클로드 앱 명령어 입력 함수
 * 명령어를 입력하고 엔터키를 누르는 기능을 제공합니다.
 * @param {string} command 입력할 명령어
 * @returns {Promise<boolean>} 입력 성공 여부
 */
async function executeCommand(command) {
  try {
    logger.log(`명령어 실행 시작: ${command}`);    
    
    // 입력 필드 찾기
    const inputFieldFound = findInputField();
    if (!inputFieldFound) {
      logger.error('입력 필드를 찾을 수 없습니다.');
      return false;
    }
    
    // 명령어 입력
    const commandTyped = typeCommand(command);
    if (!commandTyped) {
      logger.error('명령어 입력에 실패했습니다.');
      return false;
    }
    
    // 명령어 입력 후 대기 (AI가 응답할 시간)
    const waitTime = store.get('commandWaitTime') || 5000; // 기본값 5초
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    logger.log(`명령어 실행 완료: ${command}`);
    return true;
  } catch (err) {
    logger.error('명령어 실행 오류:', err);
    return false;
  }
}

/**
 * 클로드 앱 입력 필드 자동 감지 함수
 * 이미지 분석을 통해 입력 필드를 찾는 실험적 함수
 * @returns {Object|null} 감지된 입력 필드 위치 정보 또는 null
 */
async function detectInputField() {
  try {
    // 현재 클로드 앱이 열려 있는지 확인
    if (!isClaudeRunning()) {
      logger.warn('클로드 앱이 실행되고 있지 않아 입력 필드 감지 불가능');
      return null;
    }
    
    // 화면 캡처 모듈 가져오기
    const captureManager = require('./captureManager');
    const screenshot = require('screenshot-desktop');
    const path = require('path');
    const fs = require('fs');
    const sharp = require('sharp');
    
    logger.log('입력 필드 감지를 위한 화면 캡처 시작...');
    
    // 화면 캡처
    const imgPath = await screenshot({
      format: 'png'
    });
    
    // 운영체제별 화면 크기 및 기본 범위 계산
    const { width, height } = robot.getScreenSize();
    
    // 우선 클로드 창이 활성화되어 있는지 확인
    await activateClaudeWindow();
    
    // Claude 앱 창 정보 가져오기
    const claudeWindow = await getClaudeWindowInfo();
    
    // 클로드 창 정보가 있으면 그 정보를 사용
    if (claudeWindow && claudeWindow.position) {
      // 창 위치 정보를 사용하여 하단 중앙 부분을 입력 필드로 가정
      const winX = claudeWindow.position.x;
      const winY = claudeWindow.position.y;
      const winWidth = claudeWindow.position.width;
      const winHeight = claudeWindow.position.height;
      
      // 하단 중앙 좌표 계산
      const inputX = winX + Math.floor(winWidth / 2);
      const inputY = winY + Math.floor(winHeight * 0.85); // 하단 85% 위치
      
      logger.log(`클로드 창 정보를 통한 입력 필드 감지: (${inputX}, ${inputY})`);
      
      // 입력 필드 위치 저장
      saveDetectedInputField(inputX, inputY);
      
      return { x: inputX, y: inputY };
    }
    
    // 클로드 창 정보를 찾지 못한 경우 이미지 분석 시도
    logger.log('이미지 분석을 통한 입력 필드 감지 시도...');
    
    // 기본적인 추측 방법 사용 - 화면 하단 중앙
    // 실제 구현에서는 이미지 분석 라이브러리를 통한 전략적 배치가 필요
    const inputX = Math.floor(width * 0.5); // 화면 가로 중앙
    const inputY = Math.floor(height * 0.85); // 화면 하단 85% 위치
    
    logger.log(`기본 추측을 통한 입력 필드 감지: (${inputX}, ${inputY})`);
    
    // 입력 필드 위치 저장
    saveDetectedInputField(inputX, inputY);
    
    return { x: inputX, y: inputY };
  } catch (err) {
    logger.error('입력 필드 자동 감지 오류:', err);
    return null;
  }
}

/**
 * 감지된 입력 필드 위치 저장
 * @param {number} x X 좌표
 * @param {number} y Y 좌표
 */
function saveDetectedInputField(x, y) {
  try {
    // 현재 설정 가져오기
    const inputFieldSettings = store.get('inputFieldSettings') || {};
    
    // 절대 위치로 업데이트
    inputFieldSettings.useAbsolutePosition = true;
    inputFieldSettings.x = x;
    inputFieldSettings.y = y;
    inputFieldSettings.lastDetectedAt = new Date().toISOString();
    
    // 저장
    store.set('inputFieldSettings', inputFieldSettings);
    
    logger.log(`감지된 입력 필드 위치 저장: (${x}, ${y})`);
  } catch (err) {
    logger.error('입력 필드 위치 저장 오류:', err);
  }
}

// 모듈 내보내기
module.exports = {
  init,
  launchClaudeApp,
  activateClaudeWindow,
  controlClaudeApp,
  findClaudeWindow,
  getClaudeWindowInfo,
  setInputFieldPosition,
  calibrateInputFieldPosition,
  setClipboardInputMode,
  getQueueStatus,
  isClaudeRunning,
  findClaudeAppPath,
  detectInputField,
  executeCommand, // 새로 추가된 함수
  typeCommand,   // 외부 접근 가능하도록 추가
  findInputField  // 외부 접근 가능하도록 추가
};