/**
 * 유니코드 변환 헬퍼
 * 한글이 깨지는 문제를 해결하기 위해 유니코드 변환 기능 제공
 */

// 문자열을 유니코드 이스케이프 시퀀스로 변환
function toUnicode(str) {
  return Array.from(str)
    .map(c => {
      // ASCII 범위는 그대로 유지 (더 읽기 쉬움)
      if (c.charCodeAt(0) < 128) {
        return c;
      }
      // 나머지는 Unicode 이스케이프 시퀀스로 변환
      return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    })
    .join('');
}

// 유니코드 이스케이프 시퀀스를 일반 문자열로 변환
function fromUnicode(str) {
  return str.replace(/\\u([0-9a-f]{4})/gi, (match, group) => {
    return String.fromCharCode(parseInt(group, 16));
  });
}

// 숫자 코드를 유니코드 문자로 변환
function codePointToChar(codePoint) {
  try {
    return String.fromCodePoint(codePoint);
  } catch (err) {
    return String.fromCharCode(codePoint);
  }
}

// 우회책으로 자주 사용되는 한글 문자열 리터럴 제공
const KoreanMessages = {
  // 기본 메시지
  START: '\uC2DC\uC791',
  END: '\uC885\uB8CC',
  SUCCESS: '\uC131\uACF5',
  FAIL: '\uC2E4\uD328',
  ERROR: '\uC624\uB958',
  NEXT: '\uB2E4\uC74C',
  PREV: '\uC774\uC804',
  CANCEL: '\uCDE8\uC18C',
  CONFIRM: '\uD655\uC778',
  OK: '\uD655\uC778',
  YES: '\uC608',
  NO: '\uC544\uB2C8\uC624',
  
  // 서버 관련
  SERVER_START: '\uC11C\uBC84 \uC2DC\uC791...',
  SERVER_STOP: '\uC11C\uBC84 \uC885\uB8CC \uC911...',
  SERVER_START_SUCCESS: '\uC11C\uBC84 \uC2DC\uC791 \uC131\uACF5',
  SERVER_START_FAIL: '\uC11C\uBC84 \uC2DC\uC791 \uC2E4\uD328',
  SERVER_STOP_SUCCESS: '\uC11C\uBC84 \uC885\uB8CC \uC131\uACF5',
  SERVER_STOP_FAIL: '\uC11C\uBC84 \uC885\uB8CC \uC2E4\uD328',
  
  // 스트리밍 관련
  STREAMING_START: '\uC2A4\uD2B8\uB9AC\uBC0D \uC2DC\uC791...',
  STREAMING_STOP: '\uC2A4\uD2B8\uB9AC\uBC0D \uC911\uC9C0',
  STREAMING_ALREADY_ACTIVE: '\uC2A4\uD2B8\uB9AC\uBC0D\uC774 \uC774\uBBF8 \uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. \uC7AC\uC2DC\uC791\uD569\uB2C8\uB2E4.',
  STREAMING_AUTO_START: '\uC790\uB3D9 \uC2A4\uD2B8\uB9AC\uBC0D \uC2DC\uC791\uB428',
  
  // 로그 관련
  MAIN_PROCESS_START: '\uBA54\uC778 \uD504\uB85C\uC138\uC2A4 \uC2DC\uC791...',
  LOG_FILE_PATH: '\uB85C\uADF8 \uD30C\uC77C \uACBD\uB85C',
  KOREAN_TEST_SUCCESS: '\uD55C\uAE00 \uD14C\uC2A4\uD2B8 \uC131\uACF5!',
  KOREAN_TEST_ERROR: '\uD55C\uAE00 \uD14C\uC2A4\uD2B8 \uC624\uB958',
  KOREAN_TEST_MESSAGE: '\uD55C\uAE00 \uCD9C\uB825 \uD14C\uC2A4\uD2B8: \uC548\uB155\uD558\uC138\uC694'
};

/**
 * PowerShell에서 한글 출력을 위한 도움 함수
 * @param {string} message 출력할 메시지
 * @param {string} colorCode 선택적 색상 코드 (ANSI 컬러 코드)
 * @returns {void}
 */
function writeToPowerShell(message, colorCode = '') {
  try {
    const reset = '\x1b[0m';
    const output = colorCode ? `${colorCode}${message}${reset}` : message;
    const buffer = Buffer.from(`${output}\n`, 'utf8');
    process.stdout.write(buffer);
  } catch (err) {
    // 버퍼 출력 실패시 일반 콘솔 사용
    console.log(message);
  }
}

/**
 * PowerShell에서 한글 출력을 위한 명령어 생성
 * 시작 전에 PowerShell에서 실행할 수 있는 명령어를 반환
 * @returns {string} PowerShell에서 실행할 명령어
 */
function getPowerShellEncodingCommand() {
  return '$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8';
}

module.exports = {
  toUnicode,
  fromUnicode,
  codePointToChar,
  KoreanMessages,
  writeToPowerShell,
  getPowerShellEncodingCommand
};