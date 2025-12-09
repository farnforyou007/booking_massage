// src/pages/AdminPage.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import Swal from "sweetalert2";
import { Html5Qrcode } from "html5-qrcode";
import {
    adminLogin,
    adminGetBookings,
    adminGetSlotsSummary,
    adminUpdateSlotCapacity,
    adminUpdateBookingStatus,
    getBookingByCode
} from "../api";
import {
    FiLock, FiCalendar, FiRefreshCw, FiUser, FiPhone, FiClock,
    FiCheckCircle, FiXCircle, FiActivity, FiEdit2, FiLogOut,
    FiLayers, FiUsers, FiSearch, FiFilter, FiCheckSquare,
    FiCamera, FiImage, FiGrid
} from "react-icons/fi";

const todayStr = () => new Date().toISOString().slice(0, 10);

function renderStatusBadge(status) {
    switch (status) {
        case "BOOKED": return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200"><FiClock /> รอใช้บริการ</span>;
        case "CHECKED_IN": return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><FiCheckCircle /> เช็คอินแล้ว</span>;
        case "CANCELLED": return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"><FiXCircle /> ยกเลิก</span>;
        default: return <span className="text-gray-500">-</span>;
    }
}

export default function AdminPage() {
    // --- Auth States ---
    const [passwordInput, setPasswordInput] = useState("");
    const [authToken, setAuthToken] = useState(sessionStorage.getItem("authToken") || "");

    const [date, setDate] = useState(todayStr());
    const [bookings, setBookings] = useState([]);
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(false);

    const [activeTab, setActiveTab] = useState("dashboard");
    const isAuthed = useMemo(() => !!authToken, [authToken]);

    // --- Filter States ---
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");

    // --- Scanner States ---
    const [isScanning, setIsScanning] = useState(false);
    const [scanData, setScanData] = useState(null);
    const [manualCode, setManualCode] = useState("");

    // Refs สำหรับจัดการกล้องโดยเฉพาะ (แก้ปัญหา Race Condition)
    const scannerRef = useRef(null);
    const isScanningRef = useRef(false); // ตัวแปรเช็คสถานะจริงของกล้อง

    // ==================== AUTH ====================
    async function handleLogin(e) {
        e.preventDefault();
        if (!passwordInput.trim()) { Swal.fire("แจ้งเตือน", "กรุณากรอกรหัสผ่าน", "warning"); return; }
        setLoading(true);
        try {
            const res = await adminLogin(passwordInput.trim());
            if (res.ok && res.token) {
                sessionStorage.setItem("authToken", res.token);
                setAuthToken(res.token);
                setPasswordInput("");
            } else {
                Swal.fire("ผิดพลาด", res?.message || "รหัสผ่านไม่ถูกต้อง", "error");
            }
        } catch (err) { Swal.fire("Error", err.message, "error"); }
        finally { setLoading(false); }
    }

    function handleLogout() {
        sessionStorage.removeItem("authToken");
        setAuthToken("");
        setBookings([]);
        setSlots([]);
    }

    // ==================== DATA LOADING ====================
    async function reloadData() {
        if (!authToken) return;
        setLoading(true);
        try {
            const [resB, resS] = await Promise.all([
                adminGetBookings(date, authToken),
                adminGetSlotsSummary(date, authToken)
            ]);

            if (resB.ok) {
                setBookings(resB.items || []);
            } else if (resB.auth === false) {
                handleLogout();
                Swal.fire("Session หมดอายุ", "กรุณาเข้าสู่ระบบใหม่", "info");
            }

            if (resS.ok) setSlots(resS.items || []);

        } catch (err) { console.error(err); } finally { setLoading(false); }
    }

    async function reloadSlots(targetDate) {
        const res = await adminGetSlotsSummary(targetDate, authToken);
        if (res.ok) setSlots(res.items || []);
    }

    useEffect(() => {
        if (authToken) reloadData();
    }, [date, authToken]);

    // ==================== SCANNER LOGIC (ฉบับแก้ไข Error 100%) ====================

    useEffect(() => {
        let mounted = true;

        // ถ้าเข้าหน้า Scan และยังไม่มีข้อมูล -> เปิดกล้อง
        if (activeTab === "scan" && !scanData) {
            // รอให้ DOM render div id="reader" เสร็จก่อน 100ms
            const timer = setTimeout(() => {
                if (mounted) startScanner();
            }, 100);
            return () => {
                mounted = false;
                clearTimeout(timer);
                // Cleanup เมื่อเปลี่ยนหน้า
                cleanupScanner();
            };
        } else {
            // ถ้าออกจากหน้า Scan หรือมีข้อมูลแล้ว -> ปิดกล้อง
            cleanupScanner();
        }
    }, [activeTab, scanData]);

    const startScanner = async () => {
        // 1. เช็คว่ามี element reader ไหม
        if (!document.getElementById("reader")) return;

        // 2. ถ้ามี instance เก่าค้างอยู่ ให้เคลียร์ก่อน
        if (scannerRef.current) {
            await cleanupScanner();
        }

        // 3. สร้าง instance ใหม่
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // ignore frame errors to avoid console spam
                }
            );
            // Start สำเร็จ -> ตั้งค่า flag
            if (scannerRef.current) { // เช็คอีกทีเผื่อโดน unmount ระหว่างรอ
                isScanningRef.current = true;
                setIsScanning(true);
            } else {
                // ถ้าโดน unmount ไปแล้ว ให้รีบปิด
                html5QrCode.stop().catch(() => { });
            }
        } catch (err) {
            console.error("Camera start failed:", err);
            isScanningRef.current = false;
            setIsScanning(false);
        }
    };

    const cleanupScanner = async () => {
        const scanner = scannerRef.current;
        scannerRef.current = null; // ตัด reference ทันทีเพื่อป้องกันการเรียกซ้ำ

        if (scanner) {
            try {
                // เช็คสถานะก่อนสั่ง stop (แก้ปัญหา Cannot stop if not running)
                if (isScanningRef.current) {
                    await scanner.stop();
                }
                // สั่ง clear เสมอ
                await scanner.clear();
            } catch (err) {
                // console.warn("Cleanup warning:", err); 
            } finally {
                isScanningRef.current = false;
                setIsScanning(false);
            }
        }
    };

    const handleScanSuccess = async (code) => {
        // สั่งหยุดกล้องทันทีที่เจอ
        await cleanupScanner();

        setLoading(true);
        try {
            const res = await getBookingByCode(code);
            if (res.ok && res.booking) {
                setScanData(res.booking);
            } else {
                await Swal.fire({
                    icon: "error",
                    title: "ไม่พบข้อมูล",
                    text: "รหัสไม่ถูกต้อง หรือไม่มีในระบบ",
                    timer: 1500,
                    showConfirmButton: false
                });
                // เปิดกล้องใหม่ถ้าไม่เจอ (รอ 500ms)
                setTimeout(() => {
                    if (activeTab === "scan") startScanner();
                }, 500);
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
            setTimeout(() => { if (activeTab === "scan") startScanner(); }, 500);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setLoading(true);

        // ใช้ instance แยกสำหรับอ่านไฟล์
        const fileScanner = new Html5Qrcode("reader-file-hidden");
        try {
            const result = await fileScanner.scanFileV2(file, true);
            if (result && result.decodedText) {
                handleScanSuccess(result.decodedText);
            }
        } catch (err) {
            Swal.fire("อ่านรูปไม่ได้", "ไม่พบ QR Code ในรูปภาพนี้", "error");
        } finally {
            setLoading(false);
            // เคลียร์ instance ของไฟล์
            try { await fileScanner.clear(); } catch (e) { }
            e.target.value = '';
        }
    };

    const handleConfirmCheckIn = async () => {
        if (!scanData) return;
        setLoading(true);
        try {
            const res = await adminUpdateBookingStatus(scanData.code, "CHECKED_IN", authToken);
            if (res.ok) {
                await Swal.fire({ icon: 'success', title: 'เช็คอินสำเร็จ', timer: 1500, showConfirmButton: false });
                handleResetScan();
                reloadData();
            } else { Swal.fire("ผิดพลาด", res.message, "error"); }
        } catch (err) { Swal.fire("Error", err.message, "error"); } finally { setLoading(false); }
    };

    const handleResetScan = () => {
        setScanData(null);
        setManualCode("");
        // useEffect จะทำงานและเปิดกล้องใหม่ให้เอง
    };

    // ==================== DASHBOARD HELPERS ====================
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const searchLower = searchTerm.toLowerCase();
            const matchSearch = (b.name || "").toLowerCase().includes(searchLower) || (b.phone || "").includes(searchTerm) || (b.code || "").toLowerCase().includes(searchLower);
            const matchStatus = filterStatus === "ALL" || b.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [bookings, searchTerm, filterStatus]);

    const kpiStats = useMemo(() => {
        const total = bookings.length;
        const checkedIn = bookings.filter(b => b.status === "CHECKED_IN").length;
        const cancelled = bookings.filter(b => b.status === "CANCELLED").length;
        const waiting = bookings.filter(b => b.status === "BOOKED").length;
        return { total, checkedIn, cancelled, waiting };
    }, [bookings]);

    async function handleChangeStatus(booking, newStatus) {
        const actionName = newStatus === "CHECKED_IN" ? "เช็คอิน" : "ยกเลิก";
        const result = await Swal.fire({
            title: `ยืนยันการ${actionName}?`,
            text: `${booking.name}`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ยืนยัน",
            confirmButtonColor: newStatus === "CHECKED_IN" ? "#059669" : "#dc2626"
        });

        if (!result.isConfirmed) return;
        try {
            const res = await adminUpdateBookingStatus(booking.code, newStatus, authToken);
            if (res.ok) {
                setBookings(prev => prev.map(b => b.code === booking.code ? { ...b, status: newStatus } : b));
                await reloadSlots(date);
                Swal.fire("สำเร็จ", `เรียบร้อย`, "success");
            }
        } catch (err) { Swal.fire("Error", err.message, "error"); }
    }

    async function handleEditCapacity(slot) {
        const { value: newCap } = await Swal.fire({
            title: `แก้ไขจำนวนรับ (${slot.label})`,
            input: "number",
            inputValue: slot.capacity,
            showCancelButton: true,
            confirmButtonText: "บันทึก"
        });
        if (newCap && newCap >= 0) {
            await adminUpdateSlotCapacity(slot.id, newCap, authToken);
            await reloadSlots(date);
        }
    }

    // ==================== RENDER UI ====================
    return (
        <div className="min-h-screen bg-stone-50 font-sans flex flex-col">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        #reader__dashboard_section_csr span, #reader__dashboard_section_swaplink { display: none !important; }
      `}</style>

            {/* Navbar */}
            <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><FiActivity /></div>
                        <span className="hidden sm:inline">ระบบจัดการคิว</span>
                        <span className="sm:hidden">Admin</span>
                    </div>
                    {isAuthed && (
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <span className="flex items-center gap-2"><FiGrid /> แดชบอร์ด</span>
                                </button>
                                <button onClick={() => setActiveTab("scan")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'scan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <span className="flex items-center gap-2"><FiCamera /> สแกน</span>
                                </button>
                            </div>
                            <button onClick={handleLogout} className="text-xs flex items-center gap-1 text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg font-medium">
                                <FiLogOut className="md:hidden" /><span className="hidden md:inline">ออกจากระบบ</span>
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Mobile Tabs */}
            {isAuthed && (
                <div className="md:hidden bg-white border-b border-gray-200 p-2 flex justify-center gap-2 sticky top-[60px] z-20">
                    <button onClick={() => setActiveTab("dashboard")} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${activeTab === 'dashboard' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-transparent text-gray-500'}`}>แดชบอร์ด</button>
                    <button onClick={() => setActiveTab("scan")} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${activeTab === 'scan' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-transparent text-gray-500'}`}>สแกนเช็คอิน</button>
                </div>
            )}

            <main className="flex-grow p-4 md:p-6 lg:p-8 flex flex-col items-center">

                {/* LOGIN FORM */}
                {!isAuthed && (
                    <div className="w-full max-w-md animate-fade-in-up mt-10">
                        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                            <div className="bg-emerald-800 p-6 text-center text-white relative">
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-white/30"><FiLock /></div>
                                    <h2 className="text-xl font-bold">เข้าสู่ระบบเจ้าหน้าที่</h2>
                                </div>
                            </div>
                            <div className="p-8">
                                <form onSubmit={handleLogin} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">รหัสผ่าน</label>
                                        <input type="password" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-70">
                                        {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* DASHBOARD TAB */}
                {isAuthed && activeTab === "dashboard" && (
                    <div className="w-full max-w-7xl space-y-6 animate-fade-in-up">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                <FiCalendar className="text-gray-400" />
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium" />
                            </div>
                            <button onClick={reloadData} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium shadow hover:bg-emerald-700 transition-colors">
                                <FiRefreshCw className={loading ? "animate-spin" : ""} /> <span className="hidden sm:inline">อัปเดต</span>
                            </button>
                        </div>

                        {/* KPI */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                                <div><p className="text-xs text-gray-500">ทั้งหมด</p><p className="text-xl font-bold">{kpiStats.total}</p></div><FiUsers className="text-gray-300 text-2xl" />
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                                <div><p className="text-xs text-gray-500">รอรับบริการ</p><p className="text-xl font-bold text-yellow-600">{kpiStats.waiting}</p></div><FiClock className="text-yellow-200 text-2xl" />
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                                <div><p className="text-xs text-gray-500">เช็คอิน</p><p className="text-xl font-bold text-emerald-600">{kpiStats.checkedIn}</p></div><FiCheckCircle className="text-emerald-200 text-2xl" />
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                                <div><p className="text-xs text-gray-500">ยกเลิก</p><p className="text-xl font-bold text-rose-600">{kpiStats.cancelled}</p></div><FiXCircle className="text-rose-200 text-2xl" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Table */}
                            <div className="lg:col-span-8 flex flex-col h-[600px] bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex gap-3 bg-gray-50/50">
                                    <input type="text" placeholder="ค้นหา..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                        <option value="ALL">ทุกสถานะ</option>
                                        <option value="BOOKED">รอรับบริการ</option>
                                        <option value="CHECKED_IN">เช็คอินแล้ว</option>
                                        <option value="CANCELLED">ยกเลิกแล้ว</option>
                                    </select>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 sticky top-0 text-xs font-bold text-gray-500 uppercase">
                                            <tr><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">ผู้ป่วย</th><th className="px-4 py-3 text-center">สถานะ</th><th className="px-4 py-3 text-right">จัดการ</th></tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-gray-50">
                                            {filteredBookings.map((b, i) => (
                                                <tr key={i} className="hover:bg-emerald-50/30">
                                                    <td className="px-4 py-3 font-medium text-emerald-700">{b.slot}</td>
                                                    <td className="px-4 py-3"><div className="font-medium">{b.name}</div><div className="text-xs text-gray-400">{b.phone}</div></td>
                                                    <td className="px-4 py-3 text-center">{renderStatusBadge(b.status)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        {b.status === "BOOKED" && (
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => handleChangeStatus(b, "CHECKED_IN")} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200" title="เช็คอิน"><FiCheckSquare /></button>
                                                                <button onClick={() => handleChangeStatus(b, "CANCELLED")} className="p-1.5 bg-rose-100 text-rose-700 rounded hover:bg-rose-200" title="ยกเลิก"><FiXCircle /></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {/* Slots */}
                            <div className="lg:col-span-4 flex flex-col h-[600px] bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b bg-gray-50/50 font-bold text-gray-700 flex items-center gap-2"><FiLayers /> จัดการคิว</div>
                                <div className="flex-1 overflow-auto p-4 space-y-3">
                                    {slots.map((s) => (
                                        <div key={s.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-sm text-gray-700 flex items-center gap-1"><FiClock className="text-emerald-500" /> {s.label}</span>
                                                <button onClick={() => handleEditCapacity(s)} className="text-gray-400 hover:text-emerald-600"><FiEdit2 /></button>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5"><div className={`h-full rounded-full ${s.remaining === 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${(s.booked / s.capacity) * 100}%` }}></div></div>
                                            <div className="flex justify-between text-xs text-gray-500"><span>จอง {s.booked}/{s.capacity}</span><span>{s.remaining === 0 ? 'เต็ม' : 'ว่าง ' + s.remaining}</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* === SCENE 3: SCANNER TAB === */}
                {isAuthed && activeTab === "scan" && (
                    <div className="w-full max-w-md animate-fade-in-up space-y-6">
                        {!scanData ? (
                            <>
                                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 relative">
                                    <div id="reader" className="w-full rounded-xl overflow-hidden bg-black min-h-[300px]"></div>
                                    {!isScanning && <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 rounded-3xl text-gray-400 text-sm">กำลังเปิดกล้อง...</div>}

                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div id="reader-file-hidden" className="hidden"></div>
                                        <label className="flex items-center justify-center gap-2 w-full py-3 bg-stone-100 text-stone-600 rounded-xl font-semibold cursor-pointer hover:bg-stone-200 transition-colors">
                                            <FiImage /> เลือกรูป QR Code
                                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FiSearch /> ค้นหารหัส</h3>
                                    <div className="flex gap-2">
                                        <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="กรอกรหัสจอง..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                                        <button onClick={() => handleScanSuccess(manualCode)} disabled={!manualCode} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">ค้นหา</button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden">
                                <div className="bg-emerald-50 p-6 border-b border-emerald-100 text-center relative">
                                    <button onClick={handleResetScan} className="absolute top-4 right-4 text-emerald-700 hover:bg-emerald-100 p-2 rounded-full"><FiRefreshCw /></button>
                                    <div className="inline-block p-3 bg-white rounded-full shadow-sm mb-2 text-3xl">
                                        {scanData.status === "CHECKED_IN" ? <FiCheckCircle className="text-emerald-500" /> : scanData.status === "CANCELLED" ? <FiXCircle className="text-rose-500" /> : <FiClock className="text-yellow-500" />}
                                    </div>
                                    <h2 className="text-xl font-bold text-emerald-900">{scanData.name}</h2>
                                    <p className="text-sm text-emerald-600 font-mono">{scanData.code}</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="bg-stone-50 p-3 rounded-xl"><p className="text-xs text-gray-400">วันที่</p><b>{scanData.date}</b></div>
                                        <div className="bg-stone-50 p-3 rounded-xl"><p className="text-xs text-gray-400">เวลา</p><b>{scanData.slot_label}</b></div>
                                        <div className="col-span-2 bg-stone-50 p-3 rounded-xl"><p className="text-xs text-gray-400">เบอร์โทร</p><b>{scanData.phone}</b></div>
                                    </div>

                                    {scanData.status === "CHECKED_IN" && <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm flex gap-2 items-center"><FiCheckCircle /> รายการนี้เช็คอินแล้ว</div>}
                                    {scanData.status === "CANCELLED" && <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-sm flex gap-2 items-center"><FiXCircle /> รายการนี้ถูกยกเลิก</div>}

                                    {scanData.status === "BOOKED" ? (
                                        <button onClick={handleConfirmCheckIn} disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98]">
                                            {loading ? "กำลังบันทึก..." : "ยืนยันเช็คอิน (Auto Auth)"}
                                        </button>
                                    ) : (
                                        <button onClick={handleResetScan} className="w-full py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl font-bold">สแกนรายการต่อไป</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </main>
        </div>
    );
}