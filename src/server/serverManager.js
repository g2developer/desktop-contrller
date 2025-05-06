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
  
  // 먼저 CORS 미들웨어 설정 (다른 미들웨어보다 앞에 와야 함)
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  
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
  
  // 라우트 등록 (위치 중요) - 기본 라우트 추가
  expressApp.get('/', (req, res) => {
    res.json({ 
      message: '데스크탑 컨트롤러 서버가 실행 중입니다.',
      timestamp: new Date().toISOString() 
    });
  });
  
  // 서버 상태 확인을 위한 상태 확인 엔드포인트
  expressApp.get('/status', (req, res) => {
    res.json({
      status: 'ok',
      server: 'Desktop Controller Server',
      version: '1.0.0',
      socketConnected: 0, // 서버 생성 전이므로 0으로 설정
      timestamp: new Date().toISOString()
    });
  });
  
  // 디버그용 추가 라우트
  expressApp.get('/test', (req, res) => {
    res.json({ 
      message: '테스트 엔드포인트 정상 작동',
      timestamp: new Date().toISOString() 
    });
  });
  
  // Http 서버 생성 (Express 앱 기반)
  server = http.createServer(expressApp);
  console.log('HTTP 서버 초기화 완료');
  
  // Socket.IO 설정 (Http 서버 생성 후에 설정)
  // 중요: path 옵션을 생략하고 기본값인 /socket.io를 사용하도록 설정
  io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'], // 클라이언트가 websocket만 사용하더라도 둘 다 사용 가능하게 설정
    allowEIO3: true, // Socket.IO v3 호환성 활성화
    pingTimeout: 80000, // 더 긴 핑 타임아웃 (기본값 5초를 60초로 증가)
    pingInterval: 25000  // 핑 간격 (기본값 25초)
  });
  
  // 소켓 매니저 초기화
  socketManager.setSocketIO(io);
  
  // Socket.IO 추가 설정 - io 객체에 직접 이벤트 리스너 추가
  io.on('connection', (socket) => {
    console.log('새 소켓 연결 감지:', socket.id);
    
    // 테스트용 이벤트 핸들러 추가
    socket.on('test-ping', (data, callback) => {
      console.log('테스트 핑 수신:', data);
      if (typeof callback === 'function') {
        callback({
          success: true,
          message: '테스트 핑 응답',
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('test-pong', {
          success: true,
          message: '테스트 핑 응답',
          timestamp: new Date().toISOString()
        });
      }
    });
  });
  
  // 초기화 완료 로그
  console.log('서버 초기화 완료. 서버 실행 준비 완료...');
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
    
    // 서버 시작 - 0.0.0.0으로 마운트하여 가능한 모든 네트워크 인터페이스에서 접속 가능하게 설정
    server.listen(port, '0.0.0.0', () => {
      const os = require('os');
      const nets = os.networkInterfaces();
      let localIp = '127.0.0.1';
      const allAddresses = [];
      
      // 모든 네트워크 인터페이스와 IP 주소 찾기
      Object.keys(nets).forEach((name) => {
        nets[name].forEach((net) => {
          // IPv4 주소만 처리
          if (net.family === 'IPv4') {
            // 내부 IP가 아닌 경우 기본 로컬 IP로 설정
            if (!net.internal) {
              localIp = net.address;
            }
            
            // 모든 주소 목록에 추가
            allAddresses.push({
              name: name,
              address: net.address,
              internal: net.internal
            });
          }
        });
      });
      
      // 서버 시작 정보 로깅
      logger.log('===== 서버 시작 정보 =====');
      logger.log(`서버가 포트 ${port}에서 실행 중입니다`);
      logger.log(`기본 연결 주소: ${localIp}:${port}`);
      logger.log('\n사용 가능한 모든 연결 주소:');
      
      // 모든 사용 가능한 주소 출력
      allAddresses.forEach(addr => {
        logger.log(`- ${addr.name}: ${addr.address}:${port} ${addr.internal ? '(내부)' : ''}`);
      });
      
      console.log('===== 서버 시작 완료 =====');
      console.log(`서버가 시작되었습니다. 다음 URL로 연결하세요: ${localIp}:${port}`);
      console.log(`모바일에서 접속할 URL: ${localIp}:${port}`);
      console.log('\n네트워크 연결 문제가 있는 경우 다음 주소로 시도해보세요:');
      allAddresses.filter(addr => !addr.internal).forEach(addr => {
        console.log(`- ${addr.address}:${port}`);
      });
      
      isServerRunning = true;
      
      // 서버 상태 업데이트
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          running: true,
          port,
          ip: localIp,
          url: `${localIp}:${port}`,
          allAddresses: allAddresses.map(addr => `${addr.address}:${port}`),
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