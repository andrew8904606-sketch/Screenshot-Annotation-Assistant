// background.js
// 负责：全局状态维护（isMonitoring/isPaused/step 计数）、截图与标注、数据持久化、与 popup/content 的消息协调。

// 全局状态（按活动标签页区分）
const stateByTabId = new Map(); 
// 结构：{ isMonitoring: boolean, isPaused: boolean, step: number }

const STORAGE_KEY = 'guide_automator_steps';

// 初始化存储（仅首次）
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(STORAGE_KEY);

  if (!existing[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }
});


// 工具：获取/设置某 tab 的状态
async function getTabState(tabId) {
  if (!stateByTabId.has(tabId)) {
    // 加载保存的颜色状态
    const result = await chrome.storage.local.get('guide_automator_color');
    const savedColor = result['guide_automator_color'] || '#FF3B30';
    
    stateByTabId.set(tabId, { 
      isMonitoring: false, 
      isPaused: false, 
      step: 0,
      annotationColor: savedColor // 使用保存的颜色
    });
  }
  return stateByTabId.get(tabId);
}

// 更新 badge 显示
async function updateBadge(count) {
  if (count > 0) {
    await chrome.action.setBadgeText({ text: count.toString() });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' }); // 红色背景
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' }); // 白色文字
  } else {
    await chrome.action.setBadgeText({ text: '' }); // 清除 badge
  }
}



async function broadcastStateToTab(tabId) {
  const st = await getTabState(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { 
      type: 'STATE_UPDATE', 
      isMonitoring: st.isMonitoring,
      isPaused: st.isPaused,
      annotationColor: st.annotationColor
    });
  } catch (e) {
    // content 未注入时会报错，忽略
  }
}

async function injectContentIfNeeded(tabId) {
  // 尝试向该 Tab 注入 content.js（MV3推荐用 scripting.executeScript）
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (e) {
    // 某些URL（如 chrome:// 或 权限受限页面）无法注入
    console.warn('Inject content failed:', e);
    throw e;
  }
}

// 处理来自 popup 或 content 的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'START_MONITORING') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'No active tab' });
      try {
        await injectContentIfNeeded(tab.id);
        const st = await getTabState(tab.id); 
        st.isMonitoring = true;
        st.isPaused = false;
        // 保存颜色设置
        st.annotationColor = msg.payload?.color || '#FF3B30';
        await broadcastStateToTab(tab.id);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    }

    else if (msg?.type === 'UPDATE_COLOR') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'No active tab' });
      const st = await getTabState(tab.id);
      st.annotationColor = msg.payload?.color || '#FF3B30';
      await broadcastStateToTab(tab.id);
      sendResponse({ ok: true });
    }

    else if (msg?.type === 'STOP_MONITORING') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'No active tab' });
      const st = await getTabState(tab.id);
      st.isMonitoring = false;
      st.isPaused = false;
      st.step = 0;
      await updateBadge(0); // 停止监控时移除 badge
      await broadcastStateToTab(tab.id);
      sendResponse({ ok: true });
    }

    else if (msg?.type === 'TOGGLE_PAUSE') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'No active tab' });
      const st = await getTabState(tab.id);
      st.isPaused = !st.isPaused;
      await broadcastStateToTab(tab.id);
      sendResponse({ ok: true, isPaused: st.isPaused });
    }

    else if (msg?.type === 'REQUEST_STATE') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false });
      await injectContentIfNeeded(tab.id).catch(() => {});
      const st = await getTabState(tab.id);
      await broadcastStateToTab(tab.id);
      sendResponse({ ok: true, state: st });
    }

    else if (msg?.type === 'CLEAR_CACHE') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return sendResponse({ ok: false, error: 'No active tab' });
      const st = await getTabState(tab.id);
      
      await chrome.storage.local.set({ [STORAGE_KEY]: [] });
      st.step = 0;
      await updateBadge(0); // 清空缓存时清零 badge
      await broadcastStateToTab(tab.id);
      sendResponse({ ok: true });
    }

    else if (msg?.type === 'UPDATE_BADGE') {
      // 更新badge显示
      const count = msg.payload?.count || 0;
      console.log('Updating badge to:', count);
      await updateBadge(count);
      sendResponse({ ok: true });
    }

    // 内容脚本请求截图并做标注
    else if (msg?.type === 'CAPTURE_AND_ANNOTATE') {
      // msg.payload: { rect: {left,top,width,height}, dpr, elementInfo, viewport }
      const tabId = sender?.tab?.id;
      if (!tabId) return sendResponse({ ok: false, error: 'No tab id' });

      const st = await getTabState(tabId);
      if (!st.isMonitoring || st.isPaused) {
        return sendResponse({ ok: false, error: 'Not monitoring or paused' });
      }

      try {
        // 截取可见区域
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });

        // 使用原始截图数据，不需要标注处理
        const annotated = dataUrl;

        // 获取当前存储的步骤数量，确保step编号正确
        const store = await chrome.storage.local.get(STORAGE_KEY);
        const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
        const stepNumber = steps.length + 1;
        
        // 更新tab状态中的step计数器
        st.step = stepNumber;

        // 组装日志对象
        const { elementInfo, textDescription, language } = msg.payload;
        const isChinese = language === 'zh-CN';
        const stepPrefix = isChinese ? '步骤' : 'Step';
        const defaultText = isChinese ? '点击此处' : 'Click here';
        
        const stepObj = {
          step: stepNumber,
          timestamp: Date.now(),
          imageDataUrl: annotated,
          element: elementInfo,
          caption: textDescription 
            ? `${stepPrefix} ${stepNumber}: ${textDescription}`
            : `${stepPrefix} ${stepNumber}: ${defaultText}`
        };

        // 持久化 - 使用已经获取的steps数组
        steps.push(stepObj);
        await chrome.storage.local.set({ [STORAGE_KEY]: steps });

        // 更新 badge 显示当前图片数量（使用更新后的长度）
        await updateBadge(steps.length);

        // 回传
        sendResponse({ ok: true, step: stepNumber, entry: stepObj });
      } catch (e) {
        console.error(e);
        // 发生错误时也要尝试移除覆盖层
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'REMOVE_LOGO_OVERLAY' });
        } catch (cleanupError) {
          console.warn('Failed to cleanup logo overlay:', cleanupError);
        }
        sendResponse({ ok: false, error: String(e) });
      }
    }

  })();
  // 异步响应
  return true;
});


function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}