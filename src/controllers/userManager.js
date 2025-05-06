const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 사용자 정보 파일 경로
const USER_DATA_FILE = path.join(app.getPath('userData'), 'users.json');

/**
 * 사용자 데이터 가져오기
 * @returns {Array} 사용자 데이터 배열
 */
function getUserData() {
  try {
    console.log('사용자 데이터 요청 - 데이터 경로:', USER_DATA_FILE);
    
    if (fs.existsSync(USER_DATA_FILE)) {
      console.log('사용자 데이터 파일 발견');
      const userData = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
      console.log(`사용자 데이터 로드 성공: 총 ${userData.length}명의 사용자`);
      
      // 디버깅을 위해 사용자 ID 목록 출력
      if (userData && userData.length > 0) {
        console.log(`사용자 목록: ${userData.map(u => u.id).join(', ')}`);
      }
      
      return userData;
    } else {
      console.log('사용자 데이터 파일이 없음, 기본 사용자 생성');
      // test1 사용자 추가
      const defaultUsers = [
        { id: 'admin', password: 'admin' },
        { id: 'test1', password: 'test1' }
      ];
      fs.writeFileSync(USER_DATA_FILE, JSON.stringify(defaultUsers, null, 2));
      return defaultUsers;
    }
  } catch (err) {
    console.error('사용자 데이터 로드 오류:', err);
    // 오류 발생 시 기본 사용자 2개 리턴
    return [{ id: 'admin', password: 'admin' }, { id: 'test1', password: 'test1' }];
  }
}

/**
 * 사용자 데이터 저장하기
 * @param {Array} users 사용자 데이터 배열
 * @returns {boolean} 저장 성공 여부
 */
function saveUserData(users) {
  try {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (err) {
    console.error('사용자 데이터 저장 오류:', err);
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
    
    const users = getUserData();
    
    // 중복 ID 확인
    const existingUser = users.find(u => u.id === userData.id);
    if (existingUser) {
      return { success: false, message: '이미 존재하는 아이디입니다.' };
    }
    
    // 신규 사용자 데이터 생성
    const newUser = {
      id: userData.id,
      password: userData.password,
      name: userData.name || userData.id,
      created: new Date().toISOString(),
      lastLogin: null,
      status: 'active'
    };
    
    // 사용자 추가
    users.push(newUser);
    const success = saveUserData(users);
    
    if (success) {
      return { success: true, user: newUser };
    } else {
      return { success: false, message: '사용자 저장 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    console.error('사용자 추가 오류:', err);
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
    
    console.log('사용자 정보 업데이트:', userId, userData);
    
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
      status: userData.status || oldUser.status,
      updated: new Date().toISOString()
    };
    
    // 비밀번호가 제공된 경우에만 비밀번호 업데이트
    if (userData.password) {
      updatedUser.password = userData.password;
    }
    
    users[userIndex] = updatedUser;
    const success = saveUserData(users);
    
    if (success) {
      return { success: true, user: updatedUser };
    } else {
      return { success: false, message: '사용자 정보 저장 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    console.error('사용자 수정 오류:', err);
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
    if (userId === 'admin' && users.filter(u => u.id === 'admin').length <= 1) {
      return { success: false, message: '마지막 관리자 계정은 삭제할 수 없습니다.' };
    }
    
    // 사용자 삭제
    users.splice(userIndex, 1);
    const success = saveUserData(users);
    
    if (success) {
      return { success: true };
    } else {
      return { success: false, message: '사용자 삭제 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    console.error('사용자 삭제 오류:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 특정 사용자 정보 가져오기
 * @param {string} userId 사용자 ID
 * @returns {Object|null} 사용자 정보 또는 null
 */
function getUser(userId) {
  try {
    const users = getUserData();
    return users.find(u => u.id === userId) || null;
  } catch (err) {
    console.error('사용자 정보 조회 오류:', err);
    return null;
  }
}

/**
 * 사용자 인증
 * @param {string} userId 사용자 ID
 * @param {string} password 비밀번호
 * @returns {boolean} 인증 성공 여부
 */
function authenticateUser(userId, password) {
  try {
    const users = getUserData();
    const user = users.find(u => u.id === userId && u.password === password);
    return !!user;
  } catch (err) {
    console.error('사용자 인증 오류:', err);
    return false;
  }
}

/**
 * 사용자 상태 업데이트
 * @param {string} userId 사용자 ID
 * @param {string} status 새로운 상태
 * @returns {Object} 결과 객체 {success, message}
 */
function updateUserStatus(userId, status) {
  try {
    const users = getUserData();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }
    
    users[userIndex].status = status;
    users[userIndex].updated = new Date().toISOString();
    
    const success = saveUserData(users);
    
    if (success) {
      return { success: true };
    } else {
      return { success: false, message: '사용자 상태 업데이트 중 오류가 발생했습니다.' };
    }
  } catch (err) {
    console.error('사용자 상태 업데이트 오류:', err);
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
  updateUserStatus
};