// configManager.js
// 설정 관리 모듈

// 상수 정의
const DEFAULT_SERVER_PORT = 8000; // 기본 포트 번호를 6000에서 8000으로 변경

const path = require('path');
const { app } = require('electron');
const os = require('os');
// 로컬 IP 주소 가져오기 함수
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 내부 IP만 필터링 (IPv4)
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // 기본값
}

// 공개 IP 주소 가져오기 함수
async function getPublicIpAddress() {
  try {
    // 동적 import 사용
    const { publicIpv4 } = await import('public-ip');
    return await publicIpv4();
  } catch (err) {
    console.error('공개 IP 가져오기 오류:', err);
    return getLocalIpAddress(); // 오류 발생 시 로컬 IP 반환
  }
}

// 변수 초기화
let store;

/**
 * 설정 관리자 초기화
 * @param {Store} configStore 설정 저장소
 */
function init(configStore) {
  store = configStore;
  
  // 저장소 상태 확인
  if (!store) {
    console.error('설정 저장소가 없습니다. 새 Store 객체를 생성합니다.');
    const Store = require('electron-store');
    store = new Store();
  }
  
  // Store 이상 확인
  try {
    const testKey = 'test_config_manager';
    store.set(testKey, { test: true, timestamp: new Date().toISOString() });
    const testValue = store.get(testKey);
    if (!testValue || !testValue.test) {
      console.error('설정 저장소 설정/가져오기 테스트 실패');
    } else {
      console.log('설정 저장소 정상 동작:', testValue);
      store.delete(testKey); // 테스트 키 삭제
    }
  } catch (err) {
    console.error('설정 저장소 동작 테스트 오류:', err);
  }
  
  // 기본 설정 확인 및 설정
  initializeDefaultSettings();
}

/**
 * 기본 설정 초기화
 */
function initializeDefaultSettings() {
  // 서버 설정 초기화
  if (!store.has('serverPort')) {
    store.set('serverPort', DEFAULT_SERVER_PORT);
  }
  
  if (!store.has('socketTimeout')) {
    store.set('socketTimeout', 30);
  }
  
  if (!store.has('autoStart')) {
    store.set('autoStart', true);
  }
  
  // 클로드 앱 설정 초기화
  if (!store.has('claudePath')) {
    store.set('claudePath', '');
  }
  
  if (!store.has('autoLaunch')) {
    store.set('autoLaunch', true);
  }
  
  if (!store.has('autoCaptureAfter')) {
    store.set('autoCaptureAfter', true);
  }
  
  if (!store.has('captureDelay')) {
    store.set('captureDelay', 2);
  }
  
  // 보안 설정 초기화
  if (!store.has('sessionTimeout')) {
    store.set('sessionTimeout', 30);
  }
  
  if (!store.has('passwordPolicy')) {
    store.set('passwordPolicy', {
      minLength: true,      // 최소 8자
      requireNumbers: true, // 숫자 포함
      requireSpecial: false // 특수문자 포함
    });
  }
  
  if (!store.has('loginAttempts')) {
    store.set('loginAttempts', 5);
  }
  
  // 캡처 설정 초기화
  if (!store.has('captureSettings')) {
    store.set('captureSettings', {
      quality: 'medium',   // high, medium, low
      autoCapture: true,
      autoSend: true
    });
  }
  
  // 사용자 데이터 파일 경로 설정
  if (!store.has('userDataPath')) {
    store.set('userDataPath', path.join(app.getPath('userData'), 'users.json'));
  }
  
  // 캡처 저장 경로 설정
  if (!store.has('captureSavePath')) {
    store.set('captureSavePath', path.join(app.getPath('userData'), 'captures'));
  }
  
  // 명령 기록 저장 설정
  if (!store.has('commandHistoryEnabled')) {
    store.set('commandHistoryEnabled', true);
  }
  
  if (!store.has('commandHistoryLimit')) {
    store.set('commandHistoryLimit', 100);
  }
}

/**
 * 설정 가져오기
 * @param {string} key 설정 키
 * @param {any} defaultValue 기본값
 * @returns {any} 설정 값
 */
function getSetting(key, defaultValue) {
  try {
    if (!store) {
      console.error(`설정 가져오기 실패 (${key}): 저장소가 초기화되지 않았습니다.`);
      return defaultValue;
    }
    
    const value = store.get(key, defaultValue);
    console.log(`설정 가져오기 (${key}):`, value);
    return value;
  } catch (err) {
    console.error(`설정 가져오기 오류 (${key}):`, err);
    return defaultValue;
  }
}

/**
 * 설정 저장하기
 * @param {string} key 설정 키
 * @param {any} value 설정 값
 * @returns {boolean} 저장 성공 여부
 */
function setSetting(key, value) {
  try {
    if (!store) {
      console.error(`설정 저장 실패 (${key}): 저장소가 초기화되지 않았습니다.`);
      return false;
    }
    
    console.log(`설정 저장 시도 (${key}):`, value);
    store.set(key, value);
    
    // 저장 완료 후 값을 다시 확인하여 성공 여부 확인
    const savedValue = store.get(key);
    const success = savedValue !== undefined && JSON.stringify(savedValue) === JSON.stringify(value);
    
    if (success) {
      console.log(`설정 저장 성공 (${key}):`, savedValue);
    } else {
      console.error(`설정 저장 확인 실패 (${key}): 저장된 값이 일치하지 않습니다.`, { saved: savedValue, expected: value });
    }
    
    return success;
  } catch (err) {
    console.error(`설정 저장 오류 (${key}):`, err);
    return false;
  }
}

/**
 * 설정 삭제하기
 * @param {string} key 설정 키
 * @returns {boolean} 삭제 성공 여부
 */
function deleteSetting(key) {
  try {
    store.delete(key);
    return true;
  } catch (err) {
    console.error('설정 삭제 오류:', err);
    return false;
  }
}

/**
 * 서버 정보 가져오기
 * @returns {Object} 서버 정보
 */
async function getServerInfo() {
  const serverPort = store.get('serverPort') || DEFAULT_SERVER_PORT;
  
  try {
    // 공개 IP 가져오기
    const publicIp = await getPublicIpAddress();
    
    return {
      port: serverPort,
      ip: publicIp,
      localIp: getLocalIpAddress(),
      host: os.hostname()
    };
  } catch (err) {
    // 오류 발생 시 로컬 IP만 사용
    return {
      port: serverPort,
      ip: getLocalIpAddress(),
      host: os.hostname()
    };
  }
}

/**
 * 클로드 앱 설정 가져오기
 * @returns {Object} 클로드 앱 설정
 */
function getClaudeSettings() {
  return {
    path: store.get('claudePath') || '',
    autoLaunch: store.get('autoLaunch') !== false,
    autoCaptureAfter: store.get('autoCaptureAfter') !== false,
    captureDelay: store.get('captureDelay') || 2
  };
}

/**
 * 캡처 설정 가져오기
 * @returns {Object} 캡처 설정
 */
function getCaptureSettings() {
  return store.get('captureSettings') || {
    quality: 'medium',
    autoCapture: true,
    autoSend: true
  };
}

/**
 * 보안 설정 가져오기
 * @returns {Object} 보안 설정
 */
function getSecuritySettings() {
  return {
    sessionTimeout: store.get('sessionTimeout') || 30,
    passwordPolicy: store.get('passwordPolicy') || {
      minLength: true,
      requireNumbers: true,
      requireSpecial: false
    },
    loginAttempts: store.get('loginAttempts') || 5
  };
}

/**
 * 설정 초기화 (기본값으로)
 * @returns {boolean} 초기화 성공 여부
 */
function resetSettings() {
  try {
    // 초기화 전에 중요 설정 백업
    const claudePath = store.get('claudePath');
    const userDataPath = store.get('userDataPath');
    
    // 모든 설정 삭제
    store.clear();
    
    // 기본 설정 다시 초기화
    initializeDefaultSettings();
    
    // 중요 설정 복원
    if (claudePath) {
      store.set('claudePath', claudePath);
    }
    
    if (userDataPath) {
      store.set('userDataPath', userDataPath);
    }
    
    return true;
  } catch (err) {
    console.error('설정 초기화 오류:', err);
    return false;
  }
}

// 모듈 내보내기
module.exports = {
  init,
  getSetting,
  setSetting,
  deleteSetting,
  getServerInfo,
  getClaudeSettings,
  getCaptureSettings,
  getSecuritySettings,
  resetSettings,
  DEFAULT_SERVER_PORT // 상수 내보내기
};