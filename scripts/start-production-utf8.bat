@echo off
REM 콘솔 코드 페이지를 UTF-8(65001)로 변경
chcp 65001 > nul
echo UTF-8 인코딩으로 설정되었습니다 (코드 페이지: 65001)
echo 한글 테스트: 안녕하세요

REM 현재 디렉토리를 스크립트 상위 폴더로 변경
cd /d "%~dp0.."

REM 애플리케이션 실행 (프로덕션 모드)
echo 프로덕션 모드로 애플리케이션을 시작합니다...
set NODE_ENV=production
npm run start

REM 에러가 발생할 경우 사용자에게 알림
if %ERRORLEVEL% neq 0 (
  echo 애플리케이션 실행 중 오류가 발생했습니다. (오류 코드: %ERRORLEVEL%)
  pause
)
