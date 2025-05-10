/**
 * start-console.js
 * Node.js 애플리케이션 실행 전 콘솔 인코딩을 자동으로 설정하는 스크립트
 * npm start나 npm run dev 시 자동으로 실행됨
 */

// 필수 모듈 로드
const { spawn } = require('child_process');
const path = require('path');

// 시작 메시지
console.log('데스크탑 컨트롤러 애플리케이션을 시작합니다...');
console.log('콘솔 인코딩을 UTF-8로 설정하는 중...');

// 코드 페이지를 UTF-8로 변경 (Windows 환경)
if (process.platform === 'win32') {
  try {
    // 코드 페이지 명령 실행
    const chcpProcess = spawn('cmd.exe', ['/c', 'chcp 65001'], { stdio: 'inherit' });
    
    chcpProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('콘솔 인코딩이 UTF-8로 설정되었습니다.');
        // 설정 성공 후 애플리케이션 시작
        startApplication();
      } else {
        console.error(`코드 페이지 변경 실패 (코드: ${code})`);
        // 오류가 있더라도 애플리케이션 시도
        startApplication();
      }
    });
  } catch (err) {
    console.error('코드 페이지 변경 오류:', err.message);
    // 오류가 있더라도 애플리케이션 시작
    startApplication();
  }
} else {
  // Windows가 아닌 환경에서는 바로 시작
  startApplication();
}

/**
 * 애플리케이션 메인 프로세스 시작
 */
function startApplication() {
  // 명령줄 인자 확인
  const isDev = process.argv.includes('--dev');
  
  // 환경 변수 설정
  const env = process.env;
  
  // 개발 모드 여부에 따라 설정
  if (isDev) {
    console.log('개발 모드로 실행합니다...');
    env.NODE_ENV = 'development';
  } else {
    console.log('프로덕션 모드로 실행합니다...');
    env.NODE_ENV = 'production';
  }
  
  // 한글 인코딩 관련 환경 변수 설정
  env.LANG = 'ko_KR.UTF-8';
  env.LC_ALL = 'ko_KR.UTF-8';
  env.NODE_ENV_FORCE_UTF8 = 'true';
  
  // Electron 실행
  const electronPath = require('electron');
  const mainPath = path.join(__dirname, 'main.js');
  
  const args = [mainPath];
  if (isDev) {
    args.push('--dev');
  }
  
  console.log('Electron 시작 중...');
  
  // Electron 프로세스 생성
  const electronProcess = spawn(electronPath, args, {
    stdio: 'inherit',
    env: env
  });
  
  // 종료 이벤트 처리
  electronProcess.on('exit', (code) => {
    console.log(`애플리케이션이 종료되었습니다. (코드: ${code || 0})`);
    process.exit(code || 0);
  });
  
  // CTRL+C 같은 시그널 처리
  process.on('SIGINT', () => {
    console.log('애플리케이션 종료 신호 수신 (SIGINT)');
    electronProcess.kill();
  });
  
  process.on('SIGTERM', () => {
    console.log('애플리케이션 종료 신호 수신 (SIGTERM)');
    electronProcess.kill();
  });
}
