// content.js
// 负责：元素实时高亮、监听点击并把元素信息与坐标发送给 background 请求截图标注。

let isMonitoring = false;
let isPaused = false;
let highlightColor = '#FF3B30'; // 默认颜色

// 高亮边框元素（单例）
let highlightEl = null;

// 监听器引用，便于停止
let onMouseOver = null;
let onMouseOut = null;
let onClick = null;
let onMouseMove = null;

// 判断元素是否"可交互"
function isInteractive(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

  const tag = el.tagName.toLowerCase();
  const clickableTags = new Set(['a', 'button', 'input', 'select', 'textarea', 'label', 'summary']);
  if (clickableTags.has(tag)) return true;

  const role = el.getAttribute('role');
  if (role && /button|link|checkbox|radio|tab|switch|menuitem|option/i.test(role)) return true;

  if (typeof el.onclick === 'function') return true;
  const tabindex = el.getAttribute('tabindex');
  if (tabindex && parseInt(tabindex, 10) >= 0) return true;

  const style = window.getComputedStyle(el);
  if (style.cursor === 'pointer') return true;

  return false;
}

// 获取元素的文字描述（优先级：textContent > innerText > aria-label > title）
async function getElementTextDescription(el) {
  if (!el || !isInteractive(el)) return '';
  
  // 获取当前语言设置
  const lang = await new Promise((resolve) => {
    chrome.storage.local.get('app_language', (result) => {
      resolve(result.app_language || 'zh-CN');
    });
  });
  const prefix = lang === 'zh-CN' ? '点击' : 'Click';
  
  // 优先级1: textContent（包含所有文本内容，包括隐藏文本）
  const textContent = el.textContent?.trim();
  if (textContent && textContent.length > 0) return `${prefix} ${textContent}`;
  
  // 优先级2: innerText（只包含可见文本）
  const innerText = el.innerText?.trim();
  if (innerText && innerText.length > 0) return `${prefix} ${innerText}`;
  
  // 优先级3: aria-label（无障碍标签）
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel && ariaLabel.length > 0) return `${prefix} ${ariaLabel}`;
  
  // 优先级4: title（标题属性）
  const title = el.getAttribute('title')?.trim();
  if (title && title.length > 0) return `${prefix} ${title}`;
  
  // 对于输入元素，检查value
  if (el.value?.trim()) return `${prefix} ${el.value.trim()}`;
  
  // 对于图片，检查alt文本
  if (el.tagName.toLowerCase() === 'img') {
    const alt = el.getAttribute('alt')?.trim();
    if (alt && alt.length > 0) return `${prefix} ${alt}`;
  }
  
  return '';
}
/* 
// 修改 ensureHighlightEl 函数中的高亮框样式
function ensureHighlightEl() {
  if (highlightEl) return highlightEl;
  const el = document.createElement('div');
  el.id = '__guide_automator_highlight__';
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: '2147483647', // 最高
    pointerEvents: 'none',
    border: '3px solid rgba(239, 68, 68, 0.8)', // 使用主题色，稍微透明
    borderRadius: '8px', // 增加圆角
    boxSizing: 'border-box',
    transition: 'all 120ms ease', // 增加过渡时间使动画更平滑
    display: 'none',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.3) inset, 0 0 12px rgba(239, 68, 68, 0.4)' // 添加内阴影和外发光
  });
  document.documentElement.appendChild(el);
  highlightEl = el;
  return el;
} */
// 修改 ensureHighlightEl 函数中的高亮框样式
function ensureHighlightEl() {
  if (highlightEl) return highlightEl;
  const el = document.createElement('div');
  el.id = '__guide_automator_highlight__';
  updateHighlightStyle(el);
  document.documentElement.appendChild(el);
  highlightEl = el;
  return el;
}

// 更新高亮样式
function updateHighlightStyle(element) {
  const rgb = hexToRgb(highlightColor);
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
  const shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
  
  Object.assign(element.style, {
    position: 'fixed',
    zIndex: '2147483647', // 最高
    pointerEvents: 'none',
    border: `3px solid ${borderColor}`,
    borderRadius: '8px',
    boxSizing: 'border-box',
    transition: 'all 120ms ease',
    display: 'none',
    boxShadow: `0 0 0 1px rgba(255,255,255,0.3) inset, 0 0 12px ${shadowColor}`
  });
}

// 十六进制颜色转RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 239, g: 68, b: 68 }; // 默认红色
}

// 更新高亮颜色
function updateHighlightColor(color) {
  highlightColor = color;
  if (highlightEl) {
    updateHighlightStyle(highlightEl);
  }
}

// 修改 showHighlightFor 函数，增加向外扩展的边距
function showHighlightFor(target) {
  const el = ensureHighlightEl();
  if (!target || !isInteractive(target)) {
    el.style.display = 'none';
    return;
  }
  const rect = target.getBoundingClientRect();
  const padding = 8; // 向外扩展的像素值
  
  el.style.left = (rect.left - padding) + 'px';
  el.style.top = (rect.top - padding) + 'px';
  el.style.width = (rect.width + padding * 2) + 'px';
  el.style.height = (rect.height + padding * 2) + 'px';
  el.style.display = 'block';
}

function hideHighlight() {
  if (highlightEl) highlightEl.style.display = 'none';
}

function attachListeners() {
  if (onMouseOver || onClick) return; // 已附加

  onMouseOver = (e) => {
    if (!isMonitoring || isPaused) return;
    showHighlightFor(e.target);
  };

  onMouseMove = (e) => {
    if (!isMonitoring || isPaused) return;
    showHighlightFor(e.target);
  };

  onMouseOut = (e) => {
    if (!isMonitoring || isPaused) return;
    // 如果移出到不可交互元素，隐藏
    if (!isInteractive(e.relatedTarget)) hideHighlight();
  };

  onClick = async (e) => {
    if (!isMonitoring || isPaused) return;
    
    const target = e.target;
    // 检查是否可交互区域
    if (!isInteractive(target)) return;
    
    try {
      
      const rect = target.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const elementInfo = {
        tagName: target.tagName,
        id: target.id || '',
        classes: target.className || '',
        innerText: (target.innerText || target.value || '').toString().trim().slice(0, 200)
      };

      // 获取元素的文字描述（现在函数内部已添加"点击"/"Click"前缀）
      let textDescription = await getElementTextDescription(target);
      if (!textDescription) {
        const lang = await new Promise((resolve) => {
          chrome.storage.local.get('app_language', (result) => {
            resolve(result.app_language || 'zh-CN');
          });
        });
        textDescription = lang === 'zh-CN' ? '点击此处' : 'Click here';
      } else {
        // 如果已有描述，确保不重复添加前缀
        const lang = await new Promise((resolve) => {
          chrome.storage.local.get('app_language', (result) => {
            resolve(result.app_language || 'zh-CN');
          });
        });
        const prefix = lang === 'zh-CN' ? '点击' : 'Click';
        if (!textDescription.startsWith(prefix)) {
          textDescription = `${prefix} ${textDescription}`;
        }
      }
      
      // 请求后台截图与标注
      chrome.runtime.sendMessage({
        type: 'CAPTURE_AND_ANNOTATE',
        payload: {
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          dpr,
          viewport: { w: window.innerWidth, h: window.innerHeight },
          elementInfo,
          textDescription: textDescription,
          language: await new Promise((resolve) => {
            chrome.storage.local.get('app_language', (result) => {
              resolve(result.app_language || 'zh-CN');
            });
          })
        }
      }, (res) => {
        // 截图完成后移除覆盖层
        setTimeout(() => {
          removeLogoOverlay();
        }, 100);
        
        if (!res?.ok) {
          console.warn('Capture failed:', res?.error);
        }
      });
    } catch (err) {
      console.warn('Click capture error:', err);
      // 发生错误时也要移除覆盖层
      removeLogoOverlay();
    }
  };

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
}

function detachListeners() {
  if (onMouseOver) document.removeEventListener('mouseover', onMouseOver, true);
  if (onMouseMove) document.removeEventListener('mousemove', onMouseMove, true);
  if (onMouseOut) document.removeEventListener('mouseout', onMouseOut, true);
  if (onClick) document.removeEventListener('click', onClick, true);
  onMouseOver = onMouseOut = onClick = onMouseMove = null;
  hideHighlight();
}

function applyState(st) {
  isMonitoring = !!st.isMonitoring;
  isPaused = !!st.isPaused;

  if (isMonitoring) {
    attachListeners();
  } else {
    detachListeners();
  }

  // 暂停时隐藏高亮
  if (isPaused) hideHighlight();
}


// 接收后台状态同步
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'STATE_UPDATE') {
    applyState(msg);
    // 更新高亮颜色
    if (msg.annotationColor) {
      updateHighlightColor(msg.annotationColor);
    }
  }
});

// 初次载入时，向后台请求当前状态
chrome.runtime.sendMessage({ type: 'REQUEST_STATE' }, (res) => {
  if (res?.ok && res.state) applyState(res.state);
});

