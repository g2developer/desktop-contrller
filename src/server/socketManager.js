/**
 * 소켓 매니저 모듈
 * 모든 소켓 연결과 이벤트를 관리합니다.
 */

// 모듈 가져오기
const userManager = require('../controllers/userManager');
let logManager = require('../utils/logManager');

// 로거 호환성 레이어 추가 - logger를 logManager로 매핑
const logger = {
  log: (...args) => {
    if (logManager && logManager.info) {
      return logManager.info(...args);
    }
    return console.log('[SocketManager]', ...args);
  },
  info: (...args) => {
    if (logManager && logManager.info) {
      return logManager.info(...args);
    }
    return console.log('[SocketManager]', ...args);
  },
  warn: (...args) => {
    if (logManager && logManager.warn) {
      return logManager.warn(...args);
    }
    return console.warn('[SocketManager]', ...args);
  },
  error: (...args) => {
    if (logManager && logManager.error) {
      return logManager.error(...args);
    }
    return console.error('[SocketManager]', ...args);
  }
};



// 변수 초기화
let io;
let mainWindow;
let captureManager;
let claudeManager;
let connectedClients = {};

// 클라이언트 접속 제한 (사용자당 최대 접속 수)
const MAX_CONNECTIONS_PER_USER = 3;

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
 * 사용자별 현재 접속 수 확인
 * @param {string} userId 사용자 ID
 * @returns {number} 접속 수
 */
function getUserConnectionCount(userId) {
  return Object.values(connectedClients).filter(
    client => client.authenticated && client.username === userId
  ).length;
}

/**
 * 사용자별 최대 접속 수 확인
 * @param {string} userId 사용자 ID
 * @returns {number} 최대 접속 수
 */
function getUserDeviceLimit(userId) {
  try {
    const user = userManager.getUser(userId);
    return user?.deviceLimit || MAX_CONNECTIONS_PER_USER;
  } catch (err) {
    logger.error(`사용자 접속 제한 조회 오류: ${err.message}`);
    return MAX_CONNECTIONS_PER_USER;
  }
}

/**
 * 소켓 이벤트 설정
 */
function setupSocketEvents() {
  if (!io) return;
  
  io.on('connection', (socket) => {
    logManager.info('새 클라이언트 연결:', socket.id);
    
    // 클라이언트 정보 초기화
    const clientInfo = { 
      id: socket.id, 
      authenticated: false,
      username: null,
      device: 'Unknown',
      ip: socket.handshake.address,
      connectTime: new Date(),
      lastActivity: new Date(),
      role: null
    };
    
    connectedClients[socket.id] = clientInfo;
    
    // 연결 확인 로그
    logManager.info(`소켓 연결 수락 - Socket ID: ${socket.id}, IP: ${socket.handshake.address}`);
    
    // 클라이언트 정보 업데이트
    if (mainWindow) {
      mainWindow.webContents.send('clients-update', Object.values(connectedClients));
      
      // 활동 로그 추가
      mainWindow.webContents.send('activity-log', {
        type: 'connection',
        message: `새 클라이언트 연결: ${socket.id} (${socket.handshake.address})`,
        timestamp: new Date().toISOString()
      });
    }
    
    // 클라이언트 정보 요청 처리
    socket.on('client-info', (data) => {
      try {
        // 클라이언트 정보 업데이트
        if (data.device) {
          connectedClients[socket.id].device = data.device;
        }
        
        if (data.platform) {
          connectedClients[socket.id].platform = data.platform;
        }
        
        if (data.type) {
          connectedClients[socket.id].clientType = data.type;
        }
        
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
        // 업데이트된 클라이언트 정보 전송
        if (mainWindow) {
          mainWindow.webContents.send('clients-update', Object.values(connectedClients));
        }
      } catch (error) {
        logManager.error(`클라이언트 정보 처리 중 오류 발생 - Socket ID: ${socket.id}, 오류: ${error.message}`);
      }
    });

    // 로그인 요청 처리
    socket.on('login', async (data, callback) => {
      try {
        logManager.info(`로그인 요청 수신 - Socket ID: ${socket.id}, 사용자: ${data.id}`);
        
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();

        // 콜백 함수가 없는 경우를 위한 기본 함수 설정
        const sendResponse = typeof callback === 'function' ? callback : (response) => {
          logManager.info(`로그인 응답 전송 (이벤트) - Socket ID: ${socket.id}, 성공: ${response.success}`);
          socket.emit('login-result', response);
        };

        // 데이터 유효성 검사
        if (!data || !data.id || !data.password) {
          logManager.warn(`로그인 실패 - 유효하지 않은 데이터`);
          return sendResponse({
            success: false,
            message: '아이디와 비밀번호를 모두 입력해주세요.',
            timestamp: new Date().toISOString()
          });
        }
        
        // 클라이언트 정보
        const deviceInfo = {
          device: connectedClients[socket.id].device || 'Unknown',
          platform: connectedClients[socket.id].platform || 'Unknown',
          clientType: connectedClients[socket.id].clientType || 'mobile'
        };
        
        // 사용자 인증
        const authResult = userManager.authenticateUser(
          data.id, 
          data.password, 
          socket.id, 
          socket.handshake.address,
          JSON.stringify(deviceInfo)
        );
        
        if (authResult.success) {
          // 기기 수 제한 확인
          const connectionCount = getUserConnectionCount(data.id);
          const deviceLimit = getUserDeviceLimit(data.id);
          
          logManager.info(`사용자 ${data.id}의 연결 수: ${connectionCount}/${deviceLimit}`);
          
          if (connectionCount >= deviceLimit) {
            logManager.warn(`로그인 실패 - 기기 수 제한 초과: ${data.id}`);
            return sendResponse({
              success: false,
              message: `최대 ${deviceLimit}개의 기기에서만 접속할 수 있습니다. 다른 기기의 연결을 해제하고 다시 시도해주세요.`,
              timestamp: new Date().toISOString()
            });
          }
          
          // 로그인 성공
          connectedClients[socket.id].authenticated = true;
          connectedClients[socket.id].username = data.id;
          connectedClients[socket.id].role = authResult.user.role || 'user';
          
          // 로그인 시간 갱신
          const loginTime = new Date();
          connectedClients[socket.id].lastLoginTime = loginTime;
          connectedClients[socket.id].lastActivity = loginTime;
          
          // 로그인 결과 클라이언트에 전송
          logManager.info(`로그인 성공 - 사용자: ${data.id}`);
          const response = { 
            success: true,
            username: data.id,
            role: authResult.user.role || 'user',
            name: authResult.user.name || data.id,
            timestamp: loginTime.toISOString()
          };
          
          sendResponse(response);
          
          // 클라이언트 정보 업데이트
          if (mainWindow) {
            mainWindow.webContents.send('clients-update', Object.values(connectedClients));
            
            // 활동 로그 추가
            mainWindow.webContents.send('activity-log', {
              type: 'login',
              message: `${data.id}님이 로그인했습니다. (${deviceInfo.device})`,
              timestamp: loginTime.toISOString(),
              clientId: socket.id
            });
          }
        } else {
          // 로그인 실패
          logManager.warn(`로그인 실패 - 사용자: ${data.id}, 사유: ${authResult.message}`);
          
          const response = { 
            success: false, 
            message: authResult.message || '로그인에 실패했습니다.',
            timestamp: new Date().toISOString()
          };
          
          sendResponse(response);
          
          if (mainWindow) {
            // 활동 로그 추가 (로그인 실패)
            mainWindow.webContents.send('activity-log', {
              type: 'login-fail',
              message: `로그인 실패: ${data.id} - ${authResult.message}`,
              timestamp: new Date().toISOString(),
              clientId: socket.id
            });
          }
        }
      } catch (error) {
        logManager.error(`로그인 처리 중 오류 발생 - Socket ID: ${socket.id}, 오류: ${error.message}`);
        
        // 콜백 함수가 없는 경우를 위한 기본 함수 설정
        const sendResponse = typeof callback === 'function' ? callback : (response) => {
          socket.emit('login-result', response);
        };
        
        // 오류 발생 시에도 응답 전송
        sendResponse({
          success: false,
          message: '서버 내부 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 로그아웃 요청 처리
    socket.on('logout', (callback) => {
      try {
        const username = connectedClients[socket.id].username;
        
        // 로그아웃 처리
        if (connectedClients[socket.id].authenticated) {
          connectedClients[socket.id].authenticated = false;
          connectedClients[socket.id].username = null;
          connectedClients[socket.id].role = null;
          
          logManager.info(`로그아웃 성공 - 사용자: ${username}`);
          
          // 활동 로그 추가
          if (mainWindow) {
            mainWindow.webContents.send('activity-log', {
              type: 'logout',
              message: `${username}님이 로그아웃했습니다.`,
              timestamp: new Date().toISOString(),
              clientId: socket.id
            });
            
            // 클라이언트 정보 업데이트
            mainWindow.webContents.send('clients-update', Object.values(connectedClients));
          }
        }
        
        // 응답 전송
        if (typeof callback === 'function') {
          callback({
            success: true,
            message: '로그아웃되었습니다.',
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('logout-result', {
            success: true,
            message: '로그아웃되었습니다.',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logManager.error(`로그아웃 처리 중 오류 발생 - Socket ID: ${socket.id}, 오류: ${error.message}`);
        
        // 응답 전송
        if (typeof callback === 'function') {
          callback({
            success: false,
            message: '로그아웃 처리 중 오류가 발생했습니다.',
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('logout-result', {
            success: false,
            message: '로그아웃 처리 중 오류가 발생했습니다.',
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // 명령 실행 요청 처리
    socket.on('execute-command', async (data) => {
      try {
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
        if (!connectedClients[socket.id].authenticated) {
          // 인증되지 않은 사용자
          return socket.emit('command-error', { 
            success: false, 
            message: '인증이 필요합니다. 먼저 로그인해주세요.',
            timestamp: new Date().toISOString()
          });
        }
        
        // 인증된 사용자만 명령 실행 가능
        // 데이터 유효성 검사
        if (!data) {
          throw new Error('명령어 데이터가 없습니다.');
        }
        
        // 명령어 처리 모듈 가져오기
        const commandProcessor = require('../services/commandProcessor');
        
        // 명령어 형식 확인 및 처리
        if (typeof data === 'string') {
          // 문자열 형식 명령어 (이전 버전 호환)
          logManager.info(`텍스트 명령어 실행 요청 - 사용자: ${connectedClients[socket.id].username}`);
          
          // 간단한 텍스트 명령어로 변환
          const command = {
            type: 'text',
            content: data
          };
          
          // 명령 처리
          await commandProcessor.processCommand(command, socket.id);
          
          // 명령 실행 요청 접수 알림
          socket.emit('command-accepted', { 
            command: data,
            timestamp: new Date().toISOString()
          });
          
        } else if (data.command && typeof data.command === 'string') {
          // 이전 버전 호환 형식
          logManager.info(`레거시 명령어 실행 요청 - 사용자: ${connectedClients[socket.id].username}`);
          
          // 간단한 텍스트 명령어로 변환
          const command = {
            type: 'text',
            content: data.command
          };
          
          // 명령 처리
          await commandProcessor.processCommand(command, socket.id);
          
          // 명령 실행 요청 접수 알림
          socket.emit('command-accepted', { 
            command: data.command,
            timestamp: new Date().toISOString()
          });
          
        } else if (data.type) {
          // 새로운 명령어 형식
          logManager.info(`고급 명령어 실행 요청 - 사용자: ${connectedClients[socket.id].username}, 타입: ${data.type}`);
          
          // 명령 처리
          await commandProcessor.processCommand(data, socket.id);
          
          // 명령 실행 요청 접수 알림
          socket.emit('command-accepted', { 
            commandType: data.type,
            timestamp: new Date().toISOString()
          });
          
        } else {
          throw new Error('올바르지 않은 명령어 형식입니다.');
        }
        
        // 로그 간략화를 위한 데이터 출력 제한
        let commandPreview = '';
        if (typeof data === 'string') {
          commandPreview = data.length > 50 ? `${data.substring(0, 50)}...` : data;
        } else if (data.command && typeof data.command === 'string') {
          commandPreview = data.command.length > 50 ? `${data.command.substring(0, 50)}...` : data.command;
        } else if (data.type === 'text' && data.content) {
          commandPreview = data.content.length > 50 ? `${data.content.substring(0, 50)}...` : data.content;
        } else {
          commandPreview = `[${data.type || '알 수 없음'} 타입 명령어]`;
        }
        
        if (mainWindow) {
          // 활동 로그 추가
          mainWindow.webContents.send('activity-log', {
            type: 'command',
            message: `${connectedClients[socket.id].username}님이 "${commandPreview}" 명령을 전송했습니다.`,
            timestamp: new Date().toISOString(),
            clientId: socket.id
          });
        }
      } catch (err) {
        logManager.error('명령 실행 오류:', err);
        socket.emit('command-error', { 
          success: false, 
          message: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 연결 확인 요청 처리
    socket.on('ping', (callback) => {
      try {
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
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
      } catch (error) {
        logManager.error(`핑 처리 중 오류 발생 - Socket ID: ${socket.id}, 오류: ${error.message}`);
      }
    });

    // 이미지 스트리밍 요청 처리
    socket.on('start-streaming', async (data, callback) => {
      try {
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
        if (!connectedClients[socket.id].authenticated) {
          // 인증되지 않은 사용자
          return socket.emit('streaming-error', { 
            success: false, 
            message: '인증이 필요합니다. 먼저 로그인해주세요.',
            timestamp: new Date().toISOString()
          });
        }
        
        // 스트리밍 설정 저장
        connectedClients[socket.id].streaming = true;
        connectedClients[socket.id].streamSettings = data || {};
        
        // 설정 확인
        const quality = data?.quality || 'medium';
        const fps = data?.fps || 1; // 기본 1초당 1프레임
        
        logManager.info(`이미지 스트리밍 시작 - 사용자: ${connectedClients[socket.id].username}, 품질: ${quality}, FPS: ${fps}`);
        
        // 응답 전송
        if (typeof callback === 'function') {
          callback({
            success: true,
            message: '스트리밍이 시작되었습니다.',
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('streaming-started', {
            success: true,
            quality: quality,
            fps: fps,
            timestamp: new Date().toISOString()
          });
        }
        
        // 활동 로그 추가
        if (mainWindow) {
          mainWindow.webContents.send('activity-log', {
            type: 'streaming',
            message: `${connectedClients[socket.id].username}님이 이미지 스트리밍을 시작했습니다.`,
            timestamp: new Date().toISOString(),
            clientId: socket.id
          });
        }
        
        // 캡처 스트림 매니저 가져오기
        try {
          const captureStreamManager = require('../services/captureStreamManager');
          
          // 스트리밍이 아직 활성화되지 않았다면 시작
          if (!captureStreamManager.isStreaming()) {
            // 캡처 설정 적용
            const streamSettings = {
              interval: 2000, // 기본 간격 2초
              quality: quality,
              maxFps: fps
            };
            
            logger.log('캡처 스트림 매니저를 통한 스트리밍 시작');
            captureStreamManager.startStreaming(streamSettings);
          } else {
            // 이미 스트리밍 중이면 설정만 업데이트
            logger.log('스트리밍이 이미 활성화됨, 설정 업데이트');
            captureStreamManager.updateStreamSettings({ quality, maxFps: fps });
          }
        } catch (streamErr) {
          logger.error('캡처 스트림 매니저 로드 또는 시작 오류:', streamErr);
          // 스트리밍 오류가 발생해도 클라이언트 설정은 유지
        }
      } catch (err) {
        logger.error('스트리밍 시작 오류:', err);
        socket.emit('streaming-error', { 
          success: false, 
          message: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 이미지 스트리밍 중지 요청 처리
    socket.on('stop-streaming', (callback) => {
      try {
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
        // 스트리밍 설정 제거
        connectedClients[socket.id].streaming = false;
        connectedClients[socket.id].streamSettings = null;
        
        logger.log(`이미지 스트리밍 중지 - 사용자: ${connectedClients[socket.id].username}`);
        
        // 응답 전송
        if (typeof callback === 'function') {
          callback({
            success: true,
            message: '스트리밍이 중지되었습니다.',
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('streaming-stopped', {
            success: true,
            timestamp: new Date().toISOString()
          });
        }
        
        // 활동 로그 추가
        if (mainWindow) {
          mainWindow.webContents.send('activity-log', {
            type: 'streaming-stop',
            message: `${connectedClients[socket.id].username}님이 이미지 스트리밍을 중지했습니다.`,
            timestamp: new Date().toISOString(),
            clientId: socket.id
          });
        }
        
        // 스트리밍 클라이언트가 더 이상 없는지 확인
        const remainingStreamingClients = Object.values(connectedClients).filter(client => client.streaming).length;
        if (remainingStreamingClients === 0) {
          // 스트리밍 클라이언트가 없으면 스트리밍 중지
          try {
            const captureStreamManager = require('../services/captureStreamManager');
            if (captureStreamManager.isStreaming()) {
              logger.log('남은 스트리밍 클라이언트가 없어 스트리밍 중지');
              captureStreamManager.stopStreaming();
            }
          } catch (streamErr) {
            logger.error('캡처 스트림 매니저 로드 또는 중지 오류:', streamErr);
          }
        }
      } catch (err) {
        logger.error('스트리밍 중지 오류:', err);
        if (typeof callback === 'function') {
          callback({
            success: false,
            message: err.message,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('streaming-error', { 
            success: false, 
            message: err.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  
  // 수동 이미지 스트리밍 요청 처리
  socket.on('stream-latest-capture', async (callback) => {
    try {
      // 마지막 활동 시간 업데이트
      connectedClients[socket.id].lastActivity = new Date();
      
      if (!connectedClients[socket.id].authenticated) {
        throw new Error('인증이 필요합니다. 먼저 로그인해주세요.');
      }
      
      logger.log(`최신 캡처 스트리밍 요청 - 사용자: ${connectedClients[socket.id].username}`);
      
      // 캡처 매니저 가져오기
      if (!captureManager) {
        try {
          captureManager = require('../services/captureManager');
        } catch (err) {
          throw new Error('캡처 매니저 로드 실패: ' + err.message);
        }
      }
      
      // 최신 캡처 이미지 가져오기
      const latestCapture = captureManager.getLatestCapture();
      
      if (!latestCapture || !latestCapture.base64) {
        throw new Error('최신 캡처 이미지가 없습니다. 새로운 명령을 전송하세요.');
      }
      
      // 캡처 이미지 최적화 및 전송
      const sendOptions = {
        optimize: true,
        quality: 'medium'
      };
      
      const result = await captureManager.sendCaptureToClient(socket.id, latestCapture.base64, sendOptions);
      
      // 응답 전송
      if (typeof callback === 'function') {
        callback({
          success: true,
          message: '최신 캡처 이미지가 전송되었습니다.',
          timestamp: latestCapture.timestamp || new Date().toISOString()
        });
      }
      
      // 활동 로그 추가
      if (mainWindow) {
        mainWindow.webContents.send('activity-log', {
          type: 'stream-capture',
          message: `${connectedClients[socket.id].username}님이 최신 캡처 이미지를 요청했습니다.`,
          timestamp: new Date().toISOString(),
          clientId: socket.id
        });
      }
    } catch (err) {
      logger.error('최신 캡처 스트리밍 오류:', err);
      if (typeof callback === 'function') {
        callback({
          success: false,
          message: err.message,
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('streaming-error', { 
          success: false, 
          message: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
    
    // 스트리밍 설정 변경 요청 처리
    socket.on('update-streaming-settings', (data, callback) => {
      try {
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
        if (!connectedClients[socket.id].streaming) {
          // 스트리밍 중이 아님
          return socket.emit('streaming-error', { 
            success: false, 
            message: '스트리밍이 시작되지 않았습니다.',
            timestamp: new Date().toISOString()
          });
        }
        
        // 스트리밍 설정 업데이트
        connectedClients[socket.id].streamSettings = { 
          ...connectedClients[socket.id].streamSettings, 
          ...data 
        };
        
        // 설정 확인
        const quality = data?.quality || connectedClients[socket.id].streamSettings?.quality || 'medium';
        const fps = data?.fps || connectedClients[socket.id].streamSettings?.fps || 1;
        
        logger.log(`이미지 스트리밍 설정 변경 - 사용자: ${connectedClients[socket.id].username}, 품질: ${quality}, FPS: ${fps}`);
        
        // 응답 전송
        if (typeof callback === 'function') {
          callback({
            success: true,
            message: '스트리밍 설정이 변경되었습니다.',
            settings: connectedClients[socket.id].streamSettings,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('streaming-settings-updated', {
            success: true,
            settings: connectedClients[socket.id].streamSettings,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        logger.error('스트리밍 설정 변경 오류:', err);
        if (typeof callback === 'function') {
          callback({
            success: false,
            message: err.message,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('streaming-error', { 
            success: false, 
            message: err.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
    
    // 캡처 요청 처리
    socket.on('request-capture', async (data, callback) => {
      try {
        // 마지막 활동 시간 업데이트
        connectedClients[socket.id].lastActivity = new Date();
        
        if (!connectedClients[socket.id].authenticated) {
          // 인증되지 않은 사용자
          return socket.emit('capture-error', { 
            success: false, 
            message: '인증이 필요합니다. 먼저 로그인해주세요.',
            timestamp: new Date().toISOString()
          });
        }
        
        // 캡처 옵션
        const options = {
          quality: data?.quality || 'medium',
          format: data?.format || 'jpeg',
          resize: data?.resize || null
        };
        
        logger.log(`캡처 요청 - 사용자: ${connectedClients[socket.id].username}`);
        
        // 캡처 매니저 호출
        if (!captureManager) {
          // 캡처 매니저 가져오기 시도
          try {
            captureManager = require('../services/captureManager');
          } catch (err) {
            throw new Error('캡처 매니저 로드 실패: ' + err.message);
          }
        }
        
        // 화면 캡처
        const imageData = await captureManager.captureScreen();
        
        if (!imageData) {
          throw new Error('캡처 실패: 이미지 데이터가 없습니다.');
        }
        
        // 캡처 이미지 전송
        const sendOptions = {
          optimize: true,
          quality: options.quality
        };
        
        await captureManager.sendCaptureToClient(socket.id, imageData, sendOptions);
        
        // 응답 전송
        if (typeof callback === 'function') {
          callback({
            success: true,
            message: '캡처가 성공적으로 전송되었습니다.',
            timestamp: new Date().toISOString()
          });
        }
        
        // 활동 로그 추가
        if (mainWindow) {
          mainWindow.webContents.send('activity-log', {
            type: 'capture',
            message: `${connectedClients[socket.id].username}님이 화면 캡처를 요청했습니다.`,
            timestamp: new Date().toISOString(),
            clientId: socket.id
          });
        }
      } catch (err) {
        logger.error('캡처 요청 오류:', err);
        if (typeof callback === 'function') {
          callback({
            success: false,
            message: err.message,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('capture-error', { 
            success: false, 
            message: err.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
    // 연결 해제 처리
    socket.on('disconnect', () => {
      try {
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
            timestamp: new Date().toISOString(),
            clientId: socket.id
          });
        }
      } catch (error) {
        logger.error(`연결 해제 처리 중 오류 발생: ${error.message}`);
      }
    });
  });
}
function sendToClient(clientId, event, data) {
  if (!io || !connectedClients[clientId]) {
    return false;
  }
  
  try {
    io.to(clientId).emit(event, data);
    return true;
  } catch (err) {
    logger.error(`클라이언트 메시지 전송 오류 (${event}):`, err);
    return false;
  }
}

/**
 * 특정 사용자에게 이벤트 전송
 * @param {string} username 사용자명
 * @param {string} event 이벤트 이름
 * @param {any} data 전송할 데이터
 * @returns {Object} 결과 {success, sentCount}
 */
function sendToUser(username, event, data) {
  if (!io || !username) {
    return { success: false, sentCount: 0 };
  }
  
  try {
    // 사용자의 모든 연결 찾기
    const userClients = Object.entries(connectedClients)
      .filter(([_, client]) => client.authenticated && client.username === username)
      .map(([id, _]) => id);
    
    if (userClients.length === 0) {
      return { success: false, sentCount: 0 };
    }
    
    // 모든 연결에 메시지 전송
    let sentCount = 0;
    userClients.forEach(clientId => {
      try {
        io.to(clientId).emit(event, data);
        sentCount++;
      } catch (err) {
        logger.error(`사용자 메시지 전송 오류 (${username}, ${clientId}):`, err);
      }
    });
    
    return { 
      success: sentCount > 0, 
      sentCount
    };
  } catch (err) {
    logger.error(`사용자 메시지 전송 오류 (${username}):`, err);
    return { success: false, sentCount: 0 };
  }
}

/**
 * 모든 클라이언트에게 이벤트 전송
 * @param {string} event 이벤트 이름
 * @param {any} data 전송할 데이터
 * @returns {boolean} 전송 성공 여부
 */
function notifyAllClients(event, data) {
  if (!io) {
    return false;
  }
  
  try {
    io.emit(event, data);
    return true;
  } catch (err) {
    logger.error(`전체 메시지 전송 오류 (${event}):`, err);
    return false;
  }
}

/**
 * 인증된 클라이언트에게만 이벤트 전송
 * @param {string} event 이벤트 이름
 * @param {any} data 전송할 데이터
 * @returns {Object} 결과 {success, sentCount}
 */
function notifyAuthenticatedClients(event, data) {
  if (!io) {
    return { success: false, sentCount: 0 };
  }
  
  try {
    // 인증된 클라이언트 필터링
    const authClients = Object.entries(connectedClients)
      .filter(([_, client]) => client.authenticated)
      .map(([id, _]) => id);
    
    if (authClients.length === 0) {
      return { success: false, sentCount: 0 };
    }
    
    // 인증된 클라이언트에게 메시지 전송
    let sentCount = 0;
    authClients.forEach(clientId => {
      try {
        io.to(clientId).emit(event, data);
        sentCount++;
      } catch (err) {
        logger.error(`인증 클라이언트 메시지 전송 오류 (${clientId}):`, err);
      }
    });
    
    return { 
      success: sentCount > 0, 
      sentCount
    };
  } catch (err) {
    logger.error(`인증 클라이언트 메시지 전송 오류:`, err);
    return { success: false, sentCount: 0 };
  }
}

/**
 * 클라이언트 연결 해제
 * @param {string} clientId 클라이언트 ID
 * @returns {boolean} 연결 해제 성공 여부
 */
function disconnectClient(clientId) {
  try {
    if (!clientId || !connectedClients[clientId]) {
      return false;
    }
    
    const clientInfo = connectedClients[clientId];
    
    // 클라이언트에게 연결 해제 알림
    try {
      io.to(clientId).emit('force-disconnect', {
        message: '서버에 의해 연결이 종료되었습니다.',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error(`강제 연결 해제 메시지 전송 오류 (${clientId}):`, err);
    }
    
    // 소켓 연결 종료
    try {
      const socket = io.sockets.sockets.get(clientId);
      if (socket) {
        socket.disconnect(true);
      }
    } catch (err) {
      logger.error(`소켓 연결 해제 오류 (${clientId}):`, err);
    }
    
    // 클라이언트 정보 삭제
    delete connectedClients[clientId];
    
    // 활동 로그 추가
    if (mainWindow) {
      mainWindow.webContents.send('activity-log', {
        type: 'force-disconnect',
        message: `${clientInfo.username || '알 수 없음'}(${clientInfo.device || '알 수 없음'})의 연결이 관리자에 의해 강제 종료되었습니다.`,
        timestamp: new Date().toISOString(),
        clientId: clientId
      });
      
      // 클라이언트 정보 업데이트
      mainWindow.webContents.send('clients-update', Object.values(connectedClients));
    }
    
    return true;
  } catch (err) {
    logger.error('클라이언트 연결 해제 오류:', err);
    return false;
  }
}

/**
 * 사용자의 모든 연결 해제
 * @param {string} username 사용자명
 * @returns {Object} 결과 {success, disconnectedCount}
 */
function disconnectUser(username) {
  try {
    if (!username) {
      return { success: false, disconnectedCount: 0 };
    }
    
    // 사용자의 모든 연결 찾기
    const userClients = Object.entries(connectedClients)
      .filter(([_, client]) => client.username === username)
      .map(([id, _]) => id);
    
    if (userClients.length === 0) {
      return { success: false, disconnectedCount: 0 };
    }
    
    // 모든 연결 해제
    let disconnectedCount = 0;
    userClients.forEach(clientId => {
      try {
        const success = disconnectClient(clientId);
        if (success) {
          disconnectedCount++;
        }
      } catch (err) {
        logger.error(`사용자 연결 해제 오류 (${username}, ${clientId}):`, err);
      }
    });
    
    return { 
      success: disconnectedCount > 0, 
      disconnectedCount
    };
  } catch (err) {
    logger.error(`사용자 연결 해제 오류 (${username}):`, err);
    return { success: false, disconnectedCount: 0 };
  }
}

/**
 * 모든 클라이언트 연결 해제
 * @returns {Object} 결과 {success, disconnectedCount}
 */
function disconnectAllClients() {
  try {
    const clientIds = Object.keys(connectedClients);
    
    if (clientIds.length === 0) {
      return { success: true, disconnectedCount: 0 };
    }
    
    // 모든 연결 해제
    let disconnectedCount = 0;
    clientIds.forEach(clientId => {
      try {
        const success = disconnectClient(clientId);
        if (success) {
          disconnectedCount++;
        }
      } catch (err) {
        logger.error(`전체 연결 해제 중 오류 (${clientId}):`, err);
      }
    });
    
    return { 
      success: true, 
      disconnectedCount
    };
  } catch (err) {
    logger.error('전체 연결 해제 오류:', err);
    return { success: false, disconnectedCount: 0 };
  }
}

/**
 * 비활성 클라이언트 연결 해제
 * @param {number} timeoutMinutes 제한 시간 (분)
 * @returns {Object} 결과 {success, disconnectedCount}
 */
function disconnectInactiveClients(timeoutMinutes = 30) {
  try {
    if (timeoutMinutes <= 0) {
      return { success: false, disconnectedCount: 0 };
    }
    
    const now = new Date();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    // 비활성 클라이언트 찾기
    const inactiveClients = Object.entries(connectedClients)
      .filter(([_, client]) => {
        const lastActivity = client.lastActivity || client.connectTime || now;
        const inactiveTime = now - new Date(lastActivity);
        return inactiveTime > timeoutMs;
      })
      .map(([id, _]) => id);
    
    if (inactiveClients.length === 0) {
      return { success: true, disconnectedCount: 0 };
    }
    
    // 모든 비활성 연결 해제
    let disconnectedCount = 0;
    inactiveClients.forEach(clientId => {
      try {
        // 연결 해제 전 클라이언트에게 알림
        try {
          io.to(clientId).emit('inactive-disconnect', {
            message: `${timeoutMinutes}분 동안 활동이 없어 연결이 종료되었습니다.`,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          logger.error(`비활성 연결 해제 메시지 전송 오류 (${clientId}):`, err);
        }
        
        const success = disconnectClient(clientId);
        if (success) {
          disconnectedCount++;
        }
      } catch (err) {
        logger.error(`비활성 연결 해제 중 오류 (${clientId}):`, err);
      }
    });
    
    return { 
      success: true, 
      disconnectedCount
    };
  } catch (err) {
    logger.error('비활성 연결 해제 오류:', err);
    return { success: false, disconnectedCount: 0 };
  }
}

/**
 * 모든 클라이언트 정보 삭제
 */
function clearAllClients() {
  connectedClients = {};
  
  // 클라이언트 정보 업데이트
  if (mainWindow) {
    mainWindow.webContents.send('clients-update', []);
  }
}

/**
 * 연결된 클라이언트 수 가져오기
 * @returns {number} 연결된 클라이언트 수
 */
function getClientCount() {
  return Object.keys(connectedClients).length;
}

/**
 * 인증된 클라이언트 수 가져오기
 * @returns {number} 인증된 클라이언트 수
 */
function getAuthenticatedClientCount() {
  return Object.values(connectedClients)
    .filter(client => client.authenticated)
    .length;
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

/**
 * 사용자의 모든 클라이언트 정보 가져오기
 * @param {string} username 사용자명
 * @returns {Array} 클라이언트 정보 배열
 */
function getUserClients(username) {
  if (!username) {
    return [];
  }
  
  return Object.values(connectedClients)
    .filter(client => client.authenticated && client.username === username);
}

/**
 * 스트리밍 상태 확인
 * @returns {boolean} 스트리밍 중인 클라이언트가 있는지 여부
 */
function hasStreamingClients() {
  try {
    return Object.values(connectedClients).some(client => 
      client.authenticated && client.streaming
    );
  } catch (err) {
    logger.error('스트리밍 상태 확인 오류:', err);
    return false;
  }
}

/**
 * 스트리밍 중인 클라이언트 소켓 ID 목록 가져오기
 * @returns {string[]} 스트리밍 중인 클라이언트 소켓 ID 배열
 */
function getStreamingClients() {
  try {
    return Object.entries(connectedClients)
      .filter(([_, client]) => client.authenticated && client.streaming)
      .map(([id, _]) => id);
  } catch (err) {
    logger.error('스트리밍 클라이언트 조회 오류:', err);
    return [];
  }
}

/**
 * 스트리밍 중인 클라이언트에게 이미지 전송
 * @param {string} imageData 이미지 데이터 (Base64)
 * @param {Object} options 옵션
 * @returns {Promise<Object>} 결과 {success, sentCount}
 */
async function streamImageToClients(imageData, options = {}) {
  if (!io || !imageData) {
    return { success: false, sentCount: 0 };
  }
  
  try {
    // 스트리밍 중인 클라이언트 찾기
    const streamingClients = Object.entries(connectedClients)
      .filter(([_, client]) => client.authenticated && client.streaming)
      .map(([id, client]) => ({
        id,
        settings: client.streamSettings || {}
      }));
    
    if (streamingClients.length === 0) {
      return { success: false, sentCount: 0 };
    }
    
    logManager.info(`스트리밍 클라이언트 ${streamingClients.length}개에게 이미지 전송 중...`);
    
    // 캡처 매니저 가져오기
    if (!captureManager) {
      try {
        captureManager = require('../services/captureManager');
      } catch (err) {
        logger.error('캡처 매니저 로드 실패:', err);
        return { success: false, sentCount: 0 };
      }
    }
    
    // 스트리밍 클라이언트 ID 배열 생성
    const clientIds = streamingClients.map(client => client.id);
    
    // 전송 옵션 설정
    const sendOptions = {
      optimize: true,
      quality: options.quality || 'medium'
    };
    
    // 캡처 매니저의 streamImageToClients 함수 호출
    try {
      const result = await captureManager.streamImageToClients(clientIds, imageData, sendOptions);
      
      // 전송 성공 시 활동 로그 추가
      if (result.success && mainWindow) {
        mainWindow.webContents.send('activity-log', {
          type: 'stream-image',
          message: `캡처 이미지를 ${result.sentCount}개의 클라이언트에게 스트리밍했습니다.`,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (err) {
      logger.error('캡처 매니저 스트리밍 전송 오류:', err);
      
      // 플랜 B: 각 클라이언트에게 개별 전송 시도
      let sentCount = 0;
      const timestamp = new Date().toISOString();
      
      for (const client of streamingClients) {
        try {
          // 클라이언트별 설정 가져오기
          const clientQuality = client.settings.quality || options.quality || 'medium';
          
          // 최적화 옵션 설정
          const clientOptions = {
            optimize: true,
            quality: clientQuality
          };
          
          // 이미지 최적화
          let finalImage = imageData;
          if (clientOptions.optimize) {
            try {
              finalImage = await captureManager.optimizeImage(imageData, clientOptions.quality);
            } catch (optErr) {
              logger.error(`이미지 최적화 오류 (${client.id}):`, optErr);
              // 오류 발생 시 원본 이미지 사용
            }
          }
          
          // 이미지 전송
          sendToClient(client.id, 'ai-response', {
            success: true,
            image: finalImage,
            timestamp: timestamp,
            streaming: true
          });
          
          sentCount++;
        } catch (clientErr) {
          logger.error(`클라이언트 스트리밍 전송 오류 (${client.id}):`, clientErr);
        }
      }
      
      // 전송 성공 시 활동 로그 추가
      if (sentCount > 0 && mainWindow) {
        mainWindow.webContents.send('activity-log', {
          type: 'stream-image',
          message: `캡처 이미지를 ${sentCount}개의 클라이언트에게 개별 전송했습니다. (백업 방식)`,
          timestamp: timestamp
        });
      }
      
      return { 
        success: sentCount > 0, 
        sentCount,
        timestamp
      };
    }
  } catch (err) {
    logger.error('이미지 스트리밍 오류:', err);
    return { success: false, sentCount: 0 };
  }
}

// 모듈 내보내기
module.exports = {
  init,
  setSocketIO,
  sendToClient,
  sendToUser,
  notifyAllClients,
  notifyAuthenticatedClients,
  disconnectClient,
  disconnectUser,
  disconnectAllClients,
  disconnectInactiveClients,
  clearAllClients,
  getClientCount,
  getAuthenticatedClientCount,
  getAllClients,
  getClient,
  getUserClients,
  getUserConnectionCount,
  streamImageToClients,
  hasStreamingClients,
  getStreamingClients
};