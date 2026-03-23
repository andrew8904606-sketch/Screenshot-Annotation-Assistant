// popup.js
// 负责：控制按钮与 UI，读取/监听存储，驱动下载 ZIP。

const STORAGE_KEY = 'guide_automator_steps';
const COLOR_STORAGE_KEY = 'guide_automator_color';
const LANGUAGE_STORAGE_KEY = 'app_language';

let el = {};

// 当前选中的颜色
let currentColor = '#DC2626';

// 语言资源映射
const translations = {
  'zh-CN': {
    '截图标注助手': '截图标注助手',
    '状态': '状态',
    '休息中': '休息中',
    '暂停中': '暂停中',
    '捕获中': '捕获中',
    '标注颜色': '标注颜色',
    '开始捕获': '开始捕获',
    '暂停': '暂停',
    '继续': '继续',
    '完成捕获': '完成',
    '截图画廊': '截图画廊',
    '暂无截图': '暂无截图',
    '导出为': '导出',
    '图片压缩包': '图片压缩包',
    'PDF文档': 'PDF文档',
    '清空图片': '清空',
    'x张截图': '{count} 张截图',
    '设置': '设置',
    '语言设置': '语言设置',
    '关闭': '关闭',
    '确定要删除这张截图吗？': '确定要删除这张截图吗？',
    '没有可下载的截图。': '没有可下载的截图。',
    '图片已复制到剪贴板': '图片已复制到剪贴板',
    '复制失败，请重试': '复制失败，请重试',
    '图片已删除': '图片已删除',
    '输入PDF标题': '输入PDF标题',
    '取消': '取消',
    '确认': '确认'
  },
  'en': {
    '截图标注助手': 'LessEffortMa',
    '状态': 'State',
    '休息中': 'Rest',
    '暂停中': 'Paused',
    '捕获中': 'Capturing',
    '标注颜色': 'Select color',
    '开始捕获': 'Capture',
    '暂停': 'Pause',
    '继续': 'Resume',
    '完成捕获': 'Finish',
    '截图画廊': 'Preview',
    '暂无截图': 'Empty',
    '导出为': 'Save as',
    '图片压缩包': 'ZIP Archive',
    'PDF文档': 'PDF Document',
    '清空图片': 'Clear',
    'x张截图': '{count} screenshots',
    '设置': 'Settings',
    '语言设置': 'Language',
    '关闭': 'Close',
    '确定要删除这张截图吗？': 'Are you sure you want to delete this screenshot?',
    '没有可下载的截图。': 'No screenshots available for download.',
    '图片已复制到剪贴板': 'Image copied to clipboard',
    '复制失败，请重试': 'Copy failed, please try again',
    '图片已删除': 'Image deleted',
    '输入PDF标题': 'Enter PDF Title',
    '取消': 'Cancel',
    '确认': 'Confirm'
  }
};

// 按钮事件处理函数
async function handleStartClick() {
  const res = await sendMsg({ 
    type: 'START_MONITORING',
    payload: { color: currentColor }
  });
  if (res?.ok) {
    updateStatusDisplay(true, false);
    updatePauseButtons(false);
    el.start.classList.add('hidden');
    el.captureControls.classList.remove('hidden');
  }
}

async function handleStopClick() {
  const res = await sendMsg({ type: 'STOP_MONITORING' });
  if (res?.ok) {
    updateStatusDisplay(false, false);
    updatePauseButtons(false);
    el.start.classList.remove('hidden');
    el.captureControls.classList.add('hidden');
  }
}

async function handlePauseClick() {
  const res = await sendMsg({ type: 'TOGGLE_PAUSE' });
  if (res?.ok) {
    updatePauseButtons(res.isPaused);
    updateStatusDisplay(true, res.isPaused);
  }
}

async function handleResumeClick() {
  const res = await sendMsg({ type: 'TOGGLE_PAUSE' });
  if (res?.ok) {
    updatePauseButtons(res.isPaused);
    updateStatusDisplay(true, res.isPaused);
  }
}

async function handleClearClick() {
  await sendMsg({ type: 'CLEAR_CACHE' });
  await refreshUI();
}

function handleColorPickerInput(e) {
  updateColor(e.target.value);
}

function handleColorPresetsClick(e) {
  if (e.target.classList.contains('color-preset')) {
    const preset = e.target.closest('.color-preset');
    const color = preset.dataset.color;
    
    if (preset.classList.contains('custom-color')) {
      // 点击自定义颜色按钮，触发颜色选择器
      el.customColorPicker.click();
    } else {
      updateColor(color);
    }
  }
}

// 保存颜色选择状态
async function saveColorState(color) {
  await chrome.storage.local.set({ [COLOR_STORAGE_KEY]: color });
}

// 加载颜色选择状态
async function loadColorState() {
  const result = await chrome.storage.local.get(COLOR_STORAGE_KEY);
  return result[COLOR_STORAGE_KEY] || '#DC2626'; // 默认红色
}

// 更新颜色并保存状态
async function updateColor(color) {
  currentColor = color;
  
  // 更新颜色选择器值
  if (el.customColorPicker) {
    el.customColorPicker.value = color;
  }
  
  // 保存颜色状态
  await saveColorState(color);
  
  // 更新UI状态
  await updateCustomColorButtonUI(color);
  updateColorPresets();
  
  // 如果正在监控，更新颜色设置
  if (el.captureControls && el.captureControls.classList.contains('hidden') === false) {
    sendMsg({ type: 'UPDATE_COLOR', payload: { color } });
  }
}

// 初始加载 - 确保DOM完全加载后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}



async function init() {
  // 初始化元素引用（确保DOM已加载）
  el = {
    start: document.getElementById('startBtn'),
    stop: document.getElementById('stopBtn'),
    pause: document.getElementById('pauseBtn'),
    resume: document.getElementById('resumeBtn'),
    exportBtn: document.getElementById('exportBtn'),
    exportDropdown: document.getElementById('exportDropdown'),
    clear: document.getElementById('clearCacheBtn'),
    gallery: document.getElementById('gallery'),
    status: document.getElementById('statusDisplay'),
    captureControls: document.getElementById('captureControls'),
    colorPresets: document.getElementById('colorPresets'),
    stepCounter: document.getElementById('stepCounter'),
    settingsToggle: document.getElementById('settingsToggle'),
    settingsPanel: document.getElementById('settingsPanel'),
    languageSelect: document.getElementById('language-select'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    pdfModal: document.getElementById('pdfModal'),
    pdfTitleInput: document.getElementById('pdfTitleInput'),
    pdfCancelBtn: document.getElementById('pdfCancelBtn'),
    pdfConfirmBtn: document.getElementById('pdfConfirmBtn'),
    customColorPicker: document.getElementById('customColorPicker')
  };

  // 调试：检查所有元素（已移除未定义的debugElements调用）
  
  // 加载语言设置
  const savedLanguage = await loadLanguage();
  await applyLanguage(savedLanguage);
  
  // 加载保存的颜色状态
  const savedColor = await loadColorState();
  currentColor = savedColor;
  
  // 设置颜色选择器值
  if (el.customColorPicker) {
    el.customColorPicker.value = currentColor;
  }
  
  // 先加载自定义颜色按钮状态
  await loadCustomColorButton();
  
  // 然后更新颜色预设选中状态
  updateColorPresets();
  
  // 请求一次状态，更新暂停按钮显隐
  const st = await sendMsg({ type: 'REQUEST_STATE' });
  updatePauseButtons(st?.state?.isPaused || false);
  // 更新状态显示
  updateStatusDisplay(st?.state?.isMonitoring, st?.state?.isPaused);
  
  // 根据监控状态显示正确的按钮
  if (st?.state?.isMonitoring) {
    el.start.classList.add('hidden');
    el.captureControls.classList.remove('hidden');
  } else {
    el.start.classList.remove('hidden');
    el.captureControls.classList.add('hidden');
  }
  
  refreshUI();

  // 监听存储变化，实时刷新 UI
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[STORAGE_KEY] || changes[COLOR_STORAGE_KEY])) {
      refreshUI();
      // 如果颜色变化，更新自定义颜色按钮
      if (changes[COLOR_STORAGE_KEY]) {
        loadCustomColorButton();
      }
    }
  });
  
  // 添加微交互效果
  addMicroInteractions();
  
  // 初始化设置面板
  setupSettingsPanel();
  
  // 初始化事件监听器
  setupEventListeners();
  
  // 初始化PDF模态框
  setupPdfModal();
}

// 语言相关函数
async function loadLanguage() {
  const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
  return result[LANGUAGE_STORAGE_KEY] || 'zh-CN';
}

async function saveLanguage(language) {
  await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
}

async function applyLanguage(language) {
  // 更新html lang属性
  document.documentElement.lang = language;
  
  // 先获取步骤数量
  const store = await chrome.storage.local.get(STORAGE_KEY);
  const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
  const stepCount = steps.length;
  
  // 翻译所有带data-i18n属性的元素
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = translations[language][key];
    if (translation) {
      if (key === 'x张截图' && element.id === 'stepCounter') {
        // 特殊处理计数器
        element.textContent = translation.replace('{count}', stepCount);
      } else {
        element.textContent = translation;
      }
    }
  });
  
  // 更新输入框placeholder
  applyCaptionPlaceholders();
  
  // 更新选择器选中状态
  if (el.languageSelect) {
    el.languageSelect.value = language;
  }
}

// 设置面板交互逻辑
function setupSettingsPanel() {
  // 安全检查：确保settingsPanel元素存在
  if (!el.settingsPanel) {
    console.error('Settings panel element not found');
    return;
  }

  const closeBtn = el.settingsPanel.querySelector('.close-btn');
  if (!closeBtn) {
    console.error('Close button not found in settings panel');
    return;
  }

  // 切换设置面板 - 安全检查
  if (el.settingsToggle) {
    el.settingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      el.settingsPanel.classList.toggle('active');
    });
  } else {
    console.error('Settings toggle button not found');
  }

  // 关闭设置面板
  closeBtn.addEventListener('click', () => {
    el.settingsPanel.classList.remove('active');
  });

  // 点击外部关闭
  document.addEventListener('click', (e) => {
    if (!el.settingsPanel.contains(e.target) && e.target !== el.settingsToggle) {
      el.settingsPanel.classList.remove('active');
    }
  });

  // 语言选择变化
  el.languageSelect.addEventListener('change', async (e) => {
    const newLanguage = e.target.value;
    el.loadingOverlay.classList.add('active');
    
    try {
      await saveLanguage(newLanguage);
      await applyLanguage(newLanguage);
      await refreshUI();
      
      setTimeout(() => {
        el.loadingOverlay.classList.remove('active');
        el.settingsPanel.classList.remove('active');
      }, 800);
    } catch (error) {
      console.error('Language switch failed:', error);
      el.loadingOverlay.classList.remove('active');
    }
  });

  // 颜色选择器展开/折叠
  const colorSectionHeader = el.settingsPanel.querySelector('.settings-section-header');
  const colorPresetsContainer = el.settingsPanel.querySelector('.color-presets-container');
  const arrow = el.settingsPanel.querySelector('.arrow');
  
  if (colorSectionHeader && colorPresetsContainer) {
    colorSectionHeader.addEventListener('click', () => {
      colorPresetsContainer.classList.toggle('show');
      arrow.style.transform = colorPresetsContainer.classList.contains('show') 
        ? 'rotate(180deg)' 
        : 'rotate(0deg)';
    });
  }

  // 颜色预设点击事件
  const colorPresets = el.settingsPanel.querySelectorAll('.color-preset');
  colorPresets.forEach(preset => {
    preset.addEventListener('click', (e) => {
      const color = e.target.dataset.color;
      updateColor(color);
      
      // 更新选中状态
      colorPresets.forEach(p => p.classList.remove('selected'));
      e.target.classList.add('selected');
    });
  });

  // ESC键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      el.settingsPanel.classList.remove('active');
    }
  });
}

// 更新颜色预设选中状态
function updateColorPresets() {
  const presets = el.colorPresets.querySelectorAll('.color-preset');
  presets.forEach(preset => {
    // 检查是否是自定义颜色按钮
    const isCustomColorBtn = preset.classList.contains('custom-color');
    
    if (isCustomColorBtn) {
      // 对于自定义颜色按钮，只有当当前颜色是自定义颜色时才选中
      const presetColors = ['#DC2626', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];
      const isCurrentColorCustom = !presetColors.includes(currentColor);
      
      if (isCurrentColorCustom) {
        preset.classList.add('selected');
      } else {
        preset.classList.remove('selected');
      }
    } else {
      // 对于预设颜色按钮，直接比较颜色值
      if (preset.dataset.color === currentColor) {
        preset.classList.add('selected');
      } else {
        preset.classList.remove('selected');
      }
    }
  });
}

function updateStatusDisplay(isMonitoring, isPaused) {
  const statusIndicator = el.status.querySelector('.status-indicator');
  
  // 清除现有内容但保留data-i18n属性
  const statusText = el.status.querySelector('.status-text');
  const statusValue = el.status.querySelector('.status-value');
  
  if (!statusText || !statusValue) {
    // 如果元素不存在，重新创建带data-i18n属性的结构
    if (!isMonitoring) {
      el.status.innerHTML = '<span class="status-indicator inactive"></span><span class="status-text" data-i18n="状态">状态</span>：<span class="status-value" data-i18n="休息中">休息中</span>';
      el.status.style.color = 'var(--text-muted)';
    } else {
      if (isPaused) {
        el.status.innerHTML = '<span class="status-indicator paused"></span><span class="status-text" data-i18n="状态">状态</span>：<span class="status-value" data-i18n="暂停中">暂停中</span>';
        el.status.style.color = 'var(--text-muted)';
      } else {
        el.status.innerHTML = '<span class="status-indicator active"></span><span class="status-text" data-i18n="状态">状态</span>：<span class="status-value" data-i18n="捕获中">捕获中</span>';
        el.status.style.color = 'var(--text-primary)';
      }
    }
  } else {
    // 更新状态值
    if (!isMonitoring) {
      statusIndicator.className = 'status-indicator inactive';
      statusValue.setAttribute('data-i18n', '休息中');
      statusValue.textContent = '休息中';
      el.status.style.color = 'var(--text-muted)';
    } else {
      if (isPaused) {
        statusIndicator.className = 'status-indicator paused';
        statusValue.setAttribute('data-i18n', '暂停中');
        statusValue.textContent = '暂停中';
        el.status.style.color = 'var(--text-muted)';
      } else {
        statusIndicator.className = 'status-indicator active';
        statusValue.setAttribute('data-i18n', '捕获中');
        statusValue.textContent = '捕获中';
        el.status.style.color = 'var(--text-primary)';
      }
    }
  }
  
  // 重新应用语言
  const currentLanguage = document.documentElement.lang || 'zh-CN';
  applyLanguage(currentLanguage);
}

function updatePauseButtons(isPaused) {
  if (isPaused) {
    el.pause.classList.add('hidden');
    el.resume.classList.remove('hidden');
  } else {
    el.pause.classList.remove('hidden');
    el.resume.classList.add('hidden');
  }
}

async function refreshUI() {
  const store = await chrome.storage.local.get(STORAGE_KEY);
  const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];

  // 更新步骤计数器
  updateStepCounter(steps.length);
  
  // 画廊
  renderGallery(steps);
  
  // 更新颜色预设状态
  updateColorPresets();
}

function updateStepCounter(count) {
  const currentLanguage = document.documentElement.lang || 'zh-CN';
  const counterText = translations[currentLanguage]['x张截图'].replace('{count}', count);
  el.stepCounter.textContent = counterText;
  // 确保data-i18n属性正确设置以便语言切换时能重新翻译
  el.stepCounter.setAttribute('data-i18n', 'x张截图');
}

function renderGallery(steps) {
  el.gallery.innerHTML = '';
  if (!steps.length) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.setAttribute('data-i18n', '暂无截图');
    div.textContent = '暂无截图。';
    el.gallery.appendChild(div);
    
    // 重新应用语言
    const currentLanguage = document.documentElement.lang || 'zh-CN';
    applyLanguage(currentLanguage);
    return;
  }
  for (const s of steps) {
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    
    const imageEditor = document.createElement('div');
    imageEditor.className = 'image-editor';
    
    // 创建文字输入框
    const captionEditor = document.createElement('div');
    captionEditor.className = 'caption-editor';
    
    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.className = 'caption-input';
    captionInput.placeholder = '请输入操作';
    captionInput.setAttribute('data-i18n-placeholder', '请输入操作|Please enter your operation');
    captionInput.value = s.caption || '';
    
    // 保存输入内容
    captionInput.addEventListener('change', async (e) => {
      await saveCaption(s.step, e.target.value);
    });
    
    captionEditor.appendChild(captionInput);
    imageEditor.appendChild(captionEditor);
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    
    const img = document.createElement('img');
    img.src = s.imageDataUrl;
    img.alt = `Step ${s.step}`;
    img.title = `Step ${s.step}`;
    img.dataset.step = s.step;
    
    // 点击图片在当前页面放大显示
    img.addEventListener('click', () => {
      showImageModal(s.imageDataUrl, s.step);
    });

    // 创建图片信息容器
    const imageInfo = document.createElement('div');
    imageInfo.className = 'image-info';
    
    // 步骤编号
    const stepNumber = document.createElement('span');
    stepNumber.className = 'step-number';
    stepNumber.textContent = `Step ${s.step}`;
    
    // 操作按钮容器
    const imageActions = document.createElement('div');
    imageActions.className = 'image-actions';
    
    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit';
    editBtn.innerHTML = '<img src="edit.svg" width="14" height="14" alt="编辑">';
    editBtn.title = '编辑图片';
    editBtn.onclick = async (e) => {
      e.stopPropagation();
      await editImage(s.imageDataUrl, s.step);
      
      // 视觉反馈
      editBtn.classList.add('pulse');
      setTimeout(() => {
        editBtn.classList.remove('pulse');
      }, 600);
    };
    
    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy';
    copyBtn.innerHTML = '<img src="copy.svg" width="14" height="14" alt="复制">';
    copyBtn.title = '复制图片';
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      await copyImageToClipboard(s.imageDataUrl);
      
      // 视觉反馈
      copyBtn.classList.add('pulse');
      setTimeout(() => {
        copyBtn.classList.remove('pulse');
      }, 600);
    };

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete';
    deleteBtn.innerHTML = '<img src="delete.svg" width="14" height="14" alt="删除">';
    deleteBtn.title = '删除图片';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      const currentLanguage = document.documentElement.lang || 'zh-CN';
      const confirmText = translations[currentLanguage]['确定要删除这张截图吗？'];
      if (confirm(confirmText)) {
        await deleteImage(s.step);
        
      // 视觉反馈
      deleteBtn.classList.add('pulse');
      setTimeout(() => {
        deleteBtn.classList.remove('pulse');
      }, 600);
      }
    };

    // 组装元素
    imageActions.appendChild(editBtn);
    imageActions.appendChild(copyBtn);
    imageActions.appendChild(deleteBtn);
    imageInfo.appendChild(stepNumber);
    imageInfo.appendChild(imageActions);
    
    imageItem.appendChild(img);
    imageItem.appendChild(imageInfo);
    imageContainer.appendChild(imageItem);
    imageEditor.appendChild(imageContainer);
    galleryItem.appendChild(imageEditor);
    el.gallery.appendChild(galleryItem);
  }
  
  // 应用国际化placeholder
  applyCaptionPlaceholders();
}

// 编辑图片
async function editImage(imageDataUrl, stepNumber) {
  try {
    // 创建编辑器窗口URL
    const editorUrl = chrome.runtime.getURL('image-editor.html');
    const fullUrl = `${editorUrl}?image=${encodeURIComponent(imageDataUrl)}&step=${stepNumber}`;
    
    // 打开新窗口
    const editorWindow = window.open(fullUrl, `image-editor-${stepNumber}`, 'width=1200,height=800');
    
    // 监听编辑完成的消息
    window.addEventListener('message', (event) => {
      if (event.data.type === 'IMAGE_EDITED') {
        handleImageEdited(event.data.imageData, event.data.originalStep);
      }
    });
    
  } catch (err) {
    console.error('打开编辑器失败:', err);
    showToast('打开编辑器失败，请重试');
  }
}

// 处理编辑后的图片
async function handleImageEdited(imageDataUrl, originalStep) {
  try {
    // 将URL转换为DataURL以便存储
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    
    // 获取当前存储的步骤
    const store = await chrome.storage.local.get(STORAGE_KEY);
    const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
    
    // 找到对应的步骤并更新图片
    const updatedSteps = steps.map(step => {
      if (step.step === originalStep) {
        return {
          ...step,
          imageDataUrl: dataUrl,
          timestamp: Date.now() // 更新时间戳
        };
      }
      return step;
    });
    
    // 保存更新后的步骤
    await chrome.storage.local.set({ [STORAGE_KEY]: updatedSteps });
    
    // 刷新UI
    await refreshUI();
    
    showToast('图片编辑完成');
    
    // 清理URL对象
    URL.revokeObjectURL(imageDataUrl);
  } catch (err) {
    console.error('保存编辑后的图片失败:', err);
    showToast('保存编辑后的图片失败');
  }
}

// 复制图片到剪贴板
async function copyImageToClipboard(imageDataUrl) {
  try {
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    showToast('图片已复制到剪贴板');
  } catch (err) {
    console.error('复制失败:', err);
    showToast('复制失败，请重试');
  }
}

// 保存图片说明文字
async function saveCaption(stepNumber, caption) {
  const store = await chrome.storage.local.get(STORAGE_KEY);
  const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
  const updatedSteps = steps.map(s => 
    s.step === stepNumber ? { ...s, caption } : s
  );
  
  await chrome.storage.local.set({ [STORAGE_KEY]: updatedSteps });
}

// 删除单张图片并重新编号所有截图
async function deleteImage(stepNumber) {
  const store = await chrome.storage.local.get(STORAGE_KEY);
  const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
  
  // 过滤掉要删除的截图
  const filteredSteps = steps.filter(s => s.step !== stepNumber);
  
  // 按照正确顺序重新编号所有截图
  const renumberedSteps = filteredSteps
    .sort((a, b) => a.step - b.step) // 先按原始step排序
    .map((step, index) => ({
      ...step,
      step: index + 1 // 重新编号为1, 2, 3...
    }));
  
  await chrome.storage.local.set({ [STORAGE_KEY]: renumberedSteps });
  
  // 更新badge显示
  await sendMsg({ type: 'UPDATE_BADGE', payload: { count: renumberedSteps.length } });
  
  await refreshUI();
  showToast('图片已删除');
}

// 应用国际化placeholder
function applyCaptionPlaceholders() {
  const currentLanguage = document.documentElement.lang || 'zh-CN';
  const inputs = document.querySelectorAll('.caption-input[data-i18n-placeholder]');
  
  inputs.forEach(input => {
    const placeholderData = input.getAttribute('data-i18n-placeholder');
    const [chinese, english] = placeholderData.split('|');
    input.placeholder = currentLanguage === 'zh-CN' ? chinese : english;
  });
}

// 显示提示信息
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = 'toast';
  
  // 根据类型设置不同的样式
  if (type === 'success') {
    toast.style.background = 'var(--success)';
  } else if (type === 'error') {
    toast.style.background = 'var(--danger)';
  } else {
    toast.style.background = 'var(--primary)';
  }
  
  document.body.appendChild(toast);
  
  // 添加进入动画
  setTimeout(() => {
    toast.classList.add('toast-visible');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

// 初始化事件监听器
function setupEventListeners() {
  // 按钮事件
  if (el.start) el.start.addEventListener('click', handleStartClick);
  if (el.stop) el.stop.addEventListener('click', handleStopClick);
  if (el.pause) el.pause.addEventListener('click', handlePauseClick);
  if (el.resume) el.resume.addEventListener('click', handleResumeClick);
  if (el.clear) el.clear.addEventListener('click', handleClearClick);
  
  // 导出下拉菜单事件
  if (el.exportBtn) {
    el.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 切换下拉菜单显示状态 - 使用正确的父容器
      const dropdownContainer = el.exportBtn.closest('.export-dropdown');
      if (dropdownContainer) {
        dropdownContainer.classList.toggle('active');
      }
    });
  }
  
  // 导出选项点击事件
  if (el.exportDropdown) {
    el.exportDropdown.addEventListener('click', (e) => {
      if (e.target.classList.contains('dropdown-item')) {
        const exportType = e.target.dataset.exportType;
        handleExportTypeSelect(exportType);
        // 关闭下拉菜单 - 使用正确的父容器
        const dropdownContainer = el.exportBtn.closest('.export-dropdown');
        if (dropdownContainer) {
          dropdownContainer.classList.remove('active');
        }
      }
    });
  }
  
  // 点击外部关闭下拉菜单
  document.addEventListener('click', (e) => {
    const dropdownContainer = el.exportBtn ? el.exportBtn.closest('.export-dropdown') : null;
    if (dropdownContainer && !dropdownContainer.contains(e.target)) {
      dropdownContainer.classList.remove('active');
    }
  });

  // ESC键关闭下拉菜单
  document.addEventListener('keydown', (e) => {
    const dropdownContainer = el.exportBtn ? el.exportBtn.closest('.export-dropdown') : null;
    if (e.key === 'Escape' && dropdownContainer && dropdownContainer.classList.contains('active')) {
      dropdownContainer.classList.remove('active');
    }
  });
  
  // 颜色选择器事件
  if (el.customColorPicker) el.customColorPicker.addEventListener('input', handleColorPickerInput);
  if (el.colorPresets) el.colorPresets.addEventListener('click', handleColorPresetsClick);
  
  // 自定义颜色选择器
  setupCustomColorPicker();
}

// 初始化PDF模态框
function setupPdfModal() {
  if (!el.pdfModal || !el.pdfTitleInput || !el.pdfCancelBtn || !el.pdfConfirmBtn) return;
  
  // 输入框监听
  el.pdfTitleInput.addEventListener('input', (e) => {
    el.pdfConfirmBtn.disabled = e.target.value.trim() === '';
  });
  
  // 取消按钮
  el.pdfCancelBtn.addEventListener('click', () => {
    hidePdfModal();
  });
  
  // 确认按钮
  el.pdfConfirmBtn.addEventListener('click', () => {
    const title = el.pdfTitleInput.value.trim();
    if (title) {
      downloadAllPdf(title);
      hidePdfModal();
    }
  });
  
  // ESC键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.pdfModal.style.display !== 'none') {
      hidePdfModal();
    }
  });
  
  // 点击外部关闭
  el.pdfModal.addEventListener('click', (e) => {
    if (e.target === el.pdfModal) {
      hidePdfModal();
    }
  });
}

// 显示PDF模态框
function showPdfModal() {
  if (el.pdfModal) {
    el.pdfModal.style.display = 'flex';
    el.pdfTitleInput.value = '';
    el.pdfConfirmBtn.disabled = true;
    setTimeout(() => el.pdfTitleInput.focus(), 100);
  }
}

// 隐藏PDF模态框
function hidePdfModal() {
  if (el.pdfModal) {
    el.pdfModal.style.display = 'none';
  }
}

// 处理导出类型选择
function handleExportTypeSelect(exportType) {
  // 关闭下拉菜单
  el.exportDropdown.classList.remove('active');
  
  if (exportType === 'zip') {
    downloadAllZip();
  } else if (exportType === 'pdf') {
    showPdfModal();
  }
}

// 添加微交互效果
function addMicroInteractions() {
  // 按钮点击效果
  const buttons = document.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.98)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = '';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
  
  // 图片加载效果
  const images = document.querySelectorAll('.gallery img');
  images.forEach(img => {
    if (!img.complete) {
      img.classList.add('loading');
      img.onload = () => img.classList.remove('loading');
    }
  });
}

function truncate(text, n) {
  return text.length > n ? text.slice(0, n) + '…' : text;
}

function sendMsg(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => resolve(res));
  });
}

// 打包下载 ZIP：包含所有 PNG 图片
async function downloadAllZip() {
  try {
    // 显示加载状态
    el.loadingOverlay.classList.add('active');
    
    const store = await chrome.storage.local.get(STORAGE_KEY);
    const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
    
    if (!steps.length) {
      const currentLanguage = document.documentElement.lang || 'zh-CN';
      const alertText = translations[currentLanguage]['没有可下载的截图。'];
      alert(alertText);
      el.loadingOverlay.classList.remove('active');
      return;
    }

    // 检查JSZip是否可用
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not loaded');
    }

    const zip = new JSZip();
    const folder = zip.folder('guide');

    // 创建操作日志文件（可选）
    const logContent = steps.map(step => {
      const timestamp = new Date(step.timestamp).toLocaleString('zh-CN');
      const caption = step.caption || `步骤 ${step.step}`;
      return `步骤 ${step.step} [${timestamp}]: ${caption}`;
    }).join('\\n');

    if (logContent) {
      folder.file('操作日志.txt', logContent);
    }

    // 分批处理图片以避免内存溢出
    const BATCH_SIZE = 5; // 每次处理5张图片
    let processedCount = 0;
    
    for (let i = 0; i < steps.length; i += BATCH_SIZE) {
      const batch = steps.slice(i, i + BATCH_SIZE);
      
      for (const s of batch) {
        try {
          // Data URL -> base64 去头
          const base64 = s.imageDataUrl.split(',')[1];
          const filenameSafeText = (s.element?.innerText || s.caption || '').trim().slice(0, 25).replace(/[\\\\/:*?\\\"<>|]/g, '');
          const namePart = filenameSafeText ? `_${filenameSafeText}` : '';
          const fileName = `Step_${String(s.step).padStart(2, '0')}${namePart}.png`;
          folder.file(fileName, base64, { base64: true });
          
          processedCount++;
          // 更新进度提示（可选）
          if (steps.length > 10) {
            const progress = Math.round((processedCount / steps.length) * 100);
            showToast(`正在处理图片 ${processedCount}/${steps.length} (${progress}%)`, 'info');
          }
        } catch (imgError) {
          console.error(`处理图片步骤 ${s.step} 失败:`, imgError);
        }
      }
      
      // 给浏览器一些喘息时间，避免阻塞UI
      if (i + BATCH_SIZE < steps.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 生成ZIP文件
    showToast('正在生成压缩包...', 'info');
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const url = URL.createObjectURL(blob);

    // 使用 chrome.downloads 触发下载
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `操作指南_${stamp}.zip`;
    
    chrome.downloads.download({
      url,
      filename: fileName,
      saveAs: true,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        showToast('下载失败，请检查下载权限', 'error');
      } else {
        showToast('压缩包生成成功，开始下载', 'success');
      }
      
      // 释放 URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
        el.loadingOverlay.classList.remove('active');
      }, 3000);
    });

  } catch (error) {
    console.error('ZIP导出失败:', error);
    showToast(`导出失败: ${error.message}`, 'error');
    el.loadingOverlay.classList.remove('active');
  }
}

// 生成并下载PDF文档
async function downloadAllPdf(title) {
  const store = await chrome.storage.local.get(STORAGE_KEY);
  const steps = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
  if (!steps.length) {
    const currentLanguage = document.documentElement.lang || 'zh-CN';
    const alertText = translations[currentLanguage]['没有可下载的截图。'];
    alert(alertText);
    return;
  }

  try {
    // 显示加载状态
    el.loadingOverlay.classList.add('active');
    
    // 使用jsPDF生成PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 加载黑体字体
    const fontPath = chrome.runtime.getURL('ttf/SourceHanSansCN-Bold.ttf');
    const fontResponse = await fetch(fontPath);
    const fontBlob = await fontResponse.blob();
    const fontArrayBuffer = await fontBlob.arrayBuffer();
    
    // 将字体添加到jsPDF
    doc.addFileToVFS('SourceHanSansCN-Bold.ttf', arrayBufferToBase64(fontArrayBuffer));
    doc.addFont('SourceHanSansCN-Bold.ttf', 'SourceHanSansCN', 'normal');
    doc.addFont('SourceHanSansCN-Bold.ttf', 'SourceHanSansCN', 'bold');
    
    // 设置页面尺寸为A4
    const pageWidth = 210; // A4宽度 mm
    const pageHeight = 297; // A4高度 mm
    const margin = 20; // 边距 mm
    const contentWidth = pageWidth - margin * 2;
    
    let currentY = margin;
    let currentPage = 1;
    
    // 添加标题（20pt居中，使用黑体字体）
    doc.setFontSize(20);
    doc.setFont('SourceHanSansCN', 'bold');
    const titleWidth = doc.getTextWidth(title);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, currentY);
    currentY += 15;
    
    // 添加导出时间（10pt左对齐，使用黑体字体）
    doc.setFontSize(10);
    doc.setFont('SourceHanSansCN', 'normal');
    const exportTime = new Date().toLocaleString('zh-CN');
    doc.text(`导出时间: ${exportTime}`, margin, currentY);
    currentY += 10;
    
    // 添加分隔线
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;
    
    // 设置正文字体（使用黑体字体）
    doc.setFontSize(14);
    doc.setFont('SourceHanSansCN', 'normal');
    
    // 处理每个步骤
    for (const step of steps) {
      const caption = step.caption || `步骤 ${step.step}`;
      
      // 检查是否需要换页
      if (currentY > pageHeight - margin - 100) { // 预留100mm给图片
        doc.addPage();
        currentY = margin;
        currentPage++;
      }
      
      // 添加步骤描述文字
      const lines = doc.splitTextToSize(caption, contentWidth);
      doc.text(lines, margin, currentY);
      currentY += lines.length * 7 + 5; // 行高约7mm
      
      // 添加图片
      if (step.imageDataUrl) {
        // 检查图片是否需要换页
        if (currentY > pageHeight - margin - 80) { // 预留80mm给图片
          doc.addPage();
          currentY = margin;
          currentPage++;
        }
        
        try {
          // 将Data URL转换为图片对象
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = step.imageDataUrl;
          });
          
          // 计算图片尺寸（保持比例，最大宽度为内容宽度）
          const maxWidth = contentWidth;
          const scale = maxWidth / img.width;
          const imgWidth = img.width * scale;
          const imgHeight = img.height * scale;
          
          // 添加图片到PDF
          doc.addImage({
            imageData: step.imageDataUrl,
            x: margin,
            y: currentY,
            width: imgWidth,
            height: imgHeight
          });
          
          currentY += imgHeight + 15;
          
        } catch (error) {
          console.error('图片加载失败:', error);
          doc.setFont('SourceHanSansCN', 'normal');
          doc.text('图片加载失败', margin, currentY);
          currentY += 10;
        }
      }
      
      // 添加步骤分隔
      if (step.step < steps.length) {
        if (currentY > pageHeight - margin - 10) {
          doc.addPage();
          currentY = margin;
          currentPage++;
        }
        doc.setDrawColor(240, 240, 240);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 15;
      }
    }
    
    // 添加页码（12pt居中，分数格式，使用黑体字体）
    for (let i = 1; i <= currentPage; i++) {
      doc.setPage(i);
      doc.setFontSize(12);
      doc.setFont('SourceHanSansCN', 'normal');
      const pageText = `${i}/${currentPage}`;
      const textWidth = doc.getTextWidth(pageText);
      const centerX = (pageWidth - textWidth) / 2;
      doc.text(pageText, centerX, pageHeight - 10);
    }
    
    // 生成PDF并下载
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${title}.pdf`;
    
    doc.save(fileName);
    
    // 隐藏加载状态
    el.loadingOverlay.classList.remove('active');
    
  } catch (error) {
    console.error('PDF生成失败:', error);
    const currentLanguage = document.documentElement.lang || 'zh-CN';
    alert('PDF生成失败，请重试');
    // 隐藏加载状态
    el.loadingOverlay.classList.remove('active');
  }
}

// 显示图片模态框
function showImageModal(imageUrl, stepNumber) {
  // 创建模态框元素
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'image-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(2px);
    cursor: grab;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'image-modal-content';
  modalContent.style.cssText = `
    max-width: 90vw;
    max-height: 90vh;
    position: relative;
    overflow: hidden;
    cursor: grab;
  `;
  
  const imgContainer = document.createElement('div');
  imgContainer.className = 'image-container';
  imgContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    transform-origin: center center;
    transition: transform 0.1s ease;
  `;
  
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = `Step ${stepNumber}`;
  img.style.cssText = `
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    user-select: none;
    -webkit-user-drag: none;
  `;
  
  // 缩放和移动状态
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startTranslateX = 0;
  let startTranslateY = 0;
  
  // 更新图片变换
  function updateTransform() {
    imgContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }
  
  // 限制缩放范围 (100% - 500%)
  function clampScale(value) {
    return Math.max(1, Math.min(5, value));
  }
  
  // 双指缩放手势
  let initialDistance = 0;
  let initialScale = 1;
  
  modalContent.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    if (e.ctrlKey) {
      // Ctrl+滚轮缩放
      const delta = -e.deltaY * 0.01;
      const newScale = clampScale(scale + delta);
      
      // 计算缩放中心点
      const rect = imgContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // 相对于中心的鼠标位置
      const mouseX = e.clientX - centerX;
      const mouseY = e.clientY - centerY;
      
      // 计算缩放后的偏移量
      const scaleFactor = newScale / scale;
      translateX = mouseX - (mouseX - translateX) * scaleFactor;
      translateY = mouseY - (mouseY - translateY) * scaleFactor;
      
      scale = newScale;
      updateTransform();
    } else {
      // 普通滚轮移动
      translateX -= e.deltaX;
      translateY -= e.deltaY;
      updateTransform();
    }
  }, { passive: false });
  
  // 触摸事件支持（触控板双指手势）
  modalContent.addEventListener('touchstart', (e) => {
    if (e.touches.length >= 1) {
      // 双指缩放手势
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      initialScale = scale;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      // 单指拖拽手势
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTranslateX = translateX;
      startTranslateY = translateY;
      modalOverlay.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  
  modalContent.addEventListener('touchmove', (e) => {
    if (e.touches.length >= 1) {
      // 双指缩放手势
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const newScale = clampScale(initialScale * (currentDistance / initialDistance));
      scale = newScale;
      updateTransform();
      e.preventDefault();
    } else if (isDragging && e.touches.length === 1) {
      // 单指拖拽手势
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      translateX = startTranslateX + (currentX - startX);
      translateY = startTranslateY + (currentY - startY);
      updateTransform();
      e.preventDefault();
    }
  });
  
  modalContent.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      isDragging = false;
      modalOverlay.style.cursor = 'grab';
    }
  });
  
  // 鼠标拖拽支持
  modalContent.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // 左键
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTranslateX = translateX;
      startTranslateY = translateY;
      modalOverlay.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      translateX = startTranslateX + (e.clientX - startX);
      translateY = startTranslateY + (e.clientY - startY);
      updateTransform();
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    modalOverlay.style.cursor = 'grab';
  });
  
  // 双击重置
  modalContent.addEventListener('dblclick', (e) => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
    e.preventDefault();
  });
  
  // 点击模态框外部关闭
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeImageModal();
    }
  });
  
  // ESC键关闭
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeImageModal();
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  
  // 组装元素
  imgContainer.appendChild(img);
  modalContent.appendChild(imgContainer);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  // 保存关闭函数引用
  modalOverlay._closeHandler = handleKeyDown;
  modalOverlay._imageData = { scale, translateX, translateY };
}

// 关闭图片模态框
function closeImageModal() {
  const modal = document.querySelector('.image-modal-overlay');
  if (modal) {
    document.removeEventListener('keydown', modal._closeHandler);
    document.body.removeChild(modal);
  }
}

// ArrayBuffer转Base64辅助函数
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// 自定义颜色选择器处理
function setupCustomColorPicker() {
  if (el.customColorPicker) {
    el.customColorPicker.addEventListener('input', function(e) {
      const selectedColor = e.target.value;
      
      // 直接调用 updateColor 函数，它会处理所有UI更新和状态保存
      updateColor(selectedColor);
    });
  }
}

// 更新自定义颜色按钮UI
async function updateCustomColorButtonUI(color) {
  const customColorBtn = document.querySelector('.color-preset.custom-color');
  if (customColorBtn) {
    // 检查当前选择的颜色是否是自定义颜色（不在预设列表中）
    const presetColors = ['#DC2626', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];
    const isCustomColor = !presetColors.includes(color);
    
    if (isCustomColor) {
      // 如果是自定义颜色，更新自定义按钮显示
      customColorBtn.dataset.color = color;
      customColorBtn.style.backgroundColor = color;
      
      // 隐藏加号图标
      const addIcon = customColorBtn.querySelector('.add-icon');
      if (addIcon) {
        addIcon.style.display = 'none';
      }
    } else {
      // 如果是预设颜色，重置自定义按钮为白色加号
      customColorBtn.dataset.color = '#FFFFFF';
      customColorBtn.style.backgroundColor = '#FFFFFF';
      
      // 显示加号图标
      const addIcon = customColorBtn.querySelector('.add-icon');
      if (addIcon) {
        addIcon.style.display = 'block';
      }
    }
  }
}

// 加载自定义颜色按钮状态
async function loadCustomColorButton() {
  const result = await chrome.storage.local.get(COLOR_STORAGE_KEY);
  const currentColor = result[COLOR_STORAGE_KEY] || '#DC2626';
  
  await updateCustomColorButtonUI(currentColor);
}






