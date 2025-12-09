const API_BASE = import.meta.env.VITE_API_BASE;

// ช่วยเช็กว่า .env ตั้งไว้หรือยัง
function checkApiBase() {
    if (!API_BASE) {
        throw new Error("ไม่พบ VITE_API_BASE ใน .env (URL /exec ของ Apps Script)");
    }
}

// โหลดช่วงเวลา (หน้า index เดิม)
export async function getSlots(date) {
    checkApiBase();
    const params = new URLSearchParams({
        format: "json",
        action: "slots",
        date,
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error("โหลดช่วงเวลาไม่สำเร็จ (HTTP " + res.status + ")");
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "โหลดช่วงเวลาไม่สำเร็จ");
    return data; // { ok, date, items: [...] }
}

// สร้างการจอง (index เดิม)
export async function createBooking(payload) {
    checkApiBase();
    const params = new URLSearchParams({
        format: "json",
        action: "booking",
    });

    const body = new URLSearchParams(payload); // date, slot_id, name, phone,...

    const res = await fetch(`${API_BASE}?${params.toString()}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
    });

    if (!res.ok) throw new Error("จองไม่สำเร็จ (HTTP " + res.status + ")");
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "จองไม่สำเร็จ");
    return data;
}

// โหลดข้อมูลบัตรจาก booking_code (ticket.html เดิม)
export async function getBookingByCode(code) {
    checkApiBase();
    const params = new URLSearchParams({
        format: "json",
        action: "bookingByCode",
        code,
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error("โหลดข้อมูลบัตรไม่สำเร็จ (HTTP " + res.status + ")");
    const data = await res.json();
    // ticket.html เดิม return { ok: true/false, message, booking: {...} }
    return data;
}

// ----------------- ADMIN APIs -----------------

// ดึงรายการจองตามวันที่ (สำหรับเจ้าหน้าที่)
// คาดหวังให้ Apps Script doGet คืน:
// { ok: true, auth: true/false, date, items: [ { no, date, slot, name, phone, status, code } ] }
export async function adminGetBookings(date, password) {
    checkApiBase();
    const params = new URLSearchParams({
        format: "json",
        action: "adminBookings",
        date,
        password,
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error("โหลดรายการจองไม่สำเร็จ (HTTP " + res.status + ")");
    return await res.json();
}

// ดึงสรุปช่วงเวลา + จำนวนคิวในแต่ละสลอต
// คาดหวังผลแบบ: { ok, auth, date, items: [ { id, label, capacity, booked, remaining } ] }
export async function adminGetSlotsSummary(date, password) {
    checkApiBase();
    const params = new URLSearchParams({
        format: "json",
        action: "adminSlotsSummary",
        date,
        password,
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error("โหลดข้อมูลช่วงเวลาไม่สำเร็จ (HTTP " + res.status + ")");
    return await res.json();
}

// อัปเดตจำนวนคิวสูงสุดของสลอต
// body รอผล { ok, auth, message }
// ... (โค้ดเดิมที่มีอยู่แล้ว) ...

// อัปเดตจำนวนคิวสูงสุดของสลอต
export async function adminUpdateSlotCapacity(slotId, newCapacity, password) {
    checkApiBase();

    const body = {
        format: "json",
        action: "updateSlotCapacity",
        slot_id: String(slotId),
        capacity: Number(newCapacity),
        password,
    };

    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // ใช้ text/plain เพื่อเลี่ยง CORS Preflight
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("อัปเดตจำนวนคิวไม่สำเร็จ");
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "อัปเดตไม่สำเร็จ");
    return data;
}

// 🔥 เพิ่มฟังก์ชันนี้ต่อท้ายไฟล์ครับ
export async function adminUpdateBookingStatus(code, status, password) {
    checkApiBase();

    const body = {
        format: "json",
        action: "updateStatus",
        code: String(code),
        status: String(status),
        password,
    };

    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("เปลี่ยนสถานะไม่สำเร็จ");
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "เปลี่ยนสถานะไม่สำเร็จ");
    return data;
}

// เพิ่มต่อจากฟังก์ชันอื่นๆ
