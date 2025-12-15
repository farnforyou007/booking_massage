import { useEffect, useMemo, useState, useRef } from "react";
import Swal from "sweetalert2";
import { Html5Qrcode } from "html5-qrcode";
import {
    adminLogin,
    adminGetBookings,
    adminGetSlotsSummary,
    adminUpdateSlotCapacity,
    adminUpdateBookingStatus,
    getBookingByCode,
    getOpenDates,
    addOpenDate,
    deleteOpenDate,
    getManageDates,
    updateDateStatus
} from "../api";
import {
    FiCalendar, FiRefreshCw, FiClock,
    FiCheckCircle, FiXCircle, FiActivity, FiEdit2, FiLogOut,
    FiLayers, FiUsers, FiSearch, FiCheckSquare,
    FiCamera, FiImage, FiAlertTriangle, FiCameraOff, FiPlus, FiTrash2, FiPieChart, FiBarChart2,
    FiLoader, FiPhone, FiLock, FiUnlock // เพิ่มไอคอน Phone
} from "react-icons/fi";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const todayStr = () => new Date().toISOString().slice(0, 10);

// ฟังก์ชันแปลงวันที่ให้มีปีด้วย (สำหรับ Admin ดู)
const formatThaiDateAdmin = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short', // ธ.ค.
        year: '2-digit' // 68
    });
};

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

function renderStatusBadge(status) {
    switch (status) {
        case "BOOKED": return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200"><FiClock /> รอใช้บริการ</span>;
        case "CHECKED_IN": return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><FiCheckCircle /> เช็คอินแล้ว</span>;
        case "CANCELLED": return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"><FiXCircle /> ยกเลิก</span>;
        default: return <span className="text-gray-500">-</span>;
    }
}

export default function AdminPage() {
    // --- States ---
    const [passwordInput, setPasswordInput] = useState("");
    const [authToken, setAuthToken] = useState(sessionStorage.getItem("authToken") || "");
    const [date, setDate] = useState(todayStr());
    const [bookings, setBookings] = useState([]);
    const [slots, setSlots] = useState([]);
    const [manageDates, setManageDates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false); // Loading state สำหรับการล็อกอิน
    const [activeTab, setActiveTab] = useState("dashboard");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [newDate, setNewDate] = useState("");

    // Loading States เฉพาะจุด
    const [addingDate, setAddingDate] = useState(false);

    // Scanner
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [scanStatus, setScanStatus] = useState("idle");
    const [scanErrorMsg, setScanErrorMsg] = useState("");
    const [scanData, setScanData] = useState(null);
    const [manualCode, setManualCode] = useState("");
    const scannerRef = useRef(null);

    const isAuthed = useMemo(() => !!authToken, [authToken]);

    useEffect(() => { document.title = "จัดการระบบ | คณะการแพทย์แผนไทย"; }, []);

    // --- Load Data ---
    async function reloadData() {
        if (!authToken) return;
        setLoading(true);
        try {
            const [resB, resS] = await Promise.all([
                adminGetBookings(date, authToken),
                adminGetSlotsSummary(date, authToken)
            ]);

            // ดัก Error ตรงนี้: ถ้า Token หมดอายุให้เด้งออก
            if (resB.ok) setBookings(resB.items || []);
            else if (resB.auth === false) handleLogout();

            if (resS.ok) setSlots(resS.slots || resS.items || []);
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ' });
        } finally {
            setLoading(false);
        }
    }

    // const loadDates = () => {
    //     getOpenDates()
    //         .then(res => { if (res.dates) setManageDates(res.dates); })
    //         .catch(err => console.error("Load dates error:", err));
    // };
    // 1. แก้ loadDates ให้ใช้ getManageDates แทน
    const loadDates = () => {
        // ใช้ API ตัวใหม่ ที่ได้ทั้งวันที่และสถานะ (items: [{date: '...', status: 'OPEN'}, ...])
        getManageDates()
            .then(res => { if (res.items) setManageDates(res.items); })
            .catch(err => console.error("Load dates error:", err));
    };

    useEffect(() => { if (authToken) { reloadData(); loadDates(); } }, [date, authToken]);

    // --- Actions ---
    async function handleLogin(e) {
        e.preventDefault();
        if (!passwordInput.trim()) return;
        // setLoading(true);
        setLoginLoading(true);
        try {
            const res = await adminLogin(passwordInput.trim());
            if (res.ok && res.token) {
                sessionStorage.setItem("authToken", res.token);
                setAuthToken(res.token);
                setPasswordInput("");
                Toast.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ' });
            } else { Swal.fire("ผิดพลาด", "รหัสผ่านไม่ถูกต้อง", "error"); }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        } finally {
            // setLoading(false); 
            setLoginLoading(false);
        }
    }

    function handleLogout() {
        sessionStorage.removeItem("authToken");
        setAuthToken("");
        setBookings([]);
        Toast.fire({ icon: 'success', title: 'ออกจากระบบแล้ว' });
    }

    async function handleChangeStatus(booking, newStatus) {
        const actionName = newStatus === "CHECKED_IN" ? "เช็คอิน" : "ยกเลิก";
        const result = await Swal.fire({
            title: `ยืนยันการ${actionName}?`,
            html: `ชื่อ: <b>${booking.name}</b> <br/> เบอร์โทร: <b>${booking.phone}</b> <br/>  รหัส: <b>${booking.code}</b> `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ยืนยัน",
            confirmButtonColor: newStatus === "CHECKED_IN" ? "#059669" : "#dc2626"
        });

        if (!result.isConfirmed) return;

        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        try {
            const res = await adminUpdateBookingStatus(booking.code, newStatus, authToken);
            Swal.close();

            if (!res.ok) throw new Error(res.message);

            setBookings(prev => prev.map(b => b.code === booking.code ? { ...b, status: newStatus } : b));
            Toast.fire({ icon: 'success', title: `บันทึกสถานะเรียบร้อย` });
            reloadData();

        } catch (err) {
            Swal.fire("Error", "บันทึกไม่สำเร็จ: " + err.message, "error");
        }
    }

    async function handleEditCapacity(slot) {
        const { value: newCap } = await Swal.fire({
            title: `แก้ไขจำนวนรับ (${slot.label})`,
            input: "number",
            inputValue: slot.capacity,
            showCancelButton: true,
            confirmButtonText: "บันทึก",
            confirmButtonColor: "#059669"
        });

        if (newCap) {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
            try {
                const res = await adminUpdateSlotCapacity(slot.id, newCap, authToken);
                Swal.close();
                if (res.ok) {
                    Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
                    reloadData();
                } else {
                    throw new Error(res.message);
                }
            } catch (err) { Swal.fire("Error", err.message, "error"); }
        }
    }

    // const handleAddDate = async () => {
    //     if (!newDate) return;
    //     if (manageDates.includes(newDate)) {
    //         Swal.fire("ซ้ำ", "วันนี้มีอยู่ในรายการแล้วครับ", "warning");
    //         return;
    //     }

    //     setAddingDate(true);
    //     try {
    //         const res = await addOpenDate(newDate);
    //         if (res.ok) {
    //             const updatedDates = [...manageDates, newDate].sort();
    //             setManageDates(updatedDates);
    //             Toast.fire({ icon: 'success', title: 'เพิ่มวันที่เรียบร้อย' });
    //             setNewDate("");
    //         } else {
    //             Swal.fire("แจ้งเตือน", res.message, "warning");
    //         }
    //     } catch (err) {
    //         Swal.fire("Error", "เชื่อมต่อไม่ได้", "error");
    //     } finally {
    //         setAddingDate(false);
    //     }
    // };
    // 2. แก้ handleAddDate ให้รองรับ Object แทน String
    const handleAddDate = async () => {
        if (!newDate) return;

        // เช็คซ้ำต้องเช็คที่ .date เพราะตอนนี้ข้อมูลเป็น object แล้ว
        if (manageDates.some(d => d.date === newDate)) {
            Swal.fire("ซ้ำ", "วันนี้มีอยู่ในรายการแล้วครับ", "warning");
            return;
        }

        setAddingDate(true);
        try {
            const res = await addOpenDate(newDate);
            if (res.ok) {
                // ✅ แก้ตรงนี้: สร้าง Object แทน String
                const newDateObj = { date: newDate, status: "OPEN" };

                // ✅ แก้ตรงนี้: ยัด Object ลงไป แล้วเรียงลำดับใหม่
                setManageDates(prev =>
                    [...prev, newDateObj].sort((a, b) => a.date.localeCompare(b.date))
                );

                Toast.fire({ icon: 'success', title: 'เพิ่มวันที่เรียบร้อย' });
                setNewDate("");
            } else {
                Swal.fire("แจ้งเตือน", res.message, "warning");
            }
        } catch (err) {
            Swal.fire("Error", "เชื่อมต่อไม่ได้", "error");
        } finally {
            setAddingDate(false);
        }
    };


    // const handleDeleteDate = async (dateStr) => {
    //     const confirm = await Swal.fire({
    //         title: 'ปิดรับจอง?',
    //         text: `ต้องการลบวันที่ ${formatThaiDateAdmin(dateStr)} ออกจากระบบ?`,
    //         icon: 'warning',
    //         showCancelButton: true,
    //         confirmButtonColor: '#d33',
    //         confirmButtonText: 'ลบเลย'
    //     });

    //     if (confirm.isConfirmed) {
    //         Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    //         try {
    //             const res = await deleteOpenDate(dateStr);
    //             Swal.close();
    //             if (res.ok) {
    //                 setManageDates(prev => prev.filter(d => d !== dateStr));
    //                 Toast.fire({ icon: 'success', title: 'ลบเรียบร้อย' });
    //             } else {
    //                 throw new Error(res.message);
    //             }
    //         } catch (err) { Swal.fire("Error", "ลบไม่ได้: " + err.message, "error"); }
    //     }
    // };

    // 3. แก้ handleDeleteDate ให้รองรับ Object แทน String
    const handleDeleteDate = async (dateStr) => {
        const confirm = await Swal.fire({
            title: 'ปิดรับจอง?',
            text: `ต้องการลบวันที่ ${formatThaiDateAdmin(dateStr)} ออกจากระบบ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ลบเลย'
        });

        if (confirm.isConfirmed) {
            Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
            try {
                const res = await deleteOpenDate(dateStr);
                Swal.close();
                if (res.ok) {
                    // ✅ แก้ตรงนี้: เช็คว่า d.date ไม่เท่ากับวันที่เราลบ
                    setManageDates(prev => prev.filter(d => d.date !== dateStr));

                    Toast.fire({ icon: 'success', title: 'ลบเรียบร้อย' });
                } else {
                    throw new Error(res.message);
                }
            } catch (err) { Swal.fire("Error", "ลบไม่ได้: " + err.message, "error"); }
        }
    };

    // --- Computed Data ---
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const searchLower = searchTerm.toLowerCase();
            const matchSearch = (b.name || "").toLowerCase().includes(searchLower) || (b.phone || "").includes(searchTerm) || (b.code || "").toLowerCase().includes(searchLower);
            const matchStatus = filterStatus === "ALL" || b.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [bookings, searchTerm, filterStatus]);

    const chartData = useMemo(() => {
        const stats = {};
        bookings.forEach(b => {
            if (b.status !== "CANCELLED") {
                const time = b.slot;
                stats[time] = (stats[time] || 0) + 1;
            }
        });
        return Object.keys(stats).sort().map(time => ({ name: time, count: stats[time] }));
    }, [bookings]);

    const pieData = useMemo(() => {
        const stats = { BOOKED: 0, CHECKED_IN: 0, CANCELLED: 0 };
        bookings.forEach(b => { if (stats[b.status] !== undefined) stats[b.status]++; });
        return [
            { name: 'รอรับบริการ', value: stats.BOOKED, color: '#EAB308' },
            { name: 'เช็คอินแล้ว', value: stats.CHECKED_IN, color: '#10B981' },
            { name: 'ยกเลิก', value: stats.CANCELLED, color: '#EF4444' }
        ].filter(i => i.value > 0);
    }, [bookings]);

    const kpiStats = useMemo(() => ({
        total: bookings.length,
        checkedIn: bookings.filter(b => b.status === "CHECKED_IN").length,
        cancelled: bookings.filter(b => b.status === "CANCELLED").length,
        waiting: bookings.filter(b => b.status === "BOOKED").length
    }), [bookings]);

    // --- Scanner Logic ---
    useEffect(() => {
        let mounted = true;
        if (activeTab === "scan" && !scanData && cameraEnabled) {
            const timer = setTimeout(() => { if (mounted) startScanner(); }, 300);
            return () => { mounted = false; clearTimeout(timer); stopScanner(); };
        } else { stopScanner(); }
    }, [activeTab, scanData, cameraEnabled]);

    const startScanner = async () => {
        if (!document.getElementById("reader")) return;
        if (scannerRef.current) await stopScanner();
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        setScanStatus("starting"); setScanErrorMsg("");
        try {
            await html5QrCode.start(
                { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => { handleScanSuccess(decodedText); }, () => { }
            );
            setScanStatus("active");
        } catch (err) {
            setScanStatus("error");
            setScanErrorMsg(err?.name === "NotAllowedError" ? "Browser บล็อกกล้อง" : "ไม่พบกล้อง/HTTPS");
        }
    };

    const stopScanner = async () => {
        const scanner = scannerRef.current;
        if (scanner) {
            try { if (scanner.isScanning) await scanner.stop(); scanner.clear(); } catch (e) { }
            scannerRef.current = null; setScanStatus("idle");
        }
    };

    const handleScanSuccess = async (decodedText) => {
        let finalCode = decodedText;
        try { const url = new URL(decodedText); const c = url.searchParams.get("code"); if (c) finalCode = c; } catch (e) { }
        setCameraEnabled(false);
        Swal.fire({ title: 'กำลังค้นหา...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const res = await getBookingByCode(finalCode);
            Swal.close();
            if (res.ok && res.booking) setScanData(res.booking);
            else Swal.fire({ icon: "error", title: "ไม่พบข้อมูล", text: `รหัส: ${finalCode}`, timer: 2000, showConfirmButton: false });
        } catch (err) { Swal.fire("Error", err.message, "error"); }
    };

    const handleFileUpload = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setCameraEnabled(false);
        Swal.fire({ title: 'กำลังอ่านรูป...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        const html5QrCode = new Html5Qrcode("reader-file-hidden");
        try {
            const result = await html5QrCode.scanFileV2(file, true);
            if (result && result.decodedText) handleScanSuccess(result.decodedText);
        } catch (err) {
            Swal.close(); Swal.fire("อ่านรูปไม่ได้", "ไม่พบ QR Code", "error");
        } finally {
            html5QrCode.clear().catch(() => { });
            e.target.value = '';
        }
    };

    const handleConfirmCheckIn = async () => {
        if (!scanData) return;
        const result = await Swal.fire({
            title: 'ยืนยันการเช็คอิน?',
            html: `ชื่อ: <b>${scanData.name}</b><br/>รหัส: <b>${scanData.code}</b>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            confirmButtonColor: '#059669'
        });
        if (!result.isConfirmed) return;
        Swal.fire({ title: 'กำลังเช็คอิน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const res = await adminUpdateBookingStatus(scanData.code, "CHECKED_IN", authToken);
            Swal.close();
            if (res.ok) {
                Toast.fire({ icon: 'success', title: 'เช็คอินสำเร็จ' });
                handleResetScan();
                reloadData();
            } else { Toast.fire({ icon: 'error', title: res.message }); }
        } catch (err) { Toast.fire({ icon: 'error', title: err.message }); }
    };

    const handleResetScan = () => { setScanData(null); setManualCode(""); };

    // 2. เพิ่มฟังก์ชันสลับสถานะ (Toggle)
    const handleToggleStatus = async (dateObj) => {
        const newStatus = dateObj.status === "OPEN" ? "CLOSED" : "OPEN";

        // Optimistic Update: เปลี่ยนสีปุ่มทันทีเพื่อให้ดูเร็ว (ไม่ต้องรอ Server ตอบ)
        setManageDates(prev => prev.map(d =>
            d.date === dateObj.date ? { ...d, status: newStatus } : d
        ));

        try {
            // ยิง API ไปบอก Backend
            const res = await updateDateStatus(dateObj.date, newStatus);
            if (!res.ok) throw new Error(res.message);
            // ถ้าสำเร็จ ไม่ต้องทำอะไรเพิ่ม เพราะเราแก้หน้าจอไปแล้ว
        } catch (err) {
            // ถ้าพัง! ค่อยเปลี่ยนค่ากลับคืน
            setManageDates(prev => prev.map(d =>
                d.date === dateObj.date ? { ...d, status: dateObj.status } : d
            ));
            Swal.fire("Error", "เปลี่ยนสถานะไม่ได้: " + err.message, "error");
        }
    };
    // --- Render ---
    return (

        <div className="min-h-screen bg-stone-50 font-sans flex flex-col">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap'); .font-sans { font-family: 'Prompt', sans-serif; }`}</style>
            {loading && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all duration-300">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl border border-emerald-100 flex flex-col items-center animate-bounce-slow">
                        {/* ไอคอนหมุนวงกลมสีเขียวสวยๆ */}
                        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
                        <p className="text-emerald-800 font-semibold text-sm animate-pulse">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            )}
            <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <FiActivity size={24} /> <span className="hidden sm:inline">ระบบจัดการคิว</span></div>
                    {isAuthed && (
                        <div className="flex items-center gap-3">
                            <div className=" md:flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>แดชบอร์ด</button>
                                <button onClick={() => setActiveTab("scan")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'scan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>สแกน</button>
                            </div>
                            <button onClick={handleLogout} className="text-xs flex items-center gap-1 text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg font-medium"><FiLogOut /></button>
                        </div>
                    )}
                </div>
            </nav>

            <main className="flex-grow p-4 md:p-6 lg:p-8 flex flex-col items-center">
                {!isAuthed ? (
                    <div className="w-full max-w-md mt-10 bg-white rounded-3xl shadow-xl border border-gray-100 p-8 animate-fade-in-up">
                        <h2 className="text-xl font-bold text-center text-emerald-800 mb-6">เข้าสู่ระบบเจ้าหน้าที่</h2>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input type="password"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl"
                                placeholder="รหัสผ่าน" value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)} />
                            <button type="submit" disabled={loginLoading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2">
                                {/* {loading && <FiLoader className="animate-spin" />} {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"} */}
                                {loginLoading && <FiLoader className="animate-spin" />}
                                {loginLoading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                            </button>
                        </form>
                    </div>
                ) : activeTab === "dashboard" ? (
                    <div className="w-full max-w-7xl space-y-6 animate-fade-in-up">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                <FiCalendar className="text-gray-400" />
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent border-none outline-none text-sm font-medium" />
                            </div>
                            <button onClick={reloadData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-70">
                                <FiRefreshCw className={loading ? "animate-spin" : ""} /> {loading ? "กำลังโหลด..." : "อัปเดตข้อมูล"}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center"><div><p className="text-xs text-gray-500">ทั้งหมด</p><p className="text-xl font-bold">{kpiStats.total}</p></div><FiUsers className="text-gray-300 text-2xl" /></div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center"><div><p className="text-xs text-gray-500">รอรับบริการ</p><p className="text-xl font-bold text-yellow-600">{kpiStats.waiting}</p></div><FiClock className="text-yellow-200 text-2xl" /></div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center"><div><p className="text-xs text-gray-500">เช็คอิน</p><p className="text-xl font-bold text-emerald-600">{kpiStats.checkedIn}</p></div><FiCheckCircle className="text-emerald-200 text-2xl" /></div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center"><div><p className="text-xs text-gray-500">ยกเลิก</p><p className="text-xl font-bold text-rose-600">{kpiStats.cancelled}</p></div><FiXCircle className="text-rose-200 text-2xl" /></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2"><FiBarChart2 /> สถิติการจองวันนี้</h3>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" fontSize={12} tick={{ fontSize: 10 }} />
                                            <YAxis allowDecimals={false} fontSize={12} />
                                            <Tooltip cursor={{ fill: '#f0fdf4' }} contentStyle={{ borderRadius: '8px' }} />
                                            <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2"><FiPieChart /> สัดส่วนสถานะ</h3>
                                <div className="h-[250px] w-full flex justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* Left: Booking Table (ปรับปรุงคอลัมน์แล้ว) */}
                            <div className="lg:col-span-8 flex flex-col h-[600px] bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex gap-3 bg-gray-50/50">
                                    <input type="text" placeholder="ค้นหา..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                    <select className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none cursor-pointer" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                        <option value="ALL">ทุกสถานะ</option><option value="BOOKED">รอรับบริการ</option><option value="CHECKED_IN">เช็คอินแล้ว</option><option value="CANCELLED">ยกเลิกแล้ว</option>
                                    </select>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 sticky top-0 text-xs font-bold text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-4 py-3">เวลา</th>
                                                <th className="px-4 py-3">ชื่อ-สกุล / รหัส</th>
                                                {/* 🔥 แยกคอลัมน์เบอร์โทรออกมา */}
                                                <th className="px-4 py-3">เบอร์โทร</th>
                                                <th className="px-4 py-3">สถานะ</th>
                                                <th className="px-4 py-3 text-right">จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-gray-50">
                                            {filteredBookings.map((b, i) => (
                                                <tr key={i} className="hover:bg-emerald-50/30">
                                                    <td className="px-4 py-3 font-medium text-emerald-700">{b.slot}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-800">{b.name}</div>
                                                        {/* 🔥 รหัสจองอยู่ใต้ชื่อ ตัวเล็ก */}
                                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">#{b.code}</div>
                                                    </td>
                                                    {/* 🔥 เบอร์โทรแยกมานี่ */}
                                                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{b.phone}</td>
                                                    <td className="px-4 py-3">{renderStatusBadge(b.status)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        {b.status === "BOOKED" && <div className="flex justify-end gap-2"><button onClick={() => handleChangeStatus(b, "CHECKED_IN")} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><FiCheckSquare /></button><button onClick={() => handleChangeStatus(b, "CANCELLED")} className="p-1.5 bg-rose-100 text-rose-700 rounded hover:bg-rose-200"><FiXCircle /></button></div>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Right: Sidebar */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2"><FiCalendar className="text-emerald-600" /> วันเปิดให้บริการ</h3>
                                    <div className="flex gap-2 mb-4">
                                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 ring-emerald-500" />
                                        <button
                                            onClick={handleAddDate}
                                            disabled={!newDate || addingDate}
                                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {addingDate ? <FiLoader className="animate-spin" /> : <FiPlus />} {addingDate ? "..." : "เพิ่ม"}
                                        </button>
                                    </div>
                                    {/* <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto pr-1">
                                        {manageDates.length > 0 ? manageDates.map(d => (
                                            <div key={d} className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 text-xs">
                                              
                                                <span className="text-emerald-800 font-medium">{formatThaiDateAdmin(d)}</span>
                                                <button onClick={() => handleDeleteDate(d)} className="text-red-300 hover:text-red-500"><FiTrash2 /></button>
                                            </div>
                                        )) : <p className="text-xs text-gray-400 w-full text-center py-2">ยังไม่มีวันเปิดจอง</p>}
                                    </div> */}



                                    {/* <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1"> */}
                                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                        {manageDates.length > 0 ? manageDates.map((item) => (
                                            <div
                                                key={item.date} // item เป็น object แล้วนะครับ ไม่ใช่ string
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${item.status === "OPEN"
                                                    ? "bg-emerald-50 border-emerald-200"
                                                    : "bg-gray-50 border-gray-200 opacity-75"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {/* ปุ่มแม่กุญแจ (Toggle Status) */}
                                                    <button
                                                        onClick={() => handleToggleStatus(item)}
                                                        className={`p-1.5 rounded-full transition-colors ${item.status === "OPEN"
                                                            ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                                                            }`}
                                                        title={item.status === "OPEN" ? "คลิกเพื่อปิด" : "คลิกเพื่อเปิด"}
                                                    >
                                                        {item.status === "OPEN" ? <FiUnlock size={14} /> : <FiLock size={14} />}
                                                    </button>

                                                    {/* วันที่ */}
                                                    <span className={`text-sm font-medium ${item.status === "OPEN" ? "text-emerald-900" : "text-gray-500 line-through decoration-gray-400"}`}>
                                                        {formatThaiDateAdmin(item.date)}
                                                    </span>
                                                </div>

                                                {/* ปุ่มลบ */}
                                                <button
                                                    onClick={() => handleDeleteDate(item.date)}
                                                    className="text-gray-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-colors"
                                                    title="ลบถาวร"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>
                                        )) : (
                                            // <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                                            <div className="col-span-2 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                                                <p className="text-xs text-gray-400">ยังไม่มีวันเปิดจอง</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col h-[350px]">
                                    <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2"><FiLayers className="text-blue-600" /> จัดการคิว ({slots.length})</h3>
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                        
                                        {slots.map((s) => (
                                            <div key={s.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-2">
                                                <div className="flex justify-between items-center"><span className="font-bold text-xs text-gray-700">{s.label}</span><button onClick={() => handleEditCapacity(s)} className="text-gray-400 hover:text-emerald-600"><FiEdit2 size={12} /></button></div>
                                                <div className="w-full bg-gray-200 rounded-full h-1.5"><div className={`h-full rounded-full ${s.remaining === 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${(s.booked / s.capacity) * 100}%` }}></div></div>
                                                <div className="flex justify-between text-[10px] text-gray-500"><span>จอง {s.booked}/{s.capacity}</span><span>{s.remaining === 0 ? 'เต็ม' : 'ว่าง ' + s.remaining}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                </div> */}
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col h-[350px]">
                                    <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2">
                                        <FiLayers className="text-blue-600" /> จัดการคิว ({Array.isArray(slots) ? slots.length : 0})
                                    </h3>
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">

                                        {/* ✅ แก้ตรงนี้: เช็คว่าเป็น Array และมีข้อมูลไหม ก่อนใช้ .map */}
                                        {Array.isArray(slots) && slots.length > 0 ? (
                                            slots.map((s) => (
                                                <div key={s.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-xs text-gray-700">{s.label}</span>
                                                        <button onClick={() => handleEditCapacity(s)} className="text-gray-400 hover:text-emerald-600">
                                                            <FiEdit2 size={12} />
                                                        </button>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                        <div
                                                            className={`h-full rounded-full ${s.remaining === 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                            style={{ width: `${(s.booked / s.capacity) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-gray-500">
                                                        <span>จอง {s.booked}/{s.capacity}</span>
                                                        <span>{s.remaining === 0 ? 'เต็ม' : 'ว่าง ' + s.remaining}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            // กรณีไม่มีข้อมูล หรือ slots ไม่ใช่ Array
                                            <div className="text-center text-gray-400 text-xs mt-10">
                                                <p>ไม่พบข้อมูลรอบเวลา</p>
                                                <p className="opacity-50">(หรือกำลังโหลด...)</p>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // ... (ส่วน Scanner เหมือนเดิม) ...
                    <div className="w-full max-w-md animate-fade-in-up space-y-6">
                        {!scanData ? (
                            <>
                                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 relative flex flex-col">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-gray-700 flex gap-2 items-center"><FiCamera /> กล้อง</h3>
                                        <button onClick={() => setCameraEnabled(!cameraEnabled)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${cameraEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{cameraEnabled ? 'เปิดอยู่' : 'ปิดอยู่'}</button>
                                    </div>
                                    <div className="relative w-full rounded-xl overflow-hidden bg-black min-h-[250px] mb-4">
                                        {cameraEnabled ? (
                                            <>
                                                <div id="reader" className="w-full h-full"></div>
                                                {scanStatus === 'starting' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 z-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div><span className="text-xs text-gray-500">กำลังเปิด...</span></div>}
                                                {scanStatus === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-center p-4 z-20"><FiAlertTriangle className="text-rose-500 text-3xl mb-2" /><p className="text-xs text-gray-500 mb-2">{scanErrorMsg}</p><button onClick={() => setCameraEnabled(false)} className="text-emerald-600 underline text-xs">ปิดกล้อง</button></div>}
                                            </>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"><FiCameraOff size={40} /><p className="text-sm mt-2">กล้องถูกปิด</p></div>
                                        )}
                                    </div>
                                    <div className="pt-2 border-t border-gray-100">
                                        <div id="reader-file-hidden" className="hidden"></div>
                                        <label className="flex items-center justify-center gap-2 w-full py-3 bg-stone-100 text-stone-600 rounded-xl font-semibold cursor-pointer hover:bg-stone-200 transition-colors"><FiImage /> เลือกรูป QR Code <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
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
                                        <div className="bg-stone-50 p-3 rounded-xl"><p className="text-xs text-gray-400">เวลา</p><b>{scanData.slot_label || scanData.slot}</b></div>
                                        <div className="col-span-2 bg-stone-50 p-3 rounded-xl"><p className="text-xs text-gray-400">เบอร์โทร</p><b>{scanData.phone}</b></div>
                                    </div>
                                    {scanData.status === "CHECKED_IN" && <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm flex gap-2 items-center"><FiCheckCircle /> รายการนี้เช็คอินแล้ว</div>}
                                    {scanData.status === "CANCELLED" && <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-sm flex gap-2 items-center"><FiXCircle /> รายการนี้ถูกยกเลิก</div>}
                                    {scanData.status === "BOOKED" ? (
                                        <button onClick={handleConfirmCheckIn} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98]">ยืนยันเช็คอิน</button>
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