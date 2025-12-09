/** helper: ตอบกลับเป็น JSON + เปิด CORS ให้ React ใช้ได้ */
/** helper: ตอบกลับเป็น JSON */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}


const SHEET_BOOKINGS = "bookings";
const SHEET_SLOTS = "slots";

// 🔐 รหัสผ่านเจ้าหน้าที่ (แก้เป็นของคุณเอง)
const ADMIN_PASSWORD = "123456";

/** จัดการ API แบบ GET */
function handleApiGet_(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || "";

  // 1) ดึงช่วงเวลา + จำนวนคิวคงเหลือ
  if (action === "slots") {
    var dateStr = params.date || formatDate(new Date());
    var items = getSlotsWithRemaining(dateStr);   // ใช้ฟังก์ชันเดิมของคุณเลย

    return jsonResponse_({
      ok: true,
      date: dateStr,
      items: items,
    });
  }

  // 2) ดึงข้อมูลบัตรคิวจาก booking_code (ไว้ใช้หน้าตั๋วทีหลัง)
  if (action === "bookingByCode") {
    var code = params.code || "";
    var result = getBookingByCode(code);          // ฟังก์ชันเดิมในไฟล์นี้
    return jsonResponse_(result);
  }

  return jsonResponse_({
    ok: false,
    message: "Unknown GET action: " + action,
  });
}

/** จัดการ API แบบ POST */
function handleApiPost_(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || "";

  // 1) สร้างการจองใหม่
  if (action === "booking") {
    var form = {
      date: params.date,
      slot_id: params.slot_id,
      name: params.name,
      phone: params.phone,
      line_user_id: params.line_user_id || "",
    };

    var result = createBooking(form);   // ใช้ฟังก์ชัน createBooking ของคุณ
    return jsonResponse_(result);
  }

  // 2) ยกเลิกการจองจาก code (ถ้าจะใช้)
  if (action === "cancelBooking") {
    var code = params.code || "";
    var result = cancelBookingByCode(code);
    return jsonResponse_(result);
  }

  return jsonResponse_({
    ok: false,
    message: "Unknown POST action: " + action,
  });
}


/** อ่าน config ช่วงเวลา จากชีต slots */
function getSlots() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_SLOTS);
  const rows = sheet.getDataRange().getValues(); // รวม header
  const [header, ...data] = rows;

  const slotIdIdx = header.indexOf("slot_id");
  const labelIdx = header.indexOf("label");
  const capIdx = header.indexOf("capacity");

  return data
    .filter(r => r[slotIdIdx]) // กันแถวว่าง
    .map(r => ({
      id: r[slotIdIdx],
      label: r[labelIdx],
      capacity: Number(r[capIdx] || 0),
    }));
}

/**
 * อ่านช่วงเวลา + คำนวณจำนวนคิวที่จองแล้วในวันนั้น
 * ใช้ฝั่งหน้าเว็บจอง (index.html)
 */
function getSlotsWithRemaining(dateStr) {
  const ss = SpreadsheetApp.getActive();

  // ---- 1) อ่าน config ช่วงเวลาจากชีต slots ----
  const slotSheet = ss.getSheetByName(SHEET_SLOTS);
  if (!slotSheet) {
    throw new Error("ไม่พบชีต slots");
  }

  const slotRows = slotSheet.getDataRange().getValues();
  const [slotHeader, ...slotData] = slotRows;

  const slotIdIdx = slotHeader.indexOf("slot_id");
  const labelIdx = slotHeader.indexOf("label");
  const capIdx = slotHeader.indexOf("capacity");

  if ([slotIdIdx, labelIdx, capIdx].some(i => i === -1)) {
    throw new Error(
      "โครงสร้างหัวตารางชีต 'slots' ควรมีคอลัมน์ slot_id, label, capacity"
    );
  }

  const slots = slotData
    .filter(r => r[slotIdIdx])
    .map(r => ({
      id: String(r[slotIdIdx]),
      label: String(r[labelIdx]),
      capacity: Number(r[capIdx] || 0),
    }));

  // ---- 2) อ่าน bookings เพื่อนับจำนวนที่จองแล้วในวันนั้น ----
  const bookingSheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!bookingSheet) {
    // ถ้าไม่มีชีต bookings แสดงว่ายังไม่เคยมีการจองเลย → เหลือ = capacity ทั้งหมด
    return slots.map(s => ({
      id: s.id,
      label: s.label,
      capacity: s.capacity,
      booked: 0,
      remaining: s.capacity,
    }));
  }

  const bookingRowsAll = bookingSheet.getDataRange().getValues();
  if (!bookingRowsAll || bookingRowsAll.length < 2) {
    return slots.map(s => ({
      id: s.id,
      label: s.label,
      capacity: s.capacity,
      booked: 0,
      remaining: s.capacity,
    }));
  }

  const [bHeader, ...bRows] = bookingRowsAll;
  const bDateIdx = bHeader.indexOf("date");
  const bSlotIdIdx = bHeader.indexOf("slot_id");
  const bStatusIdx = bHeader.indexOf("status");

  if ([bDateIdx, bSlotIdIdx, bStatusIdx].some(i => i === -1)) {
    throw new Error(
      "โครงสร้างหัวตารางชีต 'bookings' ควรมีคอลัมน์ date, slot_id, status"
    );
  }

  const targetDateStr = dateStr; // 'YYYY-MM-DD'

  /** เก็บจำนวนที่จองในแต่ละ slot ของวันนั้น */
  const countsBySlot = {};

  bRows.forEach(r => {
    const d = r[bDateIdx];
    const sid = r[bSlotIdIdx];
    if (!d || !sid) return;

    const status = String(r[bStatusIdx] || "");
    // ยกเลิกแล้วไม่นับ
    if (status === "CANCELLED") return;

    const rowDateStr = formatDate(d);
    if (rowDateStr !== targetDateStr) return;

    const key = String(sid);
    countsBySlot[key] = (countsBySlot[key] || 0) + 1;
  });

  // ---- 3) รวมข้อมูลออกไปให้หน้าเว็บใช้ ----
  return slots.map(s => {
    const booked = countsBySlot[s.id] || 0;
    const remaining = Math.max(0, s.capacity - booked);
    return {
      id: s.id,
      label: s.label,
      capacity: s.capacity,
      booked: booked,
      remaining: remaining,
    };
  });
}


/** helper แปลง Date → yyyy-mm-dd */
function formatDate(d) {
  if (Object.prototype.toString.call(d) === "[object Date]") {
    const year = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    return `${year}-${m}-${day}`;
  }
  if (typeof d === "string") return d;
  return "";
}

/** สร้างการจองใหม่
 * form = { date: '2026-02-01', slot_id: 'M1', name: 'xxx', phone: '...', line_user_id: '...' }
 */
function createBooking(form) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000); // รอ lock สูงสุด 20 วินาที

  try {
    const ss = SpreadsheetApp.getActive();
    const bookingSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (!bookingSheet) {
      return { ok: false, message: "ไม่พบชีต bookings" };
    }

    const slots = getSlots();
    const slot = slots.find(s => String(s.id) === String(form.slot_id));
    if (!slot) {
      return { ok: false, message: "ไม่พบช่วงเวลาที่เลือก" };
    }

    // ดึงข้อมูลทั้งหมดในชีต bookings
    let all = bookingSheet.getDataRange().getValues();
    let header;
    let rows;

    // ถ้ายังไม่มี header หรือว่าง → สร้าง header ใหม่
    if (!all || all.length === 0 || all[0].every(v => v === "")) {
      header = [
        "timestamp",
        "date",
        "slot_id",
        "slot_label",
        "name",
        "phone",
        "line_user_id",
        "booking_code",
        "status",
      ];
      bookingSheet.getRange(1, 1, 1, header.length).setValues([header]);
      rows = [];
    } else {
      header = all[0];
      rows = all.slice(1);
    }

    const dateIdx = header.indexOf("date");
    const slotIdIdx = header.indexOf("slot_id");
    const nameIdx = header.indexOf("name");
    const phoneIdx = header.indexOf("phone");
    const statusIdx = header.indexOf("status");

    if ([dateIdx, slotIdIdx, nameIdx, phoneIdx].some(i => i === -1)) {
      return {
        ok: false,
        message:
          "โครงสร้างหัวตารางในชีต 'bookings' ไม่ถูกต้อง\n" +
          "ควรเป็น: timestamp, date, slot_id, slot_label, name, phone, line_user_id, booking_code, status\n" +
          "ปัจจุบัน: " + JSON.stringify(header),
      };
    }

    const targetDateStr = form.date; // 'YYYY-MM-DD'

    // ✅ กันจองซ้ำ: ใช้ วัน + ช่วงเวลา + เบอร์โทร เป็น key
    const duplicated = rows.some(r => {
      if (!r[dateIdx] || !r[slotIdIdx]) return false;

      const rowDateStr = formatDate(r[dateIdx]);
      const sameDate = rowDateStr === targetDateStr;
      const sameSlot = String(r[slotIdIdx]) === String(form.slot_id);
      const samePhone = String(r[phoneIdx]).trim() === String(form.phone).trim();

      return sameDate && sameSlot && samePhone;
    });

    if (duplicated) {
      return {
        ok: false,
        message: "คุณได้จองช่วงเวลานี้ไว้แล้ว",
      };
    }

    // ✅ นับจำนวนที่จองแล้วในวัน + ช่วงเวลานี้ (กันเกิน capacity)
    const count = rows.filter(r => {
      if (!r[dateIdx] || !r[slotIdIdx]) return false;
      const rowDateStr = formatDate(r[dateIdx]);
      const status = statusIdx === -1 ? "BOOKED" : String(r[statusIdx] || "");

      // CANCELLED ไม่ต้องนับคิว
      if (status === "CANCELLED") return false;

      return (
        rowDateStr === targetDateStr &&
        String(r[slotIdIdx]) === String(form.slot_id)
      );
    }).length;

    if (count >= slot.capacity) {
      return {
        ok: false,
        message: "ช่วงเวลานี้เต็มแล้ว (ครบ " + slot.capacity + " คน)",
      };
    }

    // const bookingCode = Utilities.getUuid();
    // ---------------------------
    // สร้าง booking code (เบอร์เต็ม + 4 ตัวสุ่ม)
    // ---------------------------
    let phoneRaw = String(form.phone).replace(/[^0-9]/g, "");
    if (!phoneRaw) phoneRaw = "0000000000";

    // สุ่ม 4 ตัวอักษร/ตัวเลข
    function genRand4() {
      return Array.from({ length: 4 }, () =>
        Math.random().toString(36).charAt(2).toUpperCase()
      ).join("");
    }

    // initial code
    let bookingCode = phoneRaw + "-" + genRand4();

    // ---------------------------
    // ป้องกัน "รหัสซ้ำ" (rare case)
    // ---------------------------
    const duplicateCode = rows.some(r => {
      const codeIdx = header.indexOf("booking_code");
      return String(r[codeIdx]) === bookingCode;
    });

    // ถ้าซ้ำ → สุ่มใหม่อีกรอบ
    if (duplicateCode) {
      bookingCode = phoneRaw + "-" + genRand4();
    }

    // บันทึก date เป็น Date object และเบอร์โทรเป็น text
    bookingSheet.appendRow([
      new Date(),                  // timestamp
      new Date(form.date),         // date
      form.slot_id,                // slot_id
      slot.label,                  // slot_label
      form.name || "",
      "'" + String(form.phone).trim(), // phone เก็บเป็น text ไม่ตัด 0
      form.line_user_id || "",
      bookingCode,
      "BOOKED",
    ]);

    return {
      ok: true,
      messege: "จองสำเร็จ",
      booking_code: bookingCode,
      date: form.date,
      slot_label: slot.label,
      name: form.name || "",
      phone: form.phone || "",
    };
  } catch (err) {
    return { ok: false, message: "เกิดข้อผิดพลาด: " + err.message };
  } finally {
    lock.releaseLock();
  }
}


/** ดึงรายการจองตามวันที่ (ดูย้อนหลังได้) + ตรวจรหัสผ่านเจ้าหน้าที่ */
function getBookingsByDate(dateStr, password) {
  if (password !== ADMIN_PASSWORD) {
    return { ok: false, auth: false, message: "รหัสผ่านไม่ถูกต้อง" };
  }

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) {
    return { ok: false, auth: true, message: "ไม่พบชีต bookings" };
  }

  const all = sheet.getDataRange().getValues();
  if (!all || all.length === 0) {
    return { ok: true, auth: true, date: dateStr, items: [] };
  }

  const [header, ...rows] = all;

  const dateIdx = header.indexOf("date");
  const slotIdx = header.indexOf("slot_label");
  const nameIdx = header.indexOf("name");
  const phoneIdx = header.indexOf("phone");
  const statusIdx = header.indexOf("status");
  const codeIdx = header.indexOf("booking_code");

  if ([dateIdx, slotIdx, nameIdx, phoneIdx, statusIdx].some(i => i === -1)) {
    return {
      ok: false,
      auth: true,
      message:
        "โครงสร้างหัวตารางในชีต 'bookings' ไม่ถูกต้อง\nปัจจุบัน: " +
        JSON.stringify(header),
    };
  }

  // ถ้าไม่ส่งวันมา → ใช้วันนี้
  const targetDateStr = dateStr && dateStr.trim() !== ""
    ? dateStr
    : formatDate(new Date());

  const items = rows
    .filter(r => formatDate(r[dateIdx]) === targetDateStr)
    .map((r, idx) => ({
      no: idx + 1,
      date: formatDate(r[dateIdx]),
      slot: r[slotIdx],
      name: r[nameIdx],
      phone: r[phoneIdx],
      status: r[statusIdx],
      code: r[codeIdx],
    }));

  return {
    ok: true,
    auth: true,
    date: targetDateStr,
    items,
  };
}



/** helper include HTML fragment ถ้าจะใช้หลายไฟล์ */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ดึงข้อมูลการจองจาก booking_code (ใช้ตอนสแกน QR) */
function getBookingByCode(code) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) {
    return { ok: false, message: "ไม่พบชีต bookings" };
  }

  const all = sheet.getDataRange().getValues();
  if (!all || all.length < 2) {
    return { ok: false, message: "ไม่พบข้อมูลการจอง" };
  }

  const [header, ...rows] = all;

  const codeIdx = header.indexOf("booking_code");
  const dateIdx = header.indexOf("date");
  const slotIdx = header.indexOf("slot_label");
  const nameIdx = header.indexOf("name");
  const phoneIdx = header.indexOf("phone");
  const statusIdx = header.indexOf("status");

  if ([codeIdx, dateIdx, slotIdx, nameIdx, phoneIdx, statusIdx].some(i => i === -1)) {
    return { ok: false, message: "โครงสร้างชีต bookings ไม่ถูกต้อง" };
  }

  // ✅ normalize โค้ดทั้งสองฝั่งให้เท่ากัน
  const targetCode = String(code || "").trim();

  const found = rows.find(r => {
    const rowCode = String(r[codeIdx] || "").trim();
    return rowCode === targetCode;
  });

  if (!found) {
    return { ok: false, message: "ไม่พบรหัสการจองนี้ในระบบ" };
  }

  return {
    ok: true,
    booking: {
      code: String(found[codeIdx] || "").trim(),
      date: formatDate(found[dateIdx]),
      slot: found[slotIdx],
      name: found[nameIdx],
      phone: found[phoneIdx],
      status: found[statusIdx]
    }
  };
}


// function updateBookingStatusSecure(code,newStatus,password){
//   if(password !== ADMIN_PASSWORD) {
//     return {ok : false , auth: false , message:"รหัสผ่านไม่ถูกต้อง"}
//   }

//   const result = updateBookingStatus(code,newStatus);
//   return {...result , auth:true};
// }
/** เปลี่ยนสถานะ เช่น BOOKED → CHECKED_IN */
function updateBookingStatus(code, newStatus) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  const all = sheet.getDataRange().getValues();
  const [header, ...rows] = all;

  const codeIdx = header.indexOf("booking_code");
  const statusIdx = header.indexOf("status");

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][codeIdx]) === String(code)) {
      sheet.getRange(i + 2, statusIdx + 1).setValue(newStatus);
      return { ok: true, message: "อัปเดตสถานะสำเร็จ" };
    }
  }
  return { ok: false, message: "ไม่พบข้อมูลในการอัปเดต" };
}


/** ให้บริการหน้าเว็บฟอร์มจอง / หน้าเจ้าหน้าที่ */
/** ให้บริการหน้าเว็บฟอร์มจอง / หน้าเจ้าหน้าที่ / JSON API */
function doGet(e) {
  var params = (e && e.parameter) || {};

  // 🔹 ถ้า React เรียกแบบ API → ตอบ JSON แทน HTML
  if (params.format === "json") {
    return handleApiGet_(e);
  }

  // 🔹 ของเดิม: เสิร์ฟหน้า HTML (ยังเก็บไว้เผื่อใช้)
  var page = params.page;

  if (page === "admin") {
    return HtmlService.createTemplateFromFile("admin")
      .evaluate()
      .setTitle("ระบบเจ้าหน้าที่ - ดูคิวผู้ป่วย");
  }

  if (page === "scan") {
    return HtmlService.createTemplateFromFile("scan")
      .evaluate()
      .setTitle("สแกน QR - เช็คอินผู้ป่วย");
  }

  if (page === "ticket") {
    return HtmlService.createTemplateFromFile("ticket")
      .evaluate()
      .setTitle("บัตรการจอง");
  }

  // default = ฟอร์มจองเก่า (ยังอยู่ แต่เดี๋ยวเราย้ายไป React)
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("จองคิวเข้าร่วม");
}

function doPost(e) {
  var params = (e && e.parameter) || {};

  // ตอนนี้เรารองรับเฉพาะ API JSON
  if (params.format === "json") {
    return handleApiPost_(e);
  }

  // กันกรณีมีคนยิง POST มาผิดๆ
  return jsonResponse_({
    ok: false,
    message: "Unsupported POST (expect format=json)",
  });
}



/**
 * ยกเลิกนัดจาก booking_code (ใช้ฝั่งคนไข้)
 * เงื่อนไข:
 *  - ยกเลิกได้เฉพาะถ้าสถานะยังเป็น BOOKED
 */
function cancelBookingByCode(code) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) {
    return { ok: false, message: "ไม่พบชีต bookings" };
  }

  const all = sheet.getDataRange().getValues();
  if (!all || all.length < 2) {
    return { ok: false, message: "ไม่พบข้อมูลการจอง" };
  }

  const [header, ...rows] = all;
  const codeIdx = header.indexOf("booking_code");
  const statusIdx = header.indexOf("status");

  if (codeIdx === -1 || statusIdx === -1) {
    return { ok: false, message: "โครงสร้างชีตไม่ถูกต้อง" };
  }

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][codeIdx]) === String(code)) {
      const currentStatus = rows[i][statusIdx];

      if (currentStatus === "CHECKED_IN") {
        return {
          ok: false,
          message: "ไม่สามารถยกเลิกได้ เนื่องจากยืนยันแล้ว"
        };
      }
      if (currentStatus === "CANCELLED") {
        return {
          ok: true,
          message: "การจองนี้ถูกยกเลิกไปก่อนแล้ว",
          status: "CANCELLED"
        };
      }

      // ✅ เปลี่ยนสถานะเป็น CANCELLED
      sheet.getRange(i + 2, statusIdx + 1).setValue("CANCELLED");

      return {
        ok: true,
        message: "ยกเลิกการจองเรียบร้อยแล้ว",
        status: "CANCELLED"
      };
    }
  }

  return { ok: false, message: "ไม่พบรหัสจองนี้ในระบบ" };
}

/**
 * สำหรับหน้า admin: ดูสรุปช่วงเวลาในวันนั้น ๆ
 * (capacity, booked, remaining)
 */
function getSlotsSummary(dateStr, password) {
  if (password !== ADMIN_PASSWORD) {
    return { ok: false, auth: false, message: "รหัสผ่านไม่ถูกต้อง" };
  }

  const items = getSlotsWithRemaining(dateStr);

  return {
    ok: true,
    auth: true,
    date: dateStr,
    items: items,
  };
}

/**
 * สำหรับหน้า admin: ปรับจำนวน capacity ของ slot
 */
function updateSlotCapacity(slotId, newCapacity, password) {
  if (password !== ADMIN_PASSWORD) {
    return { ok: false, auth: false, message: "รหัสผ่านไม่ถูกต้อง" };
  }

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_SLOTS);
  if (!sheet) {
    return { ok: false, auth: true, message: "ไม่พบชีต slots" };
  }

  const rows = sheet.getDataRange().getValues();
  const [header, ...data] = rows;

  const slotIdIdx = header.indexOf("slot_id");
  const capIdx = header.indexOf("capacity");

  if (slotIdIdx === -1 || capIdx === -1) {
    return {
      ok: false,
      auth: true,
      message: "ชีต slots ต้องมีคอลัมน์ slot_id และ capacity",
    };
  }

  let found = false;
  data.forEach((r, i) => {
    if (String(r[slotIdIdx]) === String(slotId)) {
      sheet.getRange(i + 2, capIdx + 1).setValue(Number(newCapacity));
      found = true;
    }
  });

  if (!found) {
    return { ok: false, auth: true, message: "ไม่พบ slot_id นี้ในชีต slots" };
  }

  return { ok: true, auth: true, message: "อัปเดตจำนวนคิวสำเร็จ" };
}

function test_handleApiGet_slots() {
  var e = {
    parameter: {
      action: "slots",
      date: "2025-11-21", // เปลี่ยนเป็นวันที่ที่มี slot จริง
      format: "json",
    },
  };
  var out = handleApiGet_(e); // ออกมาเป็น TextOutput
  Logger.log(out.getContent());
}

/** * ค้นหาข้อมูลการจองจาก "รหัสจอง" หรือ "เบอร์โทรศัพท์"
 * (ถ้าเป็นเบอร์โทร จะเอาใบจองล่าสุดที่ยังไม่ยกเลิก)
 */
function getBookingByCode(keyword) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!sheet) {
    return { ok: false, message: "ไม่พบชีต bookings" };
  }

  const all = sheet.getDataRange().getValues();
  if (!all || all.length < 2) {
    return { ok: false, message: "ไม่พบข้อมูลการจอง" };
  }

  const [header, ...rows] = all;

  const codeIdx = header.indexOf("booking_code");
  const dateIdx = header.indexOf("date");
  const slotIdx = header.indexOf("slot_label");
  const nameIdx = header.indexOf("name");
  const phoneIdx = header.indexOf("phone");
  const statusIdx = header.indexOf("status");

  if ([codeIdx, dateIdx, slotIdx, nameIdx, phoneIdx, statusIdx].some(i => i === -1)) {
    return { ok: false, message: "โครงสร้างชีต bookings ไม่ถูกต้อง" };
  }

  // Normalize keyword: ตัดช่องว่าง
  const searchKey = String(keyword || "").trim();
  // ถ้า searchKey เป็นตัวเลขล้วน (เบอร์โทร) ให้เตรียมไว้เทียบแบบตัดขีดตัดช่องว่าง
  const searchKeyDigits = searchKey.replace(/[^0-9]/g, "");

  // เราจะวนลูปหา "แถวล่างสุด" ที่ตรงเงื่อนไข (เพราะการจองใหม่อยู่ล่างเสมอ)
  let foundRow = null;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rowCode = String(row[codeIdx] || "").trim();
    const rowPhone = String(row[phoneIdx] || "").replace(/[^0-9]/g, ""); // เอาเฉพาะตัวเลขจากเบอร์ในชีต
    const status = String(row[statusIdx] || "");

    // 1. เทียบรหัสจอง (Booking Code) - ต้องตรงเป๊ะ
    if (rowCode === searchKey) {
      foundRow = row;
      break; // เจอรหัสจอง จบเลย (Unique)
    }

    // 2. เทียบเบอร์โทร (Phone) - ต้องตรง และสถานะไม่ใช่ CANCELLED
    // (ถ้า searchKey ดูเหมือนเบอร์โทร และตรงกับ rowPhone)
    if (searchKeyDigits.length >= 9 && searchKeyDigits === rowPhone) {
      if (status !== "CANCELLED") {
        foundRow = row;
        break; // เจอใบจองล่าสุดของเบอร์นี้ จบเลย
      }
    }
  }

  if (!foundRow) {
    return { ok: false, message: "ไม่พบข้อมูลการจอง (ตรวจสอบรหัสหรือเบอร์โทรอีกครั้ง)" };
  }

  return {
    ok: true,
    booking: {
      code: String(foundRow[codeIdx] || "").trim(),
      date: formatDate(foundRow[dateIdx]),
      slot: foundRow[slotIdx],
      name: foundRow[nameIdx],
      phone: foundRow[phoneIdx],
      status: foundRow[statusIdx]
    }
  };
}


