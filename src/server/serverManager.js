const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const socketManager = require('./socketManager');
const logger = require('../utils/logger');
const { DEFAULT_SERVER_PORT } = require('../utils/configManager'); // 상수 가져오기

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
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Socket.IO v3 호환성 활성화
    pingTimeout: 60000, // 더 긴 포넷 타임아웃 (기본값 5초를 60초로 증가)
    pingInterval: 25000  // 평감 파았 주기 (기본값 25초)
  });
  
  // 소켓 클라이언트 연결 로깅
  console.log('서버 소켓 초기화 완료. 서버 실행 중...');
  
  // 한글 인코딩 설정
  expressApp.use(express.json({
    charset: 'utf-8'
  }));
  expressApp.use(express.urlencoded({
    extended: true,
    charset: 'utf-8'
  }));
  
  // 기본 헤더 설정
  expressApp.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });
  
  // 서버 상태 확인을 위한 간단한 상태 확인 엔드포인트 추가
  expressApp.get('/status', (req, res) => {
    res.json({
      status: 'ok',
      server: 'Desktop Controller Server',
      version: '1.0.0',
      socketConnected: io ? Object.keys(io.sockets.sockets).length : 0,
      timestamp: new Date().toISOString()
    });
  });
  
  // CORS 헤더 설정 추가
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
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
    const port = store.get('serverPort') || DEFAULT_SERVER_PORT;
    
    // 서버 시작
    server.listen(port, () => {
      const os = require('os');
      const nets = os.networkInterfaces();
      let localIp = '127.0.0.1';
      
      // 로컬 IP 주소 찾기
      Object.keys(nets).forEach((name) => {
        nets[name].forEach((net) => {
          // 내부 IP가 아니고 IPv4인 경우
          if (!net.internal && net.family === 'IPv4') {
            localIp = net.address;
          }
        });
      });
      
      logger.log(`서버가 포트 ${port}에서 실행 중입니다`);
      logger.log(`연결 주소: ${localIp}:${port}`);
      logger.log(`클라이언트 연결 URL: ${localIp}:${port}`);
      console.log(`서버가 시작되었습니다. 다음 URL로 연결하세요: ${localIp}:${port}`);
      isServerRunning = true;
      
      // 서버 상태 업데이트
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          running: true,
          port,
          ip: localIp,
          url: `${localIp}:${port}`,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return true;
  } catch (err) {
    logger.error('서버 시작 오류:', err);
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
      logger.log('서버가 종료되었습니다.');
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
    logger.error('서버 종료 오류:', err);
    return false;
  }
}

/**
 * 서버 상태 가져오기
 * @returns {Object} 서버 상태 정보
 */
function getServerStatus() {
  const port = store.get('serverPort') || DEFAULT_SERVER_PORT;
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