// --- CONFIG ---
const SHEET_BOOKINGS = "bookings";
const SHEET_SLOTS = "slots";
const ADMIN_PASSWORD = "123456"; // 🔐 แก้รหัสผ่านตรงนี้

// --- HELPER: JSON Response ---
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- HELPER: Parse Parameters (สำคัญมาก!) ---
function getParams_(e) {
  var params = (e && e.parameter) || {};
  if (e && e.postData && e.postData.contents) {
    try {
      var jsonBody = JSON.parse(e.postData.contents);
      for (var key in jsonBody) {
        params[key] = jsonBody[key];
      }
    } catch (err) {
      // parsing error, ignore
    }
  }
  return params;
}

// --- MAIN GET HANDLER ---
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || "";
  var page = params.page || "";

  // 1. API Mode (JSON)
  if (params.format === "json" || action) {
    return handleApiGet_(params);
  }

  // 2. HTML Page Mode
  if (page === "admin") return HtmlService.createTemplateFromFile("admin").evaluate().setTitle("Admin Panel");
  if (page === "scan") return HtmlService.createTemplateFromFile("scan").evaluate().setTitle("Scan QR");
  if (page === "ticket") return HtmlService.createTemplateFromFile("ticket").evaluate().setTitle("Ticket");

  return HtmlService.createTemplateFromFile("index").evaluate().setTitle("จองคิว");
}

// --- MAIN POST HANDLER ---
function doPost(e) {
  // บังคับตอบ JSON เสมอสำหรับ POST
  return handleApiPost_(e);
}

// --- API LOGIC (GET) ---
function handleApiGet_(params) {
  try {
    var action = params.action;

    if (action === "slots") {
      var dateStr = params.date || formatDate(new Date());
      var items = getSlotsWithRemaining(dateStr);
      return jsonResponse_({ ok: true, date: dateStr, items: items });
    }

    if (action === "bookingByCode") {
      return jsonResponse_(getBookingByCode(params.code));
    }

    if (action === "adminBookings") {
      return jsonResponse_(getBookingsByDate(params.date, params.password));
    }

    if (action === "adminSlotsSummary") {
      return jsonResponse_(getSlotsSummary(params.date, params.password));
    }

    return jsonResponse_({ ok: false, message: "Unknown GET action" });
  } catch (err) {
    return jsonResponse_({ ok: false, message: "Error: " + err.toString() });
  }
}

// --- API LOGIC (POST) ---
function handleApiPost_(e) {
  var params = getParams_(e);
  var action = params.action || "";

  try {
    // 1. สร้างการจอง
    if (action === "booking" || action === "createBooking") {
      var form = {
        date: params.date,
        slot_id: params.slot_id,
        name: params.name,
        phone: params.phone,
        line_user_id: params.line_user_id || ""
      };
      return jsonResponse_(createBooking(form));
    }

    // 2. ยกเลิก (User)
    if (action === "cancelBooking") {
      return jsonResponse_(cancelBookingByCode(params.code));
    }

    // 3. อัปเดตสถานะ (Admin)
    if (action === "updateStatus") {
      if (params.password !== ADMIN_PASSWORD) return jsonResponse_({ ok: false, message: "รหัสผ่านผิด" });
      return jsonResponse_(updateBookingStatus(params.code, params.status));
    }

    // 4. แก้ไขสล็อต (Admin)
    if (action === "updateSlotCapacity") {
      if (params.password !== ADMIN_PASSWORD) return jsonResponse_({ ok: false, message: "รหัสผ่านผิด" });
      return jsonResponse_(updateSlotCapacity(params.slot_id, params.capacity));
    }

    return jsonResponse_({ ok: false, message: "Unknown POST action: " + action });

  } catch (err) {
    return jsonResponse_({ ok: false, message: "Server Error: " + err.toString() });
  }
}


// --- BUSINESS LOGIC FUNCTIONS ---

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
  if (!lock.tryLock(10000)) return { ok: false, message: "ระบบไม่ว่าง" };

  try {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_BOOKINGS);
      sheet.appendRow(["timestamp", "date", "slot_id", "slot_label", "name", "phone", "line_user_id", "booking_code", "status"]);
    }

    const slots = getSlots();
    const slot = slots.find(s => String(s.id) === String(form.slot_id));
    if (!slot) return { ok: false, message: "Slot Error" };

    const rows = sheet.getDataRange().getValues();
    const [header, ...data] = rows;

    // Indices
    const dIdx = header.indexOf("date");
    const sIdx = header.indexOf("slot_id");
    const pIdx = header.indexOf("phone");
    const stIdx = header.indexOf("status");

    // Check Duplicate
    const isDup = data.some(r =>
      formatDate(r[dIdx]) === form.date &&
      String(r[sIdx]) === String(form.slot_id) &&
      String(r[pIdx]).trim() === String(form.phone).trim() &&
      String(r[stIdx]) !== "CANCELLED"
    );
    if (isDup) return { ok: false, message: "จองซ้ำไม่ได้" };

    // Check Capacity
    const currentCount = data.filter(r =>
      formatDate(r[dIdx]) === form.date &&
      String(r[sIdx]) === String(form.slot_id) &&
      String(r[stIdx]) !== "CANCELLED"
    ).length;

    if (currentCount >= slot.capacity) return { ok: false, message: "เต็มแล้ว" };

    // Create
    const code = String(form.phone).slice(-4) + Math.floor(1000 + Math.random() * 9000);
    sheet.appendRow([
      new Date(), new Date(form.date), form.slot_id, slot.label,
      form.name, "'" + form.phone, form.line_user_id, code, "BOOKED"
    ]);

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
      return { ok: true, message: "Success" };
    }
  }
  return { ok: false, message: "Not Found" };
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
      
      // ✅ แก้ตรงนี้: เพิ่ม auth: true
      return { ok: true, auth: true, message: "Success" }; 
    }
  }
  // ✅ แก้ตรงนี้ด้วย (กรณีไม่เจอ slot แต่เรายังเป็น admin อยู่)
  return { ok: false, auth: true, message: "Slot Not Found" }; 
}

function getBookingsByDate(dateStr, pass) {
  if (pass !== ADMIN_PASSWORD) return { ok: false, auth: false };

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) return { ok: true, items: [] };

  const [header, ...rows] = sheet.getDataRange().getValues();
  const dIdx = header.indexOf("date");

  const items = rows
    .filter(r => formatDate(r[dIdx]) === dateStr)
    .map(r => ({
      date: formatDate(r[dIdx]),
      slot: r[header.indexOf("slot_label")],
      name: r[header.indexOf("name")],
      phone: r[header.indexOf("phone")],
      status: r[header.indexOf("status")],
      code: r[header.indexOf("booking_code")]
    }));

  return { ok: true, auth: true, items: items };
}

function getSlotsSummary(dateStr, pass) {
  if (pass !== ADMIN_PASSWORD) return { ok: false, auth: false };
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

  // Search Logic: Find matching code OR phone (lastest active)
  let found = null;
  const key = String(keyword).trim();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rCode = String(row[cIdx]).trim();
    const rPhone = String(row[pIdx]).replace(/[^0-9]/g, "");

    if (rCode === key) { found = row; break; }
    if (key.length >= 9 && key.replace(/[^0-9]/g, "") === rPhone && row[sIdx] !== "CANCELLED") {
      found = row; break;
    }
  }

  if (!found) return { ok: false, message: "Not Found" };

  return {
    ok: true,
    booking: {
      code: found[cIdx],
      date: formatDate(found[header.indexOf("date")]),
      slot: found[header.indexOf("slot_label")],
      name: found[header.indexOf("name")],
      phone: found[header.indexOf("phone")],
      status: found[sIdx]
    }
  };
}

function cancelBookingByCode(code) {
  return updateBookingStatus(code, "CANCELLED");
}

function formatDate(d) {
  if (!d) return "";
  if (typeof d === "string") return d;
  const y = d.getFullYear();
  const m = ("0" + (d.getMonth() + 1)).slice(-2);
  const dd = ("0" + d.getDate()).slice(-2);
  return `${y}-${m}-${dd}`;
}