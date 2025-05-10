/**
 * Windows 시스템 유틸리티 모듈
 * Windows 환경에서 프로세스와 창 관리를 위한 유틸리티 함수를 제공합니다.
 * 
 * 참고: 이 모듈은 Windows 환경에서만 작동합니다.
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Windows 프로세스 관리 유틸리티 클래스
 */
class WindowsProcesses {
  /**
   * 모든 창 정보 가져오기
   * @returns {Array<Object>} 창 정보 배열
   */
  static getAllWindows() {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      // PowerShell 스크립트를 사용하여 모든 창 정보 가져오기
      const ps1ScriptPath = this._createTempPsScript();
      
      // PowerShell 스크립트 실행
      const output = execSync(`powershell -ExecutionPolicy Bypass -File "${ps1ScriptPath}"`, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 5 // 5MB
      });
      
      // 임시 스크립트 파일 삭제
      try {
        fs.unlinkSync(ps1ScriptPath);
      } catch (err) {
        // 파일 삭제 오류 무시
      }
      
      // 결과 파싱
      try {
        const results = JSON.parse(output);
        return Array.isArray(results) ? results : [];
      } catch (err) {
        console.error('Windows 프로세스 정보 파싱 오류:', err);
        return [];
      }
    } catch (err) {
      console.error('Windows 프로세스 정보 가져오기 오류:', err);
      return [];
    }
  }
  
  /**
   * 프로세스 ID로 창 찾기
   * @param {number} processId 프로세스 ID
   * @returns {Array<Object>} 창 정보 배열
   */
  static getWindowsByProcessId(processId) {
    try {
      const allWindows = this.getAllWindows();
      return allWindows.filter(win => win.processId === processId);
    } catch (err) {
      console.error('프로세스 ID로 창 찾기 오류:', err);
      return [];
    }
  }
  
  /**
   * 프로세스 이름으로 창 찾기
   * @param {string} processName 프로세스 이름
   * @returns {Array<Object>} 창 정보 배열
   */
  static getWindowsByProcessName(processName) {
    try {
      const allWindows = this.getAllWindows();
      return allWindows.filter(win => 
        win.processName?.toLowerCase().includes(processName.toLowerCase())
      );
    } catch (err) {
      console.error('프로세스 이름으로 창 찾기 오류:', err);
      return [];
    }
  }
  
  /**
   * 창 제목으로 창 찾기
   * @param {string} title 창 제목
   * @returns {Array<Object>} 창 정보 배열
   */
  static getWindowsByTitle(title) {
    try {
      const allWindows = this.getAllWindows();
      return allWindows.filter(win => 
        win.title?.toLowerCase().includes(title.toLowerCase())
      );
    } catch (err) {
      console.error('창 제목으로 창 찾기 오류:', err);
      return [];
    }
  }
  
  /**
   * 창 클래스 이름으로 창 찾기
   * @param {string} className 창 클래스 이름
   * @returns {Array<Object>} 창 정보 배열
   */
  static getWindowsByClassName(className) {
    try {
      const allWindows = this.getAllWindows();
      return allWindows.filter(win => 
        win.className?.toLowerCase().includes(className.toLowerCase())
      );
    } catch (err) {
      console.error('창 클래스 이름으로 창 찾기 오류:', err);
      return [];
    }
  }
  
  /**
   * 창을 전면으로 가져오기
   * @param {number} hwnd 창 핸들
   * @returns {boolean} 성공 여부
   */
  static setForegroundWindow(hwnd) {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      // PowerShell 스크립트로 창 활성화
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class WindowsAPI {
            [DllImport("user32.dll")]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          }
"@
        $hwnd = [IntPtr]::new(${hwnd})
        [WindowsAPI]::ShowWindow($hwnd, 9) # SW_RESTORE = 9
        [WindowsAPI]::SetForegroundWindow($hwnd)
      `;
      
      execSync(`powershell -Command "${script}"`, { encoding: 'utf8' });
      
      return true;
    } catch (err) {
      console.error('창 활성화 오류:', err);
      return false;
    }
  }
  
  /**
   * 임시 PowerShell 스크립트 생성
   * @returns {string} 스크립트 파일 경로
   * @private
   */
  static _createTempPsScript() {
    // 임시 디렉토리에 PowerShell 스크립트 생성
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `get_windows_${Date.now()}.ps1`);
    
    // 스크립트 내용
    const scriptContent = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        
        public class WindowInfo {
          public IntPtr Handle;
          public string Title;
          public string ClassName;
          public bool Visible;
          public int ProcessId;
          public RECT Rect;
        }
        
        public struct RECT {
          public int Left;
          public int Top;
          public int Right;
          public int Bottom;
        }
        
        public class WindowsAPI {
          [DllImport("user32.dll")]
          [return: MarshalAs(UnmanagedType.Bool)]
          public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
          
          [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
          public static extern int GetWindowTextLength(IntPtr hWnd);
          
          [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
          public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
          
          [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
          public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
          
          [DllImport("user32.dll")]
          [return: MarshalAs(UnmanagedType.Bool)]
          public static extern bool IsWindowVisible(IntPtr hWnd);
          
          [DllImport("user32.dll", SetLastError = true)]
          public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          
          [DllImport("user32.dll", SetLastError = true)]
          [return: MarshalAs(UnmanagedType.Bool)]
          public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        }
        
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
"@
      
      # 모든 창 정보를 담을 리스트
      $windows = New-Object System.Collections.ArrayList
      
      # EnumWindows 콜백 함수
      $callback = {
        param([IntPtr]$hwnd, [IntPtr]$lparam)
        
        # 창 제목 가져오기
        $length = [WindowsAPI]::GetWindowTextLength($hwnd)
        if ($length -gt 0) {
          $title = New-Object System.Text.StringBuilder($length + 1)
          [void][WindowsAPI]::GetWindowText($hwnd, $title, $title.Capacity)
          
          # 클래스 이름 가져오기
          $className = New-Object System.Text.StringBuilder(256)
          [void][WindowsAPI]::GetClassName($hwnd, $className, $className.Capacity)
          
          # 창 가시성 확인
          $visible = [WindowsAPI]::IsWindowVisible($hwnd)
          
          # 프로세스 ID 가져오기
          $processId = 0
          [void][WindowsAPI]::GetWindowThreadProcessId($hwnd, [ref]$processId)
          
          # 창 영역 가져오기
          $rect = New-Object WindowsAPI+RECT
          [void][WindowsAPI]::GetWindowRect($hwnd, [ref]$rect)
          
          # 프로세스 이름 가져오기
          $processName = $null
          try {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
              $processName = $process.ProcessName
            }
          } catch {}
          
          # 창 정보 객체 생성
          $windowInfo = @{
            hwnd = $hwnd.ToInt64()
            title = $title.ToString()
            className = $className.ToString()
            visible = $visible
            processId = $processId
            processName = $processName
            rect = @{
              left = $rect.Left
              top = $rect.Top
              right = $rect.Right
              bottom = $rect.Bottom
            }
          }
          
          # 리스트에 추가
          [void]$windows.Add($windowInfo)
        }
        
        return $true
      }
      
      # EnumWindows 호출
      $enumWindowsCallback = [EnumWindowsProc]$callback
      [void][WindowsAPI]::EnumWindows($enumWindowsCallback, [IntPtr]::Zero)
      
      # 결과를 JSON으로 출력
      ConvertTo-Json -InputObject $windows -Depth 4 -Compress
    `;
    
    // 스크립트 파일 작성
    fs.writeFileSync(scriptPath, scriptContent, { encoding: 'utf8' });
    
    return scriptPath;
  }
  
  /**
   * 지정된 프로세스 강제 종료
   * @param {number} processId 프로세스 ID
   * @returns {boolean} 성공 여부
   */
  static killProcess(processId) {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      execSync(`taskkill /F /PID ${processId}`, { encoding: 'utf8' });
      return true;
    } catch (err) {
      console.error('프로세스 종료 오류:', err);
      return false;
    }
  }
  
  /**
   * 지정된 프로세스 이름으로 프로세스 찾기
   * @param {string} processName 프로세스 이름
   * @returns {Array<Object>} 프로세스 정보 배열
   */
  static findProcessesByName(processName) {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      const output = execSync(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`, { encoding: 'utf8' });
      
      // 결과 없음
      if (output.includes('정보가 없습니다') || output.includes('No tasks are running')) {
        return [];
      }
      
      // CSV 형식 파싱
      const lines = output.trim().split('\n');
      const processes = [];
      
      for (const line of lines) {
        // CSV 형식에서 따옴표 제거 및 분리
        const parts = line.replace(/"/g, '').split(',');
        
        if (parts.length >= 2) {
          const [name, pid] = parts;
          
          processes.push({
            name: name.trim(),
            pid: parseInt(pid.trim(), 10)
          });
        }
      }
      
      return processes;
    } catch (err) {
      console.error('프로세스 찾기 오류:', err);
      return [];
    }
  }
  
  /**
   * 지정된 이름으로 프로세스 종료
   * @param {string} processName 프로세스 이름
   * @returns {boolean} 성공 여부
   */
  static killProcessByName(processName) {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      execSync(`taskkill /F /IM "${processName}"`, { encoding: 'utf8' });
      return true;
    } catch (err) {
      console.error('프로세스 종료 오류:', err);
      return false;
    }
  }
  
  /**
   * 창 크기 변경 및 위치 이동
   * @param {number} hwnd 창 핸들
   * @param {number} x X 좌표
   * @param {number} y Y 좌표
   * @param {number} width 너비
   * @param {number} height 높이
   * @returns {boolean} 성공 여부
   */
  static moveWindow(hwnd, x, y, width, height) {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      // PowerShell 스크립트로 창 이동
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class WindowsAPI {
            [DllImport("user32.dll", SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
          }
"@
        $hwnd = [IntPtr]::new(${hwnd})
        [WindowsAPI]::MoveWindow($hwnd, ${x}, ${y}, ${width}, ${height}, $true)
      `;
      
      execSync(`powershell -Command "${script}"`, { encoding: 'utf8' });
      
      return true;
    } catch (err) {
      console.error('창 이동 오류:', err);
      return false;
    }
  }
  
  /**
   * 가상 키 입력 함수
   * @param {Array<number>} keyCodes 가상 키 코드 배열
   * @returns {boolean} 성공 여부
   */
  static sendKeys(keyCodes) {
    try {
      if (os.platform() !== 'win32') {
        throw new Error('이 함수는 Windows 환경에서만 사용 가능합니다.');
      }
      
      // PowerShell 스크립트로 키 입력
      let scriptContent = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class WindowsAPI {
            [DllImport("user32.dll")]
            public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
            
            public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
            public const int KEYEVENTF_KEYUP = 0x0002;
          }
"@
      `;
      
      // 각 키에 대한 입력 이벤트 생성
      for (const keyCode of keyCodes) {
        scriptContent += `
          [WindowsAPI]::keybd_event(${keyCode}, 0, [WindowsAPI]::KEYEVENTF_EXTENDEDKEY, [IntPtr]::Zero)
          Start-Sleep -Milliseconds 50
          [WindowsAPI]::keybd_event(${keyCode}, 0, [WindowsAPI]::KEYEVENTF_KEYUP, [IntPtr]::Zero)
          Start-Sleep -Milliseconds 50
        `;
      }
      
      execSync(`powershell -Command "${scriptContent}"`, { encoding: 'utf8' });
      
      return true;
    } catch (err) {
      console.error('키 입력 오류:', err);
      return false;
    }
  }
}

// 가상 키 코드 상수
const VirtualKeys = {
  ENTER: 0x0D,
  TAB: 0x09,
  SHIFT: 0x10,
  CONTROL: 0x11,
  ALT: 0x12,
  ESCAPE: 0x1B,
  HOME: 0x24,
  END: 0x23,
  DELETE: 0x2E,
  LEFT: 0x25,
  UP: 0x26,
  RIGHT: 0x27,
  DOWN: 0x28,
  F1: 0x70,
  F2: 0x71,
  F3: 0x72,
  F4: 0x73,
  F5: 0x74,
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  F11: 0x7A,
  F12: 0x7B,
  A: 0x41,
  B: 0x42,
  C: 0x43,
  // ... 추가 키 코드
};

// 모듈 내보내기
module.exports = {
  WindowsProcesses,
  VirtualKeys
};