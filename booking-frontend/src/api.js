const API_BASE = import.meta.env.VITE_API_BASE;

function checkApiBase() {
    if (!API_BASE) throw new Error("ไม่พบ API Base URL");
}

// --- PUBLIC ---
export async function getSlots(date) {
    checkApiBase();
    const res = await fetch(`${API_BASE}?format=json&action=slots&date=${date}`);
    return await res.json();
}

export async function createBooking(payload) {
    checkApiBase();
    const res = await fetch(`${API_BASE}?format=json&action=createBooking`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // ใช้ text/plain เลี่ยง preflight
        body: JSON.stringify(payload),
    });
    return await res.json();
}

export async function getBookingByCode(code) {
    checkApiBase();
    const res = await fetch(`${API_BASE}?format=json&action=bookingByCode&code=${code}`);
    return await res.json();
}

// --- ADMIN (SECURE) ---

// 1. ฟังก์ชันล็อกอิน (ใหม่)
export async function adminLogin(password) {
    checkApiBase();
    const res = await fetch(`${API_BASE}?format=json&action=login`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ password }),
    });
    return await res.json(); // คาดหวัง { ok: true, token: "..." }
}

// 2. ดึงข้อมูล (ส่ง token แทน password)
export async function adminGetBookings(date, token) {
    checkApiBase();
    const res = await fetch(`${API_BASE}?format=json&action=adminBookings&date=${date}&token=${token}`);
    return await res.json();
}

export async function adminGetSlotsSummary(date, token) {
    checkApiBase();
    const res = await fetch(`${API_BASE}?format=json&action=adminSlotsSummary&date=${date}&token=${token}`);
    return await res.json();
}

export async function adminUpdateSlotCapacity(slotId, newCapacity, token) {
    checkApiBase();
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
            format: "json",
            action: "updateSlotCapacity",
            slot_id: String(slotId),
            capacity: Number(newCapacity),
            token, // ส่ง token
        }),
    });
    return await res.json();
}

export async function adminUpdateBookingStatus(code, status, token) {
    checkApiBase();
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
            format: "json",
            action: "updateStatus",
            code: String(code),
            status: String(status),
            token, // ส่ง token
        }),
    });
    return await res.json();
}