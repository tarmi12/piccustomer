// api.js
// เรียก Supabase ตรง ๆ เป็นแหล่งข้อมูลหลัก (เร็ว ไม่มี cold-start)
// ส่วน GAS ใช้แค่ 2 อย่าง: อัปโหลดรูปบัตรประชาชนขึ้น Drive และบันทึกสำเนาลง Google Sheet (ทำงานเบื้องหลัง ไม่บล็อกหน้าเว็บ)

const Api = (() => {
  function base64ToBlob(base64, mimeType) {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  }

  async function callGas(action, data) {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, data)),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'GAS error');
    return json;
  }

  // ทำงานเบื้องหลัง ไม่ await ไม่บล็อก UI — ถ้า error แค่ log เงียบ ๆ ไม่กระทบ flow หลัก
  function syncToSheetInBackground(billNumber) {
    getCustomer(billNumber)
      .then(res => {
        if (!res.found) return;
        return callGas('logToSheet', {
          billNumber,
          customerName: res.customerName,
          station1Status: res.stations.station1.status,
          station1Thumbs: res.stations.station1.thumbs,
          station2Status: res.stations.station2.status,
          station2Thumbs: res.stations.station2.thumbs,
          station3Status: res.stations.station3.status,
          station3Thumbs: res.stations.station3.thumbs,
          idCardThumbs: res.stations.id_card ? res.stations.id_card.thumbs : [],
          finalStatus: res.finalStatus,
        });
      })
      .catch(err => console.warn('sync sheet ไม่สำเร็จ (ไม่กระทบข้อมูลหลัก):', err.message));
  }

  async function getCustomer(billNumber) {
    const { data, error } = await sb
      .from('customers')
      .select('*')
      .eq('bill_number', billNumber)
      .maybeSingle();
    if (error) throw new Error('ค้นหาไม่สำเร็จ: ' + error.message);
    if (!data) return { found: false };
    return {
      found: true,
      customerName: data.customer_name,
      finalStatus: data.final_status,
      stations: {
        station1: { status: data.station1_status, thumbs: data.station1_thumbs || [] },
        station2: { status: data.station2_status, thumbs: data.station2_thumbs || [] },
        station3: { status: data.station3_status, thumbs: data.station3_thumbs || [] },
        id_card: { thumbs: data.id_card_thumbs || [] },
      },
    };
  }

  async function saveStation({ billNumber, customerName, station, photos }) {
    const thumbUrls = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const ts = Date.now();
      const fullPath = `${billNumber}/${station}/original/${ts}_${i + 1}.jpg`;
      const thumbPath = `${billNumber}/${station}/thumbnail/${ts}_${i + 1}.jpg`;

      const fullBlob = base64ToBlob(photo.original, photo.mimeType);
      const thumbBlob = base64ToBlob(photo.thumbnail, photo.mimeType);

      const up1 = await sb.storage.from(STORAGE_BUCKET).upload(fullPath, fullBlob, { contentType: photo.mimeType });
      if (up1.error) throw new Error('อัปโหลดรูปเต็มไม่สำเร็จ: ' + up1.error.message);

      const up2 = await sb.storage.from(STORAGE_BUCKET).upload(thumbPath, thumbBlob, { contentType: photo.mimeType });
      if (up2.error) throw new Error('อัปโหลด thumbnail ไม่สำเร็จ: ' + up2.error.message);

      const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath);
      thumbUrls.push(pub.publicUrl);
    }

    const row = {
      bill_number: billNumber,
      [`${station}_status`]: 'เสร็จสิ้น',
      [`${station}_thumbs`]: thumbUrls,
      [`${station}_time`]: new Date().toISOString(),
    };
    if (customerName) row.customer_name = customerName;

    const { error } = await sb.from('customers').upsert(row, { onConflict: 'bill_number' });
    if (error) throw new Error('บันทึกข้อมูลไม่สำเร็จ: ' + error.message);

    syncToSheetInBackground(billNumber);
    return { thumbs: thumbUrls };
  }

  async function markPaid(billNumber) {
    const { error } = await sb
      .from('customers')
      .update({ final_status: 'รับเงินแล้ว', final_time: new Date().toISOString() })
      .eq('bill_number', billNumber);
    if (error) throw new Error('บันทึกไม่สำเร็จ: ' + error.message);

    syncToSheetInBackground(billNumber);
  }

  /**
   * ถ่ายบัตรประชาชน — อัปโหลดขึ้น Google Drive ผ่าน GAS (ไม่ใช่ Supabase Storage)
   * แล้วบันทึกลิงก์ thumbnail ไว้ใน Supabase เพื่อโชว์เทียบหน้าได้เหมือนสถานีอื่น
   */
  async function uploadIdCard({ billNumber, photos }) {
    const json = await callGas('uploadIdCard', {
      billNumber,
      photos: photos.map(p => ({ mimeType: p.mimeType, original: p.original, thumbnail: p.thumbnail })),
    });

    const { error } = await sb
      .from('customers')
      .upsert({
        bill_number: billNumber,
        id_card_thumbs: json.thumbs,
        id_card_time: new Date().toISOString(),
      }, { onConflict: 'bill_number' });
    if (error) throw new Error('บันทึกลิงก์รูปบัตรไม่สำเร็จ: ' + error.message);

    syncToSheetInBackground(billNumber);
    return { thumbs: json.thumbs };
  }

  return { getCustomer, saveStation, markPaid, uploadIdCard };
})();
