# 데스크탑 컨트롤러 프로그램 구조 및 기능 목록

## 프로젝트 구조

### 데스크탑 앱 (서버)
```
desktop-contrller/
├── main.js                 # 애플리케이션 진입점
├── preload.js              # Electron 프리로드 스크립트
├── package.json            # 프로젝트 메타데이터 및 의존성
├── src/
│   ├── index.html          # 메인 HTML 파일
│   ├── style.css           # 전역 스타일
│   ├── renderer.js         # 렌더러 프로세스 진입점 (2023-05-11 수정)
│   ├── debug.js            # 디버깅용 파일
│   ├── preload.js          # 렌더러 용 프리로드 스크립트
│   ├── assets/             # 애셋 파일
│   │   ├── css/            # CSS 파일
│   │   ├── images/         # 이미지 파일
│   │   └── js/             # 추가 자바스크립트
│   ├── components/         # UI 컴포넌트
│   │   ├── ClientList.js    # 클라이언트 목록 컴포넌트
│   │   ├── Dashboard.js     # 대시보드 컴포넌트
│   │   └── ServerStatus.js  # 서버 상태 컴포넌트
│   ├── controllers/        # 컨트롤러 모듈
│   │   ├── ipcController.js # IPC 이벤트 처리
│   │   ├── testController.js # 테스트 컨트롤러
│   │   └── userManager.js   # 사용자 관리
│   ├── core/               # 핵심 기능 관련 모듈
│   │   └── app.js          # 앱 초기화 및 코어 기능
│   ├── features/           # 주요 기능 모듈
│   │   ├── server.js       # 서버 관련 기능
│   │   ├── capture.js      # 캡처 관련 기능
│   │   ├── users.js        # 사용자 관리 관련 기능
│   │   └── settings.js     # 설정 관련 기능
│   ├── server/             # 서버 관련 모듈
│   │   ├── serverManager.js # 서버 생성 및 관리
│   │   └── socketManager.js # 소켓 연결 및 클라이언트 관리
│   ├── services/           # 서비스 모듈
│   │   ├── captureManager.js     # 화면 캡처 기능
│   │   ├── captureStreamManager.js # 캡처 스트리밍 관리
│   │   ├── claudeManager.js      # 클로드 앱 제어 기능
│   │   └── commandProcessor.js   # 명령어 처리 기능
│   ├── ui/                 # UI 관련 모듈
│   │   ├── navigation.js   # 내비게이션 관련 기능 (2023-05-11 수정)
│   │   ├── modal.js        # 모달 관련 기능
│   │   └── toast.js        # 토스트 메시지 관련 기능
│   ├── utils/              # 유틸리티 모듈
│   │   ├── configManager.js # 설정 관리
│   │   ├── cryptoUtils.js   # 암호화 유틸리티
│   │   ├── formatters.js    # 포매터 유틸리티
│   │   ├── logger.js        # 로깅 유틸리티
│   │   ├── logManager.js    # 로그 관리
│   │   ├── unicodeHelper.js # 유니코드 보조 유틸리티
│   │   └── windowsUtils.js  # 윈도우 관련 유틸리티
│   └── views/              # 추가 뷰 화면
│       ├── claudeTest.html   # 클로드 앱 연결 테스트 화면
│       └── logViewer.html    # 로그 뷰어 화면
└── scripts/              # 실행 스크립트
    ├── run-with-utf8.bat    # UTF-8 인코딩으로 실행하는 배치 파일
    └── run-with-utf8-start.bat # UTF-8으로 프로덕션 모드 실행 배치 파일
```

### 모바일 앱 (클라이언트)
```
desktop-contrller-remote/
├── package.json            # 프로젝트 메타데이터 및 의존성
├── capacitor.config.ts     # Capacitor 설정
├── ionic.config.json       # Ionic 설정
├── src/
│   ├── App.js              # 애플리케이션 진입점
│   ├── index.js            # 메인 렌더링 파일
│   ├── theme/              # 테마 및 스타일
│   │   ├── variables.css    # CSS 변수 정의
│   │   └── index.css        # 메인 스타일시트
│   ├── pages/              # 페이지 컴포넌트
│   │   ├── CommandScreen.js  # 명령 전송 화면
│   │   ├── CommandScreen.css # 명령 화면 스타일
│   │   ├── Login.js         # 로그인 화면
│   │   ├── Login.css        # 로그인 화면 스타일
│   │   ├── Main.js          # 메인 화면
│   │   ├── Main.css         # 메인 화면 스타일
│   │   ├── ResponseScreen.js # 응답 화면
│   │   └── ResponseScreen.css # 응답 화면 스타일
│   ├── components/         # 재사용 컴포넌트
│   │   ├── AILogo.js         # AI 로고 컴포넌트
│   │   ├── AuthContext.js    # 인증 컨텍스트 관리
│   │   ├── ConnectionStatus.js # 연결 상태 표시 컴포넌트
│   │   ├── ConnectionStatus.css # 연결 상태 스타일
│   │   ├── QuickCommands.js   # 빠른 명령 컴포넌트
│   │   ├── QuickCommands.css  # 빠른 명령 스타일
│   │   └── LogoComponents.js   # 여러 로고 관련 컴포넌트
│   └── services/           # 서비스 로직
│       ├── SocketService.js  # 소켓 연결 관리
│       └── AuthService.js    # 인증 서비스
```

## 파일 설명

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

- **src/services/commandProcessor.js**: 명령어 처리 기능
  - `processCommand()`: 명령어 처리
  - `queueCommand()`: 명령어 큐에 추가
  - `executeNextCommand()`: 다음 명령어 실행

### 유틸리티 파일
- **src/utils/configManager.js**: 설정 관리
  - `init()`: 설정 관리자 초기화
  - `initializeDefaultSettings()`: 기본 설정 초기화
  - `getSetting()`: 설정 가져오기
  - `setSetting()`: 설정 저장하기
  - `resetSettings()`: 설정 초기화
  - `getServerInfo()`: 서버 정보 가져오기
  - `getClaudeSettings()`: 클로드 앱 설정 가져오기

- **src/utils/logger.js**: 로깅 유틸리티
  - `log()`: 일반 로그 기록
  - `error()`: 오류 로그 기록
  - `warn()`: 경고 로그 기록
  - `info()`: 정보 로그 기록

### UI 관련 파일
- **src/index.html**: 메인 HTML 파일
- **src/style.css**: CSS 스타일 정의

- **src/renderer.js**: 렌더러 프로세스 진입점 (2023-05-11 수정)
  - 전역 오류 처리 설정 및 미처리 프로미스 오류 처리
  - `showErrorMessage()`: 오류 메시지 표시 함수
  - `addErrorToDOM()`: DOM에 오류 메시지를 추가하는 함수
  - DOM 로드 후 앱 초기화 로직
  - `setupBackupUI()`: electronAPI 실패 시 백업 UI 설정
  - `initBackupNavigation()`: 백업 네비게이션 초기화 (추가됨)
  - 비동기 초기화 처리를 위한 Promise 처리 개선

- **src/ui/navigation.js**: 내비게이션 관련 기능 (2023-05-11 수정)
  - `initNavElements()`: 내비게이션 DOM 요소 초기화
  - `initNavigation()`: 내비게이션 초기화
  - `addNavigationStyle()`: 탭 스타일 관련 CSS 추가
  - `navigateToPage()`: 페이지 이동 함수
  - `showPageError()`: 페이지 초기화 오류 시 사용자에게 메시지 표시 (추가됨)
  - `getServerStatus()`: 서버 상태 조회 (window.electronAPI 사용 방식으로 변경)
  - 직접 ipcRenderer 사용 제거 및 window.electronAPI를 통한 안전한 통신 구현

- **src/ui/modal.js**: 모달 관련 기능
  - `showModal()`: 모달 창 표시
  - `hideModal()`: 모달 창 숨기기
  - `initModal()`: 모달 초기화

- **src/ui/toast.js**: 토스트 메시지 관련 기능
  - `showToast()`: 토스트 메시지 표시
  - `hideToast()`: 토스트 메시지 숨기기
  - `createToast()`: 토스트 요소 생성

### 기능 모듈 파일
- **src/core/app.js**: 앱 초기화 및 코어 기능
  - `initApp()`: 앱 초기화
  - `renderActivityLog()`: 활동 로그 렌더링
  - `renderFullActivityLog()`: 전체 활동 로그 렌더링
  - `initEventListeners()`: 이벤트 리스너 초기화

- **src/features/server.js**: 서버 관련 기능
  - `initServerControls()`: 서버 제어 초기화
  - `updateServerStatus()`: 서버 상태 업데이트
  - `generateQRCode()`: 연결 QR 코드 생성

- **src/features/capture.js**: 캡처 관련 기능
  - `initCaptureControls()`: 캡처 제어 초기화
  - `loadCaptureArea()`: 캡처 영역 로드
  - `testCapture()`: 테스트 캡처 수행
  - `loadRecentCaptures()`: 최근 캡처 목록 로드

- **src/features/users.js**: 사용자 관리 관련 기능
  - `initUserManagement()`: 사용자 관리 초기화
  - `loadUsers()`: 사용자 목록 로드
  - `renderUserList()`: 사용자 목록 렌더링
  - `showAddUserForm()`: 사용자 추가 폼 표시

- **src/features/settings.js**: 설정 관련 기능
  - `initSettingsForm()`: 설정 폼 초기화
  - `loadSettings()`: 설정 로드
  - `saveSettings()`: 설정 저장
  - `resetSettings()`: 설정 초기화

### 컴포넌트 파일
- **src/components/Dashboard.js**: 대시보드 컴포넌트
  - 서버 상태 및 클라이언트 정보 표시
  - 연결 정보 및 QR 코드 표시
  - 명령 이력 및 활동 로그 표시

- **src/components/ClientList.js**: 클라이언트 목록 컴포넌트
  - 연결된 클라이언트 목록 표시
  - 클라이언트 상태 및 정보 표시
  - 클라이언트 관리 기능

- **src/components/ServerStatus.js**: 서버 상태 컴포넌트
  - 서버 실행 상태 표시
  - 서버 주소 및 포트 정보 표시
  - 서버 시작/중지 컨트롤

### 모바일 앱 파일
- **desktop-contrller-remote/src/App.js**: 모바일 앱 진입점
  - 라우팅 및 앱 구조 정의
  - 인증 컨텍스트 제공

- **desktop-contrller-remote/src/pages/Login.js**: 로그인 화면
  - 사용자 인증 UI
  - 서버 연결 정보 입력

- **desktop-contrller-remote/src/pages/Main.js**: 메인 화면
  - 연결 상태 표시
  - 명령 전송 및 응답 보기로 이동

- **desktop-contrller-remote/src/pages/CommandScreen.js**: 명령 전송 화면
  - 명령어 입력 및 전송
  - 빠른 명령어 선택

- **desktop-contrller-remote/src/pages/ResponseScreen.js**: 응답 화면
  - AI 응답 이미지 표시
  - 확대/축소 및 스크롤 기능

- **desktop-contrller-remote/src/services/SocketService.js**: 소켓 통신 서비스
  - 서버 연결 관리
  - 명령 전송 및 응답 수신
  - 인증 요청 처리

- **desktop-contrller-remote/src/services/AuthService.js**: 인증 서비스
  - 로그인 정보 관리
  - 인증 상태 유지
  - 로그아웃 처리

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
- 오류 처리 및 사용자 피드백 (2023-05-11 개선)

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

### 8. 오류 처리 기능 (2023-05-11 개선)
- 전역 오류 처리 시스템
- 미처리 프로미스 오류 처리
- 오류 메시지 시각적 표시
- 백업 UI 표시 및 기본 기능 유지
- 페이지 초기화 오류 시 사용자 피드백

### 9. 모바일 앱 기능
- iOS 디자인 가이드라인 준수
- 사용자 인증 및 연결
- 명령어 전송 화면
- AI 응답 화면 및 이미지 처리
- 연결 상태 표시
- 오프라인 모드 지원
- 응답 이미지 저장 및 공유

## 데이터 흐름

1. **명령 실행 흐름**:
   - 모바일 앱 → Socket.IO → socketManager → claudeManager → 클로드 앱 → captureManager → socketManager → 모바일 앱

2. **사용자 인증 흐름**:
   - 모바일 앱 → Socket.IO → socketManager → userManager → socketManager → 모바일 앱

3. **설정 변경 흐름**:
   - UI → renderer.js → ipcMain → configManager → electron-store

4. **이벤트 알림 흐름**:
   - 이벤트 발생 → ipcController → mainWindow → renderer.js → UI

5. **오류 처리 흐름** (2023-05-11 추가):
   - 오류 발생 → 전역 오류 핸들러 → showErrorMessage → addErrorToDOM → 사용자 알림
   - 페이지 초기화 오류 → showPageError → 사용자 알림 및 재시도 기능

## 최근 수정 사항 (2023-05-11)

1. **renderer.js 수정**:
   - 비동기 처리 개선: Promise로 초기화 함수 래핑
   - 백업 UI 기능 강화: 모듈 로드 실패 시에도 기본 기능 작동
   - 오류 처리 강화: 전역 오류 처리 및 사용자 피드백 개선

2. **navigation.js 수정**:
   - 보안 개선: 직접 ipcRenderer 사용 제거, window.electronAPI 활용
   - 오류 처리 개선: 페이지 초기화 오류 시 사용자 피드백 제공
   - 사용자 경험 향상: 오류 발생 시 재시도 기능 추가
   - 모듈 의존성 개선: 동적 로딩 대신 안전한 API 호출 방식 사용

## 개발 및 빌드 방법

### 개발 환경 설정 (데스크탑 앱)
```bash
# 프로젝트 디렉터리로 이동
cd D:\claude\desktop-contrller\desktop-contrller

# 필수 패키지 설치
npm install

# 개발 모드로 실행
npm start

# UTF-8 인코딩으로 실행 (PowerShell에서 한글 깨짐 방지)
npm run dev:utf8
# 또는
scripts\run-with-utf8.bat
```

### 개발 환경 설정 (모바일 앱)
```bash
# 프로젝트 디렉터리로 이동
cd D:\claude\desktop-contrller\desktop-contrller-remote

# 필수 패키지 설치
npm install

# 개발 모드로 실행
npm start
```

### 모바일 앱 빌드
```bash
# Android 앱 빌드
cd D:\claude\desktop-contrller\desktop-contrller-remote
npm run build
npx cap add android
npx cap copy android
npx cap open android

# iOS 앱 빌드 (Mac OS 환경 필요)
cd D:\claude\desktop-contrller\desktop-contrller-remote
npm run build
npx cap add ios
npx cap copy ios
npx cap open ios
```
