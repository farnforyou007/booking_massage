// src/pages/TicketPage.jsx
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getBookingByCode } from "../api";
import { QRCodeCanvas } from "qrcode.react"; // เพิ่ม QR Code เข้ามาเพื่อให้สมบูรณ์
import {
    FiCalendar,
    FiClock,
    FiUser,
    FiPhone,
    FiHash,
    FiAlertCircle,
    FiCheckCircle,
    FiArrowLeft,
    FiMapPin,
    FiActivity,
    FiDownload,
} from "react-icons/fi";

// Helper สำหรับแสดงสถานะแบบสวยงาม
function renderStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "BOOKED") {
        return {
            text: "ลงทะเบียนสำเร็จ",
            // สีเขียว Emerald
            cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
            icon: <FiCheckCircle />,
        };
    } else if (s === "CHECKED_IN") {
        return {
            text: "เข้ารับบริการแล้ว",
            // สีฟ้า Blue
            cls: "bg-blue-100 text-blue-700 border-blue-200",
            icon: <FiCheckCircle />,
        };
    } else if (s === "CANCELLED") {
        return {
            text: "ถูกยกเลิก",
            // สีแดง Rose
            cls: "bg-rose-100 text-rose-700 border-rose-200",
            icon: <FiAlertCircle />,
        };
    }
    return {
        text: s || "รอตรวจสอบ",
        cls: "bg-gray-100 text-gray-600 border-gray-200",
        icon: <FiHash />,
    };
}

export default function TicketPage() {
    const [searchParams] = useSearchParams();
    const code = searchParams.get("code") || "";

    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        if (!code) {
            setErrorMsg("ไม่พบรหัสลงทะเบียนในลิงก์");
            setLoading(false);
            return;
        }

        async function load() {
            setLoading(true);
            try {
                const res = await getBookingByCode(code);
                if (!res || !res.ok || !res.booking) {
                    setErrorMsg(res?.message || "ไม่พบข้อมูลการลงทะเบียน");
                } else {
                    setBooking(res.booking);
                }
            } catch (err) {
                setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err.message);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [code]);

    const statusView = renderStatus(booking?.status);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 py-8 font-sans">
            {/* Style & Fonts */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
        .ticket-notch {
            position: absolute;
            width: 24px;
            height: 24px;
            background-color: #fafaf9; /* matches bg-stone-50 */
            border-radius: 50%;
            top: 50%;
            transform: translateY(-50%);
            z-index: 10;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
        }
        .ticket-shadow {
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1);
        }
      `}</style>

            {/* Navigation Back */}
            <div className="w-full max-w-md mb-6 flex justify-between items-center">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100"
                >
                    <FiArrowLeft />
                    กลับหน้าจองคิว
                </Link>
            </div>

            {/* Main Card / Ticket Container */}
            <div className="w-full max-w-md bg-white rounded-3xl ticket-shadow overflow-hidden relative animate-fade-in-up">

                {/* --- Header Section (สีเขียว) --- */}
                <div className="bg-emerald-800 p-6 text-white relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                        <FiActivity size={150} />
                    </div>

                    <div className="relative z-10 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl mb-3 border border-white/30">
                            <FiActivity className="text-2xl" />
                        </div>
                        <h2 className="text-xl font-bold tracking-wide">บัตรลงทะเบียนนวดรักษา</h2>
                        <p className="text-emerald-200 text-sm font-light">คลินิกการแพทย์แผนไทย</p>
                    </div>
                </div>

                {/* --- Ticket Body --- */}
                <div className="p-0 relative">
                    {/* Loading State */}
                    {loading && (
                        <div className="p-12 text-center space-y-4">
                            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
                            <p className="text-gray-500 text-sm animate-pulse">กำลังค้นหาข้อมูล...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {!loading && errorMsg && (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiAlertCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">ไม่พบข้อมูล</h3>
                            <p className="text-gray-500 text-sm">{errorMsg}</p>
                            <Link to="/" className="mt-6 inline-block text-emerald-600 font-medium hover:underline">
                                กลับไปจองคิวใหม่
                            </Link>
                        </div>
                    )}

                    {/* Success State (Show Ticket) */}
                    {!loading && booking && (
                        <div>
                            {/* QR Code Section */}
                            <div className="pt-8 pb-6 px-6 flex flex-col items-center justify-center bg-white">
                                <div className="p-3 border-2 border-dashed border-gray-200 rounded-xl bg-stone-50 relative">
                                    {/* ใช้ booking.code สร้าง QR */}
                                    <QRCodeCanvas value={code} size={160} level="H" />
                                    {/* Corners */}
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500 -mt-0.5 -ml-0.5 rounded-tl-lg"></div>
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500 -mt-0.5 -mr-0.5 rounded-tr-lg"></div>
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500 -mb-0.5 -ml-0.5 rounded-bl-lg"></div>
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500 -mb-0.5 -mr-0.5 rounded-br-lg"></div>
                                </div>

                                <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Booking ID</span>
                                    <span className="font-mono font-bold text-emerald-700 text-base tracking-wide">{code}</span>
                                </div>
                            </div>

                            {/* Divider with Notches */}
                            <div className="relative h-6 w-full overflow-hidden">
                                <div className="absolute top-1/2 w-full border-t-2 border-dashed border-gray-200"></div>
                                <div className="ticket-notch -left-3 border-r border-gray-200"></div>
                                <div className="ticket-notch -right-3 border-l border-gray-200"></div>
                            </div>

                            {/* Details Section */}
                            <div className="px-8 pb-8 pt-4 space-y-5">

                                {/* Status Badge */}
                                <div className="text-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusView.cls}`}>
                                        {statusView.icon}
                                        {statusView.text}
                                    </span>
                                </div>

                                {/* Grid Info */}
                                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">ชื่อผู้จอง</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold text-base">
                                            <FiUser className="text-emerald-500" />
                                            {booking.name}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">วันที่</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                            <FiCalendar className="text-emerald-500" />
                                            {booking.date}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">เวลา</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                            <FiClock className="text-emerald-500" />
                                            {booking.slot_label || booking.slot}
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">เบอร์โทรศัพท์</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-medium">
                                            <FiPhone className="text-emerald-500" />
                                            {booking.phone}
                                        </div>
                                    </div>

                                    <div className="col-span-2 pt-2 border-t border-gray-100">
                                        <div className="flex items-start gap-2 text-gray-500 text-xs">
                                            <FiMapPin className="mt-0.5 text-emerald-500 flex-shrink-0" />
                                            <span>อาคารสหเวช ชั้น 7 ห้อง TTM704</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Notice */}
                                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-emerald-800 font-medium">
                                        กรุณาแสดง QR Code นี้ต่อเจ้าหน้าที่<br />ในวันที่เข้ารับบริการ
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Shadow Element (ตกแต่ง) */}
                {!loading && !errorMsg && (
                    <div className="w-[90%] mx-auto h-3 bg-emerald-900/10 rounded-b-xl filter blur-sm"></div>
                )}
            </div>

            {/* Capture Hint */}
            {!loading && booking && (
                <p className="mt-6 text-xs text-gray-400 flex items-center gap-2 animate-bounce">
                    <FiDownload /> บันทึกภาพหน้าจอนี้ไว้เป็นหลักฐาน
                </p>
            )}

            {/* Animation Style */}
            <style>{`
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.5s ease-out forwards;
        }
      `}</style>
        </div>
    );
}