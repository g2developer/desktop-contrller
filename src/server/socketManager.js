// 소켓 매니저: 모든 소켓 연결과 이벤트 관리

// 모듈 가져오기
const userManager = require('../controllers/userManager');
const logger = require('../utils/logger');

// 변수 초기화
let io;
let mainWindow;
let captureManager;
let claudeManager;
let connectedClients = {};

/**
 * 소켓 매니저 초기화
 * @param {BrowserWindow} window 메인 윈도우 객체
 * @param {Object} userMgr 사용자 관리자
 * @param {Object} captureMgr 캡처 관리자
 * @param {Object} claudeMgr 클로드 앱 관리자
 */
function init(window, userMgr, captureMgr, claudeMgr) {
  mainWindow = window;
  captureManager = captureMgr;
  claudeManager = claudeMgr;
}

/**
 * Socket.IO 객체 설정
 * @param {SocketIO.Server} socketIO Socket.IO 서버 객체
 */
function setSocketIO(socketIO) {
  io = socketIO;
  setupSocketEvents();
}

/**
 * 소켓 이벤트 설정
 */
function setupSocketEvents() {
  if (!io) return;
  
  io.on('connection', (socket) => {
    logger.log('새 클라이언트 연결:', socket.id);
    
    // 클라이언트 정보 초기화
    const clientInfo = { 
      id: socket.id, 
      authenticated: false,
      username: null,
      device: 'Unknown',
      ip: socket.handshake.address,
      connectTime: new Date()
    };
    
    connectedClients[socket.id] = clientInfo;
    
    // 클라이언트 정보 업데이트
    if (mainWindow) {
      mainWindow.webContents.send('clients-update', Object.values(connectedClients));
      
      // 활동 로그 추가
      mainWindow.webContents.send('activity-log', {
        type: 'connection',
        message: `새 클라이언트 연결: ${socket.id}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // 클라이언트 정보 요청 처리
    socket.on('client-info', (data) => {
      // 클라이언트 정보 업데이트
      if (data.device) {
        connectedClients[socket.id].device = data.device;
      }
      
      // 업데이트된 클라이언트 정보 전송
      if (mainWindow) {
        mainWindow.webContents.send('clients-update', Object.values(connectedClients));
      }
    });

    // 로그인 요청 처리
    socket.on('login', (data) => {
      const users = userManager.getUserData();
      const user = users.find(u => u.id === data.id && u.password === data.password);
      
      if (user) {
        // 로그인 성공
        connectedClients[socket.id].authenticated = true;
        connectedClients[socket.id].username = data.id;
        
        // 로그인 시간 갱신
        const loginTime = new Date();
        connectedClients[socket.id].lastLoginTime = loginTime;
        
        // 로그인 결과 클라이언트에 전송
        socket.emit('login-result', { 
          success: true,
          username: data.id,
          timestamp: loginTime.toISOString()
        });
        
        // 사용자 데이터 업데이트 (마지막 로그인 시간)
        user.lastLogin = loginTime.toISOString();
        userManager.saveUserData(users);
        
        // 클라이언트 정보 업데이트
        if (mainWindow) {
          mainWindow.webContents.send('clients-update', Object.values(connectedClients));
          
          // 활동 로그 추가
          mainWindow.webContents.send('activity-log', {
            type: 'login',
            message: `${data.id}님이 로그인했습니다. (${connectedClients[socket.id].device})`,
            timestamp: loginTime.toISOString()
          });
        }
      } else {
        // 로그인 실패
        socket.emit('login-result', { 
          success: false, 
          message: '잘못된 아이디 또는 비밀번호입니다.',
          timestamp: new Date().toISOString()
        });
        
        if (mainWindow) {
          // 활동 로그 추가 (로그인 실패)
          mainWindow.webContents.send('activity-log', {
            type: 'login-fail',
            message: `로그인 실패: ${data.id}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // 명령 실행 요청 처리
    socket.on('execute-command', async (data) => {
      if (connectedClients[socket.id].authenticated) {
        // 인증된 사용자만 명령 실행 가능
        try {
          // 데이터 유효성 검사
          if (!data || !data.command) {
            throw new Error('올바르지 않은 명령어입니다.');
          }
          
          // 명령어 실행 (비동기)
          claudeManager.controlClaudeApp(data.command, socket.id);
          
          // 명령 실행 요청 접수 알림
          socket.emit('command-accepted', { 
            command: data.command,
            timestamp: new Date().toISOString()
          });
          
          if (mainWindow) {
            // 활동 로그 추가
            mainWindow.webContents.send('activity-log', {
              type: 'command',
              message: `${connectedClients[socket.id].username}님이 "${data.command}" 명령을 전송했습니다.`,
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          logger.error('명령 실행 오류:', err);
          socket.emit('command-error', { 
            success: false, 
            message: err.message,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // 인증되지 않은 사용자
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
      logger.log('클라이언트 연결 해제:', socket.id);
      
      const clientInfo = connectedClients[socket.id];
      const username = clientInfo ? clientInfo.username || '알 수 없음' : '알 수 없음';
      const device = clientInfo ? clientInfo.device || '알 수 없음' : '알 수 없음';
      
      // 클라이언트 정보 삭제
      delete connectedClients[socket.id];
      
      if (mainWindow) {
        // 클라이언트 정보 업데이트
        mainWindow.webContents.send('clients-update', Object.values(connectedClients));
        
        // 활동 로그 추가
        mainWindow.webContents.send('activity-log', {
          type: 'disconnect',
          message: `${username}(${device})의 연결이 종료되었습니다.`,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
}

/**
 * 특정 클라이언트에게 이벤트 전송
 * @param {string} clientId 클라이언트 ID
 * @param {string} event 이벤트 이름
 * @param {any} data 전송할 데이터
 */
function sendToClient(clientId, event, data) {
  if (io && connectedClients[clientId]) {
    io.to(clientId).emit(event, data);
    return true;
  }
  return false;
}

/**
 * 모든 클라이언트에게 이벤트 전송
 * @param {string} event 이벤트 이름
 * @param {any} data 전송할 데이터
 */
function notifyAllClients(event, data) {
  if (io) {
    io.emit(event, data);
    return true;
  }
  return false;
}

/**
 * 클라이언트 연결 해제
 * @param {string} clientId 클라이언트 ID
 * @returns {boolean} 연결 해제 성공 여부
 */
function disconnectClient(clientId) {
  try {
    if (!clientId || !connectedClients[clientId]) {
      throw new Error('클라이언트를 찾을 수 없습니다.');
    }
    
    // 클라이언트에게 연결 해제 알림
    io.to(clientId).emit('force-disconnect', {
      message: '서버에 의해 연결이 종료되었습니다.',
      timestamp: new Date().toISOString()
    });
    
    // 소켓 연결 종료
    const socket = io.sockets.sockets.get(clientId);
    if (socket) {
      socket.disconnect(true);
    }
    
    // 클라이언트 정보 삭제
    delete connectedClients[clientId];
    
    return true;
  } catch (err) {
    console.error('클라이언트 연결 해제 오류:', err);
    return false;
  }
}

/**
 * 모든 클라이언트 정보 삭제
 */
function clearAllClients() {
  connectedClients = {};
}

/**
 * 연결된 클라이언트 수 가져오기
 * @returns {number} 연결된 클라이언트 수
 */
function getClientCount() {
  return Object.keys(connectedClients).length;
}

/**
 * 모든 클라이언트 정보 가져오기
 * @returns {Array} 클라이언트 정보 배열
 */
function getAllClients() {
  return Object.values(connectedClients);
}

/**
 * 특정 클라이언트 정보 가져오기
 * @param {string} clientId 클라이언트 ID
 * @returns {Object|null} 클라이언트 정보 또는 null
 */
function getClient(clientId) {
  return connectedClients[clientId] || null;
}

// 모듈 내보내기
module.exports = {
  init,
  setSocketIO,
  sendToClient,
  notifyAllClients,
  disconnectClient,
  clearAllClients,
  getClientCount,
  getAllClients,
  getClient
};