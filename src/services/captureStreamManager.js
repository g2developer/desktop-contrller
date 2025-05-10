/**
 * captureStreamManager.js
 * 캡처 스트리밍 관리 모듈
 * 클로드 앱의 응답 화면을 주기적으로 캡처하고 스트리밍하는 기능을 제공합니다.
 */

const captureManager = require('./captureManager');
const socketManager = require('../server/socketManager');

// 변수 초기화
let streamingInterval = null;
let lastCaptureTime = 0;
let streamingActive = false;
let streamSettings = {
  interval: 2000, // 기본 캡처 간격 (ms)
  quality: 'medium', // 기본 이미지 품질
  maxFps: 1 // 초당 최대 프레임 수
};
let logger;

/**
 * 스트리밍 관리자 초기화
 * @param {Object} loggerModule 로거 모듈(선택적)
 */
function init(loggerModule) {
  // 로거 설정
  logger = loggerModule || {
    info: (...args) => console.log('[Capture Stream Manager]', ...args),
    warn: (...args) => console.warn('[Capture Stream Manager]', ...args),
    error: (...args) => console.error('[Capture Stream Manager]', ...args)
  };
  
  // logManager에는 log 메서드가 없고 info를 사용하므로 변환
  if (!logger.log && logger.info) {
    logger.log = logger.info;
  }
  
  logger.info('캡처 스트리밍 관리자 초기화 완료');
}

/**
 * 스트리밍 시작
 * @param {Object} settings 스트리밍 설정
 * @returns {boolean} 시작 성공 여부
 */
function startStreaming(settings = {}) {
  try {
    // 이미 스트리밍 중인지 확인
    if (streamingActive && streamingInterval) {
      logger.warn('이미 스트리밍이 활성화되어 있습니다.');
      return false;
    }
    
    // 설정 병합
    streamSettings = {
      ...streamSettings,
      ...settings
    };
    
    // 간격이 너무 짧으면 조정
    if (streamSettings.interval < 500) {
      logger.warn(`스트리밍 간격이 너무 짧습니다: ${streamSettings.interval}ms, 500ms로 조정합니다.`);
      streamSettings.interval = 500;
    }
    
    // FPS 설정에 따라 간격 조정
    if (streamSettings.maxFps && streamSettings.maxFps > 0) {
      const intervalByFps = Math.floor(1000 / streamSettings.maxFps);
      if (intervalByFps > streamSettings.interval) {
        streamSettings.interval = intervalByFps;
      }
    }
    
    logger.info(`스트리밍 시작: 간격=${streamSettings.interval}ms, 품질=${streamSettings.quality}`);
    
    // 스트리밍 상태 활성화
    streamingActive = true;
    
    // 즉시 첫 번째 캡처 전송
    captureAndStream();
    
    // 주기적 캡처 및 스트리밍 설정
    streamingInterval = setInterval(captureAndStream, streamSettings.interval);
    
    return true;
  } catch (err) {
    logger.error('스트리밍 시작 오류:', err);
    return false;
  }
}

/**
 * 스트리밍 중지
 * @returns {boolean} 중지 성공 여부
 */
function stopStreaming() {
  try {
    // 스트리밍 중인지 확인
    if (!streamingActive || !streamingInterval) {
      logger.warn('활성화된 스트리밍이 없습니다.');
      return false;
    }
    
    // 주기적 캡처 중지
    clearInterval(streamingInterval);
    streamingInterval = null;
    
    // 스트리밍 상태 비활성화
    streamingActive = false;
    
    logger.info('스트리밍 중지됨');
    
    return true;
  } catch (err) {
    logger.error('스트리밍 중지 오류:', err);
    return false;
  }
}

/**
 * 스트리밍 설정 업데이트
 * @param {Object} settings 새 스트리밍 설정
 * @returns {boolean} 업데이트 성공 여부
 */
function updateStreamSettings(settings = {}) {
  try {
    // 변경되는 설정만 업데이트
    const oldSettings = { ...streamSettings };
    streamSettings = {
      ...streamSettings,
      ...settings
    };
    
    // 스트리밍 중인 경우에만 재시작 필요 확인
    if (streamingActive && streamingInterval) {
      // 간격이 변경된 경우 스트리밍 재시작
      if (oldSettings.interval !== streamSettings.interval || 
          (settings.maxFps && oldSettings.maxFps !== settings.maxFps)) {
        
        // 간격이 너무 짧으면 조정
        if (streamSettings.interval < 500) {
          logger.warn(`스트리밍 간격이 너무 짧습니다: ${streamSettings.interval}ms, 500ms로 조정합니다.`);
          streamSettings.interval = 500;
        }
        
        // FPS 설정에 따라 간격 조정
        if (streamSettings.maxFps && streamSettings.maxFps > 0) {
          const intervalByFps = Math.floor(1000 / streamSettings.maxFps);
          if (intervalByFps > streamSettings.interval) {
            streamSettings.interval = intervalByFps;
          }
        }
        
        logger.info(`스트리밍 설정 변경으로 재시작: 간격=${streamSettings.interval}ms, 품질=${streamSettings.quality}`);
        
        // 기존 인터벌 중지 및 재시작
        clearInterval(streamingInterval);
        streamingInterval = setInterval(captureAndStream, streamSettings.interval);
      } else {
        logger.info(`스트리밍 설정 업데이트됨: 품질=${streamSettings.quality}`);
      }
    } else {
      logger.info(`스트리밍 설정 업데이트됨 (비활성 상태): 간격=${streamSettings.interval}ms, 품질=${streamSettings.quality}`);
    }
    
    return true;
  } catch (err) {
    logger.error('스트리밍 설정 업데이트 오류:', err);
    return false;
  }
}

/**
 * 캡처 및 스트리밍 수행
 * @returns {Promise<void>}
 */
async function captureAndStream() {
  try {
    // 스트리밍 클라이언트가 있는지 확인
    const hasStreamingClients = socketManager.hasStreamingClients();
    if (!hasStreamingClients) {
      logger.info('스트리밍 클라이언트가 없어 자동 중지합니다.');
      stopStreaming();
      return;
    }
    
    // 연속 캡처 간격 제한 (최소 300ms)
    const now = Date.now();
    const timeSinceLastCapture = now - lastCaptureTime;
    if (timeSinceLastCapture < 300) {
      logger.info(`캡처 간격이 너무 짧음: ${timeSinceLastCapture}ms, 건너뜁니다.`);
      return;
    }
    
    // 시간 기록
    lastCaptureTime = now;
    
    // 화면 캡처
    logger.info('화면 캡처 중...');
    const imageData = await captureManager.captureScreen();
    
    if (!imageData) {
      logger.warn('캡처 실패: 이미지 데이터 없음');
      return;
    }
    
    // 스트리밍 클라이언트 목록 가져오기
    const streamingClients = socketManager.getStreamingClients();
    
    if (!streamingClients || streamingClients.length === 0) {
      logger.info('스트리밍 클라이언트가 없습니다.');
      return;
    }
    
    logger.info(`${streamingClients.length}개의 클라이언트에게 이미지 스트리밍 중...`);
    
    // 이미지 전송 옵션
    const sendOptions = {
      optimize: true,
      quality: streamSettings.quality
    };
    
    // 캡처 이미지 스트리밍
    await captureManager.streamImageToClients(streamingClients, imageData, sendOptions);
  } catch (err) {
    logger.error('캡처 및 스트리밍 오류:', err);
  }
}

/**
 * 스트리밍 상태 확인
 * @returns {boolean} 스트리밍 활성화 여부
 */
function isStreaming() {
  return streamingActive && streamingInterval !== null;
}

/**
 * 스트리밍 설정 가져오기
 * @returns {Object} 현재 스트리밍 설정
 */
function getStreamSettings() {
  return { ...streamSettings };
}

/**
 * 한 번의 캡처 및 스트리밍 수행 (수동)
 * @returns {Promise<boolean>} 성공 여부
 */
async function singleCaptureAndStream() {
  try {
    // 스트리밍 클라이언트가 있는지 확인
    const hasStreamingClients = socketManager.hasStreamingClients();
    if (!hasStreamingClients) {
      logger.info('스트리밍 클라이언트가 없습니다.');
      return false;
    }
    
    // 화면 캡처
    logger.info('화면 캡처 중... (수동 요청)');
    const imageData = await captureManager.captureScreen();
    
    if (!imageData) {
      logger.warn('캡처 실패: 이미지 데이터 없음');
      return false;
    }
    
    // 스트리밍 클라이언트 목록 가져오기
    const streamingClients = socketManager.getStreamingClients();
    
    if (!streamingClients || streamingClients.length === 0) {
      logger.info('스트리밍 클라이언트가 없습니다.');
      return false;
    }
    
    logger.info(`${streamingClients.length}개의 클라이언트에게 이미지 스트리밍 중... (수동 요청)`);
    
    // 이미지 전송 옵션
    const sendOptions = {
      optimize: true,
      quality: streamSettings.quality
    };
    
    // 캡처 이미지 스트리밍
    const result = await captureManager.streamImageToClients(streamingClients, imageData, sendOptions);
    
    return result.success;
  } catch (err) {
    logger.error('수동 캡처 및 스트리밍 오류:', err);
    return false;
  }
}

// 모듈 내보내기
module.exports = {
  init,
  startStreaming,
  stopStreaming,
  updateStreamSettings,
  isStreaming,
  getStreamSettings,
  singleCaptureAndStream,
  captureAndStream  // 테스트 및 직접 호출용
};