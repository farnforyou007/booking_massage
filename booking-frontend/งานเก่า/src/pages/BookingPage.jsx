import { useEffect, useState } from "react";
import { createBooking, getSlots } from "../api";

function AlertBox({ type, children }) {
    if (!children) return null;
    const base =
        "mt-3 rounded-xl border px-3.5 py-3 text-sm shadow-sm whitespace-pre-line";
    const styles =
        type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-800";
    return <div className={`${base} ${styles}`}>{children}</div>;
}

export default function BookingPage() {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [date, setDate] = useState(todayStr);
    const [slots, setSlots] = useState([]);
    const [selectedSlotId, setSelectedSlotId] = useState("");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");

    const [loadingSlots, setLoadingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [msg, setMsg] = useState("");
    const [msgType, setMsgType] = useState("");
    const [lastBookingCode, setLastBookingCode] = useState("");

    useEffect(() => {
        loadSlots(date);
    }, [date]);

    function showMsg(text, ok) {
        setMsg(text || "");
        setMsgType(ok ? "ok" : "err");
    }

    async function loadSlots(d) {
        if (!d) {
            setSlots([]);
            setSelectedSlotId("");
            showMsg("กรุณาเลือกวันที่เข้ารับบริการ", false);
            return;
        }

        setLoadingSlots(true);
        setSlots([]);
        setSelectedSlotId("");
        showMsg("", "");

        try {
            const res = await getSlots(d);
            const items = res.items || [];
            setSlots(items);

            if (!items.length) {
                showMsg("วันนี้ยังไม่มีการตั้งค่าช่วงเวลาให้ลงทะเบียน", false);
                return;
            }

            const firstAvailable = items.find((s) => {
                const remaining =
                    typeof s.remaining === "number"
                        ? s.remaining
                        : Number(s.capacity || 0) - Number(s.booked || 0);
                return remaining > 0;
            });

            setSelectedSlotId(firstAvailable ? firstAvailable.id : "");
            showMsg("เลือกช่วงเวลาที่ต้องการได้เลย", true);
        } catch (err) {
            console.error(err);
            showMsg("โหลดช่วงเวลาไม่สำเร็จ: " + err.message, false);
        } finally {
            setLoadingSlots(false);
        }
    }

    function validatePhone(ph) {
        const digits = String(ph || "").replace(/\D/g, "");
        return digits.length === 10;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLastBookingCode("");
        showMsg("", "");

        const phoneDigits = String(phone || "").replace(/\D/g, "");

        if (!date || !selectedSlotId || !name.trim() || !phoneDigits) {
            showMsg("กรุณากรอกข้อมูลให้ครบ และเลือกช่วงเวลา", false);
            return;
        }

        if (!validatePhone(phoneDigits)) {
            showMsg("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก เช่น 0812345678", false);
            return;
        }

        const slotLabel =
            slots.find((s) => s.id === selectedSlotId)?.label || "-";

        const confirm = window.confirm(
            `ยืนยันการลงทะเบียน?\n\nวันที่เข้ารับบริการ: ${date}\nช่วงเวลา: ${slotLabel}\nชื่อ-สกุล: ${name}\nเบอร์โทรศัพท์: ${phoneDigits}`
        );
        if (!confirm) return;

        setSubmitting(true);

        try {
            const res = await createBooking({
                date,
                slot_id: selectedSlotId,
                name: name.trim(),
                phone: phoneDigits,
            });

            const bookingCode =
                res.booking_code || res.code || res.bookingCode || res.bookingid;

            setLastBookingCode(bookingCode || "");

            showMsg(
                `ลงทะเบียนสำเร็จ\nวันที่เข้ารับบริการ: ${res.date || date}\nช่วงเวลา: ${res.slot_label || slotLabel
                }\nรหัสลงทะเบียน: ${bookingCode}`,
                true
            );
        } catch (err) {
            console.error(err);
            showMsg("เกิดข้อผิดพลาดในการลงทะเบียน: " + err.message, false);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-xl">
            {/* หัวข้อใช้คำเดิมจาก index.html */}
            <h2 className="mb-1 text-center text-xl font-bold text-white drop-shadow-sm">
                แบบฟอร์มลงทะเบียนเข้าร่วมกิจกรรมนวดรักษาอาการ
            </h2>
            <h5 className="text-center text-[11px] text-indigo-100">
                วันที่จัดกิจกรรม : ทุกวันเสาร์และวันอาทิตย์ เวลา 09.00 - 16.00 น.
            </h5>
            <h5 className="mb-4 text-center text-[11px] text-indigo-100">
                สถานที่จัดกิจกกรม : อาคารสหเวช ชั้น 7 ห้อง TTM704 คณะการแพทย์แผนไทย
            </h5>

            <div className="mt-2 rounded-2xl bg-white/95 p-4 shadow-lg sm:p-5">
                <form className="space-y-4" onSubmit={handleSubmit}>
                    {/* วันที่เข้ารับบริการ */}
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                            วันที่เข้ารับบริการ
                        </label>
                        <input
                            type="date"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    {/* ช่วงเวลา */}
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                            ช่วงเวลา
                        </label>
                        <select
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            value={selectedSlotId}
                            onChange={(e) => setSelectedSlotId(e.target.value)}
                            disabled={loadingSlots || !slots.length}
                        >
                            <option value="">-- เลือกช่วงเวลา --</option>
                            {slots.map((s) => {
                                const remaining =
                                    typeof s.remaining === "number"
                                        ? s.remaining
                                        : Number(s.capacity || 0) - Number(s.booked || 0);
                                const full = remaining <= 0;
                                return (
                                    <option key={s.id} value={s.id} disabled={full}>
                                        {s.label}{" "}
                                        {full
                                            ? "(เต็ม)"
                                            : `(เหลือ ${remaining} คิว จาก ${s.capacity})`}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* ชื่อ-สกุล */}
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                            ชื่อ-สกุล
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="กรอกชื่อ-สกุล"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* เบอร์โทรศัพท์ */}
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                            เบอร์โทรศัพท์
                        </label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="เช่น 0812345678"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <AlertBox type={msgType}>{msg}</AlertBox>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
                    </button>

                    {lastBookingCode && (
                        <p className="mt-2 text-[11px] text-gray-500">
                            รหัสการลงทะเบียนล่าสุดของคุณ:{" "}
                            <span className="font-semibold text-gray-800">
                                {lastBookingCode}
                            </span>
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}
