# 데스크탑 컨트롤러 프로그램 구조 및 기능 목록

## 프로젝트 개요
데스크탑 컨트롤러는 원격에서 모바일 앱을 통해 데스크탑을 제어할 수 있는 시스템입니다. 모바일 앱에서 명령을 내리면 데스크탑에 설치된 클로드 데스크탑 앱을 활성화하고, 명령을 자동으로 입력하여 실행합니다. 이후 AI 응답 영역만을 선택적으로 캡처하여 모바일 앱으로 전송합니다.

## 파일 구조

### 메인 파일
- **main.js**: 애플리케이션 진입점으로 Electron 앱 초기화 및 메인 프로세스 관리
- **preload.js**: Electron의 컨텍스트 브릿지를 설정하여 IPC 통신 구성

### 서버 관련 파일
- **src/server/serverManager.js**: Express 서버 및 Socket.IO 서버 관리
  - `init()`: 서버 관리자 초기화
  - `startServer()`: 서버 시작 함수
  - `stopServer()`: 서버 중지 함수
  - `getServerStatus()`: 서버 상태 정보 반환
  
- **src/server/socketManager.js**: 소켓 연결 및 클라이언트 관리
  - `init()`: 소켓 매니저 초기화
  - `setSocketIO()`: Socket.IO 객체 설정
  - `setupSocketEvents()`: 소켓 이벤트 리스너 설정
  - `sendToClient()`: 특정 클라이언트에게 이벤트 전송
  - `notifyAllClients()`: 모든 클라이언트에게 이벤트 전송
  - `disconnectClient()`: 클라이언트 연결 해제
  - `getAllClients()`: 모든 클라이언트 정보 반환

### 컨트롤러 파일
- **src/controllers/userManager.js**: 사용자 관리 및 인증 처리
  - `getUserData()`: 사용자 데이터 가져오기
  - `saveUserData()`: 사용자 데이터 저장
  - `addUser()`: 사용자 추가
  - `updateUser()`: 사용자 정보 업데이트
  - `deleteUser()`: 사용자 삭제
  - `authenticateUser()`: 사용자 인증
  
- **src/controllers/ipcController.js**: IPC 이벤트 처리 및 렌더러 프로세스와 통신
  - `init()`: IPC 컨트롤러 초기화
  - `addCommandHistory()`: 명령 기록 추가
  - `addActivityLog()`: 활동 로그 추가
  - 다양한 IPC 이벤트 리스너 설정 (서버 관리, 사용자 관리, 캡처 관리 등)

### 서비스 파일
- **src/services/captureManager.js**: 화면 캡처 관리
  - `init()`: 캡처 관리자 초기화
  - `captureScreen()`: 화면 캡처 수행
  - `selectCaptureArea()`: 캡처 영역 선택
  - `setCaptureArea()`: 캡처 영역 설정
  - `sendCaptureToClient()`: 캡처 이미지를 클라이언트에 전송
  - `optimizeImage()`: 이미지 품질 최적화
  
- **src/services/claudeManager.js**: 클로드 앱 제어
  - `init()`: 클로드 앱 매니저 초기화
  - `launchClaudeApp()`: 클로드 앱 실행
  - `activateClaudeWindow()`: 클로드 앱 창 활성화
  - `findInputField()`: 입력 필드 찾기
  - `typeCommand()`: 명령 입력
  - `captureResponse()`: 응답 영역 캡처
  - `controlClaudeApp()`: 클로드 앱 제어 메인 함수
  - `processCommandQueue()`: 명령 큐 처리

### 유틸리티 파일
- **src/utils/configManager.js**: 설정 관리
  - `init()`: 설정 관리자 초기화
  - `initializeDefaultSettings()`: 기본 설정 초기화
  - `getSetting()`: 설정 가져오기
  - `setSetting()`: 설정 저장하기
  - `resetSettings()`: 설정 초기화
  - `getServerInfo()`: 서버 정보 가져오기
  - `getClaudeSettings()`: 클로드 앱 설정 가져오기

### UI 관련 파일
- **src/index.html**: 메인 HTML 파일
- **src/style.css**: CSS 스타일 정의
- **src/renderer.js**: UI 이벤트 처리 및 상호작용
  - `initTabs()`: 탭 전환 기능 초기화
  - `initModals()`: 모달 창 제어 초기화
  - `initServerControls()`: 서버 제어 초기화
  - `initUserManagement()`: 사용자 관리 초기화
  - `initSettingsForm()`: 설정 폼 초기화
  - `initCaptureControls()`: 화면 캡처 컨트롤 초기화
  - `initCommandHistory()`: 명령 이력 초기화
  - `updateClientsInfo()`: 클라이언트 정보 업데이트
  - `updateActivityLog()`: 활동 로그 업데이트

## 주요 기능 목록

### 1. 서버 관리 기능
- 서버 시작/중지
- 서버 상태 모니터링
- 포트 및 IP 정보 표시
- 연결된 클라이언트 관리
- QR 코드 및 연결 URL 제공

### 2. 사용자 관리 기능
- 사용자 목록 표시
- 사용자 추가/수정/삭제
- 사용자 인증 시스템
- 비밀번호 정책 설정
- 로그인 시간 제한 설정

### 3. 화면 캡처 기능
- 캡처 영역 선택
- 테스트 캡처 기능
- 이미지 품질 설정
- 자동 캡처 설정
- 캡처 이미지 전송 기능
- 캡처 히스토리 관리

### 4. 클로드 앱 제어 기능
- 클로드 앱 실행 및 활성화
- 명령어 자동 입력
- 엔터키 자동 입력
- 응답 영역 자동 캡처
- 명령 큐 관리
- 멀티 클라이언트 지원

### 5. UI 인터페이스 기능
- 탭 기반 네비게이션
- 반응형 대시보드
- 모달 창 시스템
- 사용자 친화적인 폼
- 테이블 및 목록 표시
- 실시간 상태 업데이트
- 활동 로그 표시

### 6. 소켓 통신 기능
- 실시간 양방향 통신
- 인증 시스템
- 명령 전송 및 응답
- 연결 상태 모니터링
- 연결 해제 및 재연결 처리
- 에러 처리 및 복구

### 7. 설정 및 구성 기능
- 서버 설정 관리
- 클로드 앱 경로 설정
- 캡처 설정 관리
- 보안 설정 관리
- 설정 저장 및 불러오기
- 설정 초기화

## 데이터 흐름

1. **명령 실행 흐름**:
   - 모바일 앱 → Socket.IO → socketManager → claudeManager → 클로드 앱 → captureManager → socketManager → 모바일 앱

2. **사용자 인증 흐름**:
   - 모바일 앱 → Socket.IO → socketManager → userManager → socketManager → 모바일 앱

3. **설정 변경 흐름**:
   - UI → renderer.js → ipcMain → configManager → electron-store

4. **이벤트 알림 흐름**:
   - 이벤트 발생 → ipcController → mainWindow → renderer.js → UI

## 확장 가능한 기능

1. **플러그인 시스템**:
   - 플러그인 구조를 통해 새로운 명령어 타입 추가 가능
   - 사용자 지정 명령어 설정 기능

2. **다중 클로드 앱 지원**:
   - 여러 AI 앱 동시 제어 가능
   - 앱별 설정 및 관리

3. **보안 강화**:
   - End-to-End 암호화 지원
   - 이중 인증 시스템

4. **사용자 권한 관리**:
   - 관리자/일반 사용자 구분
   - 사용자별 권한 설정

5. **명령어 템플릿**:
   - 자주 사용하는 명령어 저장
   - 명령어 그룹 관리

## 의존성 패키지

- **electron**: 데스크탑 앱 프레임워크
- **express**: 웹 서버
- **socket.io**: 실시간 양방향 통신
- **electron-store**: 설정 저장
- **robotjs**: 키보드/마우스 자동화
- **screenshot-desktop**: 화면 캡처
- **ip**: IP 주소 관리

## 개발 및 빌드 방법

### 개발 환경 설정
```bash
# 프로젝트 디렉터리로 이동
cd D:\claude\desktop-contrller\desktop-contrller

# 필수 패키지 설치
npm install electron express socket.io electron-store robotjs screenshot-desktop ip

# 개발 모드로 실행
npm start
```

### 빌드 방법
```bash
# 패키지 설치 (없는 경우)
npm install electron-builder

# Windows용 빌드
npm run build:win

# macOS용 빌드 (macOS 환경에서만 가능)
npm run build:mac
```
