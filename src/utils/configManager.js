/**
 * 설정 관리자: 애플리케이션 설정 관리
 */

// 변수 초기화
let store;

/**
 * 설정 관리자 초기화
 * @param {Store} configStore 설정 저장소
 */
function init(configStore) {
  store = configStore;
  
  // 기본 설정 초기화
  initDefaultSettings();
}

/**
 * 기본 설정 초기화
 */
function initDefaultSettings() {
  // 서버 설정
  if (!store.has('serverPort')) {
    store.set('serverPort', 3000);
  }
  
  if (!store.has('timeout')) {
    store.set('timeout', 30);
  }
  
  if (!store.has('autoStart')) {
    store.set('autoStart', true);
  }
  
  // 클로드 앱 설정
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
  
  // 보안 설정
  if (!store.has('sessionTimeout')) {
    store.set('sessionTimeout', 30);
  }
  
  if (!store.has('passwordPolicy')) {
    store.set('passwordPolicy', {
      minLength: true,
      requireNumbers: true,
      requireSpecial: false
    });
  }
  
  if (!store.has('loginAttempts')) {
    store.set('loginAttempts', 5);
  }
  
  // 캡처 영역
  if (!store.has('captureArea')) {
    store.set('captureArea', { x: 0, y: 0, width: 800, height: 600 });
  }
}

/**
 * 특정 설정 가져오기
 * @param {string} key 설정 키
 * @param {any} defaultValue 기본값
 * @returns {any} 설정 값
 */
function getSetting(key, defaultValue) {
  return store.get(key, defaultValue);
}

/**
 * 특정 설정 저장하기
 * @param {string} key 설정 키
 * @param {any} value 설정 값
 */
function setSetting(key, value) {
  store.set(key, value);
}

/**
 * 모든 설정 가져오기
 * @returns {Object} 모든 설정
 */
function getAllSettings() {
  return {
    server: {
      port: store.get('serverPort'),
      timeout: store.get('timeout'),
      autoStart: store.get('autoStart')
    },
    claude: {
      path: store.get('claudePath'),
      autoLaunch: store.get('autoLaunch'),
      autoCaptureAfter: store.get('autoCaptureAfter'),
      captureDelay: store.get('captureDelay')
    },
    security: {
      sessionTimeout: store.get('sessionTimeout'),
      passwordPolicy: store.get('passwordPolicy'),
      loginAttempts: store.get('loginAttempts')
    },
    capture: {
      area: store.get('captureArea')
    }
  };
}

/**
 * 설정 존재 여부 확인
 * @param {string} key 설정 키
 * @returns {boolean} 존재 여부
 */
function hasSetting(key) {
  return store.has(key);
}

/**
 * 설정 삭제
 * @param {string} key 설정 키
 */
function deleteSetting(key) {
  store.delete(key);
}

/**
 * 모든 설정 초기화
 */
function resetSettings() {
  store.clear();
  initDefaultSettings();
}

// 모듈 내보내기
module.exports = {
  init,
  getSetting,
  setSetting,
  getAllSettings,
  hasSetting,
  deleteSetting,
  resetSettings
};