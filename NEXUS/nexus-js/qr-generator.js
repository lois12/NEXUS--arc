document.addEventListener('DOMContentLoaded', function() {
    const qrText = document.getElementById('qr-text');
    const qrColor = document.getElementById('qr-color');
    const qrBgColor = document.getElementById('qr-bg-color');
    const qrSize = document.getElementById('qr-size');
    const qrMargin = document.getElementById('qr-margin');
    const generateBtn = document.getElementById('generate-btn');
    const qrResult = document.getElementById('qr-result');
    const qrCanvas = document.getElementById('qr-canvas');
    const downloadPng = document.getElementById('download-png');
    const downloadSvg = document.getElementById('download-svg');
    const statusMessage = document.getElementById('status-message');
    const historyList = document.getElementById('history-list');

    let qrHistory = JSON.parse(localStorage.getItem('qrHistory') || '[]');

    function showStatus(msg, type = 'info') {
        statusMessage.textContent = msg;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        setTimeout(() => statusMessage.style.display = 'none', 3000);
    }

    function saveToHistory(text, color) {
        qrHistory.unshift({ text, color, date: new Date().toISOString() });
        if (qrHistory.length > 5) qrHistory.pop();
        localStorage.setItem('qrHistory', JSON.stringify(qrHistory));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        qrHistory.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<span>${item.text.substring(0, 30)}...</span><small>${new Date(item.date).toLocaleTimeString()}</small>`;
            div.onclick = () => {
                qrText.value = item.text;
                qrColor.value = item.color;
            };
            historyList.appendChild(div);
        });
    }

    function generateQR() {
        const text = qrText.value.trim();
        if (!text) {
            showStatus('Введите текст или ссылку!', 'error');
            return;
        }

        generateBtn.classList.add('processing');
        showStatus('Генерация...', 'info');

        setTimeout(() => {
            try {
                QRCode.toCanvas(qrCanvas, text, {
                    width: parseInt(qrSize.value),
                    margin: parseInt(qrMargin.value),
                    color: {
                        dark: qrColor.value,
                        light: qrBgColor.value
                    }
                }, function (error) {
                    if (error) {
                        showStatus('Ошибка генерации!', 'error');
                        console.error(error);
                    } else {
                        qrResult.classList.remove('hidden');
                        showStatus('QR код создан!', 'success');
                        saveToHistory(text, qrColor.value);
                        generateBtn.classList.remove('processing');
                        
                        // Анимация появления
                        qrCanvas.style.opacity = 0;
                        qrCanvas.style.transform = 'scale(0.8)';
                        setTimeout(() => {
                            qrCanvas.style.transition = 'all 0.5s ease';
                            qrCanvas.style.opacity = 1;
                            qrCanvas.style.transform = 'scale(1)';
                        }, 50);
                    }
                });
            } catch (e) {
                showStatus('Ошибка!', 'error');
                generateBtn.classList.remove('processing');
            }
        }, 500);
    }

    function downloadPNG() {
        const link = document.createElement('a');
        link.download = `nexus-qr-${Date.now()}.png`;
        link.href = qrCanvas.toDataURL('image/png');
        link.click();
        showStatus('PNG скачан!', 'success');
    }

    function downloadSVG() {
        QRCode.toString(qrText.value.trim(), {
            type: 'svg',
            width: parseInt(qrSize.value),
            margin: parseInt(qrMargin.value),
            color: {
                dark: qrColor.value,
                light: qrBgColor.value
            }
        }, function (error, svg) {
            if (error) {
                showStatus('Ошибка SVG!', 'error');
            } else {
                const blob = new Blob([svg], {type: 'image/svg+xml'});
                const link = document.createElement('a');
                link.download = `nexus-qr-${Date.now()}.svg`;
                link.href = URL.createObjectURL(blob);
                link.click();
                showStatus('SVG скачан!', 'success');
            }
        });
    }

    generateBtn.addEventListener('click', generateQR);
    downloadPng.addEventListener('click', downloadPNG);
    downloadSvg.addEventListener('click', downloadSVG);
    
    renderHistory();
});
