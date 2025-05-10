/**
 * consoleEncoding.js
 * 콘솔 출력 인코딩을 강제로 UTF-8로 설정하는 유틸리티
 * 애플리케이션 시작시 자동으로 로드되어 처리
 */

// Windows에서 추가적인 설정
// process.env에 UTF8 설정 추가
process.env.NODE_ENV_FORCE_UTF8 = 'true';

// 처음 실행시 메시지
console.log('콘솔 인코딩 설정을 자동으로 구성하는 중...');

// 표준 출력과 표준 오류의 인코딩을 UTF-8로 설정
try {
  process.stdout.setEncoding('utf8');
  process.stderr.setEncoding('utf8');
} catch (e) {
  // 설정 실패시 무시 - 이미 설정되어 있을 수 있음
}

// 원본 console 메서드 백업
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

/**
 * 텍스트를 UTF-8 버퍼로 처리하여 출력
 * @param {Object} stream 출력 스트림 (예: process.stdout)
 * @param {string} message 출력할 메시지
 * @param {string} colorCode 색상 코드 (옵션)
 */
function writeUtf8(stream, message, colorCode = '') {
  try {
    // 객체인 경우 문자열로 변환
    if (typeof message === 'object') {
      try {
        message = JSON.stringify(message, null, 2);
      } catch (e) {
        message = String(message);
      }
    }
    
    // 문자열이 아니면 단순히 문자열로 변환
    message = String(message);
    
    // 색상 코드 추가 (있는 경우)
    const reset = '\x1b[0m';
    if (colorCode) {
      message = `${colorCode}${message}${reset}`;
    }
    
    // UTF-8 버퍼를 사용하여 출력
    const buffer = Buffer.from(message + '\n', 'utf8');
    stream.write(buffer);
  } catch (err) {
    // 오류 발생 시 원본 방식으로 출력 시도
    stream.write(String(message) + '\n');
  }
}

// console.log 오버라이드
console.log = function() {
  try {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    writeUtf8(process.stdout, message);
  } catch (err) {
    // 오류 발생 시 원본 메서드 호출
    originalConsoleLog.apply(console, arguments);
  }
};

// console.info 오버라이드
console.info = function() {
  try {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    writeUtf8(process.stdout, message, '\x1b[36m'); // 하늘색
  } catch (err) {
    // 오류 발생 시 원본 메서드 호출
    originalConsoleInfo.apply(console, arguments);
  }
};

// console.debug 오버라이드
console.debug = function() {
  try {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    writeUtf8(process.stdout, message, '\x1b[90m'); // 회색
  } catch (err) {
    // 오류 발생 시 원본 메서드 호출
    originalConsoleDebug.apply(console, arguments);
  }
};

// console.warn 오버라이드
console.warn = function() {
  try {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    writeUtf8(process.stdout, message, '\x1b[33m'); // 노란색
  } catch (err) {
    // 오류 발생 시 원본 메서드 호출
    originalConsoleWarn.apply(console, arguments);
  }
};

// console.error 오버라이드
console.error = function() {
  try {
    const args = Array.from(arguments);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    writeUtf8(process.stderr, message, '\x1b[31m'); // 빨간색
  } catch (err) {
    // 오류 발생 시 원본 메서드 호출
    originalConsoleError.apply(console, arguments);
  }
};

// 한글 테스트 함수
function testKorean() {
  console.log('한글 출력 테스트: 안녕하세요!');
  console.info('한글 정보 테스트: 도움말 정보입니다.');
  console.debug('한글 디버그 테스트: 디버그 메시지입니다.');
  console.warn('한글 경고 테스트: 주의하세요!');
  console.error('한글 오류 테스트: 오류가 발생했습니다!');
  return true;
}

// 초기화 시점에 한번 한글 테스트 실행
// 이렇게 하면 처음부터 인코딩이 올바르게 되어있는지 확인 가능
testKorean();

// 모듈로 내보내기
module.exports = {
  testKorean,
  // 원본 콘솔 메서드 저장
  originalConsoleLog,
  originalConsoleWarn,
  originalConsoleError,
  originalConsoleInfo,
  originalConsoleDebug,
  // 다시 원본으로 복원하는 함수
  restoreOriginals() {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
    return true;
  }
};