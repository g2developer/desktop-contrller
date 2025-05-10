/**
 * 암호화 유틸리티 모듈
 * 데이터 암호화, 복호화, 해싱 기능을 제공합니다.
 */

const crypto = require('crypto');
const os = require('os');

// 시스템 정보를 기반으로 고유한 암호화 키 생성을 위한 유틸리티
const machineId = getMachineId();

/**
 * 시스템 정보를 기반으로 고유 ID 생성
 * @returns {string} 머신 ID
 */
function getMachineId() {
  try {
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';
    
    // 첫 번째로 유효한 MAC 주소 찾기
    Object.values(networkInterfaces).forEach(interfaces => {
      interfaces.forEach(iface => {
        if (!iface.internal && !macAddress) {
          macAddress = iface.mac || '';
        }
      });
    });
    
    // 시스템 정보 조합
    const hostname = os.hostname();
    const platform = os.platform();
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : '';
    
    // 여러 시스템 정보를 조합하여 해시 생성
    const data = `${macAddress}-${hostname}-${platform}-${cpuModel}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    
    return hash;
  } catch (err) {
    console.error('머신 ID 생성 오류:', err);
    // 오류 시 기본값 반환
    return 'default-desktop-controller-key';
  }
}

/**
 * 암호화 키 생성
 * @param {string} customSalt 추가 솔트 (선택 사항)
 * @returns {Buffer} 32바이트 암호화 키
 */
function generateEncryptionKey(customSalt = '') {
  try {
    // 머신 ID와 커스텀 솔트를 조합하여 키 생성
    const salt = `${machineId}-${customSalt}-desktop-controller-salt`;
    return crypto.scryptSync('desktop-controller-encryption-key', salt, 32);
  } catch (err) {
    console.error('암호화 키 생성 오류:', err);
    // 오류 시 고정 키 반환 (개발용, 실제 서비스에서는 더 안전한 방법 사용 권장)
    return Buffer.from('0123456789abcdef0123456789abcdef');
  }
}

/**
 * 데이터 암호화
 * @param {string|Object} data 암호화할 데이터
 * @param {string} customSalt 추가 솔트 (선택 사항)
 * @returns {string} 암호화된 문자열 (IV:암호문 형식)
 */
function encrypt(data, customSalt = '') {
  try {
    // 객체인 경우 JSON 문자열로 변환
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // 암호화 키 생성
    const key = generateEncryptionKey(customSalt);
    
    // 초기화 벡터(IV) 생성
    const iv = crypto.randomBytes(16);
    
    // 암호화 알고리즘 AES-256-CBC 사용
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // 데이터 암호화
    let encrypted = cipher.update(dataStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // IV와 암호화된 데이터를 합쳐서 반환
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('데이터 암호화 오류:', err);
    // 암호화 실패 시 원본 데이터 반환
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  }
}

/**
 * 데이터 복호화
 * @param {string} encryptedData 암호화된 문자열 (IV:암호문 형식)
 * @param {string} customSalt 추가 솔트 (선택 사항)
 * @returns {string|Object} 복호화된 데이터
 */
function decrypt(encryptedData, customSalt = '') {
  try {
    // 암호화된 데이터가, IV:암호문 형식이 아니면 암호화되지 않은 것으로 처리
    if (!encryptedData.includes(':')) {
      try {
        // JSON 형식이면 객체로 파싱
        return JSON.parse(encryptedData);
      } catch (e) {
        // JSON이 아니면 문자열 그대로 반환
        return encryptedData;
      }
    }
    
    // IV와 암호화된 데이터 분리
    const [ivHex, encrypted] = encryptedData.split(':');
    
    // 암호화 키 생성 (암호화할 때와 동일한 키 필요)
    const key = generateEncryptionKey(customSalt);
    
    // IV 변환
    const iv = Buffer.from(ivHex, 'hex');
    
    // 복호화 알고리즘 생성
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // 데이터 복호화
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // JSON 형식이면 객체로 파싱
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      // JSON이 아니면 문자열 그대로 반환
      return decrypted;
    }
  } catch (err) {
    console.error('데이터 복호화 오류:', err);
    // 복호화 실패 시 원본 데이터 반환
    try {
      return JSON.parse(encryptedData);
    } catch (e) {
      return encryptedData;
    }
  }
}

/**
 * 비밀번호 해싱
 * @param {string} password 원본 비밀번호
 * @param {number} iterations 반복 횟수 (기본값: 10000)
 * @returns {string} 해싱된 비밀번호 (salt:hash 형식)
 */
function hashPassword(password, iterations = 10000) {
  try {
    // 16바이트 솔트 생성
    const salt = crypto.randomBytes(16).toString('hex');
    
    // PBKDF2 해싱 알고리즘 사용
    const hash = crypto.pbkdf2Sync(
      password, 
      salt, 
      iterations, 
      64, 
      'sha512'
    ).toString('hex');
    
    // 솔트:해시:반복횟수 형식으로 반환
    return `${salt}:${hash}:${iterations}`;
  } catch (err) {
    console.error('비밀번호 해싱 오류:', err);
    // 해싱 실패 시 원본 비밀번호 그대로 반환 (대체 로직)
    return password;
  }
}

/**
 * 비밀번호 검증
 * @param {string} password 입력된 비밀번호
 * @param {string} hashedPassword 저장된 해시된 비밀번호 (salt:hash:iterations 형식)
 * @returns {boolean} 검증 결과
 */
function verifyPassword(password, hashedPassword) {
  try {
    // 해시된 비밀번호에 ':' 구분자가 없으면 평문 비밀번호로 간주하고 직접 비교
    if (!hashedPassword.includes(':')) {
      return password === hashedPassword;
    }
    
    // 해시된 비밀번호에서 salt, hash, iterations 분리
    const [salt, storedHash, iterationsStr] = hashedPassword.split(':');
    const iterations = parseInt(iterationsStr) || 10000;
    
    // 동일한 방식으로 해시 생성
    const hash = crypto.pbkdf2Sync(
      password, 
      salt, 
      iterations, 
      64, 
      'sha512'
    ).toString('hex');
    
    // 해시 값 비교
    return hash === storedHash;
  } catch (err) {
    console.error('비밀번호 검증 오류:', err);
    // 검증 오류 시 직접 비교로 폴백
    return password === hashedPassword;
  }
}

/**
 * 안전한 랜덤 토큰 생성
 * @param {number} length 토큰 길이 (바이트 단위, 기본값: 32)
 * @returns {string} 랜덤 토큰 (16진수)
 */
function generateRandomToken(length = 32) {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (err) {
    console.error('랜덤 토큰 생성 오류:', err);
    // 오류 시 현재 시간 기반으로 간단한 토큰 생성
    const timestamp = Date.now().toString();
    return crypto.createHash('sha256').update(timestamp).digest('hex');
  }
}

/**
 * 데이터 해싱
 * @param {string} data 해싱할 데이터
 * @param {string} algorithm 해싱 알고리즘 (기본값: 'sha256')
 * @returns {string} 해시값 (16진수)
 */
function hashData(data, algorithm = 'sha256') {
  try {
    return crypto.createHash(algorithm).update(data).digest('hex');
  } catch (err) {
    console.error('데이터 해싱 오류:', err);
    // 오류 시 간단한 해시 생성
    return data.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(16);
  }
}

// 모듈 내보내기
module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashData,
  getMachineId
};