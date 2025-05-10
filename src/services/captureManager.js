/**
 * captureManager.js
 * 화면 캡처 관리 모듈
 * Claude 앱의 응답 화면을 캡처하고 관리하는 기능을 제공합니다.
 */

const { screen, desktopCapturer } = require('electron');
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// 변수 초기화
let mainWindow;
let store;
let captureArea = null;
let captureHistory = [];

/**
 * 캡처 관리자 초기화
 * @param {Store} configStore 설정 저장소
 * @param {BrowserWindow} window 메인 윈도우 객체
 */
function init(configStore, window) {
  store = configStore;
  mainWindow = window;
  
  // 저장된 캡처 영역 로드
  captureArea = store.get('captureArea');
  
  // 캡처 저장 디렉토리 생성
  const captureDir = path.join(app.getPath('userData'), 'captures');
  if (!fs.existsSync(captureDir)) {
    fs.mkdirSync(captureDir, { recursive: true });
  }
  
  console.log('캡처 매니저 초기화 완료 - 저장 경로:', captureDir);
}

/**
 * 화면 캡처 수행
 * @returns {Promise<string|null>} 캡처된 이미지 데이터 (Base64) 또는 null
 */
async function captureScreen() {
  try {
    // 캡처 영역이 설정되지 않았으면 실패
    if (!captureArea) {
      console.log('캡처 영역이 설정되지 않았습니다. 기본 영역을 사용합니다.');
      // 기본 캡처 영역 설정 (화면 중앙 부분)
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      captureArea = {
        x: Math.floor(width * 0.25),
        y: Math.floor(height * 0.25),
        width: Math.floor(width * 0.5),
        height: Math.floor(height * 0.5)
      };
      
      // 저장
      store.set('captureArea', captureArea);
    }
    
    console.log('화면 캡처 시작 - 영역:', captureArea);
    
    // 화면 캡처
    const imgPath = await screenshot({
      format: 'png'
    });
    
    console.log('전체 화면 캡처 완료:', imgPath);
    
    // 이미지 데이터 읽기
    const imgBuffer = fs.readFileSync(imgPath);
    
    // 특정 영역만 자르기
    const croppedBuffer = await cropImage(imgBuffer, captureArea);
    
    // 캡처 기록 추가
    const captureId = Date.now().toString();
    const capturePath = path.join(app.getPath('userData'), 'captures', `${captureId}.png`);
    
    const captureInfo = {
      id: captureId,
      timestamp: new Date().toISOString(),
      path: capturePath,
      area: captureArea,
      size: croppedBuffer.length,
      sent: false
    };
    
    captureHistory.push(captureInfo);
    
    // 잘라낸 이미지 저장
    fs.writeFileSync(capturePath, croppedBuffer);
    
    console.log('캡처 이미지 저장 완료:', capturePath);
    
    // Base64로 변환
    const base64Image = croppedBuffer.toString('base64');
    
    return base64Image;
  } catch (err) {
    console.error('화면 캡처 오류:', err);
    return null;
  }
}

/**
 * 이미지 자르기 함수
 * @param {Buffer} imageBuffer 원본 이미지 버퍼
 * @param {Object} area 자를 영역 {x, y, width, height}
 * @returns {Promise<Buffer>} 잘라낸 이미지 버퍼
 */
async function cropImage(imageBuffer, area) {
  try {
    console.log('이미지 자르기 시작:', area);
    
    // Sharp 라이브러리를 사용하여 이미지 자르기
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height
      })
      .toBuffer();
    
    console.log('이미지 자르기 완료:', croppedBuffer.length, 'bytes');
    
    return croppedBuffer;
  } catch (err) {
    console.error('이미지 자르기 오류:', err);
    // 오류 발생 시 원본 이미지 반환
    return imageBuffer;
  }
}

/**
 * 캡처 영역 선택하기
 * @returns {Promise<Object|null>} 선택된 영역 정보 또는 null
 */
async function selectCaptureArea() {
  return new Promise((resolve, reject) => {
    try {
      // 모든 화면 캡처 시작
      desktopCapturer.getSources({ types: ['screen'] })
        .then(async sources => {
          // 첫 번째 화면 선택 (여러 모니터가 있는 경우 추가 처리 필요)
          const mainSource = sources[0];
          
          if (mainWindow) {
            // 영역 선택 UI를 표시하는 이벤트 전송
            mainWindow.webContents.send('select-capture-area', {
              timestamp: new Date().toISOString()
            });
            
            // 영역 선택 결과 이벤트 리스너 (renderer 프로세스에서 전송)
            const onAreaSelected = (event, selectedArea) => {
              // 이벤트 리스너 제거
              mainWindow.webContents.removeListener('capture-area-selected', onAreaSelected);
              
              // 영역 정보 저장
              captureArea = selectedArea;
              store.set('captureArea', selectedArea);
              
              // 결과 반환
              resolve(selectedArea);
            };
            
            // 이벤트 리스너 등록
            mainWindow.webContents.on('capture-area-selected', onAreaSelected);
          } else {
            // UI가 없는 경우 기본 영역 설정
            const displays = screen.getAllDisplays();
            const primaryDisplay = displays[0];
            
            // 기본 영역: 전체 화면의 중앙 부분
            const defaultArea = {
              x: Math.floor(primaryDisplay.bounds.width * 0.25),
              y: Math.floor(primaryDisplay.bounds.height * 0.25),
              width: Math.floor(primaryDisplay.bounds.width * 0.5),
              height: Math.floor(primaryDisplay.bounds.height * 0.5)
            };
            
            // 영역 정보 저장
            captureArea = defaultArea;
            store.set('captureArea', defaultArea);
            
            // 결과 반환
            resolve(defaultArea);
          }
        })
        .catch(err => {
          console.error('화면 소스 가져오기 오류:', err);
          reject(err);
        });
    } catch (err) {
      console.error('캡처 영역 선택 오류:', err);
      reject(err);
    }
  });
}

/**
 * 캡처 영역 설정하기
 * @param {Object} area 캡처 영역 정보 (x, y, width, height)
 * @returns {boolean} 설정 성공 여부
 */
function setCaptureArea(area) {
  try {
    if (!area || !area.x || !area.y || !area.width || !area.height) {
      console.error('유효하지 않은 영역 정보:', area);
      return false;
    }
    
    console.log('캡처 영역 설정:', area);
    
    captureArea = area;
    store.set('captureArea', area);
    
    // 영역 설정 이벤트 전송
    if (mainWindow) {
      mainWindow.webContents.send('capture-area-updated', {
        area: captureArea,
        timestamp: new Date().toISOString()
      });
    }
    
    return true;
  } catch (err) {
    console.error('캡처 영역 설정 오류:', err);
    return false;
  }
}

/**
 * 캡처 영역 가져오기
 * @returns {Object|null} 캡처 영역 정보 또는 null
 */
function getCaptureArea() {
  return captureArea;
}

/**
 * 캡처 이미지를 클라이언트에 전송
 * @param {string} socketId 소켓 ID
 * @param {string} base64Image 이미지 데이터 (Base64)
 * @param {Object} options 전송 옵션 (optimize: 최적화 여부, quality: 이미지 품질)
 * @returns {Promise<boolean>} 전송 성공 여부
 */
async function sendCaptureToClient(socketId, base64Image, options = {}) {
  try {
    // 소켓 매니저 가져오기
    const socketManager = require('../server/socketManager');
    
    // 캡처된 이미지가 없으면 오류
    if (!base64Image) {
      throw new Error('이미지 데이터가 없습니다.');
    }
    
    // 최근 캡처 정보 찾기
    const captureInfo = captureHistory[captureHistory.length - 1];
    
    // 캡처 정보 업데이트
    if (captureInfo) {
      captureInfo.sent = true;
    }
    
    console.log(`클라이언트(${socketId})에게 캡처 이미지 전송 중... (${base64Image.length} bytes)`);
    
    // 이미지 최적화 필요 여부 확인
    let finalImage = base64Image;
    
    if (options.optimize) {
      const quality = options.quality || 'medium';
      console.log(`이미지 최적화 적용: 품질=${quality}`);
      
      try {
        finalImage = await optimizeImage(base64Image, quality);
        console.log(`이미지 최적화 완료: ${base64Image.length} bytes -> ${finalImage.length} bytes`);
      } catch (error) {
        console.error('이미지 최적화 중 오류:', error);
        // 오류 발생 시 원본 이미지 사용
        finalImage = base64Image;
      }
    }
    
    // 캡처 이미지 전송
    socketManager.sendToClient(socketId, 'ai-response', {
      success: true,
      image: finalImage,
      timestamp: new Date().toISOString()
    });
    
    console.log('캡처 이미지 전송 완료');
    
    return true;
  } catch (err) {
    console.error('캡처 이미지 전송 오류:', err);
    return false;
  }
}

/**
 * 이미지 처리 및 최적화 함수
 * @param {Buffer} imageBuffer 원본 이미지 버퍼
 * @param {Object} options 이미지 처리 옵션
 * @param {string} options.quality 이미지 품질 ('high', 'medium', 'low')
 * @param {string} options.format 이미지 형식 ('jpeg', 'png', 'webp')
 * @param {number} options.resize 이미지 리사이즈 비율 (0.1-1.0, 0.5=50%)
 * @returns {Promise<Buffer>} 처리된 이미지 버퍼
 */
async function processImage(imageBuffer, options = {}) {
  try {
    // 기본 옵션 설정
    const quality = options.quality || 'medium';
    const format = options.format || 'jpeg';
    const resize = options.resize || null;
    
    // 품질 설정
    let compressionLevel;
    let sharpFormat;
    
    if (format === 'jpeg' || format === 'jpg') {
      sharpFormat = 'jpeg';
      // JPEG 품질 설정
      switch (quality) {
        case 'high':
          compressionLevel = 90;
          break;
        case 'medium':
          compressionLevel = 80;
          break;
        case 'low':
          compressionLevel = 60;
          break;
        default:
          compressionLevel = 80; // 기본값
      }
    } else if (format === 'webp') {
      sharpFormat = 'webp';
      // WebP 품질 설정
      switch (quality) {
        case 'high':
          compressionLevel = 85;
          break;
        case 'medium':
          compressionLevel = 75;
          break;
        case 'low':
          compressionLevel = 60;
          break;
        default:
          compressionLevel = 75; // 기본값
      }
    } else {
      // PNG
      sharpFormat = 'png';
      // PNG의 경우 품질 설정이 다름 (압축레벨)
      switch (quality) {
        case 'high':
          compressionLevel = 6; // 낮은 압축랭서 더 좋은 품질
          break;
        case 'medium':
          compressionLevel = 7;
          break;
        case 'low':
          compressionLevel = 9; // 높은 압축랭서 더 낮은 품질
          break;
        default:
          compressionLevel = 7; // 기본값
      }
    }
    
    console.log(`이미지 처리 시작 - 형식: ${format}, 품질: ${quality}, 압축레벨: ${compressionLevel}`);
    
    // Sharp 라이브러리를 사용하여 이미지 처리
    let sharpInstance = sharp(imageBuffer);
    
    // 이미지 리사이즈 (설정된 경우에만)
    if (resize && resize > 0 && resize < 1) {
      // 원본 이미지 크기 확인
      const imageInfo = await sharpInstance.metadata();
      const newWidth = Math.floor(imageInfo.width * resize);
      
      // 리사이징 적용
      sharpInstance = sharpInstance.resize(newWidth, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
      
      console.log(`이미지 리사이즈 적용: ${imageInfo.width}px -> ${newWidth}px (${resize * 100}%)`);
    }
    
    // 이미지 형식에 따른 추가 처리
    if (sharpFormat === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality: compressionLevel });
    } else if (sharpFormat === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: compressionLevel });
    } else {
      sharpInstance = sharpInstance.png({ compressionLevel });
    }
    
    // 최종 이미지 버퍼 생성
    const processedBuffer = await sharpInstance.toBuffer();
    
    console.log('이미지 처리 완료:', {
      originalSize: imageBuffer.length,
      processedSize: processedBuffer.length,
      reduction: ((imageBuffer.length - processedBuffer.length) / imageBuffer.length * 100).toFixed(2) + '%'
    });
    
    return processedBuffer;
  } catch (err) {
    console.error('이미지 처리 오류:', err);
    // 오류 발생 시 원본 이미지 반환
    return imageBuffer;
  }
}

/**
 * 캡처 품질 설정에 따라 이미지 최적화
 * @param {string} base64Image 원본 이미지 데이터 (Base64)
 * @param {string} quality 이미지 품질 ('high', 'medium', 'low')
 * @returns {Promise<string>} 최적화된 이미지 데이터 (Base64)
 */
async function optimizeImage(base64Image, quality = 'medium') {
  try {
    // Base64에서 버퍼로 변환
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // 설정 가져오기
    const settings = store ? store.get('captureSettings') || {} : {};
    const format = settings.imageFormat || 'jpeg'; // 기본 형식은 JPEG
    
    // 개발자가 지정한 품질을 사용하거나 설정에서 가져옴
    const imageQuality = quality || settings.imageQuality || 'medium';
    
    // 리사이징 설정 가져오기
    const resize = settings.resizeBeforeTransmit ? settings.resizeRatio : null;
    
    console.log(`이미지 최적화 시작 - 힘질: ${imageQuality}, 형식: ${format}${resize ? `, 리사이즈: ${resize * 100}%` : ''}`);
    
    // 이미지 처리 함수 사용
    const processedBuffer = await processImage(imageBuffer, {
      quality: imageQuality,
      format: format,
      resize: resize
    });
    
    console.log('이미지 최적화 완료:', {
      originalSize: imageBuffer.length,
      optimizedSize: processedBuffer.length,
      reduction: ((imageBuffer.length - processedBuffer.length) / imageBuffer.length * 100).toFixed(2) + '%'
    });
    
    // 버퍼에서 Base64로 변환
    const optimizedBase64 = processedBuffer.toString('base64');
    
    return optimizedBase64;
  } catch (err) {
    console.error('이미지 최적화 오류:', err);
    // 오류 발생 시 원본 이미지 반환
    return base64Image;
  }
}

/**
 * 최근 캡처 목록 가져오기
 * @param {number} limit 가져올 개수 (기본값: 10)
 * @returns {Array} 캡처 정보 배열
 */
function getRecentCaptures(limit = 10) {
  try {
    // 최근 캡처 정보 반환
    const recentCaptures = captureHistory.slice(-limit);
    
    console.log(`최근 캡처 목록 조회: ${recentCaptures.length}개`);
    
    return recentCaptures;
  } catch (err) {
    console.error('최근 캡처 목록 조회 오류:', err);
    return [];
  }
}

/**
 * 자동 캡처 영역 감지하기 (클로드 앱 UI 영역)
 * @returns {Promise<Object|null>} 감지된 영역 정보 또는 null
 */
async function detectCaptureArea() {
  try {
    console.log('자동 캡처 영역 감지 시작');
    
    // Claude 창 정보를 가져오기 위해 claudeManager 가져오기
    const claudeManager = require('./claudeManager');
    
    // Claude 창이 열려 있는지 확인
    if (!claudeManager.isClaudeRunning()) {
      console.warn('Claude 앱이 실행되고 있지 않아 자동 캡처 영역 감지 불가능');
      return null;
    }
    
    // Claude 앱 활성화
    await claudeManager.activateClaudeWindow();
    
    // 전체 화면 캡처
    const imgPath = await screenshot({
      format: 'png'
    });
    
    // 이미지 데이터 읽기
    const imgBuffer = fs.readFileSync(imgPath);
    
    // 클로드 창 정보 가져오기
    const claudeWindow = await claudeManager.getClaudeWindowInfo();
    
    // 창 정보가 있으면 창 크기를 기반으로 응답 영역 추정
    if (claudeWindow && claudeWindow.position) {
      // 창 위치 정보 가져오기
      const { x, y, width, height } = claudeWindow.position;
      
      // Claude 앱의 응답 영역은 일반적으로 화면 오른쪽에 위치
      // 창의 오른쪽 60%를 차지하는 것으로 추정
      const captureX = x + Math.floor(width * 0.4); // 창 기준 40% 지점부터 시작
      const captureY = y + Math.floor(height * 0.15); // 상단 여백 15% 후 시작
      const captureWidth = Math.floor(width * 0.58); // 전체 창 크기의 58% 차지
      const captureHeight = Math.floor(height * 0.75); // 전체 창 크기의 75% 차지
      
      const detectedArea = {
        x: captureX,
        y: captureY,
        width: captureWidth,
        height: captureHeight
      };
      
      console.log('클로드 창 정보를 통한 자동 캡처 영역 감지:', detectedArea);
      
      // 캡처 영역 설정
      setCaptureArea(detectedArea);
      
      return detectedArea;
    }
    
    // 창 정보를 찾지 못한 경우, 화면 크기를 기반으로 추측 실행
    console.log('창 정보를 찾지 못해 화면 크기 기반으로 추측 시도');
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // 화면 중앙 우측 영역이 Claude의 응답 영역일 가능성이 높음
    const detectedArea = {
      x: Math.floor(width * 0.55),  // 화면 가로 기준 55% 지점부터 시작
      y: Math.floor(height * 0.15), // 화면 세로 기준 15% 지점부터 시작
      width: Math.floor(width * 0.42),  // 전체 화면 가로의 42% 차지
      height: Math.floor(height * 0.75)  // 전체 화면 세로의 75% 차지
    };
    
    console.log('화면 크기 기반 자동 캡처 영역 감지 완료:', detectedArea);
    
    // 캡처 영역 설정
    setCaptureArea(detectedArea);
    
    // 현재 설정을 저장하고 사용자에게 캡처 영역 설정을 수정하도록 알림
    if (mainWindow) {
      mainWindow.webContents.send('capture-area-detected', {
        area: detectedArea,
        message: '자동으로 응답 영역을 감지했습니다. 필요한 경우 설정에서 영역을 조정할 수 있습니다.',
        timestamp: new Date().toISOString()
      });
    }
    
    return detectedArea;
  } catch (err) {
    console.error('자동 캡처 영역 감지 오류:', err);
    return null;
  }
}

/**
 * 캡처 설정 가져오기
 * @returns {Object} 캡처 설정 정보
 */
function getCaptureSettings() {
  const defaultSettings = {
    imageQuality: 'medium',    // 기본 이미지 품질: medium
    imageFormat: 'jpeg',       // 기본 이미지 형식: jpeg
    autoCapture: true,         // 자동 캡처 활성화
    captureDelay: 2,           // 캡처 지연 시간(초)
    saveCaptures: true,        // 캡처 이미지 저장
    networkQuality: 'auto',    // 네트워크 품질: auto, high, medium, low
    sendOptimized: true,       // 최적화된 이미지 전송
    maxCaptureHistory: 50,     // 캡처 기록 최대 개수
    resizeBeforeTransmit: false, // 전송 전 리사이징 여부
    resizeRatio: 0.8           // 전송 전 리사이징 비율
  };
  
  // 저장된 설정 가져오기
  const savedSettings = store ? store.get('captureSettings') || {} : {};
  
  // 기본값과 병합
  return { ...defaultSettings, ...savedSettings };
}

/**
 * 캡처 설정 업데이트
 * @param {Object} settings 업데이트할 설정 객체
 * @returns {boolean} 업데이트 성공 여부
 */
function updateCaptureSettings(settings) {
  try {
    if (!settings || typeof settings !== 'object' || !store) {
      return false;
    }
    
    // 현재 설정 가져오기
    const currentSettings = getCaptureSettings();
    
    // 설정 업데이트
    const updatedSettings = { ...currentSettings, ...settings };
    
    // 저장
    store.set('captureSettings', updatedSettings);
    
    console.log('캡처 설정 업데이트 완료:', updatedSettings);
    
    // 설정 변경 이벤트 전송
    if (mainWindow) {
      mainWindow.webContents.send('capture-settings-updated', {
        settings: updatedSettings,
        timestamp: new Date().toISOString()
      });
    }
    
    return true;
  } catch (err) {
    console.error('캡처 설정 업데이트 오류:', err);
    return false;
  }
}

/**
 * 캡처 디렉토리 클린업
 * @param {number} maxFiles 보관할 최대 파일 개수
 * @returns {boolean} 성공 여부
 */
function cleanupCaptureDirectory(maxFiles = 100) {
  try {
    const captureDir = path.join(app.getPath('userData'), 'captures');
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(captureDir)) {
      fs.mkdirSync(captureDir, { recursive: true });
      return true;
    }
    
    // 파일 목록 가져오기
    const files = fs.readdirSync(captureDir)
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.webp'))
      .map(file => ({
        name: file,
        path: path.join(captureDir, file),
        mtime: fs.statSync(path.join(captureDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime); // 최신 순으로 정렬
    
    // 최대 개수보다 많을 경우 오래된 파일 삭제
    if (files.length > maxFiles) {
      const filesToDelete = files.slice(maxFiles);
      
      console.log(`캡처 디렉토리 클린업: 총 ${files.length}개 중 ${filesToDelete.length}개 삭제`);
      
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.warn(`파일 삭제 오류: ${file.path}`, err);
        }
      });
    }
    
    // 캡처 기록 정리
    if (captureHistory.length > maxFiles) {
      captureHistory = captureHistory.slice(-maxFiles);
    }
    
    return true;
  } catch (err) {
    console.error('캡처 디렉토리 클린업 오류:', err);
    return false;
  }
}

/**
 * 스트리밍 클라이언트에게 이미지를 전송하는 함수
 * @param {string[]} socketIds 전송할 소켓 ID 배열
 * @param {string} base64Image 이미지 데이터 (Base64)
 * @param {Object} options 전송 옵션
 * @returns {Promise<Object>} 전송 결과 {success, sentCount}
 */
async function streamImageToClients(socketIds, base64Image, options = {}) {
  if (!socketIds || !socketIds.length || !base64Image) {
    return { success: false, sentCount: 0 };
  }
  
  try {
    // 소켓 매니저 가져오기
    const socketManager = require('../server/socketManager');
    
    console.log(`${socketIds.length}개의 클라이언트에게 이미지 스트리밍 시작...`);
    
    // 이미지 최적화 필요 여부 확인
    let finalImage = base64Image;
    
    if (options.optimize) {
      const quality = options.quality || 'medium';
      console.log(`스트리밍 이미지 최적화 적용: 품질=${quality}`);
      
      try {
        finalImage = await optimizeImage(base64Image, quality);
        console.log(`스트리밍 이미지 최적화 완료: ${base64Image.length} bytes -> ${finalImage.length} bytes`);
      } catch (error) {
        console.error('스트리밍 이미지 최적화 중 오류:', error);
        // 오류 발생 시 원본 이미지 사용
        finalImage = base64Image;
      }
    }
    
    // 각 클라이언트에게 이미지 전송
    let sentCount = 0;
    const timestamp = new Date().toISOString();
    
    for (const socketId of socketIds) {
      try {
        // 이미지 전송
        const success = socketManager.sendToClient(socketId, 'ai-response', {
          success: true,
          image: finalImage,
          timestamp: timestamp,
          streaming: true
        });
        
        if (success) {
          sentCount++;
        }
      } catch (err) {
        console.error(`클라이언트(${socketId})에 스트리밍 이미지 전송 오류:`, err);
      }
    }
    
    console.log(`스트리밍 이미지 전송 완료: ${sentCount}/${socketIds.length}개 성공`);
    
    return { 
      success: sentCount > 0, 
      sentCount,
      timestamp
    };
  } catch (err) {
    console.error('스트리밍 이미지 전송 오류:', err);
    return { success: false, sentCount: 0 };
  }
}

/**
 * 가장 최근 캡처한 이미지 가져오기
 * @returns {Object|null} 이미지 데이터 {base64, path, timestamp}
 */
function getLatestCapture() {
  try {
    if (captureHistory.length === 0) {
      return null;
    }
    
    const latestCapture = captureHistory[captureHistory.length - 1];
    
    if (!latestCapture || !latestCapture.path || !fs.existsSync(latestCapture.path)) {
      return null;
    }
    
    // 이미지 파일 읽기
    const imageBuffer = fs.readFileSync(latestCapture.path);
    const base64Image = imageBuffer.toString('base64');
    
    return {
      base64: base64Image,
      path: latestCapture.path,
      timestamp: latestCapture.timestamp
    };
  } catch (err) {
    console.error('최근 캡처 이미지 가져오기 오류:', err);
    return null;
  }
}

// 모듈 내보내기
module.exports = {
  init,
  captureScreen,
  selectCaptureArea,
  setCaptureArea,
  getCaptureArea,
  sendCaptureToClient,
  streamImageToClients,
  optimizeImage,
  getRecentCaptures,
  getLatestCapture,
  detectCaptureArea,
  processImage,
  getCaptureSettings,
  updateCaptureSettings,
  cleanupCaptureDirectory
};