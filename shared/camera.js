const CameraModule = {
  stream: null,
  videoElement: null,

  async init(selectId, videoId) {
    this.videoElement = document.getElementById(videoId);
    const select = document.getElementById(selectId);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("เบราว์เซอร์ของคุณไม่รองรับการเปิดกล้อง หรือไม่ได้เชื่อมต่อผ่าน HTTPS");
      return;
    }

    try {
      // 1. ขอสิทธิ์เปิดกล้องรอบแรก เพื่อให้เบราว์เซอร์ยอมแสดงชื่อกล้องทั้งหมด
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(track => track.stop());

      // 2. ดึงรายชื่ออุปกรณ์กล้อง USB ทั้งหมดที่ต่ออยู่
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      select.innerHTML = '';

      if (videoDevices.length === 0) {
        const opt = document.createElement('option');
        opt.text = "ไม่พบอุปกรณ์กล้อง";
        select.appendChild(opt);
        return;
      }

      // 3. ใส่รายชื่อกล้องลงใน Dropdown
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `กล้องตัวที่ ${index + 1}`;
        select.appendChild(option);
      });

      // 4. สั่งเปิดกล้องตัวแรกทันที
      await this.startCamera(videoDevices[0].deviceId);

    } catch (err) {
      console.error("Camera access error:", err);
      alert("กรุณากด 'อนุญาต' (Allow) ให้เบราว์เซอร์เข้าถึงกล้องถ่ายภาพ");
    }
  },

  async startCamera(deviceId) {
    // ปิดสตรีมกล้องเดิมก่อน ถ้าเปิดค้างอยู่
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
      }
    } catch (err) {
      console.error("Failed to start camera device:", err);
      alert("ไม่สามารถเปิดกล้องที่เลือกได้");
    }
  }
};
