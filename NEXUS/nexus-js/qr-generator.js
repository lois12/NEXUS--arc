// QR Generator Module for NEXUS CORE
// Handles QR code generation with customization options

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const contentInput = document.getElementById('qr-content');
    const colorInput = document.getElementById('qr-color');
    const bgColorInput = document.getElementById('qr-bg-color');
    const errorLevelSelect = document.getElementById('qr-error-level');
    const sizeSlider = document.getElementById('qr-size');
    const marginSlider = document.getElementById('qr-margin');
    const sizeValue = document.getElementById('size-value');
    const marginValue = document.getElementById('margin-value');
    const generateBtn = document.getElementById('generate-btn');
    const downloadPngBtn = document.getElementById('download-png');
    const downloadSvgBtn = document.getElementById('download-svg');
    const qrCanvas = document.getElementById('qr-canvas');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const statusIndicator = document.getElementById('qr-status');
    const historyList = document.getElementById('history-list');

    let qrcode = null;
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');

    // Initialize
    renderHistory();
    updateRangeDisplays();

    // Event Listeners
    sizeSlider.addEventListener('input', updateRangeDisplays);
    marginSlider.addEventListener('input', updateRangeDisplays);
    generateBtn.addEventListener('click', generateQR);
    downloadPngBtn.addEventListener('click', downloadPNG);
    downloadSvgBtn.addEventListener('click', downloadSVG);

    // Update range value displays
    function updateRangeDisplays() {
        sizeValue.textContent = sizeSlider.value;
        marginValue.textContent = marginSlider.value;
    }

    // Generate QR Code
    function generateQR() {
        const content = contentInput.value.trim();
        
        if (!content) {
            showStatus('ОШИБКА: Введите содержимое', 'error');
            shakeElement(generateBtn);
            return;
        }

        showStatus('ГЕНЕРАЦИЯ...', 'processing');
        
        // Clear previous
        qrCanvas.innerHTML = '';
        qrPlaceholder.style.display = 'none';

        // Get settings
        const size = parseInt(sizeSlider.value);
        const margin = parseInt(marginSlider.value);
        const color = colorInput.value;
        const bgColor = bgColorInput.value;
        const errorLevel = errorLevelSelect.value;

        // Small delay for visual effect
        setTimeout(() => {
            try {
                qrcode = new QRCode(qrCanvas, {
                    text: content,
                    width: size,
                    height: size,
                    colorDark: color,
                    colorLight: bgColor,
                    correctLevel: QRCode.CorrectLevel[errorLevel],
                    margin: margin
                });

                showStatus('УСПЕШНО СОЗДАНО', 'success');
                enableDownloadButtons();
                addToHistory(content, color, bgColor);
                
                // Glitch effect on success
                triggerGlitch(generateBtn);
            } catch (error) {
                showStatus('ОШИБКА ГЕНЕРАЦИИ', 'error');
                console.error('QR Generation Error:', error);
            }
        }, 600);
    }

    // Download as PNG
    function downloadPNG() {
        if (!qrcode) return;
        
        const canvas = qrCanvas.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `nexus-qr-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showStatus('PNG СКАЧАН', 'success');
        }
    }

    // Download as SVG (simulate with PNG if library doesn't support SVG directly)
    function downloadSVG() {
        if (!qrcode) return;
        
        const canvas = qrCanvas.querySelector('canvas');
        if (canvas) {
            // For now, download as PNG since qrcodejs doesn't natively support SVG export easily
            // In a full implementation, we'd use a different library or generate SVG manually
            const link = document.createElement('a');
            link.download = `nexus-qr-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showStatus('ФАЙЛ СКАЧАН (PNG)', 'info');
        }
    }

    // Enable download buttons
    function enableDownloadButtons() {
        downloadPngBtn.disabled = false;
        downloadSvgBtn.disabled = false;
        downloadPngBtn.classList.add('active');
        downloadSvgBtn.classList.add('active');
    }

    // Show status message
    function showStatus(message, type) {
        statusIndicator.textContent = message;
        statusIndicator.className = 'status-indicator';
        statusIndicator.classList.add(`status-${type}`);
        
        // Reset after 3 seconds
        if (type !== 'processing') {
            setTimeout(() => {
                statusIndicator.textContent = 'ГОТОВ К РАБОТЕ';
                statusIndicator.className = 'status-indicator';
            }, 3000);
        }
    }

    // Add to history
    function addToHistory(content, color, bgColor) {
        const item = {
            id: Date.now(),
            content: content.length > 30 ? content.substring(0, 30) + '...' : content,
            fullContent: content,
            color: color,
            bgColor: bgColor,
            timestamp: new Date().toLocaleString('ru-RU')
        };

        history.unshift(item);
        if (history.length > 5) history.pop(); // Keep last 5
        
        localStorage.setItem('qrHistory', JSON.stringify(history));
        renderHistory();
    }

    // Render history
    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">История пуста</div>';
            return;
        }

        historyList.innerHTML = history.map(item => `
            <div class="history-item glass-panel" style="border-left: 3px solid ${item.color}">
                <div class="history-content">
                    <div class="history-text">${escapeHtml(item.content)}</div>
                    <div class="history-meta">
                        <span class="history-time">${item.timestamp}</span>
                        <span class="history-color" style="background: ${item.color}"></span>
                    </div>
                </div>
                <button class="history-regen-btn" onclick="regenerateFromHistory('${escapeHtml(item.fullContent)}')">↻</button>
            </div>
        `).join('');
    }

    // Regenerate from history (global function for onclick)
    window.regenerateFromHistory = function(content) {
        contentInput.value = content;
        generateQR();
        // Scroll to top
        document.querySelector('.qr-controls-panel').scrollIntoView({ behavior: 'smooth' });
    };

    // Utility: Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility: Shake animation
    function shakeElement(element) {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 500);
    }

    // Utility: Glitch effect
    function triggerGlitch(element) {
        element.classList.add('glitch-active');
        setTimeout(() => element.classList.remove('glitch-active'), 400);
    }
});
