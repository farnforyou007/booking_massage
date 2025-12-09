// src/pages/AdminPage.jsx
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
    adminGetBookings,
    adminGetSlotsSummary,
    adminUpdateSlotCapacity,
    adminUpdateBookingStatus, // ⚠️ ต้องมีฟังก์ชันนี้ใน api.js (ตามที่คุยกันรอบก่อน)
} from "../api";
import {
    FiLock,
    FiCalendar,
    FiRefreshCw,
    FiUser,
    FiPhone,
    FiClock,
    FiCheckCircle,
    FiXCircle,
    FiActivity,
    FiEdit2,
    FiLogOut,
    FiLayers,
    FiUsers,
    FiSearch,
    FiFilter,
    FiCheckSquare,
    FiAlertCircle
} from "react-icons/fi";

const todayStr = () => new Date().toISOString().slice(0, 10);

// Helper แสดงสถานะ (Badge) แบบสวยงาม
function renderStatusBadge(status) {
    switch (status) {
        case "BOOKED":
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200"><FiClock /> รอใช้บริการ</span>;
        case "CHECKED_IN":
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><FiCheckCircle /> เช็คอินแล้ว</span>;
        case "CANCELLED":
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"><FiXCircle /> ยกเลิก</span>;
        default:
            return <span className="text-gray-500">-</span>;
    }
}

export default function AdminPage() {
    // --- States ---
    const [password, setPassword] = useState("");
    const [adminPass, setAdminPass] = useState("");
    const [date, setDate] = useState(todayStr());

    const [bookings, setBookings] = useState([]);
    const [slots, setSlots] = useState([]);

    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false); // สำหรับตอนกดปุ่ม action

    // Filter & Search States
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, BOOKED, CHECKED_IN, CANCELLED

    const isAuthed = useMemo(() => !!adminPass, [adminPass]);

    // --- Computed Data (KPIs & Filtered List) ---
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            // 1. Search Filter
            const searchLower = searchTerm.toLowerCase();
            const matchSearch =
                (b.name || "").toLowerCase().includes(searchLower) ||
                (b.phone || "").includes(searchTerm) ||
                (b.code && b.code.toLowerCase().includes(searchLower));

            // 2. Status Filter
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


    // --- Actions ---
    async function handleLogin(e) {
        e.preventDefault();
        if (!password.trim()) { Swal.fire("แจ้งเตือน", "กรุณากรอกรหัสผ่าน", "warning"); return; }
        setLoading(true);
        try {
            // ลองดึงข้อมูลเพื่อเช็ครหัส
            const res = await adminGetBookings(date, password.trim());
            if (res && res.auth) {
                setAdminPass(password.trim());
                setBookings(res.items || []);
                await reloadSlots(date, password.trim());
            } else {
                Swal.fire("ผิดพลาด", res?.message || "รหัสผ่านไม่ถูกต้อง", "error");
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        } finally {
            setLoading(false);
        }
    }

    async function reloadData() {
        if (!adminPass) return;
        setLoading(true);
        try {
            const [resB, resS] = await Promise.all([
                adminGetBookings(date, adminPass),
                adminGetSlotsSummary(date, adminPass)
            ]);
            if (resB.ok) setBookings(resB.items || []);
            if (resS.ok) setSlots(resS.items || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function reloadSlots(targetDate, pass) {
        const res = await adminGetSlotsSummary(targetDate, pass);
        if (res.ok) setSlots(res.items || []);
    }

    // เปลี่ยนสถานะ (Check-in / Cancel)
    async function handleChangeStatus(booking, newStatus) {
        const actionName = newStatus === "CHECKED_IN" ? "เช็คอิน (Check-in)" : "ยกเลิก (Cancel)";
        const confirmColor = newStatus === "CHECKED_IN" ? "#059669" : "#dc2626";

        const result = await Swal.fire({
            title: `ยืนยันการ${actionName}?`,
            html: `ผู้ป่วย: <b>${booking.name}</b><br>รหัส: ${booking.code}`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: confirmColor,
            confirmButtonText: "ยืนยัน",
            cancelButtonText: "ถอยกลับ"
        });

        if (!result.isConfirmed) return;

        try {
            setLoadingAction(true);
            const res = await adminUpdateBookingStatus(booking.code, newStatus, adminPass);

            if (res.ok) {
                // อัปเดต state ทันที (Optimistic update)
                const updatedList = bookings.map(b => b.code === booking.code ? { ...b, status: newStatus } : b);
                setBookings(updatedList);

                // โหลด Slot ใหม่ เพราะจำนวนคงเหลือเปลี่ยน
                await reloadSlots(date, adminPass);

                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true,
                });
                Toast.fire({ icon: 'success', title: `เปลี่ยนสถานะเรียบร้อย` });
            } else {
                Swal.fire("ผิดพลาด", res.message, "error");
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        } finally {
            setLoadingAction(false);
        }
    }

    // แก้ไขจำนวนรับ (Slot Capacity)
    async function handleEditCapacity(slot) {
        const { value: newCap } = await Swal.fire({
            title: `แก้ไขจำนวนรับ (${slot.label})`,
            input: "number",
            inputValue: slot.capacity,
            inputAttributes: { min: "0", step: "1" },
            showCancelButton: true,
            confirmButtonText: "บันทึก",
            confirmButtonColor: "#059669",
        });

        if (newCap !== undefined && newCap !== null) {
            try {
                setLoadingAction(true);
                const res = await adminUpdateSlotCapacity(slot.id, newCap, adminPass);
                if (res.ok) {
                    await reloadSlots(date, adminPass);
                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                    Toast.fire({ icon: 'success', title: 'อัปเดตจำนวนคิวเรียบร้อย' });
                } else {
                    Swal.fire("บันทึกไม่สำเร็จ", res.message, "error");
                }
            } catch (err) {
                Swal.fire("Error", err.message, "error");
            } finally {
                setLoadingAction(false);
            }
        }
    }

    // เมื่อเปลี่ยนวันที่ ให้โหลดข้อมูลใหม่
    useEffect(() => {
        if (adminPass) reloadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, adminPass]);

    return (
        <div className="min-h-screen bg-stone-50 font-sans flex flex-col">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

            {/* Navbar */}
            <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><FiActivity /></div>
                        <span className="hidden sm:inline">ระบบจัดการคิวแพทย์แผนไทย</span>
                        <span className="sm:hidden">Admin Panel</span>
                    </div>
                    {isAuthed && (
                        <button onClick={() => setAdminPass("")} className="text-xs flex items-center gap-1 text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full font-medium transition-colors">
                            <FiLogOut /> ออกจากระบบ
                        </button>
                    )}
                </div>
            </nav>

            <main className="flex-grow p-4 md:p-6 lg:p-8 flex flex-col items-center">

                {/* --- SCENE 1: Login --- */}
                {!isAuthed && (
                    <div className="w-full max-w-md animate-fade-in-up mt-10">
                        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                            <div className="bg-emerald-800 p-6 text-center text-white relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-white/30"><FiLock /></div>
                                    <h2 className="text-xl font-bold">เข้าสู่ระบบเจ้าหน้าที่</h2>
                                    <p className="text-emerald-200 text-sm font-light">เพื่อจัดการข้อมูลการจอง</p>
                                </div>
                            </div>
                            <div className="p-8">
                                <form onSubmit={handleLogin} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">วันที่ตรวจสอบ</label>
                                        <input type="date" className="w-full pl-3 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={date} onChange={(e) => setDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">รหัสผ่าน</label>
                                        <input type="password" className="w-full pl-3 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all transform active:scale-[0.98] disabled:opacity-70">
                                        {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                                    </button>
                                </form>
                            </div>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-6">© ระบบลงทะเบียนนวดรักษา แพทย์แผนไทย</p>
                    </div>
                )}

                {/* --- SCENE 2: Dashboard --- */}
                {isAuthed && (
                    <div className="w-full max-w-7xl space-y-6 animate-fade-in-up">

                        {/* 1. Tools Bar */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 flex-1">
                                    <FiCalendar className="text-gray-400" />
                                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none outline-none text-sm text-gray-700 font-medium" />
                                </div>
                                <button onClick={() => setDate(todayStr())} className="text-xs text-emerald-600 font-bold hover:bg-emerald-50 px-3 py-2 rounded-lg transition-colors">วันนี้</button>
                            </div>
                            <button onClick={reloadData} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium shadow hover:bg-emerald-700 transition-colors w-full sm:w-auto justify-center">
                                <FiRefreshCw className={loading ? "animate-spin" : ""} /> อัปเดตข้อมูล
                            </button>
                        </div>

                        {/* 2. KPI Dashboard (Mini Stats) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                                <div><p className="text-xs text-gray-500">ผู้ลงทะเบียนทั้งหมด</p><p className="text-2xl font-bold text-gray-800">{kpiStats.total}</p></div>
                                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center"><FiUsers /></div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                                <div><p className="text-xs text-gray-500">รอเข้ารับบริการ</p><p className="text-2xl font-bold text-yellow-600">{kpiStats.waiting}</p></div>
                                <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center"><FiClock /></div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                                <div><p className="text-xs text-gray-500">เช็คอินแล้ว</p><p className="text-2xl font-bold text-emerald-600">{kpiStats.checkedIn}</p></div>
                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><FiCheckCircle /></div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                                <div><p className="text-xs text-gray-500">ยกเลิก</p><p className="text-2xl font-bold text-rose-600">{kpiStats.cancelled}</p></div>
                                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center"><FiXCircle /></div>
                            </div>
                        </div>

                        {/* 3. Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* LEFT: Bookings Table (8 Cols) */}
                            <div className="lg:col-span-8 flex flex-col h-[650px] bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
                                {/* Filters Toolbar */}
                                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between bg-gray-50/50">
                                    <div className="relative flex-1">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="ค้นหา ชื่อ, เบอร์, รหัส..."
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative w-full sm:w-40">
                                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <select
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white cursor-pointer transition-all"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                        >
                                            <option value="ALL">ทุกสถานะ</option>
                                            <option value="BOOKED">รอรับบริการ</option>
                                            <option value="CHECKED_IN">เช็คอินแล้ว</option>
                                            <option value="CANCELLED">ยกเลิกแล้ว</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    {filteredBookings.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                            <FiSearch size={32} className="text-gray-200" />
                                            <span className="text-sm">ไม่พบข้อมูลตามเงื่อนไข</span>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50 sticky top-0 z-10 text-xs font-bold text-gray-500 uppercase tracking-wider shadow-sm">
                                                <tr>
                                                    <th className="px-4 py-3 border-b border-gray-100">เวลา</th>
                                                    <th className="px-4 py-3 border-b border-gray-100">ข้อมูลผู้จอง</th>
                                                    <th className="px-4 py-3 border-b border-gray-100 text-center">สถานะ</th>
                                                    <th className="px-4 py-3 border-b border-gray-100 text-right">จัดการ</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm divide-y divide-gray-50">
                                                {filteredBookings.map((b, idx) => (
                                                    <tr key={idx} className="hover:bg-emerald-50/30 transition-colors group">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="font-bold text-emerald-700">{b.slot}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono bg-gray-100 inline-block px-1 rounded mt-0.5">{b.code}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-800">{b.name}</div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><FiPhone size={10} /> {b.phone}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {renderStatusBadge(b.status)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {/* Action Buttons (Show only if BOOKED) */}
                                                            {b.status === "BOOKED" && (
                                                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        disabled={loadingAction}
                                                                        onClick={() => handleChangeStatus(b, "CHECKED_IN")}
                                                                        className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 hover:shadow-sm transition-all"
                                                                        title="เช็คอิน (มาแล้ว)"
                                                                    >
                                                                        <FiCheckSquare size={16} />
                                                                    </button>
                                                                    <button
                                                                        disabled={loadingAction}
                                                                        onClick={() => handleChangeStatus(b, "CANCELLED")}
                                                                        className="p-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 hover:shadow-sm transition-all"
                                                                        title="ยกเลิกการจอง"
                                                                    >
                                                                        <FiXCircle size={16} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Slots (4 Cols) */}
                            <div className="lg:col-span-4 flex flex-col h-[650px] bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><FiLayers className="text-purple-600" /> จัดการคิว</h3>
                                    <span className="text-xs text-gray-400">{slots.length} รอบ</span>
                                </div>
                                <div className="flex-1 overflow-auto p-4 space-y-3 bg-stone-50 custom-scrollbar">
                                    {loading ? (
                                        <div className="text-center py-10 text-xs text-gray-400">กำลังโหลด...</div>
                                    ) : slots.length === 0 ? (
                                        <div className="text-center py-10 text-xs text-gray-400">ไม่พบช่วงเวลา</div>
                                    ) : (
                                        slots.map((slot) => (
                                            <div key={slot.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-gray-700 text-sm flex items-center gap-1">
                                                            <FiClock className="text-emerald-500" size={12} /> {slot.label}
                                                        </h4>
                                                    </div>
                                                    <button
                                                        disabled={loadingAction}
                                                        onClick={() => handleEditCapacity(slot)}
                                                        className="text-gray-400 hover:text-emerald-600 p-1 rounded hover:bg-gray-50"
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
                                                    <div className={`h-full rounded-full transition-all duration-500 ${slot.remaining === 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (slot.booked / slot.capacity) * 100)}%` }}></div>
                                                </div>

                                                <div className="flex justify-between text-xs items-center">
                                                    <span className="text-gray-500">จอง {slot.booked} / {slot.capacity}</span>
                                                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${slot.remaining === 0 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                                        {slot.remaining === 0 ? 'เต็ม' : 'ว่าง ' + slot.remaining}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}