// camera.js
// จัดการเลือกกล้อง USB (รองรับหลายตัว), เปิด/ปิด stream, และถ่ายภาพ (เต็ม + ย่อ)

const CameraModule = (() => {
  let currentStream = null;

  async function listCameras() {
    // ต้องขอ permission ก่อนครั้งแรก ไม่งั้น label ของกล้องจะว่างเปล่า
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());
    } catch (err) {
      throw new Error('ไม่สามารถขอสิทธิ์กล้องได้: ' + err.message);
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  }

  async function start(deviceId, videoEl, storageKey) {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
    }
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    videoEl.srcObject = currentStream;
    await videoEl.play();
    if (storageKey) localStorage.setItem(storageKey, deviceId);
  }

  function stop() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  }

  // ถ่ายจาก video element ปัจจุบัน คืนค่า { mimeType, original (base64 ล้วน), thumbnail (base64 ล้วน) }
  function capture(videoEl, { thumbWidth = 400, quality = 0.85 } = {}) {
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = videoEl.videoWidth;
    fullCanvas.height = videoEl.videoHeight;
    fullCanvas.getContext('2d').drawImage(videoEl, 0, 0);
    const fullDataUrl = fullCanvas.toDataURL('image/jpeg', quality);

    const scale = thumbWidth / videoEl.videoWidth;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = Math.round(videoEl.videoHeight * scale);
    thumbCanvas.getContext('2d').drawImage(videoEl, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.5);

    return {
      mimeType: 'image/jpeg',
      original: fullDataUrl.split(',')[1],
      thumbnail: thumbDataUrl.split(',')[1],
      previewUrl: thumbDataUrl, // ใช้แสดงผลใน gallery ทันทีโดยไม่ต้องรอ upload
    };
  }

  return { listCameras, start, stop, capture };
})();
