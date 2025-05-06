const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Express 앱 설정
const expressApp = express();
const server = http.createServer(expressApp);
const io = new Server(server);

// 포트 설정
const PORT = 3000;

let mainWindow;

function createWindow() {
  // 브라우저 창 생성
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 메인 HTML 파일 로드
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 개발 도구 열기 (개발 중에만 사용)
  // mainWindow.webContents.openDevTools();

  // 창이 닫힐 때 발생하는 이벤트
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Electron이 준비되었을 때 창 생성
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // macOS에서는 창이 닫혀도 프로세스가 종료되지 않으므로, 
    // 창이 없을 때 새 창을 생성합니다.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // 웹 서버 시작
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});

// 모든 창이 닫혔을 때 애플리케이션 종료 (Windows & Linux)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log('새 클라이언트 연결됨:', socket.id);

  // 클라이언트로부터 명령 수신
  socket.on('command', (data) => {
    console.log('명령 수신:', data);
    // 명령 처리 로직 추가
  });

  // 연결 종료 처리
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 종료:', socket.id);
  });
});