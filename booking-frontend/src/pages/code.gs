// --- CONFIG ---
const SHEET_BOOKINGS = "bookings";
const SHEET_SLOTS = "slots";
// const ADMIN_PASSWORD = "123456";
const CHANNEL_ACCESS_TOKEN = "oGxcobFqF/6Bcad7/E4dKAb/yCBmZ381JgQ7xfPkN8oJ0ZefQyMYhLFpKhsMVB93KxzK6NOP7bbXXmszrsL73wW/LGoVFYyaKmIY4t5tU/50x48Yi7PkTHzrMoBpEQFClWWxAApJ7iTqhOUfclirfAdB04t89/1O/w1cDnyilFU=";

// ==========================================
// 1. SYSTEM HANDLERS (ห้ามแก้ไขส่วนนี้)
// ==========================================

function doPost(e) {
  // ตอบ OK ทันทีเพื่อกันตาย (LINE ต้องการ 200 OK)
  var output = ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);

  try {
    // 1. เช็คว่าเป็น Request ว่างหรือไม่ (ป้องกันกด Run เล่น)
    if (!e || !e.postData || !e.postData.contents) return output;

    // 2. แปลงข้อมูลเป็น JSON
    var jsonBody = JSON.parse(e.postData.contents);

    // 3. แยกทาง: ถ้ามี events คือ LINE, ถ้าไม่มีคือ API
    if (jsonBody.events) {
      return handleLineWebhook(jsonBody);
    } else {
      return handleApiPost_(e);
    }

  } catch (err) {
    // ถ้าพัง ให้ Log Error ไว้ แต่ยังคงส่ง OK กลับไป
    console.error("Critical Error: " + err.toString());
    return output;
  }
}

function doGet(e) {
  var params = e ? e.parameter : {};
  if (params.format === "json" || params.action) {
    return handleApiGet_(params);
  }
  return HtmlService.createHtmlOutput("Booking API Service is Running...");
}

// ฟังก์ชัน Verify & Handle LINE
function handleLineWebhook(json) {
  var output = ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
  try {
    var events = json.events;
    if (!events || events.length === 0) return output;
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (event.replyToken === '00000000000000000000000000000000' || event.replyToken === 'ffffffffffffffffffffffffffffffff') continue;

      // ✅ แก้ไข: เรียกใช้ handleMessage เพื่อให้มันไปเช็คเงื่อนไขต่างๆ (จอง, เช็คสถานะ, เมนู)
      if (event.type === "message" && event.message.type === "text") {
        handleMessage(event);
      }
    }
  } catch (error) {
    console.error("Webhook Logic Error: " + error.toString());
  }
  return output;
}

// ==========================================
// 2. LINE BUSINESS LOGIC
// ==========================================

function handleMessage(event) {
  const userId = event.source.userId;
  const userMsg = event.message.text.trim();
  const replyToken = event.replyToken;

  // 1. ฝั่ง User กดจอง
  if (userMsg === "จองคิว" || userMsg === "ลงทะเบียน") {
    // ⚠️ อย่าลืมแก้เป็น LIFF URL ของคุณตรงนี้
    const webUrl = "https://liff.line.me/2008672437-ULl4HDOy"; 
    replyText(replyToken, `กดที่ลิงก์นี้เพื่อลงทะเบียนจองคิวได้เลยครับ\n👉 ${webUrl}`);
  }
  
  // 2. เช็คสถานะ
  else if (userMsg === "การจองของฉัน" || userMsg === "เช็คสถานะ") {
    const booking = findBookingByLineId(userId);
    if (booking) {
      // ⚠️ อย่าลืมแก้เป็น LIFF URL ของคุณตรงนี้
      const ticketUrl = `https://liff.line.me/2008672437-ULl4HDOy/ticket?code=${booking.code}`;
      const msg = `📅 ข้อมูลการจองของคุณ\n` +
                  `รหัส: ${booking.code}\n` +
                  `ชื่อ: ${booking.name}\n` +
                  `วันที่: ${booking.date}\n` +
                  `เวลา: ${booking.slot}\n\n` +
                  `ดู QR Code: ${ticketUrl}`;
      replyText(replyToken, msg);
    } else {
      replyText(replyToken, "ไม่พบข้อมูลการจองของคุณ หรือคุณอาจยังไม่ได้ลงทะเบียนครับ");
    }
  }

  // 3. เมนู / ช่วยเหลือ (แยกออกมาเป็นอีกเงื่อนไข ไม่ซ้อนข้างในแล้ว)
  else if (userMsg === "ช่วยเหลือ" || userMsg === "เมนู") {
    const msg = "📝 คำสั่งที่สามารถใช้ได้:\n" +
                "• จองคิว – เพื่อลงทะเบียน\n" +
                "• เช็คสถานะ – ดูตั๋วของคุณ\n" +
                "• เมนู – ดูคำสั่งทั้งหมด";
    replyText(replyToken, msg);
  }

    else if (userMsg === "แอดมิน" || userMsg === "ผู้ดูแล") {
    const webUrl = "https://booking-massage.vercel.app/admin"; 
    replyText(replyToken, `กดที่ลิงก์นี้เข้าสู่ระบบผู้ดูแลได้เลยครับ\n👉 ${webUrl}`);
    
  }
  
  // 4. พิมพ์คำอื่น (Default)
  else {
    const msg = "ผมไม่เข้าใจคำสั่งครับ 😅\nลองพิมพ์ 'เมนู' เพื่อดูคำสั่งที่ใช้ได้นะครับ";
    replyText(replyToken, msg);
  }
}

function handleEvent(event) {
  if (event.type === "follow") {
    return handleFollow(event);
  } else if (event.type === "message" && event.message.type === "text") {
    return handleMessage(event);
  }
}

function handleFollow(event) {
  const replyToken = event.replyToken;

  const welcomeMsg =
    "สวัสดีครับ 👋\n" +
    "ยินดีต้อนรับสู่ระบบจองคิว\n\n" +
    "คุณสามารถใช้คำสั่งเหล่านี้ได้:\n" +
    "• พิมพ์: \"จองคิว\" เพื่อจองคิวใหม่\n" +
    "• พิมพ์: \"ตั๋วของฉัน\" เพื่อเช็คสถานะการจอง\n" +
    "• พิมพ์: \"ช่วยเหลือ\" หากต้องการดูคำสั่งทั้งหมด\n\n" +
    "ลองพิมพ์อย่างใดอย่างหนึ่งได้เลยครับ 😊";

  replyText(replyToken, welcomeMsg);
}


function replyText(replyToken, text) {
  if (!replyToken || !text || String(text).trim() === "") return;

  const url = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: [{ type: "text", text: String(text) }]
  };

  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        // [cite_start]// [cite: 24] แก้ไขตรงนี้: ย้ายตัวแปรออกมาไว้นอกเครื่องหมายคำพูด
        "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error("Reply Failed: " + e.toString());
  }
}

// ==========================================
// 3. 🚨 ฟังก์ชันปลดล็อกสิทธิ์ (Run Me First!)
// ==========================================
function debugPermissions() {
  console.log("Checking Permissions...");
  SpreadsheetApp.getActiveSpreadsheet(); // ขอสิทธิ์ Sheet
  UrlFetchApp.fetch("https://google.com"); // ขอสิทธิ์ยิง Net
  console.log("✅ Permissions OK! Ready to Deploy.");
}

// ==========================================
// 4. HELPERS & DATABASE
// ==========================================

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj || {})).setMimeType(ContentService.MimeType.JSON);
}

function getParams_(e) {
  var params = (e && e.parameter) || {};
  if (e && e.postData && e.postData.contents) {
    try {
      var jsonBody = JSON.parse(e.postData.contents);
      for (var key in jsonBody) params[key] = jsonBody[key];
    } catch (err) { }
  }
  return params;
}

function createSessionToken() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, "valid", 21600);
  return token;
}

function isTokenValid(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get(token) === "valid";
}

function findBookingByLineId(uid) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return null;
  const [header, ...rows] = sheet.getDataRange().getValues();
  const lIdx = header.indexOf("line_user_id");
  const sIdx = header.indexOf("status");
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (String(row[lIdx]) === String(uid) && row[sIdx] !== "CANCELLED") {
      return {
        code: row[header.indexOf("booking_code")],
        name: row[header.indexOf("name")],
        date: formatDate(row[header.indexOf("date")]),
        slot: row[header.indexOf("slot_label")]
      };
    }
  }
  return null;
}

function handleApiGet_(params) {
  try {
    var action = params.action;
    if (action === "slots") {
      var dateStr = params.date || formatDate(new Date());
      return jsonResponse_({ ok: true, date: dateStr, items: getSlotsWithRemaining(dateStr) });
    }
    if (action === "bookingByCode") return jsonResponse_(getBookingByCode(params.code));
    if (action === "adminBookings") {
      if (!isTokenValid(params.token)) return jsonResponse_({ ok: false, auth: false, message: "Session Expired" });
      return jsonResponse_(getBookingsByDate(params.date));
    }
    if (action === "adminSlotsSummary") {
      if (!isTokenValid(params.token)) return jsonResponse_({ ok: false, auth: false, message: "Session Expired" });
      return jsonResponse_(getSlotsSummary(params.date));
    }
    return jsonResponse_({ ok: false, message: "Unknown Action" });
  } catch (err) {
    return jsonResponse_({ ok: false, message: "Error: " + err.toString() });
  }
}

function handleApiPost_(e) {
  var params = getParams_(e);
  var action = params.action || "";
  // เพิ่มบรรทัดนี้เพื่อไปดึงรหัสล่าสุดจาก Sheet มาเช็ค
  const currentPassword = getConfig("ADMIN_PASSWORD");
  try {
    if (action === "login") {
      // เทียบกับ password ที่ดึงมาสดๆ
      return (params.password === currentPassword) ?
        jsonResponse_({ ok: true, token: createSessionToken() }) : jsonResponse_({ ok: false, message: "รหัสผ่านไม่ถูกต้อง" });
    }
    if (action === "createBooking") return jsonResponse_(createBooking(params));
    if (action === "cancelBooking") return jsonResponse_(cancelBookingByCode(params.code));
    if (action === "updateStatus") {
      if (!isTokenValid(params.token)) return jsonResponse_({ ok: false, auth: false });
      return jsonResponse_(updateBookingStatus(params.code, params.status));
    }
    if (action === "updateSlotCapacity") {
      if (!isTokenValid(params.token)) return jsonResponse_({ ok: false, auth: false });
      return jsonResponse_(updateSlotCapacity(params.slot_id, params.capacity));
    }
    return jsonResponse_({ ok: false, message: "Unknown Action" });
  } catch (err) {
    return jsonResponse_({ ok: false, message: "Error: " + err.toString() });
  }
}

function getSlots() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_SLOTS);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const [header, ...data] = rows;
  const idIdx = header.indexOf("slot_id");
  const lblIdx = header.indexOf("label");
  const capIdx = header.indexOf("capacity");
  return data.filter(r => r[idIdx]).map(r => ({
    id: String(r[idIdx]), label: r[lblIdx], capacity: Number(r[capIdx] || 0)
  }));
}

function getSlotsWithRemaining(dateStr) {
  const slots = getSlots();
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return slots.map(s => ({ ...s, booked: 0, remaining: s.capacity }));
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return slots.map(s => ({ ...s, booked: 0, remaining: s.capacity }));
  const [header, ...data] = rows;
  const dIdx = header.indexOf("date");
  const sIdx = header.indexOf("slot_id");
  const stIdx = header.indexOf("status");
  const counts = {};
  data.forEach(r => {
    if (formatDate(r[dIdx]) === dateStr && String(r[stIdx]) !== "CANCELLED") {
      const sid = String(r[sIdx]);
      counts[sid] = (counts[sid] || 0) + 1;
    }
  });
  return slots.map(s => {
    const booked = counts[s.id] || 0;
    return { ...s, booked, remaining: Math.max(0, s.capacity - booked) };
  });
}

function createBooking(form) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) return { ok: false, message: "System Busy" };
  try {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_BOOKINGS);
      sheet.appendRow(["timestamp", "date", "slot_id", "slot_label", "name", "phone", "line_user_id", "booking_code", "status"]);
    }
    const slots = getSlots();
    const slot = slots.find(s => String(s.id) === String(form.slot_id));
    if (!slot) return { ok: false, message: "Invalid Slot" };
    const rows = sheet.getDataRange().getValues();
    const [header, ...data] = rows;
    const dIdx = header.indexOf("date");
    const sIdx = header.indexOf("slot_id");
    const pIdx = header.indexOf("phone");
    const stIdx = header.indexOf("status");
    const targetPhone = String(form.phone).replace(/[^0-9]/g, "");
    const isDup = data.some(r => formatDate(r[dIdx]) === form.date && String(r[sIdx]) === String(form.slot_id) && String(r[pIdx]).replace(/[^0-9]/g, "") === targetPhone && String(r[stIdx]) !== "CANCELLED");
    if (isDup) return { ok: false, message: "ขออภัย ! คุณจองช่วงเวลานี้ไปแล้ว" };
    const currentCount = data.filter(r => formatDate(r[dIdx]) === form.date && String(r[sIdx]) === String(form.slot_id) && String(r[stIdx]) !== "CANCELLED").length;
    if (currentCount >= slot.capacity) return { ok: false, message: "Slot Full" };

    let phoneRaw = String(form.phone).replace(/[^0-9]/g, "");
    let randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = phoneRaw + "-" + randomSuffix;
    sheet.appendRow([new Date(), new Date(form.date), form.slot_id, slot.label, form.name, "'" + String(form.phone).trim(), form.line_user_id || "", code, "BOOKED"]);
    if (form.line_user_id) {
       const bookingData = {
         code: code,
         name: form.name,
         date: form.date, // หรือ formatDate(new Date(form.date)) ให้สวยงาม
         slot: slot.label
       };
       sendBookingConfirmation(form.line_user_id, bookingData);
    }
    return { ok: true, booking_code: code, date: form.date, slot_label: slot.label };
    
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function updateBookingStatus(code, newStatus) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return { ok: false, message: "No Sheet" };
  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  const cIdx = header.indexOf("booking_code");
  const stIdx = header.indexOf("status");
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][cIdx]).trim() === String(code).trim()) {
      sheet.getRange(i + 2, stIdx + 1).setValue(newStatus);
      return { ok: true, auth: true, message: "Success" };
    }
  }
  return { ok: false, auth: true, message: "Not Found" };
}

function updateSlotCapacity(slotId, newCap) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_SLOTS);
  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  const idIdx = header.indexOf("slot_id");
  const capIdx = header.indexOf("capacity");
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(slotId)) {
      sheet.getRange(i + 2, capIdx + 1).setValue(Number(newCap));
      return { ok: true, auth: true, message: "Success" };
    }
  }
  return { ok: false, auth: true, message: "Slot Not Found" };
}

function getBookingsByDate(dateStr) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return { ok: true, items: [] };
  const [header, ...rows] = sheet.getDataRange().getValues();
  const dIdx = header.indexOf("date");
  const items = rows.filter(r => formatDate(r[dIdx]) === dateStr).map(r => ({
    date: formatDate(r[dIdx]), slot: r[header.indexOf("slot_label")], name: r[header.indexOf("name")], phone: r[header.indexOf("phone")], status: r[header.indexOf("status")], code: r[header.indexOf("booking_code")]
  }));
  return { ok: true, auth: true, items: items };
}

function getSlotsSummary(dateStr) {
  return { ok: true, auth: true, items: getSlotsWithRemaining(dateStr) };
}

function getBookingByCode(keyword) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return { ok: false, message: "No Data" };
  const [header, ...rows] = sheet.getDataRange().getValues();
  const cIdx = header.indexOf("booking_code");
  const pIdx = header.indexOf("phone");
  const sIdx = header.indexOf("status");
  let found = null;
  const key = String(keyword).trim();
  const hasLetters = /[a-zA-Z]/.test(key);
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rCode = String(row[cIdx]).trim();
    const rPhone = String(row[pIdx]).replace(/[^0-9]/g, "");
    if (rCode === key) { found = row; break; }
    if (!hasLetters && key.length >= 9 && key.replace(/[^0-9]/g, "") === rPhone && row[sIdx] !== "CANCELLED") { found = row; break; }
  }
  if (!found) return { ok: false, message: "Not Found" };
  return { ok: true, booking: { code: found[cIdx], date: formatDate(found[header.indexOf("date")]), slot: found[header.indexOf("slot_label")], name: found[header.indexOf("name")], phone: found[header.indexOf("phone")], status: found[sIdx] } };
}

function cancelBookingByCode(code) { return updateBookingStatus(code, "CANCELLED"); }
// function formatDate(d) { if (!d) return ""; if (typeof d === "string") return d; const y = d.getFullYear(); const m = ("0" + (d.getMonth() + 1)).slice(-2); const dd = ("0" + d.getDate()).slice(-2); return `${y}-${m}-${dd}`; }

// ฟังก์ชันจัดรูปแบบวันที่ (ฉลาดขึ้น รองรับทั้ง 12/12/2025 และ Date Object)
function formatDate(d) {
  if (!d) return "";
  
  // กรณีเป็น String ที่มี / (เช่น 12/12/2025) ให้แปลงเป็น 2025-12-12
  if (typeof d === "string") {
    if (d.includes("/")) {
      const parts = d.split("/");
      if (parts.length === 3) {
        // สมมติว่าเป็น วัน/เดือน/ปี -> แปลงเป็น ปี-เดือน-วัน
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    // ถ้าไม่มี / ก็ส่งกลับไปตามเดิม (เช่น 2025-12-12)
    return d;
  }

  // กรณีเป็น Date Object
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const dd = ("0" + d.getDate()).slice(-2);
    return `${y}-${m}-${dd}`;
  }
  
  return String(d);
}

function getConfig(key) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("config"); // ชื่อ sheet ต้องตรงกับที่สร้าง
  if (!sheet) return "123456"; // กันเหนียว ถ้าหา sheet ไม่เจอ ใช้รหัสสำรอง
  
  const data = sheet.getDataRange().getValues();
  // วนหา key ในคอลัมน์ A แล้วคืนค่าจากคอลัมน์ B
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      return String(data[i][1]);
    }
  }
  return null;
}

// ==========================================
// 5. LINE MESSAGING & NOTIFICATIONS
// ==========================================

// ฟังก์ชันส่งข้อความหา User (รองรับทั้ง Text และ Flex Message)
function pushMessage(userId, msgContent) {
  if (!userId || userId === "NO_LIFF_ID") return;
  
  // ถ้าส่งมาเป็นข้อความ string ให้แปลงเป็น object text
  const message = typeof msgContent === 'string' ? { type: "text", text: msgContent } : msgContent;

  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: userId,
    messages: [message]
  };

  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error("Push Failed: " + e.toString());
  }
}

// ฟังก์ชันสร้างการ์ดสวยๆ (Flex Message)
function sendBookingConfirmation(userId, booking) {
  // ⚠️ เปลี่ยนตรงนี้เป็น LIFF ID ของคุณ
  const liffUrl = "https://liff.line.me/2008672437-ULl4HDOy"; 
  
  const flexMessage = {
    "type": "flex",
    "altText": "✅ ยืนยันการจองคิว: " + booking.code,
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "CONFIRMED", "weight": "bold", "color": "#ffffff", "size": "xs", "align": "center" },
          { "type": "text", "text": "ข้อมูลการจองคิว", "weight": "bold", "color": "#ffffff", "size": "lg", "align": "center", "margin": "md" }
        ],
        "backgroundColor": "#047857", // สีเขียว Emerald
        "paddingAll": "20px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "คุณ " + booking.name, "weight": "bold", "size": "xl", "align": "center", "color": "#1F2937" },
          { "type": "text", "text": "รหัสจอง: " + booking.code, "weight": "bold", "size": "md", "align": "center", "color": "#047857", "margin": "sm" },
          { "type": "separator", "margin": "lg" },
          {
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "วันที่", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": booking.date, "wrap": true, "color": "#666666", "size": "sm", "flex": 5, "weight": "bold" }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "เวลา", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": booking.slot, "wrap": true, "color": "#666666", "size": "sm", "flex": 5, "weight": "bold" }
                ]
              },
               {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "สถานที่", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": "อาคารสหเวช ชั้น 7\nห้อง TTM704", "wrap": true, "color": "#666666", "size": "sm", "flex": 5 }
                ]
              }
            ]
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "ดูรายละเอียด / ยกเลิกการจอง",
              "uri": liffUrl + "/ticket?code=" + booking.code
            },
            "style": "primary",
            "color": "#047857"
          }
        ]
      }
    }
  };

  pushMessage(userId, flexMessage);
}

// ฟังก์ชันส่งการ์ดแจ้งเตือน (Flex Message)
function sendReminderFlexMessage(userId, booking) {
  // ⚠️ อย่าลืมใส่ LIFF ID ของคุณที่นี่
  const liffUrl = "https://liff.line.me/2008672437-ULl4HDOy"; 
  
  const flexMessage = {
    "type": "flex",
    "altText": "🔔 แจ้งเตือนนัดหมายพรุ่งนี้: " + booking.name,
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "REMINDER", "weight": "bold", "color": "#ffffff", "size": "xs", "align": "center" },
          { "type": "text", "text": "แจ้งเตือนนัดหมาย", "weight": "bold", "color": "#ffffff", "size": "lg", "align": "center", "margin": "md" }
        ],
        "backgroundColor": "#F59E0B", // สีส้ม Amber (สื่อถึงการแจ้งเตือน)
        "paddingAll": "20px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "สวัสดีคุณ " + booking.name, "weight": "bold", "size": "md", "align": "center", "color": "#1F2937" },
          { "type": "text", "text": "พรุ่งนี้คุณมีนัดนวดรักษาอาการ", "size": "xs", "color": "#6B7280", "align": "center", "margin": "sm" },
          { "type": "separator", "margin": "lg" },
          {
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "วันที่", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": booking.date, "wrap": true, "color": "#666666", "size": "sm", "flex": 5, "weight": "bold" }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "เวลา", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": booking.slot, "wrap": true, "color": "#666666", "size": "sm", "flex": 5, "weight": "bold" }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "สถานที่", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": "อาคารสหเวช ชั้น 7\nห้อง TTM704", "wrap": true, "color": "#666666", "size": "sm", "flex": 5 }
                ]
              }
            ]
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "ดูรายละเอียด / QR Code",
              "uri": liffUrl + "/ticket?code=" + booking.code
            },
            "style": "primary",
            "color": "#F59E0B"
          }
        ]
      }
    }
  };

  pushMessage(userId, flexMessage);
}

// ฟังก์ชันแจ้งเตือนนัดหมายล่วงหน้า (Trigger)

function sendReminders() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  
  // หาวันพรุ่งนี้
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  
  console.log("Checking reminders for: " + tomorrowStr);

  rows.forEach(row => {
    // ดึงข้อมูลตามชื่อหัวตาราง (Header)
    const dStr = formatDate(row[header.indexOf("date")]);
    const status = String(row[header.indexOf("status")]);
    const uid = String(row[header.indexOf("line_user_id")]);
    
    // เงื่อนไข: เป็นวันพรุ่งนี้ + ไม่ได้ยกเลิก + มีไลน์ไอดี
    if (dStr === tomorrowStr && status !== "CANCELLED" && uid && uid !== "NO_LIFF_ID") {
       
       // เตรียมข้อมูลสำหรับใส่ในการ์ด
       const bookingData = {
         name: row[header.indexOf("name")],
         date: dStr,
         slot: row[header.indexOf("slot_label")],
         code: row[header.indexOf("booking_code")]
       };

       // ส่งการ์ดแจ้งเตือน
       sendReminderFlexMessage(uid, bookingData);
       console.log("Sent reminder to: " + bookingData.name);
    }
  });
}
// ==========================================
// 6. URGENT REMINDER (แจ้งเตือน 1 ชม. ก่อนถึงนัด)
// ==========================================

// ฟังก์ชันนี้จะรัน "ทุกชั่วโมง" เพื่อเช็คคิวในชั่วโมงถัดไป
function sendHourlyReminders() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;

  // คำนวณเวลา: เอาเวลาปัจจุบัน + 1 ชั่วโมง
  const now = new Date();
  const nextHour = new Date(now);
  // nextHour.setHours(now.getHours() + 1); ล่วงหน้าคแ่ 13 นาที

  nextHour.setHours(now.getHours() + 2);

  const todayStr = formatDate(now);
  const targetHour = nextHour.getHours(); // เลขชั่วโมงถัดไป (เช่น 9, 10, 14)

  console.log(`Checking hourly reminders for: ${todayStr} at hour ${targetHour}:00`);

  rows.forEach(row => {
    const dStr = formatDate(row[header.indexOf("date")]);
    const status = String(row[header.indexOf("status")]);
    const uid = String(row[header.indexOf("line_user_id")]);
    const slotLabel = String(row[header.indexOf("slot_label")]); // เช่น "09:00-10:00"

    // ดึงเลขชั่วโมงแรกออกจาก slot_label (เช่น "09:00" -> ได้เลข 9)
    const slotHour = parseInt(slotLabel.split(":")[0]); 
  console.log(`Row Check: ${row[header.indexOf("name")]} | Date: ${dStr} vs ${todayStr} | Hour: ${slotHour} vs ${targetHour}`);
    // เงื่อนไข: วันตรงกับวันนี้ + ชั่วโมงตรงกับชั่วโมงหน้า + ไม่ยกเลิก
    if (dStr === todayStr && slotHour === targetHour && status !== "CANCELLED" && uid && uid !== "NO_LIFF_ID") {
       
       const bookingData = {
         name: row[header.indexOf("name")],
         date: dStr,
         slot: slotLabel,
         code: row[header.indexOf("booking_code")]
       };

       // ส่งการ์ดสีแดงแจ้งเตือนด่วน
       sendUrgentFlexMessage(uid, bookingData);
       console.log("Sent urgent reminder to: " + bookingData.name);
    }
  });
}


// ฟังก์ชันสร้างการ์ดสีแดง (แจ้งเตือนด่วน + มีชื่อ/รหัส)
function sendUrgentFlexMessage(userId, booking) {
  // ⚠️ เช็ค LIFF ID ให้ถูกต้อง
  const liffUrl = "https://liff.line.me/2008672437-ULl4HDOy"; 
  
  const flexMessage = {
    "type": "flex",
    "altText": "⏳ อีก 1 ชั่วโมงถึงเวลานัด: " + booking.name,
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "URGENT", "weight": "bold", "color": "#ffffff", "size": "xs", "align": "center" },
          { "type": "text", "text": "ใกล้ถึงเวลานัดหมาย", "weight": "bold", "color": "#ffffff", "size": "lg", "align": "center", "margin": "md" }
        ],
        "backgroundColor": "#EF4444", // สีแดง
        "paddingAll": "20px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          // 🔥 ส่วนที่เพิ่ม: ชื่อลูกค้า (ตัวใหญ่)
          { "type": "text", "text": "คุณ " + booking.name, "weight": "bold", "size": "xl", "align": "center", "color": "#1F2937" },
          
          // 🔥 ส่วนที่เพิ่ม: รหัสการจอง (สีแดง)
          { "type": "text", "text": "รหัสจอง: " + booking.code, "size": "md", "color": "#EF4444", "weight": "bold", "align": "center", "margin": "sm" },
          
          { "type": "text", "text": "อีกประมาณ 1 ชม. จะถึงเวลานัด", "size": "xs", "color": "#6B7280", "align": "center", "margin": "xs" },
          { "type": "separator", "margin": "lg" },
          {
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "เวลา", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": booking.slot, "wrap": true, "color": "#EF4444", "size": "xl", "flex": 5, "weight": "bold" }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  { "type": "text", "text": "สถานที่", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                  { "type": "text", "text": "อาคารสหเวช ชั้น 7\nห้อง TTM704", "wrap": true, "color": "#666666", "size": "sm", "flex": 5 }
                ]
              }
            ]
          }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": { "type": "uri", "label": "ดูรายละเอียด / QR Code", "uri": liffUrl + "/ticket?code=" + booking.code },
            "style": "primary",
            "color": "#EF4444"
          }
        ]
      }
    }
  };

  pushMessage(userId, flexMessage);
}

// ==========================================
// 7. DATE MANAGEMENT API (จัดการวันเปิดจอง)
// ==========================================

// ฟังก์ชันดึงวันที่เปิดจอง (จาก Sheet 'days')
function getOpenDates() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("days");
  
  // ถ้ายังไม่มี Sheet ให้สร้างใหม่
  if (!sheet) {
    sheet = ss.insertSheet("days");
    sheet.appendRow(["date", "status"]);
  }
  
  const data = sheet.getDataRange().getValues();
  const [header, ...rows] = data;
  
  // ดึงเฉพาะคอลัมน์ date และแปลงเป็นข้อความ YYYY-MM-DD
  let dates = rows.map(r => formatDate(r[0])).filter(d => d !== "");
  
  // เรียงลำดับจากน้อยไปมาก
  dates.sort();
  
  return responseJSON({ dates: dates });
}

// ฟังก์ชันเพิ่มวันที่ (Add Date)
function addOpenDate(e) {
  const dateStr = e.parameter.date;
  if (!dateStr) return responseJSON({ ok: false, message: "Date is required" });
  
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("days");
  
  // เช็คว่ามีวันนี้อยู่แล้วไหม?
  const existingDates = sheet.getDataRange().getValues().map(r => formatDate(r[0]));
  if (existingDates.includes(dateStr)) {
    return responseJSON({ ok: false, message: "วันนี้มีอยู่ในระบบแล้ว" });
  }
  
  // เพิ่มแถวใหม่
  sheet.appendRow([dateStr, "OPEN"]);
  return responseJSON({ ok: true, message: "เพิ่มวันที่สำเร็จ" });
}

// ฟังก์ชันลบวันที่ (Delete Date)
function deleteOpenDate(e) {
  const dateStr = e.parameter.date;
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("days");
  const data = sheet.getDataRange().getValues();
  
  // หาแถวที่ตรงกับวันที่ แล้วลบทิ้ง
  for (let i = 0; i < data.length; i++) {
    if (formatDate(data[i][0]) === dateStr) {
      sheet.deleteRow(i + 1); // ลบแถวนั้น (Row index เริ่มที่ 1)
      return responseJSON({ ok: true, message: "ลบวันที่สำเร็จ" });
    }
  }
  
  return responseJSON({ ok: false, message: "ไม่พบวันที่ต้องการลบ" });
}