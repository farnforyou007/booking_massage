import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getBookingByCode } from "../api";

function renderStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "BOOKED") {
        return { text: "ลงทะเบียนสำเร็จ", cls: "text-emerald-600 bg-emerald-50" };
    } else if (s === "CHECKED_IN") {
        return { text: "ยืนยันการเข้าร่วมแล้ว", cls: "text-blue-600 bg-blue-50" };
    } else if (s === "CANCELLED") {
        return { text: "ยกเลิกการลงทะเบียน", cls: "text-rose-600 bg-rose-50" };
    }
    return { text: s || "-", cls: "text-gray-600 bg-gray-50" };
}

export default function TicketPage() {
    const { code } = useParams();
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        if (!code) {
            setErrorMsg("ไม่พบรหัสลงทะเบียน");
            setLoading(false);
            return;
        }
        loadBooking();
        async function loadBooking() {
            setLoading(true);
            try {
                const res = await getBookingByCode(code);
                if (!res || !res.ok || !res.booking) {
                    setErrorMsg(res?.message || "ไม่พบข้อมูลการลงทะเบียน");
                } else {
                    setBooking(res.booking);
                }
            } catch (err) {
                setErrorMsg("เกิดข้อผิดพลาด: " + err.message);
            } finally {
                setLoading(false);
            }
        }
    }, [code]);

    return (
        <div className="mx-auto max-w-md">
            <h2 className="mb-1 text-center text-lg font-bold text-gray-800">
                บัตรการลงทะเบียน
            </h2>
            <div className="mb-4 text-center text-[11px] text-gray-600">
                กรุณาแสดงบัตรนี้ต่อเจ้าหน้าที่เมื่อติดต่อหน่วยบริการ
            </div>

            <div className="rounded-2xl bg-white p-4 shadow">
                {loading && <div className="text-sm text-gray-500">กำลังโหลดข้อมูล...</div>}
                {!loading && errorMsg && (
                    <div className="text-sm text-rose-600">
                        {errorMsg}
                        <div className="mt-1 text-[11px] text-gray-400">
                            รหัสที่ใช้ค้นหา: {code}
                        </div>
                    </div>
                )}
                {!loading && booking && (
                    <div className="space-y-2 text-sm text-gray-800">
                        <div className="flex justify-between">
                            <span className="font-semibold">รหัสลงทะเบียน:</span>
                            <span>{booking.code || booking.booking_code}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">ชื่อ-สกุล:</span>
                            <span>{booking.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">เบอร์โทรศัพท์:</span>
                            <span>{booking.phone}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">วันที่เข้ารับบริการ:</span>
                            <span>{booking.date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">ช่วงเวลา:</span>
                            <span>{booking.slot_label || booking.slot}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">สถานะ:</span>
                            <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${renderStatus(
                                    booking.status
                                ).cls}`}
                            >
                                {renderStatus(booking.status).text}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
