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
