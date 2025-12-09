// src/pages/TicketPage.jsx
import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { getBookingByCode } from "../api";
import { QRCodeCanvas } from "qrcode.react";
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
    FiSearch
} from "react-icons/fi";

// Helper renderStatus (คงเดิม)
function renderStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "BOOKED") {
        return {
            text: "ลงทะเบียนสำเร็จ",
            cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
            icon: <FiCheckCircle />,
        };
    } else if (s === "CHECKED_IN") {
        return {
            text: "เข้ารับบริการแล้ว",
            cls: "bg-blue-100 text-blue-700 border-blue-200",
            icon: <FiCheckCircle />,
        };
    } else if (s === "CANCELLED") {
        return {
            text: "ถูกยกเลิก",
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
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const codeFromUrl = searchParams.get("code") || "";

    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    // State สำหรับค้นหา
    const [searchInput, setSearchInput] = useState("");

    // 1. Effect: โหลดข้อมูลเมื่อมี code
    useEffect(() => {
        if (!codeFromUrl) {
            setBooking(null);
            setErrorMsg("");
            setLoading(false);
            return;
        }

        async function load() {
            setLoading(true);
            setErrorMsg("");
            setBooking(null);

            try {
                const res = await getBookingByCode(codeFromUrl);
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

        load();
    }, [codeFromUrl]);

    // 2. Handle Search
    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;
        setSearchParams({ code: searchInput.trim() });
    };

    // 3. Clear Search
    const clearSearch = () => {
        setSearchParams({});
        setSearchInput("");
        setErrorMsg("");
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 py-8 font-sans">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
        .ticket-notch {
            position: absolute; width: 24px; height: 24px; background-color: #fafaf9; 
            border-radius: 50%; top: 50%; transform: translateY(-50%); z-index: 10;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
        }
        .ticket-shadow { box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1); }
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

            {/* ---- MAIN CARD ---- */}
            <div className="w-full max-w-md bg-white rounded-3xl ticket-shadow overflow-hidden relative animate-fade-in-up min-h-[400px] flex flex-col">

                {/* 1. Header (สีเขียว) */}
                <div className="bg-emerald-800 p-6 text-white relative overflow-hidden flex-shrink-0">
                    {/* ปุ่มยกเลิกค้นหา (แสดงเฉพาะตอนมี Code แล้ว) */}
                    {codeFromUrl && (
                        <button
                            onClick={clearSearch}
                            className="absolute top-4 right-4 bg-black/20 hover:bg-black/30 p-1.5 rounded-full text-white/80 transition-colors z-20"
                            title="ค้นหาใหม่"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}

                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                        <FiActivity size={150} />
                    </div>
                    <div className="relative z-10 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl mb-3 border border-white/30">
                            <FiActivity className="text-2xl" />
                        </div>
                        <h2 className="text-xl font-bold tracking-wide">
                            {codeFromUrl ? "บัตรลงทะเบียนนวดรักษา" : "ค้นหาการลงทะเบียน"}
                        </h2>
                        <p className="text-emerald-200 text-sm font-light">คลินิกการแพทย์แผนไทย</p>
                    </div>
                </div>

                {/* 2. Body Content */}
                <div className="relative flex-grow flex flex-col bg-white">

                    {/* --- SCENE 1: Search Form (แสดงเมื่อไม่มี Code) --- */}
                    {!codeFromUrl && (
                        <div className="p-8 flex flex-col justify-center flex-grow">
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FiSearch size={24} />
                                </div>
                                <p className="text-gray-500 text-sm">กรอกรหัสจอง หรือ เบอร์โทรศัพท์ เพื่อค้นหา</p>
                            </div>
                            <form onSubmit={handleSearch} className="space-y-4">
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-center text-gray-800 placeholder-gray-400"
                                    placeholder="เช่น 0891234567"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!searchInput}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ค้นหาข้อมูล
                                </button>
                            </form>
                        </div>
                    )}

                    {/* --- SCENE 2: Loading --- */}
                    {codeFromUrl && loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-400 text-sm animate-pulse">กำลังค้นหาข้อมูล...</p>
                        </div>
                    )}

                    {/* --- SCENE 3: Error --- */}
                    {codeFromUrl && !loading && errorMsg && (
                        <div className="p-8 text-center flex-grow flex flex-col justify-center">
                            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiAlertCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">ไม่พบข้อมูล</h3>
                            <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
                            <button onClick={clearSearch} className="text-emerald-600 font-medium hover:underline">
                                ลองค้นหาใหม่
                            </button>
                        </div>
                    )}

                    {/* --- SCENE 4: Success (Ticket) --- */}
                    {codeFromUrl && !loading && booking && (
                        <div>
                            {/* QR Section */}
                            <div className="pt-8 pb-6 px-6 flex flex-col items-center justify-center bg-white">
                                <div className="p-3 border-2 border-dashed border-gray-200 rounded-xl bg-stone-50 relative">
                                    <QRCodeCanvas value={booking.code} size={160} level="H" />
                                    {/* Corners */}
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500 -mt-0.5 -ml-0.5 rounded-tl-lg"></div>
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500 -mt-0.5 -mr-0.5 rounded-tr-lg"></div>
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500 -mb-0.5 -ml-0.5 rounded-bl-lg"></div>
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500 -mb-0.5 -mr-0.5 rounded-br-lg"></div>
                                </div>
                                <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Booking ID</span>
                                    <span className="font-mono font-bold text-emerald-700 text-base tracking-wide">{booking.code}</span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="relative h-6 w-full overflow-hidden">
                                <div className="absolute top-1/2 w-full border-t-2 border-dashed border-gray-200"></div>
                                <div className="ticket-notch -left-3 border-r border-gray-200"></div>
                                <div className="ticket-notch -right-3 border-l border-gray-200"></div>
                            </div>

                            {/* Details */}
                            <div className="px-8 pb-8 pt-4 space-y-5">
                                {/* Status */}
                                <div className="text-center">
                                    {(() => {
                                        const st = renderStatus(booking.status);
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${st.cls}`}>
                                                {st.icon} {st.text}
                                            </span>
                                        );
                                    })()}
                                </div>

                                {/* Grid Info (UI เดิมที่คุณชอบ) */}
                                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">ชื่อผู้จอง</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold text-base">
                                            <FiUser className="text-emerald-500" /> {booking.name}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">วันที่</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                            <FiCalendar className="text-emerald-500" /> {booking.date}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">เวลา</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                            <FiClock className="text-emerald-500" /> {booking.slot_label || booking.slot}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-400 mb-1 font-medium">เบอร์โทรศัพท์</label>
                                        <div className="flex items-center gap-2 text-gray-800 font-medium">
                                            <FiPhone className="text-emerald-500" /> {booking.phone}
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

                {/* Shadow Element */}
                {!loading && !errorMsg && codeFromUrl && (
                    <div className="w-[90%] mx-auto h-3 bg-emerald-900/10 rounded-b-xl filter blur-sm"></div>
                )}
            </div>

            {/* Capture Hint */}
            {!loading && booking && codeFromUrl && (
                <p className="mt-6 text-xs text-gray-400 flex items-center gap-2 animate-bounce">
                    <FiDownload /> บันทึกภาพหน้าจอนี้ไว้เป็นหลักฐาน
                </p>
            )}

            {/* Animations */}
            <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
      `}</style>
        </div>
    );
}