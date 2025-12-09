// src/pages/ScanPage.jsx
import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import Swal from "sweetalert2";
import { getBookingByCode, adminUpdateBookingStatus } from "../api";
import {
    FiCamera,
    FiSearch,
    FiUser,
    FiPhone,
    FiCalendar,
    FiClock,
    FiCheckCircle,
    FiXCircle,
    FiAlertCircle,
    FiArrowLeft,
    FiLock,
    FiRefreshCw
} from "react-icons/fi";
import { Link } from "react-router-dom";

export default function ScanPage() {
    const [scanResult, setScanResult] = useState(null);
    const [bookingData, setBookingData] = useState(null);
    const [manualCode, setManualCode] = useState("");
    const [password, setPassword] = useState(""); // รหัส Admin
    const [loading, setLoading] = useState(false);

    // Ref สำหรับควบคุม Scanner
    const scannerRef = useRef(null);

    // --- 1. เริ่มกล้องอัตโนมัติ ---
    useEffect(() => {
        // ถ้ามีข้อมูลแล้ว หรือไม่มี Element reader ให้ข้ามไป
        if (bookingData || !document.getElementById("reader")) return;

        // เคลียร์ของเก่าก่อนสร้างใหม่ (ป้องกัน Error ใน React Strict Mode)
        if (scannerRef.current) {
            scannerRef.current.clear().catch(() => { });
        }

        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                showTorchButtonIfSupported: true,
            },
      /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                // เมื่อสแกนเจอ
                handleSearch(decodedText);
                // สั่งเคลียร์กล้องทันที
                scanner.clear().catch(console.error);
            },
            (error) => {
                // สแกนไม่เจอ (ไม่ต้องทำอะไร)
            }
        );

        scannerRef.current = scanner;

        // Cleanup เมื่อออกจากหน้า
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => { });
            }
        };
    }, [bookingData]); // รันใหม่เมื่อ bookingData ถูกเคลียร์ (กดสแกนใหม่)

    // --- 2. ค้นหาข้อมูล ---
    async function handleSearch(code) {
        if (!code) return;
        setScanResult(code);
        setLoading(true);
        setBookingData(null);

        try {
            const res = await getBookingByCode(code);
            if (res.ok && res.booking) {
                setBookingData(res.booking);
            } else {
                Swal.fire({
                    icon: "error",
                    title: "ไม่พบข้อมูล",
                    text: "รหัสไม่ถูกต้อง หรือไม่มีในระบบ",
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    handleReset(); // รีเซ็ตเพื่อเปิดกล้องใหม่
                });
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
            handleReset();
        } finally {
            setLoading(false);
        }
    }

    // --- 3. ยืนยันเช็คอิน ---
    async function handleConfirmCheckIn() {
        if (!password) {
            Swal.fire("กรุณาใส่รหัสเจ้าหน้าที่", "", "warning");
            return;
        }

        setLoading(true);
        try {
            const res = await adminUpdateBookingStatus(
                bookingData.code,
                "CHECKED_IN",
                password
            );

            if (res.ok) {
                await Swal.fire({
                    icon: "success",
                    title: "เช็คอินสำเร็จ",
                    text: `ผู้ป่วย: ${bookingData.name}`,
                    timer: 1500,
                    showConfirmButton: false,
                });
                handleReset();
            } else {
                Swal.fire("ผิดพลาด", res.message, "error");
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        } finally {
            setLoading(false);
        }
    }

    function handleReset() {
        setScanResult(null);
        setBookingData(null);
        setManualCode("");
        setPassword("");
    }

    return (
        <div className="min-h-screen bg-stone-50 font-sans flex flex-col items-center py-8 px-4">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
        #reader__dashboard_section_csr span { display: none !important; }
      `}</style>

            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
                    <FiCamera /> สแกนเช็คอิน
                </h1>
                <Link to="/admin" className="text-sm text-gray-500 hover:text-emerald-600 flex items-center gap-1">
                    <FiArrowLeft /> กลับหน้า Admin
                </Link>
            </div>

            {/* --- SCENE 1: Camera & Manual Input --- */}
            {!bookingData && (
                <div className="w-full max-w-md space-y-6 animate-fade-in-up">

                    {/* Camera Box */}
                    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100 p-4">
                        <div id="reader" className="w-full rounded-xl overflow-hidden bg-black min-h-[300px]"></div>
                        <p className="text-center text-xs text-gray-400 mt-3">
                            วาง QR Code ให้อยู่ในกรอบ
                        </p>
                    </div>

                    {/* Manual Input */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FiSearch /> หรือค้นหาด้วยรหัส/เบอร์โทร
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                placeholder="กรอกรหัสจอง..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                                onClick={() => handleSearch(manualCode)}
                                disabled={!manualCode}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                            >
                                ค้นหา
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SCENE 2: Booking Info & Confirm --- */}
            {bookingData && (
                <div className="w-full max-w-md animate-fade-in-up">
                    <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden">

                        {/* Header Info */}
                        <div className="bg-emerald-50 p-6 border-b border-emerald-100 text-center relative">
                            <button onClick={handleReset} className="absolute top-4 right-4 p-2 text-emerald-700 hover:bg-emerald-100 rounded-full">
                                <FiRefreshCw />
                            </button>

                            <div className="inline-block p-3 bg-white rounded-full shadow-sm mb-2">
                                {bookingData.status === "CHECKED_IN" ? (
                                    <FiCheckCircle className="text-3xl text-emerald-500" />
                                ) : bookingData.status === "CANCELLED" ? (
                                    <FiXCircle className="text-3xl text-rose-500" />
                                ) : (
                                    <FiClock className="text-3xl text-yellow-500" />
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-emerald-900">{bookingData.name}</h2>
                            <p className="text-sm text-emerald-600 font-mono">{bookingData.code}</p>
                        </div>

                        {/* Details */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-stone-50 p-3 rounded-xl">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FiCalendar /> วันที่</p>
                                    <p className="font-semibold text-gray-700">{bookingData.date}</p>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FiClock /> เวลา</p>
                                    <p className="font-semibold text-gray-700">{bookingData.slot_label}</p>
                                </div>
                                <div className="col-span-2 bg-stone-50 p-3 rounded-xl">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FiPhone /> เบอร์โทร</p>
                                    <p className="font-semibold text-gray-700">{bookingData.phone}</p>
                                </div>
                            </div>

                            {/* Status Warnings */}
                            {bookingData.status === "CHECKED_IN" && (
                                <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm flex items-center gap-2 font-medium">
                                    <FiCheckCircle /> รายการนี้เช็คอินไปแล้ว
                                </div>
                            )}
                            {bookingData.status === "CANCELLED" && (
                                <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-sm flex items-center gap-2 font-medium">
                                    <FiXCircle /> รายการนี้ถูกยกเลิก
                                </div>
                            )}

                            <hr className="border-dashed border-gray-200" />

                            {/* Confirm Button (Only if BOOKED) */}
                            {bookingData.status === "BOOKED" ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">รหัสเจ้าหน้าที่</label>
                                        <div className="relative">
                                            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="password"
                                                className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                                placeholder="รหัสผ่าน (123456)"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleConfirmCheckIn}
                                        disabled={loading || !password}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {loading ? "กำลังบันทึก..." : "ยืนยันเช็คอิน"}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleReset}
                                    className="w-full py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl font-bold"
                                >
                                    สแกนรายการต่อไป
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}