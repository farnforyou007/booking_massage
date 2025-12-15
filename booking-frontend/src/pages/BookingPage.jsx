// src/pages/BookingPage.jsx
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { getSlots, createBooking, getOpenDates } from "../api";
import { QRCodeCanvas } from "qrcode.react";
import liff from "@line/liff";
import {
    FiCalendar,
    FiClock,
    FiUser,
    FiPhone,
    FiCheckCircle,
    FiAlertCircle,
    FiMapPin,
    FiActivity,
    FiLoader // เพิ่มไอคอนหมุน
} from "react-icons/fi";

export default function BookingPage() {
    // --- State Management ---
    const [date, setDate] = useState("");
    const [slots, setSlots] = useState([]);
    const [slotId, setSlotId] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");

    // UI States
    const [loadingDates, setLoadingDates] = useState(true); // สถานะโหลดวันที่
    const [isSubmitting, setIsSubmitting] = useState(false); // สถานะตอนกดจอง
    const [slotStatus, setSlotStatus] = useState({ text: "", type: "" }); // สถานะโหลดรอบ

    // Data & Config
    const [availableDates, setAvailableDates] = useState([]);
    const [message, setMessage] = useState({ text: "", ok: true });
    const [bookingCode, setBookingCode] = useState("");
    const [ticketUrl, setTicketUrl] = useState("");

    // Line Profile
    const [lineUserId, setLineUserId] = useState("");
    const [lineDisplayName, setLineDisplayName] = useState("");

    const [dateError, setDateError] = useState("");

    useEffect(() => {
        document.title = "จองคิวกิจกรรมนวดรักษาอาการ | คณะการแพทย์แผนไทย";
    }, []);
    // 🔥 ฟังก์ชันแปลงวันที่เป็นไทยแบบเต็ม (ใช้ใน Dropdown)
    const formatFullThaiDate = (dateStr) => {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split('-');
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long', // เต็ม (มกราคม)
            year: 'numeric' // 2568
        });
    };

    // --- 1. Load Available Dates (โหลดวันที่เมื่อเข้าเว็บ) ---
    useEffect(() => {
        setLoadingDates(true);
        getOpenDates()
            .then(res => {
                if (res.dates) {
                    setAvailableDates(res.dates);
                }
            })
            .catch(err => {
                console.error("Failed to load dates:", err);
                Swal.fire("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลวันที่ได้ กรุณาลองใหม่", "error");
            })
            .finally(() => {
                setLoadingDates(false); // หยุดหมุนไม่ว่าจะสำเร็จหรือพัง
            });
    }, []);

    // --- 2. Load Slots (โหลดรอบเวลาเมื่อเลือกวัน) ---
    useEffect(() => {
        if (!date) {
            setSlotStatus({ text: "", type: "" });
            setSlots([]);
            return;
        }

        // เริ่มโหลด: ขึ้นสีส้ม + หมุน
        setSlotStatus({
            text: `กำลังโหลดช่วงเวลา...`,
            type: "loading"
        });
        setSlots([]); // เคลียร์รอบเก่า
        setSlotId(""); // เคลียร์เวลาที่เลือกค้างไว้

        let cancelled = false;

        getSlots(date)
            .then((data) => {
                if (cancelled) return;
                const items = data.items || [];

                if (items.length === 0) {
                    setSlotStatus({
                        text: "❌ วันนี้ยังไม่มีรอบว่าง หรือปิดให้บริการ",
                        type: "error"
                    });
                } else {
                    setSlotStatus({
                        text: `✅ เลือกช่วงเวลาที่ต้องการ`,
                        type: "success"
                    });
                }
                setSlots(items);
            })
            .catch((err) => {
                if (cancelled) return;
                setSlotStatus({
                    text: "⚠️ โหลดข้อมูลไม่สำเร็จ: " + err.message,
                    type: "error"
                });
            });

        return () => { cancelled = true; };
    }, [date]);

    // --- 3. Initialize LIFF ---
    useEffect(() => {
        const initLiff = async () => {
            try {
                await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });
                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    setLineUserId(profile.userId);
                    setLineDisplayName(profile.displayName);
                } else {
                    // 👇🔥 ใส่บรรทัดนี้กลับมาครับ (สำหรับขึ้น Production)
                    // liff.login();
                }
            } catch (err) {
                console.error("LIFF Init Error:", err);
            }
        };
        initLiff();
    }, []);

    // --- 4. Handle Submit ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!date || !slotId || !name.trim() || !phone.trim()) {
            setMessage({ text: "กรุณากรอกข้อมูลให้ครบทุกช่อง", ok: false });
            return;
        }

        const phoneDigits = phone.replace(/[^0-9]/g, "");
        if (phoneDigits.length !== 10) {
            await Swal.fire("เบอร์โทรไม่ถูกต้อง", "กรุณากรอกเบอร์มือถือ 10 หลัก", "warning");
            return;
        }

        // หาชื่อรอบเวลาเพื่อมาแสดงใน Pop-up Confirm
        const selectedSlot = slots.find((s) => String(s.id) === String(slotId));
        const slotLabel = selectedSlot ? selectedSlot.label : "";

        // Confirm Dialog
        const result = await Swal.fire({
            title: "ยืนยันการจอง?",
            html: `
                <div class="text-left text-sm p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p class="mb-1"><strong>วันที่:</strong> <span class="text-emerald-700">${date}</span></p>
                    <p class="mb-1"><strong>เวลา:</strong> <span class="text-emerald-700">${slotLabel}</span></p>
                    <p class="mb-1"><strong>ชื่อ:</strong> ${name}</p>
                    <p><strong>เบอร์โทร:</strong> ${phoneDigits}</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "ยืนยันการจอง",
            cancelButtonText: "แก้ไข",
            confirmButtonColor: "#047857",
        });

        if (!result.isConfirmed) return;

        // Start Submit Process
        setIsSubmitting(true); // 🔄 เริ่มหมุนปุ่ม Submit
        setMessage({ text: "กำลังบันทึกข้อมูล...", ok: true });

        try {
            const res = await createBooking({
                date,
                slot_id: slotId,
                name: name.trim(),
                phone: phoneDigits,
                line_user_id: lineUserId || "NO_LIFF_ID",
            });

            if (res.ok === false) {
                throw new Error(res.message || "การจองไม่สำเร็จ");
            }

            const code = res.booking_code || res.code;
            if (!code) throw new Error("ไม่ได้รับรหัสยืนยันจากระบบ");

            // Success Handling
            const LIFF_URL = "https://liff.line.me/2008672437-ULl4HDOy"; // ⚠️ ตรวจสอบ ID
            const ticketLink = `${LIFF_URL}/ticket?code=${code}`;

            setBookingCode(code);
            setTicketUrl(ticketLink);
            setMessage({ text: "จองสำเร็จเรียบร้อย!", ok: true });

            await Swal.fire({
                icon: "success",
                title: "จองคิวสำเร็จ!",
                html: `รหัสจอง: <b class="text-emerald-600 text-xl">${code}</b><br/><span class="text-sm text-gray-500">กรุณาแคปหน้าจอไว้เป็นหลักฐาน</span>`,
                timer: 5000,
                showConfirmButton: true,
                confirmButtonText: "ตกลง"
            });

        } catch (err) {
            setMessage({ text: err.message, ok: false });
            Swal.fire({
                icon: 'error',
                title: 'ขออภัย',
                text: err.message
            });
        } finally {
            setIsSubmitting(false); // ⏹️ หยุดหมุน
        }
    };

    // --- Render ---
    return (
        <div className="min-h-screen flex font-sans bg-stone-50 relative">
            {/* Styles & Animation */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600&display=swap');
                .font-sans { font-family: 'Prompt', sans-serif; }
                .fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
                @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob { animation: blob 7s infinite; }
                .animation-delay-2000 { animation-delay: 2s; }
            `}</style>

            {(loadingDates || isSubmitting) && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all duration-300">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl border border-emerald-100 flex flex-col items-center animate-bounce-slow">
                        {/* ไอคอนหมุน */}
                        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
                        
                        {/* ข้อความเปลี่ยนตามสถานะ */}
                        <p className="text-emerald-800 font-semibold text-sm animate-pulse">
                            {isSubmitting ? "กำลังบันทึกการจอง..." : "กำลังโหลดข้อมูล..."}
                        </p>
                    </div>
                </div>
            )}

            {/* Left Side: Image Banner */}
            <div className="hidden md:flex md:w-1/2 bg-emerald-800 relative overflow-hidden">
                <img src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2070" alt="Thai Medicine" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
                <div className="relative z-10 m-auto text-center px-10">
                    <div className="mb-6 inline-block p-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <FiActivity className="text-white text-5xl" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide">คณะการแพทย์แผนไทย</h1>
                    <p className="text-emerald-100 text-base md:text-lg font-light leading-relaxed">
                        บริการตรวจรักษาด้วยศาสตร์การแพทย์แผนไทย<br />นวดรักษา ประคบสมุนไพร
                    </p>
                </div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            </div>

            {/* Right Side: Form */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-8 md:p-12 overflow-y-auto">
                <div className="w-full max-w-md space-y-8 fade-in-up">

                    {/* Header */}
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-emerald-900">ลงทะเบียนนวดรักษาอาการ</h2>
                        {lineDisplayName && (
                            <p className="mt-2 text-emerald-600 font-medium">สวัสดีคุณ {lineDisplayName} 👋</p>
                        )}
                        <p className="mt-2 text-gray-600">กรุณากรอกข้อมูลเพื่อจองคิวล่วงหน้า</p>
                    </div>

                    {/* Location Info */}
                    <div className="bg-white border-l-4 border-emerald-500 shadow-sm rounded-r-lg p-4 flex items-start gap-3">
                        <FiMapPin className="text-emerald-600 mt-1 text-lg flex shrink-0" />
                        <div className="text-sm text-gray-600">
                            <p className="font-semibold text-emerald-800">สถานที่ให้บริการ</p>
                            <p>โรงพยาบาลแพทย์แผนไทย มหาวิทยาลัยสงขลานครินทร์ </p>
                            <p> อาคารสหเวช ชั้น 7 ห้อง TTM704</p>
                            <p className="text-xs text-gray-400 mt-1">เปิดบริการตามวันที่กำหนด</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 flex justify-between">
                                วันที่ร่วมกิจกรรม <span className="text-red-500">*</span>
                                {loadingDates && <span className="text-xs text-emerald-600 flex items-center gap-1"><FiLoader className="animate-spin" /> กำลังโหลดวันที่...</span>}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiCalendar className="text-gray-400" />
                                </div>

                                <select
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    // 🔥 แก้ตรงนี้ 1: ปิดการใช้งานถ้ากำลังโหลด หรือไม่มีวันเปิดจอง
                                    disabled={loadingDates || availableDates.length === 0}
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white cursor-pointer appearance-none min-h-[50px] text-base disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                    required
                                >
                                    {/* 🔥 แก้ตรงนี้ 2: เปลี่ยนข้อความตามสถานะ */}
                                    <option value="">
                                        {loadingDates
                                            ? "⏳ กำลังโหลดวันที่..."
                                            : availableDates.length === 0
                                                ? "⚠️ ยังไม่มีรอบเปิดให้บริการ"
                                                : "-- กรุณาเลือกวันที่ --"
                                        }
                                    </option>

                                    {availableDates.map((d) => (
                                        <option key={d} value={d}>
                                            {formatFullThaiDate(d)}
                                        </option>
                                    ))}
                                </select>

                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                            </div>

                            {/* 🔥 แก้ตรงนี้ 3: เพิ่มข้อความแจ้งเตือนตัวแดง ถ้าไม่มีวันเปิดจอง */}
                            {!loadingDates && availableDates.length === 0 && (
                                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1 animate-pulse">
                                    <FiAlertCircle /> ขออภัย ขณะนี้ระบบยังไม่มีกำหนดการเปิดรับลงทะเบียน
                                </p>
                            )}

                            {/* แสดงสถานะการโหลดรอบ (Slot Loading) อันเดิมของคุณ */}
                            {slotStatus.text && (
                                <div className={`mt-2 text-xs md:text-sm p-3 rounded-lg flex items-center gap-2 animate-fade-in-up transition-colors duration-300 
                                    ${slotStatus.type === "loading" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                                        slotStatus.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                            "bg-red-50 text-red-700 border border-red-200"
                                    }`}>
                                    {slotStatus.type === "loading" && <FiLoader className="animate-spin" />}
                                    {slotStatus.text}
                                </div>
                            )}
                        </div>

                        {/* 2. Slot Select */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">ช่วงเวลา <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiClock className="text-gray-400" />
                                </div>
                                <select
                                    value={slotId}
                                    onChange={(e) => setSlotId(e.target.value)}
                                    // ปิดถ้ายังไม่ได้เลือกวัน หรือกำลังโหลด
                                    disabled={!date || slotStatus.type === "loading"}
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white appearance-none transition-colors cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
                                    required
                                >
                                    <option value="">-- กรุณาเลือกช่วงเวลา --</option>
                                    {slots.map((s) => {
                                        const remaining = typeof s.remaining === "number" ? s.remaining : Number(s.capacity || 0) - Number(s.booked || 0);
                                        const isFull = remaining <= 0;
                                        return (
                                            <option key={s.id} value={s.id} disabled={isFull} className={isFull ? "text-gray-400 bg-gray-50" : "text-gray-900"}>
                                                {s.label} {isFull ? "(เต็ม)" : `(ว่าง ${remaining})`}
                                            </option>
                                        );
                                    })}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {/* 3. Name */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">ชื่อ–นามสกุล <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiUser className="text-gray-400" />
                                    </div>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white" placeholder="ระบุชื่อจริง" required />
                                </div>
                            </div>

                            {/* 4. Phone */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiPhone className="text-gray-400" />
                                    </div>
                                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white" placeholder="08xxxxxxxx" maxLength={10} required />
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            // ปิดปุ่มถ้าข้อมูลไม่ครบ หรือ กำลังบันทึก(isSubmitting)
                            disabled={!date || !slotId || !name || !phone || isSubmitting}
                            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
                        >
                            {/* 🔄 ถ้ากำลังบันทึก ให้โชว์ Spinner แทนข้อความ */}
                            {isSubmitting ? (
                                <>
                                    <FiLoader className="animate-spin text-xl" />
                                    กำลังบันทึกข้อมูล...
                                </>
                            ) : (
                                "ยืนยันการจองคิว"
                            )}
                        </button>
                    </form>

                    {/* Notification Area (Text) */}
                    {message.text && (
                        <div className={`rounded-lg p-4 flex items-start gap-3 text-sm animate-pulse ${message.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                            {message.ok ? <FiCheckCircle className="mt-0.5 text-lg" /> : <FiAlertCircle className="mt-0.5 text-lg" />}
                            <div className="whitespace-pre-line">{message.text}</div>
                        </div>
                    )}

                    {/* Ticket Result (QR Code) */}
                    {ticketUrl && (
                        <div className="mt-8 border-t-2 border-dashed border-gray-200 pt-6 flex flex-col items-center text-center fade-in-up">
                            <h3 className="text-lg font-semibold text-emerald-900">ลงทะเบียนสำเร็จ</h3>
                            <p className="text-gray-500 text-sm mb-4">บันทึก QR Code นี้เพื่อแสดงต่อเจ้าหน้าที่</p>
                            <div className="p-3 bg-white border border-gray-200 shadow-lg rounded-xl">
                                <QRCodeCanvas value={ticketUrl} size={180} level={"H"} />
                            </div>
                            <div className="mt-4 inline-block px-4 py-2 bg-gray-100 rounded-full">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mr-2">Booking ID</span>
                                <span className="font-mono text-emerald-700 font-bold text-lg">{bookingCode}</span>
                            </div>
                        </div>
                    )}

                    <div className="text-center text-xs text-gray-400 mt-8">
                        © {new Date().getFullYear()} คณะการแพทย์แผนไทย <br /> พัฒนาระบบโดย ทีมงานสารสนเทศ
                    </div>
                </div>
            </div>
        </div>
    );
}