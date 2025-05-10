/**
 * 명령어 처리 모듈
 * 다양한 명령어를 처리하고 클로드 앱에 전달합니다.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { clipboard } = require('electron');

// 설정 및 로그 관련 모듈
let store;
let logger;
let claudeManager;

// 명령어 타입 상수
const COMMAND_TYPES = {
  TEXT: 'text',             // 일반 텍스트 명령어
  IMAGE: 'image',           // 이미지 첨부 명령어
  TEMPLATE: 'template',     // 템플릿 명령어
  SYSTEM: 'system',         // 시스템 명령어
  COMPOSITE: 'composite'    // 복합 명령어
};

// 내장 템플릿
const BUILT_IN_TEMPLATES = {
  'translate-ko': '다음 텍스트를 한국어로 번역해줘:\n{{content}}',
  'translate-en': 'Translate the following text to English:\n{{content}}',
  'summarize': '다음 내용을 간략하게 요약해줘:\n{{content}}',
  'correct': '다음 텍스트의 문법과 맞춤법을 교정해줘:\n{{content}}',
  'code-review': '다음 코드를 검토하고 개선점을 알려줘:\n```{{language}}\n{{content}}\n```',
  'explain-code': '다음 코드를 자세히 설명해줘:\n```{{language}}\n{{content}}\n```'
};

/**
 * 명령어 처리기 초기화
 * @param {Object} configStore 설정 저장소
 * @param {Object} loggerModule 로거 모듈
 * @param {Object} claudeMgrModule 클로드 앱 관리 모듈
 */
function init(configStore, loggerModule, claudeMgrModule) {
  store = configStore;
  logger = loggerModule || console;
  claudeManager = claudeMgrModule;
  
  // 사용자 정의 템플릿 로드
  loadCustomTemplates();
  
  logger.log('명령어 처리기 초기화 완료');
}

/**
 * 사용자 정의 템플릿 로드
 */
function loadCustomTemplates() {
  try {
    // 저장된 템플릿 로드
    const templates = store.get('commandTemplates') || {};
    
    // 내장 템플릿과 병합
    const allTemplates = { ...BUILT_IN_TEMPLATES, ...templates };
    
    // 템플릿 저장
    store.set('commandTemplates', allTemplates);
    
    logger.log(`템플릿 로드 완료: 총 ${Object.keys(allTemplates).length}개`);
  } catch (err) {
    logger.error('템플릿 로드 오류:', err);
  }
}

/**
 * 명령어 처리 메인 함수
 * @param {Object} command 명령어 객체
 * @param {string} socketId 요청한 클라이언트 소켓 ID
 * @returns {Promise<Object>} 처리 결과
 */
async function processCommand(command, socketId) {
  try {
    if (!command || typeof command !== 'object') {
      throw new Error('유효하지 않은 명령어 형식입니다.');
    }
    
    // 명령어 타입 확인
    const type = command.type || COMMAND_TYPES.TEXT;
    let finalCommand = '';
    
    switch (type) {
      case COMMAND_TYPES.TEXT:
        // 일반 텍스트 명령어
        finalCommand = await processTextCommand(command);
        break;
        
      case COMMAND_TYPES.TEMPLATE:
        // 템플릿 명령어
        finalCommand = await processTemplateCommand(command);
        break;
        
      case COMMAND_TYPES.IMAGE:
        // 이미지 명령어
        finalCommand = await processImageCommand(command);
        break;
        
      case COMMAND_TYPES.SYSTEM:
        // 시스템 명령어
        return await processSystemCommand(command, socketId);
        
      case COMMAND_TYPES.COMPOSITE:
        // 복합 명령어
        finalCommand = await processCompositeCommand(command);
        break;
        
      default:
        // 알 수 없는 타입
        throw new Error(`지원하지 않는 명령어 타입입니다: ${type}`);
    }
    
    // 명령어 최대 길이 검사
    const maxLength = store.get('maxCommandLength') || 10000;
    if (finalCommand.length > maxLength) {
      logger.warn(`명령어가 최대 길이(${maxLength}자)를 초과하여 잘립니다.`);
      finalCommand = finalCommand.substring(0, maxLength) + '... (잘림)';
    }
    
    // 명령어 로깅
    const commandPreview = finalCommand.length > 100
      ? `${finalCommand.substring(0, 100)}...`
      : finalCommand;
    logger.log(`최종 명령어 전송: ${commandPreview}`);
    
    // 추가 옵션 설정
    const commandOptions = {
      autoCapture: command.options?.autoCapture !== false, // 기본적으로 자동 캡처 활성화
      skipQueue: command.options?.priority === 'high', // 우선순위가 높은 명령은 큐를 건너뜀
    };
    
    // 클로드 앱으로 명령어 전송
    return await claudeManager.controlClaudeApp(finalCommand, socketId, commandOptions);
  } catch (err) {
    logger.error('명령어 처리 오류:', err);
    throw err;
  }
}

/**
 * 텍스트 명령어 처리
 * @param {Object} command 명령어 객체
 * @returns {Promise<string>} 처리된 명령어
 */
async function processTextCommand(command) {
  // 간단한 유효성 검사
  if (!command.content) {
    throw new Error('텍스트 내용이 없습니다.');
  }
  
  // 명령어 내용
  return command.content;
}

/**
 * 템플릿 명령어 처리
 * @param {Object} command 명령어 객체
 * @returns {Promise<string>} 처리된 명령어
 */
async function processTemplateCommand(command) {
  // 템플릿 이름과 변수 확인
  const { templateName, variables } = command;
  
  if (!templateName) {
    throw new Error('템플릿 이름이 지정되지 않았습니다.');
  }
  
  // 템플릿 가져오기
  const templates = store.get('commandTemplates') || {};
  const template = templates[templateName] || BUILT_IN_TEMPLATES[templateName];
  
  if (!template) {
    throw new Error(`템플릿을 찾을 수 없습니다: ${templateName}`);
  }
  
  // 변수 치환
  let result = template;
  if (variables && typeof variables === 'object') {
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
  }
  
  // 남은 템플릿 변수 제거
  result = result.replace(/{{[^{}]+}}/g, '');
  
  return result;
}

/**
 * 이미지 명령어 처리
 * @param {Object} command 명령어 객체
 * @returns {Promise<string>} 처리된 명령어
 */
async function processImageCommand(command) {
  // 이미지 경로 또는 데이터 확인
  const { content, imagePath, imageData } = command;
  
  if (!imagePath && !imageData) {
    throw new Error('이미지 경로 또는 데이터가 제공되지 않았습니다.');
  }
  
  // 이미지 처리 - 실제 구현에서는 클로드 앱에 이미지를 직접 업로드하거나
  // 클립보드에 이미지를 복사하는 로직이 필요합니다.
  // 현재 버전에서는 단순히 텍스트만 반환합니다.
  const prefix = content ? `${content}\n\n` : '이 이미지에 대해 설명해주세요:\n\n';
  return prefix + '[이미지 첨부됨]';
}

/**
 * 시스템 명령어 처리
 * @param {Object} command 명령어 객체
 * @param {string} socketId 소켓 ID
 * @returns {Promise<Object>} 처리 결과
 */
async function processSystemCommand(command, socketId) {
  // 시스템 명령어 처리
  const { action, params } = command;
  
  if (!action) {
    throw new Error('시스템 명령어의 액션이 지정되지 않았습니다.');
  }
  
  // 소켓 매니저 가져오기
  const socketManager = require('../server/socketManager');
  
  switch (action) {
    case 'get-templates':
      // 템플릿 목록 반환
      const templates = store.get('commandTemplates') || {};
      socketManager.sendToClient(socketId, 'system-result', {
        action: 'get-templates',
        result: templates,
        builtInTemplates: BUILT_IN_TEMPLATES,
        timestamp: new Date().toISOString()
      });
      return { success: true, message: '템플릿 목록 전송 완료' };
      
    case 'add-template':
      // 템플릿 추가
      if (!params.name || !params.content) {
        throw new Error('템플릿 이름과 내용이 필요합니다.');
      }
      
      // 템플릿 저장
      const currentTemplates = store.get('commandTemplates') || {};
      currentTemplates[params.name] = params.content;
      store.set('commandTemplates', currentTemplates);
      
      socketManager.sendToClient(socketId, 'system-result', {
        action: 'add-template',
        result: { success: true, name: params.name },
        timestamp: new Date().toISOString()
      });
      return { success: true, message: `템플릿 추가 완료: ${params.name}` };
      
    case 'delete-template':
      // 템플릿 삭제
      if (!params.name) {
        throw new Error('삭제할 템플릿 이름이 필요합니다.');
      }
      
      // 내장 템플릿은 삭제 불가
      if (BUILT_IN_TEMPLATES[params.name]) {
        throw new Error('내장 템플릿은 삭제할 수 없습니다.');
      }
      
      // 템플릿 삭제
      const templates2 = store.get('commandTemplates') || {};
      if (templates2[params.name]) {
        delete templates2[params.name];
        store.set('commandTemplates', templates2);
      }
      
      socketManager.sendToClient(socketId, 'system-result', {
        action: 'delete-template',
        result: { success: true, name: params.name },
        timestamp: new Date().toISOString()
      });
      return { success: true, message: `템플릿 삭제 완료: ${params.name}` };
      
    case 'get-status':
      // 상태 정보 반환
      const claudeStatus = claudeManager.getQueueStatus();
      const isRunning = claudeManager.isClaudeRunning();
      
      socketManager.sendToClient(socketId, 'system-result', {
        action: 'get-status',
        result: {
          claudeRunning: isRunning,
          queueStatus: claudeStatus,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
      return { success: true, message: '상태 정보 전송 완료' };
      
    default:
      throw new Error(`지원하지 않는 시스템 명령어입니다: ${action}`);
  }
}

/**
 * 복합 명령어 처리
 * @param {Object} command 명령어 객체
 * @returns {Promise<string>} 처리된 명령어
 */
async function processCompositeCommand(command) {
  // 복합 명령어 처리
  const { commands, separator } = command;
  
  if (!commands || !Array.isArray(commands) || commands.length === 0) {
    throw new Error('유효한 복합 명령어가 아닙니다.');
  }
  
  // 각 명령어 처리 및 조합
  const separatorStr = separator || '\n\n';
  const results = [];
  
  for (const cmd of commands) {
    if (cmd.type === COMMAND_TYPES.SYSTEM) {
      // 시스템 명령어는 복합 명령어에서 지원하지 않음
      logger.warn('복합 명령어에서 시스템 명령어는 무시됩니다.');
      continue;
    }
    
    // 명령어 타입에 따라 처리
    let result = '';
    switch (cmd.type || COMMAND_TYPES.TEXT) {
      case COMMAND_TYPES.TEXT:
        result = await processTextCommand(cmd);
        break;
      case COMMAND_TYPES.TEMPLATE:
        result = await processTemplateCommand(cmd);
        break;
      case COMMAND_TYPES.IMAGE:
        result = await processImageCommand(cmd);
        break;
      default:
        logger.warn(`지원하지 않는 명령어 타입: ${cmd.type}`);
        continue;
    }
    
    results.push(result);
  }
  
  return results.join(separatorStr);
}

/**
 * 명령어 템플릿 목록 가져오기
 * @returns {Object} 템플릿 목록
 */
function getTemplates() {
  const userTemplates = store.get('commandTemplates') || {};
  return {
    builtIn: BUILT_IN_TEMPLATES,
    user: userTemplates
  };
}

/**
 * 템플릿 추가하기
 * @param {string} name 템플릿 이름
 * @param {string} content 템플릿 내용
 * @returns {boolean} 성공 여부
 */
function addTemplate(name, content) {
  try {
    if (!name || !content) {
      throw new Error('템플릿 이름과 내용이 필요합니다.');
    }
    
    // 내장 템플릿과 같은 이름은 사용 불가
    if (BUILT_IN_TEMPLATES[name]) {
      throw new Error('내장 템플릿과 같은 이름은 사용할 수 없습니다.');
    }
    
    // 템플릿 저장
    const templates = store.get('commandTemplates') || {};
    templates[name] = content;
    store.set('commandTemplates', templates);
    
    return true;
  } catch (err) {
    logger.error('템플릿 추가 오류:', err);
    return false;
  }
}

/**
 * 템플릿 삭제하기
 * @param {string} name 템플릿 이름
 * @returns {boolean} 성공 여부
 */
function deleteTemplate(name) {
  try {
    if (!name) {
      throw new Error('템플릿 이름이 필요합니다.');
    }
    
    // 내장 템플릿은 삭제 불가
    if (BUILT_IN_TEMPLATES[name]) {
      throw new Error('내장 템플릿은 삭제할 수 없습니다.');
    }
    
    // 템플릿 삭제
    const templates = store.get('commandTemplates') || {};
    if (templates[name]) {
      delete templates[name];
      store.set('commandTemplates', templates);
    }
    
    return true;
  } catch (err) {
    logger.error('템플릿 삭제 오류:', err);
    return false;
  }
}

/**
 * 파일 내용을 명령어로 변환
 * @param {string} filePath 파일 경로
 * @returns {Promise<string>} 변환된 명령어
 */
async function processFileToCommand(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('유효한 파일 경로가 아닙니다.');
    }
    
    // 파일 확장자 확인
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    
    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (fileSize > maxSize) {
      throw new Error(`파일 크기가 너무 큽니다. 최대 10MB까지 지원합니다. (현재: ${Math.round(fileSize / 1024 / 1024)}MB)`);
    }
    
    // 텍스트 파일 (소스 코드, 텍스트 등)
    const textExtensions = ['.txt', '.md', '.js', '.ts', '.py', '.html', '.css', '.json', '.xml', '.csv', '.c', '.cpp', '.h', '.java', '.php', '.rb', '.go', '.rs', '.sh', '.bat', '.ps1', '.sql'];
    
    // 코드 파일 확장자별 언어
    const codeLanguages = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.java': 'java',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.sh': 'bash',
      '.bat': 'batch',
      '.ps1': 'powershell',
      '.sql': 'sql'
    };
    
    // 텍스트 파일 처리
    if (textExtensions.includes(ext)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // 파일 내용이 너무 길면 잘라내기
      const maxLength = 10000;
      const truncatedContent = fileContent.length > maxLength
        ? fileContent.substring(0, maxLength) + '\n\n[파일이 너무 길어 일부만 표시됩니다...]'
        : fileContent;
      
      // 코드 파일인 경우
      if (codeLanguages[ext]) {
        return `다음 ${codeLanguages[ext]} 코드 파일(${fileName})을 검토해주세요:\n\n\`\`\`${codeLanguages[ext]}\n${truncatedContent}\n\`\`\``;
      }
      
      // 일반 텍스트 파일
      return `다음 텍스트 파일(${fileName})을 검토해주세요:\n\n${truncatedContent}`;
    }
    
    // 이미지 파일 (현재 버전에서는 지원하지 않음)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    if (imageExtensions.includes(ext)) {
      return `[이미지 첨부: ${fileName}]\n\n이 이미지에 대해 설명해주세요.`;
    }
    
    // 지원하지 않는 파일 타입
    return `파일 ${fileName}을 첨부했습니다. 이 파일의 내용을 확인할 수 없습니다.`;
  } catch (err) {
    logger.error('파일 처리 오류:', err);
    throw err;
  }
}

// 모듈 내보내기
module.exports = {
  init,
  processCommand,
  getTemplates,
  addTemplate,
  deleteTemplate,
  processFileToCommand,
  COMMAND_TYPES
};