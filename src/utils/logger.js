// logger.js
// 로깅 유틸리티

const util = require('util');

/**
 * 한글을 포함한 문자열을 콘솔에 안전하게 출력하는 유틸리티
 */

// 콘솔 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// 한글 인코딩 확인
function ensureEncoding() {
  try {
    // Windows에서 코드페이지를 UTF-8로 설정
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      execSync('chcp 65001', { stdio: 'ignore' });
    }
  } catch (err) {
    // 오류 무시
  }
}

// 초기화 시 한 번만 실행
ensureEncoding();

// 시간 포맷 함수
function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

// 로깅 래퍼 함수
function log(message, ...args) {
  const timestamp = getTimestamp();
  const formattedMessage = formatMessage(message);
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${formattedMessage}`, ...args);
}

function info(message, ...args) {
  const timestamp = getTimestamp();
  const formattedMessage = formatMessage(message);
  console.info(`${colors.dim}[${timestamp}]${colors.reset} ${colors.green}[정보]${colors.reset} ${formattedMessage}`, ...args);
}

function warn(message, ...args) {
  const timestamp = getTimestamp();
  const formattedMessage = formatMessage(message);
  console.warn(`${colors.dim}[${timestamp}]${colors.reset} ${colors.yellow}[경고]${colors.reset} ${formattedMessage}`, ...args);
}

function error(message, ...args) {
  const timestamp = getTimestamp();
  const formattedMessage = formatMessage(message);
  console.error(`${colors.dim}[${timestamp}]${colors.reset} ${colors.red}[오류]${colors.reset} ${formattedMessage}`, ...args);
}

// 메시지 포맷팅 함수
function formatMessage(message) {
  if (typeof message === 'string') {
    try {
      // Windows에서 한글이 깨지는 경우를 위한 추가 처리
      if (process.platform === 'win32') {
        const iconv = require('iconv-lite');
        return iconv.decode(Buffer.from(message), 'utf8');
      }
      return message;
    } catch (err) {
      // fallback: 그대로 반환
      return message;
    }
  }
  
  // 객체인 경우 예쁘하게 포맷팅
  if (typeof message === 'object') {
    try {
      return util.inspect(message, { colors: true, depth: 4 });
    } catch (err) {
      return String(message);
    }
  }
  
  return String(message);
}

// 한글 로그 형식화 함수
function formatKorean(message) {
  if (typeof message === 'string') {
    try {
      // Windows에서 한글이 깨지는 경우를 위한 추가 처리
      if (process.platform === 'win32') {
        const iconv = require('iconv-lite');
        return iconv.decode(Buffer.from(message), 'utf8');
      }
      return message;
    } catch (err) {
      return message;
    }
  }
  return message;
}

// 모듈 내보내기
module.exports = {
  log,
  info,
  warn,
  error,
  formatKorean,
  colors
};