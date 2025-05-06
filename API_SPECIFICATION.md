# 데스크탑 컨트롤러 - 서버/클라이언트 연동 규격서

## 개요

이 문서는 데스크탑 컨트롤러 앱(서버)과 모바일 앱(클라이언트) 간의 통신 규격을 정의합니다. 두 앱은 WebSocket(Socket.io)을 통해 실시간으로 통신하며, 모바일 앱에서 데스크탑 앱을 원격으로 제어할 수 있게 합니다.

## 기본 정보

- **프로토콜**: WebSocket (Socket.io)
- **기본 포트**: 8000
- **인코딩**: UTF-8
- **데이터 포맷**: JSON

## 연결 설정

### 서버 주소 형식
```
http://{서버IP주소}:{포트번호}
```

예시: `http://192.168.0.10:8000`

### 클라이언트 연결 정보
클라이언트는 연결 시 다음 정보를 제공해야 합니다:

```json
{
  "device": "디바이스 정보 (예: 'iPhone 13', 'Galaxy S22')"
}
```

## 인증 프로세스

1. 클라이언트는 연결 후 인증을 위해 `login` 이벤트를 전송합니다.
2. 서버는 인증 결과를 `login-result` 이벤트로 응답합니다.
3. 인증 후에만 명령 전송 및 기타 기능이 활성화됩니다.

### 인증 요청 (`login` 이벤트)

```json
{
  "id": "사용자 아이디",
  "password": "사용자 비밀번호"
}
```

### 인증 응답 (`login-result` 이벤트)

성공 시:
```json
{
  "success": true,
  "username": "사용자 아이디",
  "timestamp": "2025-05-07T10:30:00.000Z"
}
```

실패 시:
```json
{
  "success": false,
  "message": "잘못된 아이디 또는 비밀번호입니다.",
  "timestamp": "2025-05-07T10:30:00.000Z"
}
```

## 이벤트 목록

### 클라이언트 -> 서버 이벤트

| 이벤트 이름 | 설명 | 필요한 인증 | 데이터 형식 |
|------------|------|------------|------------|
| `client-info` | 클라이언트 정보 전송 | 아니오 | `{ device: string }` |
| `login` | 인증 요청 | 아니오 | `{ id: string, password: string }` |
| `execute-command` | 명령 실행 요청 | 예 | `{ command: string }` |
| `ping` | 연결 확인 | 아니오 | 없음 |

### 서버 -> 클라이언트 이벤트

| 이벤트 이름 | 설명 | 데이터 형식 |
|------------|------|------------|
| `login-result` | 로그인 결과 | `{ success: boolean, username?: string, message?: string, timestamp: string }` |
| `command-accepted` | 명령 수락 알림 | `{ command: string, timestamp: string }` |
| `command-error` | 명령 오류 알림 | `{ success: false, message: string, timestamp: string }` |
| `command-result` | 명령 실행 결과 | `{ command: string, response?: string, imageData?: string, timestamp: string }` |
| `pong` | 연결 확인 응답 | `{ status: "ok", timestamp: string }` |
| `force-disconnect` | 서버에 의한 강제 연결 종료 | `{ message: string, timestamp: string }` |
| `server-shutdown` | 서버 종료 알림 | `{ message: string, timestamp: string }` |

## 명령 실행 프로세스

1. 클라이언트는 인증 후 `execute-command` 이벤트를 통해 명령을 전송합니다.
2. 서버는 `command-accepted` 이벤트로 명령 수락을 확인합니다.
3. 서버는 명령을 처리하고 결과를 생성합니다.
4. 서버는 `command-result` 이벤트를 통해 명령 실행 결과(텍스트 및/또는 이미지)를 클라이언트에 전송합니다.

### 명령 실행 요청 (`execute-command` 이벤트)

```json
{
  "command": "수행할 명령어"
}
```

### 명령 수락 응답 (`command-accepted` 이벤트)

```json
{
  "command": "수행할 명령어",
  "timestamp": "2025-05-07T10:30:00.000Z"
}
```

### 명령 결과 응답 (`command-result` 이벤트)

```json
{
  "command": "수행한 명령어",
  "response": "텍스트 응답 (있는 경우)",
  "imageData": "Base64로 인코딩된 이미지 데이터 (있는 경우)",
  "timestamp": "2025-05-07T10:30:00.000Z"
}
```

## 연결 상태 관리

### 연결 확인 (`ping` 이벤트)

클라이언트는 주기적으로 `ping` 이벤트를 전송하여 연결 상태를 확인할 수 있습니다.

서버는 `pong` 이벤트로 응답합니다:

```json
{
  "status": "ok",
  "timestamp": "2025-05-07T10:30:00.000Z"
}
```

### 연결 종료

서버는 다음 상황에서 클라이언트 연결을 종료할 수 있습니다:

1. 서버 종료 시
2. 관리자에 의한 강제 연결 종료
3. 세션 시간 초과

서버는 연결 종료 전 `force-disconnect` 또는 `server-shutdown` 이벤트를 전송합니다.

## 오류 코드 및 메시지

| 오류 유형 | 메시지 |
|----------|--------|
| 인증 실패 | "잘못된 아이디 또는 비밀번호입니다." |
| 인증 필요 | "인증이 필요합니다. 먼저 로그인해주세요." |
| 서버 오류 | "서버 처리 중 오류가 발생했습니다." |
| 명령 실행 오류 | "명령 실행 중 오류가 발생했습니다." |
| 연결 종료 | "서버에 의해 연결이 종료되었습니다." |
| 서버 종료 | "서버가 종료되었습니다." |

## 이미지 데이터 처리

1. 서버는 화면 캡처 이미지를 JPEG 형식으로 인코딩합니다.
2. 인코딩된 이미지는 Base64 문자열로 변환하여 전송합니다.
3. 클라이언트는 Base64 데이터를 디코딩하여 이미지를 표시합니다.

이미지 품질 설정:
- `high`: 원본 품질 (낮은 압축률)
- `medium`: 중간 품질 (기본값)
- `low`: 낮은 품질 (높은 압축률, 빠른 전송)

## 구현 예시

### 서버 측 (Node.js + Socket.io)

```javascript
// 서버 설정
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 클라이언트 연결 처리
io.on('connection', (socket) => {
  console.log('새 클라이언트 연결:', socket.id);
  
  // 클라이언트 정보 초기화
  const clientInfo = { 
    id: socket.id, 
    authenticated: false,
    username: null,
    device: 'Unknown',
    ip: socket.handshake.address,
    connectTime: new Date()
  };
  
  // 클라이언트 정보 요청 처리
  socket.on('client-info', (data) => {
    if (data.device) {
      clientInfo.device = data.device;
    }
  });

  // 로그인 요청 처리
  socket.on('login', (data) => {
    // 사용자 인증 로직
    // ...
    
    if (authenticated) {
      socket.emit('login-result', { 
        success: true,
        username: data.id,
        timestamp: new Date().toISOString()
      });
    } else {
      socket.emit('login-result', { 
        success: false, 
        message: '잘못된 아이디 또는 비밀번호입니다.',
        timestamp: new Date().toISOString()
      });
    }
  });

  // 명령 실행 요청 처리
  socket.on('execute-command', (data) => {
    if (clientInfo.authenticated) {
      // 명령 실행 로직
      // ...
      
      // 명령 수락 알림
      socket.emit('command-accepted', { 
        command: data.command,
        timestamp: new Date().toISOString()
      });
      
      // 명령 결과 전송 (비동기)
      executeCommand(data.command)
        .then(result => {
          socket.emit('command-result', {
            command: data.command,
            response: result.text,
            imageData: result.image, // Base64 인코딩된 이미지
            timestamp: new Date().toISOString()
          });
        })
        .catch(err => {
          socket.emit('command-error', {
            success: false,
            message: '명령 실행 중 오류가 발생했습니다.',
            timestamp: new Date().toISOString()
          });
        });
    } else {
      socket.emit('command-error', { 
        success: false, 
        message: '인증이 필요합니다. 먼저 로그인해주세요.',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 연결 확인 요청 처리
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    } else {
      socket.emit('pong', {
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    }
  });

  // 연결 해제 처리
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});
```

### 클라이언트 측 (JavaScript + Socket.io)

```javascript
// 서버 연결
const socket = io('http://192.168.0.10:8000', {
  reconnection: true,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

// 연결 이벤트
socket.on('connect', () => {
  console.log('서버에 연결되었습니다.');
  
  // 클라이언트 정보 전송
  socket.emit('client-info', {
    device: 'iPhone 13'
  });
  
  // 로그인
  socket.emit('login', {
    id: 'user123',
    password: 'password123'
  });
});

// 로그인 결과 처리
socket.on('login-result', (data) => {
  if (data.success) {
    console.log(`환영합니다, ${data.username}님!`);
    // 로그인 성공 처리
  } else {
    console.error(`로그인 실패: ${data.message}`);
    // 로그인 실패 처리
  }
});

// 명령 전송
function sendCommand(command) {
  socket.emit('execute-command', {
    command: command
  });
}

// 명령 수락 처리
socket.on('command-accepted', (data) => {
  console.log(`명령이 수락되었습니다: ${data.command}`);
  // 명령 수락 처리
});

// 명령 결과 처리
socket.on('command-result', (data) => {
  console.log(`명령 응답: ${data.command}`);
  
  // 텍스트 응답 처리
  if (data.response) {
    console.log(`텍스트 응답: ${data.response}`);
    // 텍스트 응답 표시
  }
  
  // 이미지 응답 처리
  if (data.imageData) {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data.imageData}`;
    // 이미지 표시
  }
});

// 오류 처리
socket.on('command-error', (data) => {
  console.error(`명령 오류: ${data.message}`);
  // 오류 처리
});

// 연결 종료 처리
socket.on('force-disconnect', (data) => {
  console.log(`서버에 의해 연결이 종료되었습니다: ${data.message}`);
  // 연결 종료 처리
});

// 서버 종료 처리
socket.on('server-shutdown', (data) => {
  console.log(`서버가 종료되었습니다: ${data.message}`);
  // 서버 종료 처리
});

// 연결 해제 처리
socket.on('disconnect', (reason) => {
  console.log(`서버와의 연결이 해제되었습니다: ${reason}`);
  // 연결 해제 처리
});

// 연결 오류 처리
socket.on('connect_error', (error) => {
  console.error(`연결 오류: ${error.message}`);
  // 연결 오류 처리
});

// 주기적 연결 확인
setInterval(() => {
  socket.emit('ping', (response) => {
    console.log(`연결 상태: ${response.status}`);
  });
}, 30000); // 30초 간격
```

## 보안 고려사항

1. **통신 암호화**: 프로덕션 환경에서는 HTTPS/WSS를 통한 통신을 권장합니다.
2. **비밀번호 보안**: 비밀번호는 항상 해시 처리하여 저장하고, 평문으로 전송하지 않는 것이 좋습니다.
3. **인증 토큰**: 장기적인 연결을 위해 JWT 같은 인증 토큰 사용을 고려하세요.
4. **IP 제한**: 특정 IP 주소 또는 IP 범위로 연결을 제한할 수 있습니다.
5. **요청 제한**: 과도한 요청을 방지하기 위한 비율 제한을 구현하세요.

## 구현 시 주의사항

1. **오류 처리**: 모든 이벤트에 대해 적절한 오류 처리를 구현하세요.
2. **연결 복구**: 연결이 끊어진 경우 자동 재연결 메커니즘을 구현하세요.
3. **상태 관리**: 클라이언트와 서버 모두에서 연결 상태를 추적하세요.
4. **타임아웃 처리**: 장시간 응답이 없는 요청에 대한 타임아웃 처리를 구현하세요.
5. **메모리 관리**: 이미지 데이터와 같은 대용량 데이터 전송 시 메모리 사용량을 고려하세요.

## 문제 해결

| 문제 | 가능한 원인 | 해결 방법 |
|-----|------------|----------|
| 연결 실패 | 잘못된 IP 또는 포트 | 서버 IP와 포트 확인 |
| | 방화벽 문제 | 방화벽 설정 확인 |
| | 서버가 실행되지 않음 | 서버 상태 확인 |
| 인증 실패 | 잘못된 인증 정보 | 사용자 ID와 비밀번호 확인 |
| | 사용자가 존재하지 않음 | 사용자 등록 여부 확인 |
| 명령 실행 실패 | 인증되지 않은 상태 | 로그인 상태 확인 |
| | 서버 측 오류 | 서버 로그 확인 |
| 이미지 로드 실패 | 잘못된 Base64 데이터 | 데이터 형식 확인 |
| | 메모리 부족 | 이미지 품질 설정 조정 |

## 버전 이력

- **v1.0.0** (2025-05-07): 초기 규격 정의
