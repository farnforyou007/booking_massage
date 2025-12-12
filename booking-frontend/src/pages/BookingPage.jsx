// src/pages/BookingPage.jsx
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { getSlots, createBooking } from "../api";
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
    FiActivity
} from "react-icons/fi";

export default function BookingPage() {
    const [date, setDate] = useState("");
    const [slots, setSlots] = useState([]);
    const [slotId, setSlotId] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState({ text: "", ok: true });
    const [bookingCode, setBookingCode] = useState("");
    const [ticketUrl, setTicketUrl] = useState("");
    const API_BASE = import.meta.env.VITE_API_BASE;
    const [lineUserId, setLineUserId] = useState(""); // 👈 เพิ่มตัวนี้
    const [lineDisplayName, setLineDisplayName] = useState("");
    const [dateError, setDateError] = useState("");

    const [slotStatus, setSlotStatus] = useState({ text: "", type: "" }); // (เก็บสถานะโหลดรอบ)

    useEffect(() => {
        document.title = "จองคิวกิจกรรมนวดรักษาอาการ | คณะการแพทย์แผนไทย";
    }, []);
    // --- Logic เดิม (ไม่เปลี่ยนแปลง) ---
    // --- Logic โหลดรอบเวลา (ปรับปรุงใหม่) ---
    useEffect(() => {
        if (!date) {
            setSlotStatus({ text: "", type: "" }); // ล้างสถานะถ้าไม่มีวันที่
            return;
        }

        // 🟠 1. ตั้งสถานะเป็น "กำลังโหลด" (สีส้ม)
        setSlotStatus({
            text: ` กำลังโหลดช่วงเวลาสำหรับวันที่ ${date} ...`,
            type: "loading"
        });

        // ล้างข้อความเก่า (Notification Area) ทิ้งไป เพราะเราย้ายมาตรงนี้แล้ว
        setMessage({ text: "", ok: true });

        let cancelled = false;

        getSlots(date)
            .then((data) => {
                if (cancelled) return;
                const items = data.items || [];
                if (!items.length) {
                    // 🔴 2. ถ้าไม่มีรอบ (สีแดง)
                    setSlotStatus({
                        text: "❌ วันนี้ยังไม่มีรอบว่าง หรือปิดให้บริการ",
                        type: "error"
                    });
                } else {
                    // 🟢 3. ถ้าเจอรอบ (สีเขียว)
                    setSlotStatus({
                        text: `✅ โหลดสำเร็จ เลือกช่วงเวลาที่ต้องการได้เลย`,
                        type: "success"
                    });
                }
                setSlots(items);
            })
            .catch((err) => {
                if (cancelled) return;
                // 🔴 4. ถ้า Error (สีแดง)
                setSlotStatus({
                    text: "⚠️ โหลดช่วงเวลาไม่สำเร็จ: " + err.message,
                    type: "error"
                });
                setSlots([]);
            });

        return () => {
            cancelled = true;
        };
    }, [date]);

    // --- LIFF INITIALIZATION ---
    useEffect(() => {
        const initLiff = async () => {
            try {
                // ดึง LIFF ID จาก .env
                await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });

                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    setLineUserId(profile.userId);
                    setLineDisplayName(profile.displayName);

                    // (Option) ถ้าอยากให้ชื่อ User ในไลน์ เด้งไปใส่ในช่องชื่ออัตโนมัติ ให้เปิดบรรทัดล่างนี้
                    // if (!name) setName(profile.displayName); 
                } else {
                    // ถ้ายังไม่ล็อกอิน และเปิดในมือถือ (ในไลน์) มันจะล็อกอินเอง
                    // แต่ถ้าเปิดในคอม อาจจะต้องสั่ง liff.login()
                    liff.login();
                }
            } catch (err) {
                console.error("LIFF Init Error:", err);
            }
        };

        initLiff();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!date || !slotId || !name.trim() || !phone.trim()) {
            setMessage({ text: "กรุณากรอกข้อมูลให้ครบ", ok: false });
            return;
        }

        const phoneDigits = phone.replace(/[^0-9]/g, "");
        if (phoneDigits.length !== 10) {
            await Swal.fire(
                "เบอร์โทรไม่ถูกต้อง",
                "กรุณากรอกเบอร์โทร 10 หลัก เช่น 0891234567",
                "error"
            );
            return;
        }

        const slotLabel =
            slots.find((s) => String(s.id) === String(slotId))?.label || "";
        const slotDisplayText = slots.find(
            (s) => String(s.id) === String(slotId)
        )?.displayText;

        const result = await Swal.fire({
            title: "ยืนยันการลงทะเบียน?",
            html: `
        <div class="text-left text-sm p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p class="mb-1"><strong>วันที่:</strong> <span class="text-emerald-700">${date}</span></p>
            <p class="mb-1"><strong>ช่วงเวลา:</strong> <span class="text-emerald-700">${slotDisplayText || slotLabel}</span></p>
            <p class="mb-1"><strong>ชื่อ:</strong> ${name}</p>
            <p><strong>เบอร์โทร:</strong> ${phoneDigits}</p>
        </div>
      `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "ยืนยันการจอง",
            cancelButtonText: "ยกเลิก",
            confirmButtonColor: "#047857", // Emerald-700
            cancelButtonColor: "#6b7280",
        });

        if (!result.isConfirmed) return;

        try {
            setMessage({ text: "กำลังส่งข้อมูลการจอง...", ok: true });

            const res = await createBooking({
                date,
                slot_id: slotId,
                name: name.trim(),
                phone: phoneDigits,
                line_user_id: lineUserId || "NO_LIFF_ID", // 👈 เพิ่มบรรทัดนี้สำคัญมาก! 
            });

            // 🔥🔥🔥 เพิ่มส่วนนี้เข้าไปครับ 🔥🔥🔥
            // เช็คว่า Backend ตอบกลับมาว่าไม่สำเร็จหรือไม่ (เช่น จองซ้ำ หรือ เต็ม)
            if (res.ok === false) {
                throw new Error(res.message || "การจองไม่สำเร็จ");
            }
            // ------------------------------------

            const code = res.booking_code || res.code;

            if (!code) {
                throw new Error("ระบบตอบรับการจอง แต่ไม่ได้รับรหัสยืนยัน");
            }

            const LIFF_URL = "https://liff.line.me/2008672437-ULl4HDOy";
            const ticketLink = `${LIFF_URL}/ticket?code=${code}`;;

            setBookingCode(code);
            setTicketUrl(ticketLink);

            setMessage({
                text: "จองสำเร็จ เรียบร้อยแล้ว",
                ok: true,
            });

            await Swal.fire({
                icon: "success",
                title: "ลงทะเบียนสำเร็จ",
                html: `รหัสจองของคุณคือ <b class="text-emerald-600 text-xl">${code}</b><br/><span class="text-sm text-gray-500">กรุณาบันทึกภาพหน้าจอไว้เป็นหลักฐาน</span>`,
                timer: 4000,
                showConfirmButton: false,
            });

        } catch (err) {
            // เมื่อ throw error มา จะเข้าตรงนี้ และแสดงข้อความที่ถูกต้อง
            // เช่น "คุณได้จองช่วงเวลานี้ไว้แล้ว" หรือ "เต็มแล้ว"
            setMessage({
                text: err.message,
                ok: false,
            });

            // Swal.fire({
            //     icon: 'error',
            //     title: 'ไม่สามารถจองได้',
            //     text: err.message
            // });
        }
    };

    // --- New UI Render ---
    // --- New UI Render ---
    return (
        <div className="min-h-screen flex font-sans bg-stone-50">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
        
        /* Animation Classes */
        .fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
        
        /* เพิ่ม Animation ให้ฟองอากาศขยับได้ */
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>

            {/* --- Left Side: Image (Desktop & Notebook) --- 
          แก้จาก hidden lg:flex เป็น hidden md:flex เพื่อให้โชว์บนจอขนาดกลาง (Notebook/Tablet) ด้วย
      */}
            <div className="hidden md:flex md:w-1/2 bg-emerald-800 relative overflow-hidden">
                {/* Background Image */}
                <img
                    src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2070&auto=format&fit=crop"
                    alt="Thai Medicine Background"
                    className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
                />
                <div className="relative z-10 m-auto text-center px-10">
                    <div className="mb-6 inline-block p-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <FiActivity className="text-white text-5xl" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide">คณะการแพทย์แผนไทย</h1>
                    <p className="text-emerald-100 text-base md:text-lg font-light leading-relaxed">
                        บริการตรวจรักษาด้วยศาสตร์การแพทย์แผนไทย<br />
                        นวดรักษา ประคบสมุนไพร และดูแลสุขภาพองค์รวม
                    </p>
                </div>
                {/* Decorative Circles */}
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            </div>

            {/* --- Right Side: Form Container --- 
          แก้จาก w-full lg:w-1/2 เป็น w-full md:w-1/2
      */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-8 md:p-12 overflow-y-auto">
                <div className="w-full max-w-md space-y-8 fade-in-up">

                    {/* Header Form */}
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-emerald-900">ลงทะเบียนนวดรักษาอาการ</h2>
                        {/* 👇 เพิ่มตรงนี้ */}
                        {lineDisplayName && (
                            <p className="mt-2 text-emerald-600 font-medium">
                                สวัสดีคุณ {lineDisplayName} 👋
                            </p>
                        )}
                        {/* 👆 จบส่วนเพิ่ม */}
                        <p className="mt-2 text-gray-600">กรุณากรอกข้อมูลเพื่อจองคิวล่วงหน้า</p>
                    </div>

                    {/* ... (ส่วน Form ข้างล่างเหมือนเดิม ไม่ต้องแก้) ... */}
                    {/* Info Box */}
                    <div className="bg-white border-l-4 border-emerald-500 shadow-sm rounded-r-lg p-4 flex items-start gap-3">
                        <FiMapPin className="text-emerald-600 mt-1 text-lg flex shrink-0" />
                        <div className="text-sm text-gray-600">
                            <p className="font-semibold text-emerald-800">สถานที่ให้บริการ</p>
                            <p>อาคารสหเวช ชั้น 7 ห้อง TTM704</p>
                            <p className="text-xs text-gray-400 mt-1">เปิดบริการ: เสาร์ - อาทิตย์ (09.00 - 16.00 น.)</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Date Input */}
                        {/* Date Input Block */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">วันที่เข้ารับร่วมกิจกรรม <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiCalendar className="text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                        const val = e.target.value;

                                        // ถ้ายกเลิกการเลือก (ค่าว่าง) ให้ล้างค่าทุกอย่าง
                                        if (!val) {
                                            setDate("");
                                            setDateError("");
                                            return;
                                        }

                                        // 1. แยกวันเดือนปี
                                        const [y, m, d] = val.split('-').map(Number);
                                        const dateObj = new Date(y, m - 1, d, 12, 0, 0);
                                        const day = dateObj.getDay();

                                        // 2. เช็คเงื่อนไข (เสาร์=6, อาทิตย์=0)
                                        if (day !== 0 && day !== 6) {
                                            // ❌ แทนที่จะเด้ง Swal เราเซ็ต Error Message แทน
                                            setDateError("⚠️ เปิดให้บริการเฉพาะวันเสาร์ - อาทิตย์ เท่านั้น");
                                            setDate(""); // ไม่รับค่าวันที่นั้น
                                            return;
                                        }

                                        // ✅ ถ้าผ่าน: ล้าง Error และทำงานต่อ
                                        setDateError("");
                                        setDate(val);
                                        setSlots([]);
                                        setMessage({ text: "", ok: true });
                                        setBookingCode("");
                                        setTicketUrl("");
                                    }}
                                    // 🔥 ปรับ Class: ถ้ามี Error ให้ขอบเป็นสีแดง (border-red-500)
                                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm sm:text-sm bg-white transition-colors appearance-none min-h-[50px] text-base ${dateError
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500 text-red-900"
                                        : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                                        }`}
                                    required
                                />
                            </div>

                            {/* 👇 ส่วนแสดงข้อความแจ้งเตือน (จะโผล่มาเมื่อมี error) */}
                            {dateError && (
                                <p className="mt-1 text-sm text-red-600 animate-pulse font-medium">
                                    {dateError}
                                </p>
                            )}

                            {slotStatus.text && !dateError && (
                                <div className={`mt-2 text-xs md:text-sm p-3 rounded-lg flex items-center gap-2 animate-fade-in-up transition-colors duration-300 ${slotStatus.type === "loading" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                                    slotStatus.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                        "bg-red-50 text-red-700 border border-red-200"
                                    }`}>
                                    {slotStatus.type === "loading" && <span className="animate-spin">⏳</span>}
                                    {slotStatus.text}
                                </div>
                            )}
                        </div>

                        {/* Slot Select */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">ช่วงเวลา <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiClock className="text-gray-400" />
                                </div>
                                <select
                                    value={slotId}
                                    onChange={(e) => setSlotId(e.target.value)}
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white appearance-none transition-colors cursor-pointer"
                                    required
                                >
                                    <option value="">-- กรุณาเลือกช่วงเวลา --</option>
                                    {slots.map((s) => {
                                        const remaining = typeof s.remaining === "number"
                                            ? s.remaining
                                            : Number(s.capacity || 0) - Number(s.booked || 0);
                                        const isFull = remaining <= 0;

                                        return (
                                            <option key={s.id} value={s.id} disabled={isFull} className={isFull ? "text-gray-400 bg-gray-50" : "text-gray-900"}>
                                                {s.label} {isFull ? "(เต็ม)" : `(ว่าง ${remaining})`}
                                            </option>
                                        );
                                    })}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {/* Name Input */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">ชื่อ–นามสกุล <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiUser className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white transition-colors"
                                        placeholder="ระบุชื่อจริง"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Phone Input */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiPhone className="text-gray-400" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white transition-colors"
                                        placeholder="08xxxxxxxx"
                                        maxLength={10}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!date || !slotId || !name || !phone}
                            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
                        >
                            ยืนยันการจองคิว
                        </button>
                    </form>

                    {/* Notification Area */}
                    {message.text && (
                        <div className={`rounded-lg p-4 flex items-start gap-3 text-sm animate-pulse ${message.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
                            }`}>
                            {message.ok ? <FiCheckCircle className="mt-0.5 text-lg" /> : <FiAlertCircle className="mt-0.5 text-lg" />}
                            <div className="whitespace-pre-line">{message.text}</div>
                        </div>
                    )}

                    {/* Ticket Result */}
                    {ticketUrl && (
                        <div className="mt-8 border-t-2 border-dashed border-gray-200 pt-6 flex flex-col items-center text-center fade-in-up">
                            <h3 className="text-lg font-semibold text-emerald-900">ลงทะเบียนสำเร็จ</h3>
                            <p className="text-gray-500 text-sm mb-4">บันทึก QR Code นี้เพื่อแสดงต่อเจ้าหน้าที่เพื่อเข้ารับบริการ</p>

                            <div className="p-3 bg-white border border-gray-200 shadow-lg rounded-xl">
                                <QRCodeCanvas value={ticketUrl} size={180} level={"H"} />
                            </div>

                            <div className="mt-4 inline-block px-4 py-2 bg-gray-100 rounded-full">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mr-2">Booking ID</span>
                                <span className="font-mono text-emerald-700 font-bold text-lg">{bookingCode}</span>
                            </div>
                        </div>
                    )}

                    {/* Footer Text Mobile */}
                    <div className="text-center text-xs text-gray-400 mt-8">
                        © {new Date().getFullYear()} คณะการแพทย์แผนไทย <br /> พัฒนาระบบโดย ทีมงานสารสนเทศ
                    </div>

                </div>
            </div>
        </div>
    );
}