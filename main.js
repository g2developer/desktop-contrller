const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { spawn } = require('child_process');
const robotjs = require('robotjs');
const screenshot = require('screenshot-desktop');

// 사용자 정보 파일 경로
const USER_DATA_FILE = path.join(app.getPath('userData'), 'users.json');

// Express 앱 설정
const expressApp = express();
const server = http.createServer(expressApp);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 포트 설정
const PORT = 3000;

// 소켓 연결 관리
let connectedClients = {};

// 메인 윈도우 객체
let mainWindow;

// 자동 버튼 클릭 상태
let autoClickEnabled = true;

// 사용자 데이터 관리
function getUserData() {
  try {
    if (fs.existsSync(USER_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
    } else {
      const defaultUsers = [{ id: 'admin', password: 'admin' }];
      fs.writeFileSync(USER_DATA_FILE, JSON.stringify(defaultUsers, null, 2));
      return defaultUsers;
    }
  } catch (err) {
    console.error('사용자 데이터 로드 오류:', err);
    return [{ id: 'admin', password: 'admin' }];
  }
}

function saveUserData(users) {
  try {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (err) {
    console.error('사용자 데이터 저장 오류:', err);
    return false;
  }
}

// AI 응답 영역 캡처 함수
async function captureAIResponseArea() {
  try {
    // 전체 화면 캡처 후 AI 응답 영역만 추출
    const img = await screenshot();
    // TODO: AI 응답 영역의 좌표 설정 필요
    // 예시: 특정 영역 좌표 (실제 클로드 앱 UI에 맞게 조정 필요)
    const x = 300;
    const y = 200;
    const width = 800;
    const height = 600;
    
    // 여기서는 단순 전체 스크린샷만 반환하지만,
    // 실제로는 이미지 처리 라이브러리를 사용하여 특정 영역만 추출해야 함
    return img;
  } catch (err) {
    console.error('화면 캡처 오류:', err);
    return null;
  }
}

// 특정 텍스트가 있는 버튼 찾기 및 클릭 함수
async function findAndClickButton() {
  if (!autoClickEnabled) return;

  try {
    // 화면 캡처
    const img = await screenshot();
    
    // 이미지 처리를 통해 버튼 위치 찾기
    // 실제 구현에서는 이미지 처리 라이브러리(예: OpenCV, Tesseract OCR)를 사용하여 
    // "권한 허용" 또는 "계속하기" 텍스트가 있는 버튼 영역을 찾아야 함
    
    // 여기서는 예시로, 버튼이 항상 특정 위치에 있다고 가정
    const buttonPositions = [
      // "권한 허용" 버튼 추정 위치 (x, y)
      { x: 700, y: 500, text: "권한 허용" },
      // "계속하기" 버튼 추정 위치 (x, y)
      { x: 700, y: 550, text: "계속하기" }
    ];
    
    // 실제 구현에서는 화면에서 버튼을 찾아야 함
    // 예시: 이미지 인식을 통해 찾은 버튼 위치
    const foundButtons = buttonPositions; // 실제 구현에서는 이미지 인식 결과
    
    // 각 버튼 위치로 마우스 이동 및 클릭
    for (const button of foundButtons) {
      console.log(`'${button.text}' 버튼을 찾았습니다. 클릭 시도...`);
      
      // 마우스 이동 및 클릭
      robotjs.moveMouse(button.x, button.y);
      robotjs.mouseClick();
      
      // 이벤트 로그
      mainWindow.webContents.send('auto-click-event', {
        text: button.text,
        x: button.x,
        y: button.y,
        timestamp: new Date().toISOString()
      });
      
      // 버튼 간 클릭 지연
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    console.error('자동 버튼 클릭 오류:', err);
  }
}

// 클로드 앱 제어 함수
function controlClaudeApp(command) {
  try {
    // 클로드 앱 활성화 (실제 경로로 변경 필요)
    const claudeApp = spawn('start', ['claude.exe'], { shell: true });
    
    // 잠시 대기 후 명령어 입력
    setTimeout(() => {
      // 채팅창에 명령어 입력
      robotjs.typeString(command);
      // 엔터키 입력
      robotjs.keyTap('enter');
      
      // 자동 버튼 클릭 모니터링 시작
      // 주기적으로 화면을 확인하고 필요한 버튼을 클릭
      const checkInterval = setInterval(async () => {
        await findAndClickButton();
      }, 2000); // 2초마다 확인
      
      // AI 응답 영역 캡처 및 전송
      setTimeout(async () => {
        // 자동 버튼 클릭 모니터링 종료
        clearInterval(checkInterval);
        
        const screenshot = await captureAIResponseArea();
        if (screenshot) {
          // 연결된 모든 클라이언트에게 스크린샷 전송
          Object.keys(connectedClients).forEach(clientId => {
            io.to(clientId).emit('ai-response', { 
              image: screenshot.toString('base64'), 
              timestamp: new Date().toISOString() 
            });
          });
        }
      }, 10000); // AI 응답 기다리는 시간 (조정 필요)
    }, 1000);
    
    return true;
  } catch (err) {
    console.error('클로드 앱 제어 오류:', err);
    return false;
  }
}

// 앱 준비 완료 이벤트
app.whenReady().then(() => {
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // HTML 파일 로드
  mainWindow.loadFile('src/index.html');
  
  // 개발자 도구 열기
  mainWindow.webContents.openDevTools();

  // Express 서버 시작
  server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  });

  // 소켓 이벤트 설정
  io.on('connection', (socket) => {
    console.log('새 클라이언트 연결:', socket.id);
    connectedClients[socket.id] = { 
      id: socket.id, 
      authenticated: false,
      username: null,
      connectTime: new Date()
    };
    
    // 클라이언트 정보 업데이트
    mainWindow.webContents.send('clients-update', Object.values(connectedClients));

    // 로그인 요청 처리
    socket.on('login', (data) => {
      const users = getUserData();
      const user = users.find(u => u.id === data.id && u.password === data.password);
      
      if (user) {
        connectedClients[socket.id].authenticated = true;
        connectedClients[socket.id].username = data.id;
        socket.emit('login-result', { success: true });
        
        // 클라이언트 정보 업데이트
        mainWindow.webContents.send('clients-update', Object.values(connectedClients));
      } else {
        socket.emit('login-result', { success: false, message: '잘못된 아이디 또는 비밀번호입니다.' });
      }
    });

    // 명령 실행 요청 처리
    socket.on('execute-command', (data) => {
      if (connectedClients[socket.id].authenticated) {
        const result = controlClaudeApp(data.command);
        socket.emit('command-result', { success: result });
        
        // 데스크탑 앱에 명령 실행 알림
        mainWindow.webContents.send('command-executed', {
          clientId: socket.id,
          username: connectedClients[socket.id].username,
          command: data.command,
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('command-result', { success: false, message: '인증이 필요합니다.' });
      }
    });

    // 연결 해제 처리
    socket.on('disconnect', () => {
      console.log('클라이언트 연결 해제:', socket.id);
      delete connectedClients[socket.id];
      
      // 클라이언트 정보 업데이트
      mainWindow.webContents.send('clients-update', Object.values(connectedClients));
    });
  });

  // IPC 이벤트 설정
  // 사용자 데이터 요청
  ipcMain.on('get-users', (event) => {
    event.reply('users-data', getUserData());
  });

  // 사용자 추가
  ipcMain.on('add-user', (event, userData) => {
    const users = getUserData();
    users.push(userData);
    const success = saveUserData(users);
    event.reply('add-user-result', { success });
    if (success) {
      event.reply('users-data', users);
    }
  });

  // 사용자 수정
  ipcMain.on('update-user', (event, { index, userData }) => {
    const users = getUserData();
    if (index >= 0 && index < users.length) {
      users[index] = userData;
      const success = saveUserData(users);
      event.reply('update-user-result', { success });
      if (success) {
        event.reply('users-data', users);
      }
    } else {
      event.reply('update-user-result', { success: false });
    }
  });

  // 사용자 삭제
  ipcMain.on('delete-user', (event, index) => {
    const users = getUserData();
    if (index >= 0 && index < users.length) {
      users.splice(index, 1);
      const success = saveUserData(users);
      event.reply('delete-user-result', { success });
      if (success) {
        event.reply('users-data', users);
      }
    } else {
      event.reply('delete-user-result', { success: false });
    }
  });

  // 자동 버튼 클릭 기능 토글
  ipcMain.on('toggle-auto-click', (event, enabled) => {
    autoClickEnabled = enabled;
    event.reply('auto-click-status', { enabled: autoClickEnabled });
  });
});

// 모든 창이 닫히면 앱 종료
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
