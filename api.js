// api.js
// ใช้ Content-Type: text/plain เพื่อให้ browser ส่งเป็น "simple request"
// (ไม่ trigger CORS preflight ซึ่ง Google Apps Script Web App จัดการ OPTIONS ไม่ได้)
async function callGas(action, data) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, data)),
  });
  if (!res.ok) throw new Error('เรียก server ไม่สำเร็จ (HTTP ' + res.status + ')');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาดที่ server');
  return json;
}
