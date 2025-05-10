/**
 * 로그 매니저
 * 로그를 메모리에 저장하고 GUI에 표시하는 기능을 제공합니다.
 */

const fs = require('fs');
const path = require('path');
const electron = require('electron');
const app = electron.app || (electron.remote ? electron.remote.app : null);
const electronLog = require('electron-log');

class LogManager {
  constructor() {
    // 로그 항목 배열 (메모리에 저장)
    this.logs = [];
    
    // 최대 로그 항목 수 (메모리 관리)
    this.maxLogs = 1000;
    
    // 로그 레벨 설정
    this.logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    
    // 로그 파일 설정
    this.logDir = app ? path.join(app.getPath('userData'), 'logs') : path.join(process.cwd(), 'logs');
    
    // 로그 파일 디렉토리 생성
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logFilePath = path.join(this.logDir, `desktop-controller-${new Date().toISOString().slice(0, 10)}.log`);
    
    // IPC 메인 채널 설정 (메인 프로세스에서만)
    this.ipcMain = null;
    this.mainWindow = null;
    
    // electron-log 설정
    electronLog.transports.file.level = this.logLevel;
    electronLog.transports.file.resolvePathFn = () => this.logFilePath;
    electronLog.transports.console.level = this.logLevel;
  }
  
  /**
   * 로그 매니저 초기화 (메인 프로세스에서 호출)
   * @param {Electron.IpcMain} ipcMain IPC 메인 객체
   * @param {Electron.BrowserWindow} mainWindow 메인 윈도우 객체
   */
  init(ipcMain, mainWindow) {
    this.ipcMain = ipcMain;
    this.mainWindow = mainWindow;
    
    // IPC 이벤트 리스너 등록
    if (this.ipcMain) {
      this.ipcMain.on('request-logs', (event) => {
        event.sender.send('init-logs', this.logs);
      });
    }
    
    // 로그 초기화 메시지
    this.info('로그 매니저가 초기화되었습니다.');
    this.info(`로그 파일: ${this.logFilePath}`);
  }
  
  /**
   * 로그 항목 추가
   * @param {string} level 로그 레벨 (debug, info, warn, error)
   * @param {string} message 로그 메시지
   * @param  {...any} args 추가 인자
   * @returns {Object} 로그 항목
   */
  _log(level, message, ...args) {
    // 메시지 포맷팅
    let formattedMessage = message;
    
    // 추가 인자가 있는 경우 형식 지정
    if (args && args.length > 0) {
      try {
        formattedMessage = `${message} ${args.map(arg => {
          if (typeof arg === 'object') {
            return JSON.stringify(arg);
          }
          return String(arg);
        }).join(' ')}`;
      } catch (err) {
        formattedMessage = `${message} [포맷 오류: ${err.message}]`;
      }
    }
    
    // 로그 항목 생성
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: formattedMessage
    };
    
    // 메모리에 저장
    this.logs.push(logEntry);
    
    // 최대 개수 초과 시 오래된 로그 제거
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // 파일에도 기록
    this.writeToFile(logEntry);
    
    // electron-log에도 기록
    switch (level) {
      case 'debug':
        electronLog.debug(formattedMessage);
        break;
      case 'info':
        electronLog.info(formattedMessage);
        break;
      case 'warn':
        electronLog.warn(formattedMessage);
        break;
      case 'error':
        electronLog.error(formattedMessage);
        break;
      default:
        electronLog.log(formattedMessage);
    }
    
    // GUI에 전송 (메인 윈도우가 있는 경우에만)
    this.sendToGui(logEntry);
    
    return logEntry;
  }
  
  /**
   * 로그 파일에 기록
   * @param {Object} logEntry 로그 항목
   */
  writeToFile(logEntry) {
    try {
      const logLine = `[${logEntry.timestamp}] [${logEntry.level.toUpperCase()}] ${logEntry.message}\n`;
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');

      // PowerShell에서 한글 로그 출력 색상 설정
      const colors = {
        debug: '',
        info: '\x1b[32m', // 초록색
        warn: '\x1b[33m', // 노란색
        error: '\x1b[31m', // 빨간색
        reset: '\x1b[0m'   // 색상 초기화
      };
      
      // 콘솔에도 출력 (개발용)
      if (process.env.NODE_ENV !== 'production') {
        try {
          const colorPrefix = colors[logEntry.level] || '';
          const output = `${colorPrefix}[${logEntry.timestamp}] [${logEntry.level.toUpperCase()}] ${logEntry.message}${colors.reset}`;
          
          // UTF-8 버퍼로 인코딩하여 출력
          const buffer = Buffer.from(`${output}\n`, 'utf8');
          process.stdout.write(buffer);
        } catch (consoleErr) {
          // 콘솔 출력 오류 발생 시 무시
        }
      }
    } catch (err) {
      // 파일 쓰기 오류 발생 시 콘솔에만 출력
      try {
        const buffer = Buffer.from(`로그 파일 쓰기 오류: ${err.message}\n`, 'utf8');
        process.stderr.write(buffer);
      } catch (consoleErr) {
        console.error(`로그 파일 쓰기 오류: ${err.message}`);
      }
    }
  }
  
  /**
   * GUI에 로그 전송
   * @param {Object} logEntry 로그 항목
   */
  sendToGui(logEntry) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('log-message', logEntry);
      } catch (err) {
        // GUI 전송 오류는 무시
      }
    }
  }
  
  /**
   * 디버그 로그
   * @param {string} message 로그 메시지
   * @param  {...any} args 추가 인자
   */
  debug(message, ...args) {
    if (this.isLevelEnabled('debug')) {
      this._log('debug', message, ...args);
    }
  }
  
  /**
   * 정보 로그
   * @param {string} message 로그 메시지
   * @param  {...any} args 추가 인자
   */
  info(message, ...args) {
    if (this.isLevelEnabled('info')) {
      this._log('info', message, ...args);
    }
  }
  
  /**
   * 경고 로그
   * @param {string} message 로그 메시지
   * @param  {...any} args 추가 인자
   */
  warn(message, ...args) {
    if (this.isLevelEnabled('warn')) {
      this._log('warn', message, ...args);
    }
  }
  
  /**
   * 오류 로그
   * @param {string} message 로그 메시지
   * @param  {...any} args 추가 인자
   */
  error(message, ...args) {
    if (this.isLevelEnabled('error')) {
      this._log('error', message, ...args);
    }
  }
  
  /**
   * 로그 레벨이 활성화되어 있는지 확인
   * @param {string} level 확인할 로그 레벨
   * @returns {boolean} 활성화 여부
   */
  isLevelEnabled(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const checkLevelIndex = levels.indexOf(level);
    return checkLevelIndex >= currentLevelIndex;
  }
  
  /**
   * 로그 뷰어 창 열기
   * @param {Electron.App} app Electron 앱 객체
   * @param {string} htmlPath 로그 뷰어 HTML 경로
   */
  openLogViewer(app, htmlPath) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }
    
    // 새 창에서 로그 뷰어 열기
    const { BrowserWindow } = require('electron');
    const logWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: '로그 뷰어',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // HTML 파일 로드
    logWindow.loadFile(htmlPath);
    
    // 개발 모드에서는 개발자 도구 열기
    if (process.env.NODE_ENV !== 'production') {
      logWindow.webContents.openDevTools();
    }
    
    // 로그 창이 준비되면 로그 전송
    logWindow.webContents.on('did-finish-load', () => {
      logWindow.webContents.send('init-logs', this.logs);
    });
    
    return logWindow;
  }
  
  /**
   * 로그 기록 가져오기
   * @param {number} count 가져올 로그 수 (기본값: 100)
   * @returns {Array} 로그 항목 배열
   */
  getLogs(count = 100) {
    return this.logs.slice(-count);
  }
  
  /**
   * 로그 파일 경로 가져오기
   * @returns {string} 로그 파일 경로
   */
  getLogFilePath() {
    return this.logFilePath;
  }
  
  /**
   * 모든 로그 지우기
   */
  clearLogs() {
    this.logs = [];
    
    // GUI에 로그 초기화 알림
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('init-logs', []);
    }
    
    this.info('로그가 초기화되었습니다.');
  }
}

// 싱글톤 인스턴스 생성
const logManager = new LogManager();

module.exports = logManager;