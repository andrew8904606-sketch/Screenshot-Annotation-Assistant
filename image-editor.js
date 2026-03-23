class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('editCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.imageCanvas = document.getElementById('imageCanvas');
        this.imageCtx = this.imageCanvas.getContext('2d', { willReadFrequently: true });
        
        this.currentTool = 'rectangle';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        this.history = [];
        this.historyStep = -1;
        this.currentImage = null;
          
        this.currentColor = '#FF3B30';
        this.currentSize = 3;
        this.currentFontSize = 16;
        
        this.tempCanvas = null;
        this.tempCtx = null;
        
        this.activeTextBox = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadImageFromUrl();
        this.updateToolButtons();
        
        // 等待图片加载完成后居中显示
        setTimeout(() => {
            if (this.currentImage) {
                this.centerImage();
            }
        }, 100);
    }
    
    setupEventListeners() {
        // 工具按钮事件
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentTool = e.currentTarget.dataset.tool;
                // 当切换到文本工具时，确保字体大小合适
                if (this.currentTool === 'text') {
                    this.currentFontSize = Math.max(this.currentSize, 12);
                    // 更新大小选择器的值以反映字体大小
                    const sizePicker = document.getElementById('sizePicker');
                    if (sizePicker) {
                        sizePicker.value = this.currentFontSize;
                    }
                }
                this.updateToolButtons();
                this.updateCursor();
            });
        });
        
        // 颜色和大小控制
        const colorPicker = document.getElementById('colorPicker');
        const sizePicker = document.getElementById('sizePicker');
        
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                this.currentColor = e.target.value;
            });
            this.currentColor = colorPicker.value;
        }
        
        if (sizePicker) {
            sizePicker.addEventListener('change', (e) => {
                this.currentSize = parseInt(e.target.value);
                // 当切换到文本工具时，使用合适的字体大小
                if (this.currentTool === 'text') {
                    this.currentFontSize = Math.max(parseInt(e.target.value), 12);
                }
                this.updateTextBoxFontSize();
            });
            this.currentSize = parseInt(sizePicker.value);
            this.currentFontSize = Math.max(parseInt(sizePicker.value), 12);
        }
        
          
        // 撤回和恢复
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        
        // 完成按钮
        document.getElementById('completeBtn').addEventListener('click', () => this.complete());
        
          
        // 画布事件
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                    e.preventDefault();
                    this.redo();
                }
            }
        });
        
        // 窗口调整
        window.addEventListener('resize', () => this.handleResize());
    }
    
    loadImageFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const imageUrl = urlParams.get('image');
        
        if (imageUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.currentImage = img;
                this.setupCanvases();
                this.saveState();
            };
            img.src = imageUrl;
        }
    }
    
    setupCanvases() {
        const img = this.currentImage;
        const maxWidth = window.innerWidth - 100;
        const maxHeight = window.innerHeight - 200;
        
        let scale = 1;
        if (img.width > maxWidth || img.height > maxHeight) {
            scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        }
        
        const canvasWidth = img.width * scale;
        const canvasHeight = img.height * scale;
        
        // 设置画布显示尺寸
        [this.canvas, this.imageCanvas].forEach(canvas => {
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';
        });
        
        // 设置画布实际尺寸为原始图片尺寸
        [this.canvas, this.imageCanvas].forEach(canvas => {
            canvas.width = img.width;
            canvas.height = img.height;
        });
        
        // 创建临时画布用于预览
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = img.width;
        this.tempCanvas.height = img.height;
        this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // 绘制原始图片
        this.imageCtx.drawImage(img, 0, 0, img.width, img.height);
        this.scale = scale;
        this.originalWidth = img.width;
        this.originalHeight = img.height;
        
        // 确保编辑层可以接收事件
        this.canvas.style.pointerEvents = 'auto';
        
        // 居中显示图片
        setTimeout(() => {
            this.centerImage();
        }, 50);
    }
    
    updateToolButtons() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
        
        this.updateHistoryButtons();
    }
    
    updateHistoryButtons() {
        document.getElementById('undoBtn').disabled = this.historyStep <= 0;
        document.getElementById('redoBtn').disabled = this.historyStep >= this.history.length - 1;
    }
    
    updateCursor() {
        const canvas = this.canvas;
        canvas.className = '';
        
        switch (this.currentTool) {
            case 'line':
                canvas.classList.add('line-mode');
                break;
            case 'rectangle':
                canvas.classList.add('rectangle-mode');
                break;
            case 'blur':
                canvas.classList.add('blur-mode');
                break;
            case 'arrow':
                canvas.classList.add('arrow-mode');
                break;
            case 'text':
                canvas.classList.add('text-mode');
                break;
            case 'pointer':
                canvas.style.cursor = 'default';
                canvas.style.pointerEvents = 'none';
                return;
            default:
                // 默认情况下禁用事件
                canvas.style.pointerEvents = 'none';
        }
        
        canvas.style.pointerEvents = 'auto';
    }
    
    updateTextBoxFontSize() {
        const textareas = document.querySelectorAll('textarea[style*="position: fixed"]');
        textareas.forEach(textarea => {
            textarea.style.fontSize = this.currentFontSize + 'px';
        });
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.originalWidth / rect.width;
        const scaleY = this.originalHeight / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    handleMouseDown(e) {
        // 如果有活动的文本框，先不处理鼠标按下事件
        if (this.activeTextBox) {
            return;
        }
        
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.currentX = pos.x;
        this.currentY = pos.y;
        
        this.isDrawing = true;
        this.startDrawing();
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        
        if (this.isDrawing) {
            this.draw();
        }
    }
    
    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            // 如果是文本工具，创建文本框（不需要调用finishDrawing）
            if (this.currentTool === 'text') {
                this.createTextBox(this.currentX, this.currentY);
            } else {
                this.finishDrawing();
            }
            
            this.saveState();
        }
    }
    
    startDrawing() {
        // 设置绘制样式
        this.ctx.lineWidth = this.currentSize || 3;
        this.ctx.strokeStyle = this.currentColor || '#FF3B30';
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if (this.currentTool === 'rectangle') {
            this.ctx.fillStyle = this.currentColor || '#FF3B30';
        }
    }
    
    draw() {
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        
        // 文本工具和橡皮擦工具不需要预览
        if (this.currentTool === 'text' || this.currentTool === 'eraser') {
            return;
        }
        
        // 清空编辑画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 确保绘制样式正确设置
        this.ctx.lineWidth = this.currentSize || 3;
        this.ctx.strokeStyle = this.currentColor || '#FF3B30';
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
        
        switch (this.currentTool) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(this.currentX, this.currentY);
                this.ctx.stroke();
                break;
                
            case 'arrow':
                this.drawArrow();
                break;
                
            case 'rectangle':
                this.ctx.strokeRect(this.startX, this.startY, dx, dy);
                break;
                
            case 'blur':
                this.drawBlur();
                break;
        }
    }
    
    drawBlur() {
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        
        // 获取原图数据
        const imageData = this.imageCtx.getImageData(
            Math.min(this.startX, this.currentX),
            Math.min(this.startY, this.currentY),
            Math.abs(dx),
            Math.abs(dy)
        );
        
        // 应用马赛克效果
        const pixelatedData = this.applyMosaic(imageData, 10);
        
        // 绘制马赛克效果到编辑画布
        this.ctx.putImageData(pixelatedData, 
            Math.min(this.startX, this.currentX),
            Math.min(this.startY, this.currentY)
        );
    }
    
    drawArrow() {
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        const angle = Math.atan2(dy, dx);
        
        // 箭头线长度
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        
        // 箭头头部大小
        const arrowHeadLength = Math.min(20, lineLength * 0.3);
        const arrowHeadAngle = Math.PI / 6; // 30度
        
        // 绘制箭头主线
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(this.currentX, this.currentY);
        this.ctx.stroke();
        
        // 绘制箭头头部
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentX, this.currentY);
        this.ctx.lineTo(
            this.currentX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
            this.currentY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
        );
        this.ctx.moveTo(this.currentX, this.currentY);
        this.ctx.lineTo(
            this.currentX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
            this.currentY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
        );
        this.ctx.stroke();
    }
    
    applyMosaic(imageData, blockSize) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                // 计算块的平均颜色
                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;
                
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const index = ((y + dy) * width + (x + dx)) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        count++;
                    }
                }
                
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);
                a = Math.floor(a / count);
                
                // 应用平均颜色到整个块
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const index = ((y + dy) * width + (x + dx)) * 4;
                        data[index] = r;
                        data[index + 1] = g;
                        data[index + 2] = b;
                        data[index + 3] = a;
                    }
                }
            }
        }
        
        return imageData;
    }
    
    finishDrawing() {
        // 合并编辑层到图像层
        this.imageCtx.drawImage(this.canvas, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
        
        
    saveState() {
        const imageData = this.imageCtx.getImageData(0, 0, this.imageCanvas.width, this.imageCanvas.height);
        
        // 删除当前步骤之后的历史记录
        this.history = this.history.slice(0, this.historyStep + 1);
        
        // 添加新的历史记录
        this.history.push(imageData);
        this.historyStep++;
        
        // 限制历史记录数量
        if (this.history.length > 50) {
            this.history.shift();
            this.historyStep--;
        }
        
        this.updateHistoryButtons();
    }
    
    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState(this.history[this.historyStep]);
        }
    }
    
    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState(this.history[this.historyStep]);
        }
    }
    
    restoreState(imageData) {
        this.imageCtx.putImageData(imageData, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateHistoryButtons();
    }
    
    complete() {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = this.imageCanvas.width;
        finalCanvas.height = this.imageCanvas.height;
        const finalCtx = finalCanvas.getContext('2d');
        
        finalCtx.drawImage(this.imageCanvas, 0, 0);
        finalCtx.drawImage(this.canvas, 0, 0);
        
        finalCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            
            // 发送编辑后的图片回popup
            if (window.opener) {
                window.opener.postMessage({
                    type: 'IMAGE_EDITED',
                    imageData: url,
                    originalStep: this.getOriginalStep()
                }, '*');
            }
            
            // 关闭编辑器
            setTimeout(() => {
                window.close();
            }, 100);
        }, 'image/png', 1.0); // 最高质量
    }
    
    getOriginalStep() {
        const urlParams = new URLSearchParams(window.location.search);
        return parseInt(urlParams.get('step')) || 0;
    }
    
    handleResize() {
        if (this.currentImage) {
            this.setupCanvases();
            this.centerImage();
        }
    }
    
    createTextBox(canvasX, canvasY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.originalWidth;
        const scaleY = rect.height / this.originalHeight;
        
        // 转换为屏幕坐标
        const screenX = rect.left + canvasX * scaleX;
        const screenY = rect.top + canvasY * scaleY;
        
        const fontSize = this.currentFontSize || 16;
        
        const textarea = document.createElement('textarea');
        textarea.style.position = 'fixed';
        textarea.style.left = screenX + 'px';
        textarea.style.top = screenY + 'px';
        textarea.style.width = '200px';
        textarea.style.height = '100px';
        textarea.style.border = '2px solid ' + this.currentColor;
        textarea.style.borderRadius = '4px';
        textarea.style.padding = '8px';
        textarea.style.fontSize = fontSize + 'px';
        textarea.style.fontFamily = 'Arial, sans-serif';
        textarea.style.backgroundColor = 'white';
        textarea.style.zIndex = '1000';
        textarea.style.resize = 'both';
        textarea.placeholder = '输入文字...';
        
        // 添加到文档中
        document.body.appendChild(textarea);
        
        // 设置活动文本框
        this.activeTextBox = textarea;
        
        // 聚焦到文本框
        textarea.focus();
        
        // 处理文本框完成事件
        const finishText = () => {
            const text = textarea.value.trim();
            if (text) {
                this.drawText(text, canvasX, canvasY);
            }
            document.body.removeChild(textarea);
            this.activeTextBox = null;
        };
        
        // 点击外部区域完成文本输入
        textarea.addEventListener('blur', finishText);
        
        // 按Enter键完成文本输入
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                finishText();
            }
        });
    }
    
    drawText(text, x, y) {
        const fontSize = this.currentFontSize || 14;
        this.ctx.font = `${fontSize}px Arial, sans-serif`;
        this.ctx.fillStyle = this.currentColor || '#FF3B30';
        this.ctx.textBaseline = 'top';
        
        // 处理多行文本
        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2; // 行高为字体的1.2倍
        
        lines.forEach((line, index) => {
            this.ctx.fillText(line, x, y + index * lineHeight);
        });
        
        // 合并到图像层
        this.imageCtx.drawImage(this.canvas, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    centerImage() {
        const imageArea = document.querySelector('.image-area');
        const container = document.querySelector('.canvas-container');
        
        // 重置图片区域的样式，确保滚动行为正确
        imageArea.style.display = 'block';
        imageArea.style.justifyContent = 'flex-start';
        imageArea.style.alignItems = 'flex-start';
        imageArea.style.padding = '0';
        
        // 重置容器的transform和位置
        container.style.transform = 'none';
        container.style.position = 'absolute';
        container.style.left = '0px';
        container.style.top = '0px';
        
        // 等待DOM更新后设置正确的滚动范围
        setTimeout(() => {
            const containerRect = container.getBoundingClientRect();
            const imageAreaRect = imageArea.getBoundingClientRect();
            
            // 获取图片的实际尺寸
            const imageWidth = containerRect.width;
            const imageHeight = containerRect.height;
            const viewportWidth = imageAreaRect.width;
            const viewportHeight = imageAreaRect.height;
            
            // 设置图片区域的滚动范围
            if (imageWidth > viewportWidth || imageHeight > viewportHeight) {
                // 图片比视窗大，设置正确的滚动范围
                imageArea.style.overflow = 'auto';
                
                // 初始滚动位置设为0（左上角对齐）
                imageArea.scrollLeft = 0;
                imageArea.scrollTop = 0;
            } else {
                // 图片比视窗小，居中显示
                const scrollLeft = (viewportWidth - imageWidth) / 2;
                const scrollTop = (viewportHeight - imageHeight) / 2;
                imageArea.scrollLeft = scrollLeft;
                imageArea.scrollTop = scrollTop;
            }
        }, 100);
    }
}

// 初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
});