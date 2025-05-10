/**
 * PowerShell 인코딩 문제를 해결하기 위한 스크립트
 * 프로젝트를 시작하기 전에 실행하여 PowerShell의 인코딩을 UTF-8로 설정합니다.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getPowerShellEncodingCommand } = require('../src/utils/unicodeHelper');

// 배치 파일 생성 경로
const batchFilePath = path.join(__dirname, 'run-with-utf8.bat');

/**
 * PowerShell에서 UTF-8 인코딩 명령어로 프로젝트를 시작하는 배치 파일 생성
 */
function createEncodingBatchFile() {
  try {
    // UTF-8 인코딩 명령어
    const encodingCommand = getPowerShellEncodingCommand();
    
    // 배치 파일 내용 생성
    const batchContent = `@echo off
echo PowerShell 인코딩을 UTF-8로 설정하고 애플리케이션을 시작합니다...
powershell -Command "${encodingCommand}; cd '%~dp0..'; npm run dev"
`;

    // 배치 파일 작성
    fs.writeFileSync(batchFilePath, batchContent, 'utf8');
    console.log(`배치 파일이 생성되었습니다: ${batchFilePath}`);
    
    return true;
  } catch (err) {
    console.error('배치 파일 생성 오류:', err.message);
    return false;
  }
}

/**
 * PowerShell 명령어 직접 실행하기
 */
function runWithProperEncoding() {
  try {
    const encodingCommand = getPowerShellEncodingCommand();
    
    // PowerShell로 명령어 실행
    const ps = spawn('powershell.exe', [
      '-Command',
      `${encodingCommand}; Write-Host "인코딩 설정 완료: 한글 테스트: 안녕하세요" -ForegroundColor Green`
    ]);
    
    ps.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    ps.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    ps.on('close', (code) => {
      if (code === 0) {
        console.log('PowerShell 인코딩 설정이 성공적으로 완료되었습니다.');
      } else {
        console.error(`PowerShell 명령 실행 실패 (종료 코드: ${code})`);
      }
    });
    
    return true;
  } catch (err) {
    console.error('PowerShell 명령 실행 오류:', err.message);
    return false;
  }
}

// 메인 실행 부분
if (require.main === module) {
  console.log('PowerShell 인코딩 문제 해결 스크립트를 실행합니다...');
  
  // 배치 파일 생성
  const batchCreated = createEncodingBatchFile();
  
  // 인코딩 테스트 실행
  if (batchCreated) {
    runWithProperEncoding();
  }
}

module.exports = {
  createEncodingBatchFile,
  runWithProperEncoding
};
