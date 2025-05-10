// logger.js
// 로깅 유틸리티 - 한글 출력 포함

const fs = require('fs');
const path = require('path');
const util = require('util');
const electronLog = require('electron-log');
const { app } = require('electron');

// 로그 파일 경로 설정
let logDir;
try {
  logDir = app ? path.join(app.getPath('userData'), 'logs') : path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

const logFilePath = path.join(logDir, `desktop-controller-${new Date().toISOString().slice(0, 10)}.log`);

// 최신 로그를 파일에 저장하는 함수
function writeToLogFile(message) {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
  } catch (err) {
    // 로그 파일 쓰기 실패시 노드 콘솔에 오류 출력
    process.stdout.write(`[로그 파일 쓰기 실패] ${err.message}\n`);
  }
}

// 한글 팝업창 설정 - 한글이 안 보일 때 확인용
function showKoreanPopup(message) {
  try {
    const { dialog } = require('electron');
    dialog.showMessageBoxSync({
      type: 'info',
      title: '한글 테스트',
      message: message,
      buttons: ['확인']
    });
  } catch (err) {
    // 오류 무시
  }
}

// 시간 포맷 함수
function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

// 시스템 콘솔에 로그 출력
function writeToConsole(level, message) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  // 사용자 정의 문자열 색상 설정
  let coloredPrefix = prefix;
  if (process.stdout.isTTY) {
    const colors = {
      info: '\x1b[32m', // 초록색
      warn: '\x1b[33m', // 노란색
      error: '\x1b[31m', // 빨간색
      reset: '\x1b[0m'   // 색상 초기화
    };
    coloredPrefix = `${colors[level] || ''}${prefix}${colors.reset}`;
  }
  
  // 메시지 출력
  const output = `${coloredPrefix} ${message}`;
  
  // PowerShell에서 한글이 깨지는 문제 해결을 위해 인코딩 설정 처리
  try {
    // Buffer를 사용하여 UTF-8로 인코딩된 데이터 생성
    const buffer = Buffer.from(`${output}\n`, 'utf8');
    
    switch (level) {
      case 'error':
        process.stderr.write(buffer);
        break;
      case 'warn':
      default:
        process.stdout.write(buffer);
    }
  } catch (err) {
    // 인코딩 오류 발생 시 기본 방식으로 출력 시도
    switch (level) {
      case 'error':
        process.stderr.write(`${output}\n`);
        break;
      case 'warn':
      default:
        process.stdout.write(`${output}\n`);
    }
  }
  
  // 로그 파일에도 저장
  writeToLogFile(`[${level.toUpperCase()}] ${message}`);
}

// 포맷팅 함수
function formatMessage(message, ...args) {
  if (typeof message === 'string') {
    if (args.length === 0) {
      return message;
    }
    
    // 포맷팅 문자열이 있는 경우 (printf 스타일)
    try {
      return util.format(message, ...args);
    } catch (err) {
      return `${message} ${args.join(' ')}`;
    }
  }
  
  // 객체인 경우
  if (typeof message === 'object') {
    try {
      const objStr = util.inspect(message, { depth: 4, colors: false });
      if (args.length === 0) {
        return objStr;
      }
      return `${objStr} ${args.map(arg => {
        if (typeof arg === 'object') {
          return util.inspect(arg, { depth: 2, colors: false });
        }
        return String(arg);
      }).join(' ')}`;
    } catch (err) {
      return String(message);
    }
  }
  
  // 기본은 문자열로 변환
  return String(message);
}

// 로그 함수
function log(message, ...args) {
  const formattedMessage = formatMessage(message, ...args);
  writeToConsole('info', formattedMessage);
  
  // electron-log에도 기록
  try {
    electronLog.info(formattedMessage);
  } catch (err) {
    // 오류 무시
  }
}

function info(message, ...args) {
  const formattedMessage = formatMessage(message, ...args);
  writeToConsole('info', formattedMessage);
  
  // electron-log에도 기록
  try {
    electronLog.info(formattedMessage);
  } catch (err) {
    // 오류 무시
  }
}

function warn(message, ...args) {
  const formattedMessage = formatMessage(message, ...args);
  writeToConsole('warn', formattedMessage);
  
  // electron-log에도 기록
  try {
    electronLog.warn(formattedMessage);
  } catch (err) {
    // 오류 무시
  }
}

function error(message, ...args) {
  const formattedMessage = formatMessage(message, ...args);
  writeToConsole('error', formattedMessage);
  
  // electron-log에도 기록
  try {
    electronLog.error(formattedMessage);
  } catch (err) {
    // 오류 무시
  }
}

// 로그 파일 경로 반환
function getLogFilePath() {
  return logFilePath;
}

// 한글 테스트 함수
function testKorean() {
  // 한글 테스트 메시지
  const testMessage = '한글 출력 테스트: 안녕하세요';
  
  // 테스트 메시지 팝업 표시
  showKoreanPopup(testMessage);
  
  // 콘솔에 테스트 메시지 출력
  log(testMessage);
  info(testMessage);
  warn(testMessage);
  error(testMessage);
  
  return testMessage;
}

// 모듈 내보내기
module.exports = {
  log,
  info,
  warn,
  error,
  getLogFilePath,
  testKorean
};