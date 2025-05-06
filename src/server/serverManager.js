const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const socketManager = require('./socketManager');

let expressApp;
let server;
let io;
let mainWindow;
let store;
let isServerRunning = false;

/**
 * 서버 관리자 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 */
function init(configStore, window) {
  store = configStore;
  mainWindow = window;
  
  // Express 앱 설정
  expressApp = express();
  server = http.createServer(expressApp);
  io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // 소켓 매니저 초기화
  socketManager.setSocketIO(io);
}

/**
 * 서버 시작 함수
 * @returns {boolean} 서버 시작 성공 여부
 */
function startServer() {
  try {
    // 이미 실행 중이면 무시
    if (isServerRunning) return true;
    
    // 설정에서 포트 가져오기
    const port = store.get('serverPort') || 3000;
    
    // 서버 시작
    server.listen(port, () => {
      console.log(`서버가 포트 ${port}에서 실행 중입니다`);
      isServerRunning = true;
      
      // 서버 상태 업데이트
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          running: true,
          port,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return true;
  } catch (err) {
    console.error('서버 시작 오류:', err);
    return false;
  }
}

/**
 * 서버 중지 함수
 * @returns {boolean} 서버 중지 성공 여부
 */
function stopServer() {
  try {
    // 이미 중지되었으면 무시
    if (!isServerRunning) return true;
    
    // 연결된 모든 클라이언트에게 서버 종료 알림
    socketManager.notifyAllClients('server-shutdown', {
      message: '서버가 종료되었습니다.',
      timestamp: new Date().toISOString()
    });
    
    // 서버 종료
    server.close(() => {
      console.log('서버가 종료되었습니다.');
      isServerRunning = false;
      
      // 연결된 클라이언트 목록 초기화
      socketManager.clearAllClients();
      
      // 서버 상태 업데이트
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          running: false,
          timestamp: new Date().toISOString()
        });
        
        // 클라이언트 목록 업데이트
        mainWindow.webContents.send('clients-update', []);
      }
    });
    
    return true;
  } catch (err) {
    console.error('서버 종료 오류:', err);
    return false;
  }
}

/**
 * 서버 상태 가져오기
 * @returns {Object} 서버 상태 정보
 */
function getServerStatus() {
  const port = store.get('serverPort') || 3000;
  return {
    running: isServerRunning,
    port: port,
    clientCount: socketManager.getClientCount(),
    timestamp: new Date().toISOString()
  };
}

// 모듈 내보내기
module.exports = {
  init,
  startServer,
  stopServer,
  getServerStatus,
  getIO: () => io,
  isRunning: () => isServerRunning
};