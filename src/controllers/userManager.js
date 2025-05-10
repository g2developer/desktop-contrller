/**
 * 사용자 관리 모듈
 * 사용자 데이터를 관리하고 인증 기능을 제공합니다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

// 상수 정의
const USER_DATA_FILE = path.join(app.getPath('userData'), 'users.json');
const USER_LOGIN_LOG_FILE = path.join(app.getPath('userData'), 'login_logs.json');
const ENCRYPTION_KEY = 'desktop-controller-encryption-key-2025'; // 실제 서비스에서는 환경변수로 관리 권장
const IV_LENGTH = 16; // IV 길이 (16바이트)
const SALT_ROUNDS = 10; // 해싱 반복 횟수

// 로깅을 위한 유틸리티 함수
const logger = {
  log: (message, ...args) => console.log(`[UserManager] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[UserManager] ${message}`, ...args),
  error: (message, ...args) => console.error(`[UserManager] ${message}`, ...args)
};

/**
 * 비밀번호 해싱
 * @param {string} password 원본 비밀번호
 * @returns {string} 해싱된 비밀번호
 */
function hashPassword(password) {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  } catch (err) {
    logger.error('비밀번호 해싱 오류:', err);
    // 해싱 실패 시 원본 비밀번호 그대로 반환 (기존 사용자 로그인 문제 방지)
    return password;
  }
}

/**
 * 비밀번호 검증
 * @param {string} password 입력된 비밀번호
 * @param {string} hashedPassword 저장된 해시된 비밀번호
 * @returns {boolean} 검증 결과
 */
function verifyPassword(password, hashedPassword) {
  try {
    // 해시된 비밀번호에 ':' 구분자가 없으면 평문 비밀번호로 간주하고 직접 비교
    if (!hashedPassword.includes(':')) {
      return password === hashedPassword;
    }
    
    // 해시된 비밀번호에서 salt와 hash 분리
    const [salt, storedHash] = hashedPassword.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512').toString('hex');
    return hash === storedHash;
  } catch (err) {
    logger.error('비밀번호 검증 오류:', err);
    // 검증 오류 시 직접 비교로 폴백
    return password === hashedPassword;
  }
}

/**
 * 데이터 암호화
 * @param {Object|string} data 암호화할 데이터
 * @returns {string} 암호화된 문자열
 */
function encryptData(data) {
  try {
    // 데이터가 객체일 경우 JSON 문자열로 변환
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // 암호화 키에서 32바이트 크기의 키 생성
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('base64').substring(0, 32);
    
    // 초기화 벡터(IV) 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 암호화 알고리즘 AES-256-CBC 사용
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    
    // 데이터 암호화
    let encrypted = cipher.update(dataStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // IV와 암호화된 데이터를 합쳐서 반환
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    logger.error('데이터 암호화 오류:', err);
    // 암호화 실패 시 원본 데이터 JSON 문자열로 반환
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  }
}

/**
 * 데이터 복호화
 * @param {string} encryptedData 암호화된 문자열
 * @returns {string|Object} 복호화된 데이터
 */
function decryptData(encryptedData) {
  try {
    // 암호화된 데이터에 ':' 구분자가 없으면 평문으로 간주
    if (!encryptedData.includes(':')) {
      try {
        // JSON 형식이면 객체로 파싱
        return JSON.parse(encryptedData);
      } catch (e) {
        return encryptedData;
      }
    }
    
    // IV와 암호화된 데이터 분리
    const [ivHex, encrypted] = encryptedData.split(':');
    
    // 암호화 키에서 32바이트 크기의 키 생성
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('base64').substring(0, 32);
    
    // IV 변환
    const iv = Buffer.from(ivHex, 'hex');
    
    // 복호화 알고리즘 생성
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    
    // 데이터 복호화
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // JSON 형식이면 객체로 파싱
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  } catch (err) {
    logger.error('데이터 복호화 오류:', err);
    
    // 복호화 실패 시 원본 데이터 그대로 반환
    try {
      return JSON.parse(encryptedData);
    } catch (e) {
      return encryptedData;
    }
  }
}

/**
 * 사용자 데이터 파일 조회
 * @returns {boolean} 파일 존재 여부
 */
function checkUserDataFile() {
  try {
    return fs.existsSync(USER_DATA_FILE);
  } catch (err) {
    logger.error('사용자 데이터 파일 확인 오류:', err);
    return false;
  }
}

/**
 * 전체 사용자 데이터 가져오기
 * @param {boolean} includePassword 비밀번호 필드 포함 여부
 * @returns {Array} 사용자 데이터 배열
 */
function getUserData(includePassword = true) {
  try {
    logger.log('사용자 데이터 로드 - 경로:', USER_DATA_FILE);
    
    if (fs.existsSync(USER_DATA_FILE)) {
      logger.log('사용자 데이터 파일 발견');
      try {
        // 파일에서 데이터 읽기
        const encryptedData = fs.readFileSync(USER_DATA_FILE, 'utf8');
        
        // 데이터 형식에 따라 처리
        let userData;
        if (encryptedData.trim().startsWith('{') || encryptedData.trim().startsWith('[')) {
          // 평문 JSON으로 저장된 경우 (기존 데이터)
          userData = JSON.parse(encryptedData);
        } else {
          // 암호화된 데이터인 경우
          userData = decryptData(encryptedData);
        }
        
        // 배열이 아닌 경우 배열로 변환
        if (!Array.isArray(userData)) {
          userData = [];
        }
        
        logger.log(`사용자 데이터 로드 성공: 총 ${userData.length}명의 사용자`);
        
        // 비밀번호 제외 옵션 처리
        if (!includePassword) {
          userData = userData.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
          });
        }
        
        return userData;
      } catch (parseErr) {
        logger.error('사용자 데이터 파싱 오류:', parseErr);
        // 파일이 손상된 경우 기본 사용자 생성
        return createDefaultUsers();
      }
    } else {
      logger.log('사용자 데이터 파일이 없음, 기본 사용자 생성');
      return createDefaultUsers();
    }
  } catch (err) {
    logger.error('사용자 데이터 로드 오류:', err);
    // 오류 발생 시 기본 사용자 데이터 반환
    return createDefaultUsers();
  }
}

/**
 * 기본 사용자 생성
 * @returns {Array} 기본 사용자 배열
 */
function createDefaultUsers() {
  try {
    // 관리자와 테스트 계정 생성
    const defaultUsers = [
      { 
        id: 'admin', 
        password: hashPassword('admin'),
        name: '관리자',
        role: 'admin',
        created: new Date().toISOString(),
        lastLogin: null,
        status: 'active'
      },
      { 
        id: 'test1', 
        password: hashPassword('test1'),
        name: '테스트 사용자',
        role: 'user',
        created: new Date().toISOString(),
        lastLogin: null,
        status: 'active'
      }
    ];
    
    // 사용자 데이터 저장
    saveUserData(defaultUsers);
    
    return defaultUsers;
  } catch (err) {
    logger.error('기본 사용자 생성 오류:', err);
    // 오류 발생 시 평문 비밀번호로 생성
    return [
      { id: 'admin', password: 'admin', role: 'admin', status: 'active' },
      { id: 'test1', password: 'test1', role: 'user', status: 'active' }
    ];
  }
}

/**
 * 사용자 데이터 저장하기
 * @param {Array} users 사용자 데이터 배열
 * @returns {boolean} 저장 성공 여부
 */
function saveUserData(users) {
  try {
    // 저장 전 디렉토리 생성 확인
    const userDataDir = path.dirname(USER_DATA_FILE);
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // 데이터 암호화 후 저장
    const encryptedData = encryptData(users);
    fs.writeFileSync(USER_DATA_FILE, encryptedData);
    
    logger.log(`사용자 데이터 저장 성공: 총 ${users.length}명의 사용자`);
    return true;
  } catch (err) {
    logger.error('사용자 데이터 저장 오류:', err);
    return false;
  }
}

/**
 * 사용자 로그인 로그 저장
 * @param {string} userId 사용자 ID
 * @param {string} clientId 클라이언트 ID (소켓 ID)
 * @param {string} ipAddress IP 주소
 * @param {string} deviceInfo 기기 정보
 * @param {boolean} success 로그인 성공 여부
 * @returns {boolean} 저장 성공 여부
 */
function saveLoginLog(userId, clientId, ipAddress, deviceInfo, success) {
  try {
    // 로그 데이터 생성
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      clientId,
      ipAddress,
      deviceInfo,
      success,
    };
    
    // 기존 로그 데이터 로드
    let logs = [];
    if (fs.existsSync(USER_LOGIN_LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(USER_LOGIN_LOG_FILE, 'utf8'));
      } catch (parseErr) {
        logger.error('로그인 로그 파싱 오류:', parseErr);
      }
    }
    
    if (!Array.isArray(logs)) {
      logs = [];
    }
    
    // 새 로그 추가
    logs.push(logEntry);
    
    // 로그 크기 제한 (최근 1000개만 유지)
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // 로그 저장
    fs.writeFileSync(USER_LOGIN_LOG_FILE, JSON.stringify(logs, null, 2));
    
    // 사용자 마지막 로그인 시간 업데이트
    if (success) {
      updateLastLogin(userId);
    }
    
    return true;
  } catch (err) {
    logger.error('로그인 로그 저장 오류:', err);
    return false;
  }
}

/**
 * 로그인 로그 가져오기
 * @param {number} limit 가져올 로그 개수 (기본값: 100)
 * @param {string} userId 특정 사용자 ID (선택사항)
 * @returns {Array} 로그인 로그 배열
 */
function getLoginLogs(limit = 100, userId = null) {
  try {
    if (!fs.existsSync(USER_LOGIN_LOG_FILE)) {
      return [];
    }
    
    const logs = JSON.parse(fs.readFileSync(USER_LOGIN_LOG_FILE, 'utf8'));
    
    if (!Array.isArray(logs)) {
      return [];
    }
    
    // 특정 사용자 필터링
    let filteredLogs = logs;
    if (userId) {
      filteredLogs = logs.filter(log => log.userId === userId);
    }
    
    // 최신 로그 순으로 정렬
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 개수 제한
    return filteredLogs.slice(0, limit);
  } catch (err) {
    logger.error('로그인 로그 조회 오류:', err);
    return [];
  }
}

/**
 * 마지막 로그인 시간 업데이트
 * @param {string} userId 사용자 ID
 * @returns {boolean} 업데이트 성공 여부
 */
function updateLastLogin(userId) {
  try {
    const users = getUserData();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return false;
    }
    
    // 마지막 로그인 시간 업데이트
    users[userIndex].lastLogin = new Date().toISOString();
    
    return saveUserData(users);
  } catch (err) {
    logger.error('마지막 로그인 시간 업데이트 오류:', err);
    return false;
  }
}

/**
 * 사용자 추가
 * @param {Object} userData 사용자 데이터
 * @returns {Object} 결과 객체 {success, message, user}
 */
function addUser(userData) {
  try {
    // 유효성 검사
    if (!userData || !userData.id || !userData.password) {
      return { success: false, message: '유효하지 않은 사용자 데이터입니다.' };
    }
    
    // ID 형식 검사 (영문, 숫자만 허용)
    if (!/^[a-zA-Z0-9]{4,20}$/.test(userData.id)) {
      return { 
        success: false, 
        message: '아이디는 4~20자의 영문, 숫자만 사용할 수 있습니다.' 
      };
    }
    
    // 비밀번호 형식 검사 (최소 4자 이상)
    if (userData.password.length < 4) {
      return { 
        success: false, 
        message: '비밀번호는 최소 4자 이상이어야 합니다.' 
      };
    }
    
    const users = getUserData();
    
    // 중복 ID 확인
    const existingUser = users.find(u => u.id === userData.id);
    if (existingUser) {
      return { success: false, message: '이미 존재하는 아이디입니다.' };
    }
    
    // 사용자 역할 기본값 설정
    if (!userData.role) {
      userData.role = 'user';
    }
    
    // 신규 사용자 데이터 생성
    const newUser = {
      id: userData.id,
      password: hashPassword(userData.password), // 비밀번호 해싱
      name: userData.name || userData.id,
      role: userData.role,
      created: new Date().toISOString(),
      lastLogin: null,
      status: 'active',
      deviceLimit: userData.deviceLimit || 3
    };
    
    // 사용자 추가
    users.push(newUser);
    const success = saveUserData(users);
    
    if (success) {
      // 비밀번호 제외하고 반환
      const { password, ...userWithoutPassword } = newUser;
      return { 
        success: true, 
        message: '사용자가 추가되었습니다.',
        user: userWithoutPassword 
      };
    } else {
      return { success: false, message: '사용자 저장 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    logger.error('사용자 추가 오류:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 사용자 정보 업데이트
 * @param {string} userId 사용자 ID
 * @param {Object} userData 업데이트할 사용자 데이터
 * @returns {Object} 결과 객체 {success, message, user}
 */
function updateUser(userId, userData) {
  try {
    // 유효성 검사
    if (!userId || !userData) {
      return { success: false, message: '유효하지 않은 사용자 데이터입니다.' };
    }
    
    logger.log('사용자 정보 업데이트:', userId);
    
    const users = getUserData();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }
    
    // 기존 사용자 데이터에 새 데이터 덮어쓰기
    const oldUser = users[userIndex];
    const updatedUser = {
      ...oldUser,
      name: userData.name || oldUser.name,
      role: userData.role || oldUser.role,
      status: userData.status || oldUser.status,
      deviceLimit: userData.deviceLimit || oldUser.deviceLimit || 3,
      updated: new Date().toISOString()
    };
    
    // 비밀번호가 제공된 경우에만 비밀번호 업데이트
    if (userData.password) {
      // 비밀번호 형식 검사
      if (userData.password.length < 4) {
        return { 
          success: false, 
          message: '비밀번호는 최소 4자 이상이어야 합니다.' 
        };
      }
      
      updatedUser.password = hashPassword(userData.password);
    }
    
    users[userIndex] = updatedUser;
    const success = saveUserData(users);
    
    if (success) {
      // 비밀번호 제외하고 반환
      const { password, ...userWithoutPassword } = updatedUser;
      return { 
        success: true, 
        message: '사용자 정보가 업데이트되었습니다.',
        user: userWithoutPassword 
      };
    } else {
      return { success: false, message: '사용자 정보 저장 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    logger.error('사용자 수정 오류:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 사용자 삭제
 * @param {string} userId 사용자 ID
 * @returns {Object} 결과 객체 {success, message}
 */
function deleteUser(userId) {
  try {
    // 유효성 검사
    if (!userId) {
      return { success: false, message: '유효하지 않은 사용자 ID입니다.' };
    }
    
    const users = getUserData();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }
    
    // 관리자 계정 확인 (마지막 관리자 계정은 삭제 불가)
    if (users[userIndex].role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return { success: false, message: '마지막 관리자 계정은 삭제할 수 없습니다.' };
      }
    }
    
    // 사용자 삭제
    users.splice(userIndex, 1);
    const success = saveUserData(users);
    
    if (success) {
      return { success: true, message: '사용자가 삭제되었습니다.' };
    } else {
      return { success: false, message: '사용자 삭제 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    logger.error('사용자 삭제 오류:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 특정 사용자 정보 가져오기
 * @param {string} userId 사용자 ID
 * @param {boolean} includePassword 비밀번호 포함 여부
 * @returns {Object|null} 사용자 정보 또는 null
 */
function getUser(userId, includePassword = false) {
  try {
    if (!userId) {
      return null;
    }
    
    const users = getUserData();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return null;
    }
    
    // 비밀번호 제외 옵션 처리
    if (!includePassword) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    
    return user;
  } catch (err) {
    logger.error('사용자 정보 조회 오류:', err);
    return null;
  }
}

/**
 * 사용자 인증
 * @param {string} userId 사용자 ID
 * @param {string} password 비밀번호
 * @param {string} clientId 클라이언트 ID
 * @param {string} ipAddress IP 주소
 * @param {string} deviceInfo 기기 정보
 * @returns {Object} 인증 결과 {success, message, user}
 */
function authenticateUser(userId, password, clientId = null, ipAddress = null, deviceInfo = null) {
  try {
    if (!userId || !password) {
      return { 
        success: false, 
        message: '아이디와 비밀번호를 모두 입력해주세요.' 
      };
    }
    
    const users = getUserData();
    const user = users.find(u => u.id === userId);
    
    // 사용자를 찾을 수 없음
    if (!user) {
      // 로그인 시도 기록
      if (clientId) {
        saveLoginLog(userId, clientId, ipAddress, deviceInfo, false);
      }
      
      return { 
        success: false, 
        message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
      };
    }
    
    // 비활성 계정 확인
    if (user.status === 'inactive' || user.status === 'suspended') {
      // 로그인 시도 기록
      if (clientId) {
        saveLoginLog(userId, clientId, ipAddress, deviceInfo, false);
      }
      
      return { 
        success: false, 
        message: '비활성화된 계정입니다. 관리자에게 문의하세요.' 
      };
    }
    
    // 비밀번호 검증
    const passwordValid = verifyPassword(password, user.password);
    
    // 로그인 시도 기록
    if (clientId) {
      saveLoginLog(userId, clientId, ipAddress, deviceInfo, passwordValid);
    }
    
    if (!passwordValid) {
      return { 
        success: false, 
        message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
      };
    }
    
    // 인증 성공 - 민감 정보 제외하고 반환
    const { password: pass, ...userInfo } = user;
    
    return { 
      success: true, 
      message: '로그인 성공',
      user: userInfo 
    };
  } catch (err) {
    logger.error('사용자 인증 오류:', err);
    return { 
      success: false, 
      message: '인증 처리 중 오류가 발생했습니다.' 
    };
  }
}

/**
 * 사용자 상태 업데이트
 * @param {string} userId 사용자 ID
 * @param {string} status 새로운 상태 (active, inactive, suspended)
 * @returns {Object} 결과 객체 {success, message}
 */
function updateUserStatus(userId, status) {
  try {
    if (!userId || !status) {
      return { success: false, message: '유효하지 않은 파라미터입니다.' };
    }
    
    // 상태 값 검증
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return { 
        success: false, 
        message: '유효하지 않은 상태값입니다. active, inactive, suspended 중 하나여야 합니다.' 
      };
    }
    
    const users = getUserData();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }
    
    // 마지막 관리자 비활성화 방지
    if (users[userIndex].role === 'admin' && status !== 'active') {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.status === 'active');
      if (activeAdmins.length <= 1) {
        return { 
          success: false, 
          message: '마지막 활성 관리자 계정은 비활성화할 수 없습니다.' 
        };
      }
    }
    
    // 상태 및 업데이트 시간 변경
    users[userIndex].status = status;
    users[userIndex].updated = new Date().toISOString();
    
    const success = saveUserData(users);
    
    if (success) {
      return { 
        success: true, 
        message: `사용자 상태가 '${status}'로 변경되었습니다.` 
      };
    } else {
      return { 
        success: false, 
        message: '사용자 상태 업데이트 중 오류가 발생했습니다.' 
      };
    }
  } catch (err) {
    logger.error('사용자 상태 업데이트 오류:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 사용자 권한 확인
 * @param {string} userId 사용자 ID
 * @param {string} requiredRole 필요한 권한 (admin, user)
 * @returns {boolean} 권한 보유 여부
 */
function checkUserRole(userId, requiredRole) {
  try {
    const user = getUser(userId);
    
    if (!user) {
      return false;
    }
    
    // 관리자는 모든 권한 보유
    if (user.role === 'admin') {
      return true;
    }
    
    // 관리자 권한이 필요한 경우
    if (requiredRole === 'admin') {
      return false;
    }
    
    // 일반 사용자 권한 확인
    return user.role === requiredRole;
  } catch (err) {
    logger.error('사용자 권한 확인 오류:', err);
    return false;
  }
}

/**
 * 비밀번호 재설정
 * @param {string} userId 사용자 ID
 * @param {string} newPassword 새 비밀번호
 * @returns {Object} 결과 객체 {success, message}
 */
function resetPassword(userId, newPassword) {
  try {
    if (!userId || !newPassword) {
      return { 
        success: false, 
        message: '유효하지 않은 파라미터입니다.' 
      };
    }
    
    // 비밀번호 형식 검사
    if (newPassword.length < 4) {
      return { 
        success: false, 
        message: '비밀번호는 최소 4자 이상이어야 합니다.' 
      };
    }
    
    const users = getUserData();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }
    
    // 비밀번호 해싱 및 저장
    users[userIndex].password = hashPassword(newPassword);
    users[userIndex].updated = new Date().toISOString();
    
    const success = saveUserData(users);
    
    if (success) {
      return { 
        success: true, 
        message: '비밀번호가 성공적으로 재설정되었습니다.' 
      };
    } else {
      return { 
        success: false, 
        message: '비밀번호 재설정 중 오류가 발생했습니다.' 
      };
    }
  } catch (err) {
    logger.error('비밀번호 재설정 오류:', err);
    return { success: false, message: err.message };
  }
}

// 모듈 내보내기
module.exports = {
  getUserData,
  saveUserData,
  addUser,
  updateUser,
  deleteUser,
  getUser,
  authenticateUser,
  updateUserStatus,
  checkUserRole,
  resetPassword,
  getLoginLogs,
  saveLoginLog,
  hashPassword,
  verifyPassword
};