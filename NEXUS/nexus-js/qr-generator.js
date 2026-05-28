// QR Generator Module - Browser Version
document.addEventListener('DOMContentLoaded', function() {
    const qrText = document.getElementById('qr-text');
    const qrColor = document.getElementById('qr-color');
    const qrBgColor = document.getElementById('qr-bg-color');
    const qrSize = document.getElementById('qr-size');
    const qrMargin = document.getElementById('qr-margin');
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-png');
    const qrContainer = document.getElementById('qr-container');
    
    let qrcodeObj = null;

    // Функция генерации QR кода
    function generateQR() {
        const text = qrText.value.trim();
        if (!text) {
            alert('Введите текст или ссылку!');
            return;
        }

        // Очищаем контейнер
        qrContainer.innerHTML = '';
        
        // Создаем новый QR код
        qrcodeObj = new QRCode(qrContainer, {
            text: text,
            width: parseInt(qrSize.value),
            height: parseInt(qrSize.value),
            colorDark: qrColor.value,
            colorLight: qrBgColor.value,
            correctLevel: QRCode.CorrectLevel.H
        });

        // Активируем кнопку скачивания
        setTimeout(() => {
            downloadBtn.disabled = false;
        }, 100);
    }

    // Обработчик кнопки генерации
    generateBtn.addEventListener('click', generateQR);

    // Обработчик кнопки скачивания
    downloadBtn.addEventListener('click', function() {
        const canvas = qrContainer.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = 'nexus-qr-' + Date.now() + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } else {
            alert('Сначала сгенерируйте QR код!');
        }
    });

    // Кнопка назад
    const backBtn = document.getElementById('back-to-home');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = '/';
        });
    }
});
