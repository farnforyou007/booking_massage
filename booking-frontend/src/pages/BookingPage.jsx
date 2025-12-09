// src/pages/BookingPage.jsx
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { getSlots, createBooking } from "../api";
import { QRCodeCanvas } from "qrcode.react";
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

    // --- Logic เดิม (ไม่เปลี่ยนแปลง) ---
    useEffect(() => {
        if (!date) return;

        setMessage({
            text: `กำลังโหลดช่วงเวลาที่ว่างสำหรับวันที่ ${date} ...`,
            ok: true,
        });

        let cancelled = false;

        getSlots(date)
            .then((data) => {
                if (cancelled) return;
                const items = data.items || [];
                if (!items.length) {
                    setMessage({
                        text: "วันนี้ยังไม่มีการตั้งค่าช่วงเวลาให้ลงทะเบียน",
                        ok: false,
                    });
                } else {
                    setMessage({
                        text: "เลือกช่วงเวลาที่ต้องการได้เลย",
                        ok: true,
                    });
                }
                setSlots(items);
            })
            .catch((err) => {
                if (cancelled) return;
                setMessage({
                    text: "โหลดช่วงเวลาไม่สำเร็จ: " + err.message,
                    ok: false,
                });
                setSlots([]);
            });

        return () => {
            cancelled = true;
        };
    }, [date]);

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
            });

            const code =
                res.booking_code || res.code || res.bookingCode || res.bookingid;

            if (!code) {
                setMessage({
                    text: "จองสำเร็จ แต่ไม่พบรหัสจองจากระบบ",
                    ok: false,
                });
                return;
            }

            // const ticketLink = `${API_BASE}?page=ticket&code=${encodeURIComponent(code)}`;
            const FRONTEND_BASE = "http://10.135.171.31:5173";

            const ticketLink = `${FRONTEND_BASE}/ticket?code=${code}`;


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
            setMessage({
                text: "เกิดข้อผิดพลาด: " + err.message,
                ok: false,
            });
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
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide">คลินิกการแพทย์แผนไทย</h1>
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
                        <h2 className="text-3xl font-bold text-emerald-900">ลงทะเบียนนวดรักษา</h2>
                        <p className="mt-2 text-gray-600">กรุณากรอกข้อมูลเพื่อจองคิวล่วงหน้า</p>
                    </div>

                    {/* ... (ส่วน Form ข้างล่างเหมือนเดิม ไม่ต้องแก้) ... */}
                    {/* Info Box */}
                    <div className="bg-white border-l-4 border-emerald-500 shadow-sm rounded-r-lg p-4 flex items-start gap-3">
                        <FiMapPin className="text-emerald-600 mt-1 text-lg flex-shrink-0" />
                        <div className="text-sm text-gray-600">
                            <p className="font-semibold text-emerald-800">สถานที่ให้บริการ</p>
                            <p>อาคารสหเวช ชั้น 7 ห้อง TTM704</p>
                            <p className="text-xs text-gray-400 mt-1">เปิดบริการ: เสาร์ - อาทิตย์ (09.00 - 16.00 น.)</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Date Input */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">วันที่เข้ารับบริการ <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiCalendar className="text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                        setDate(e.target.value);
                                        setSlots([]);
                                        setMessage({ text: "", ok: true });
                                        setBookingCode("");
                                        setTicketUrl("");
                                    }}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-white transition-colors"
                                    required
                                />
                            </div>
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
                        © {new Date().getFullYear()} คลินิกการแพทย์แผนไทย <br /> พัฒนาระบบโดย ทีมงานสารสนเทศ
                    </div>

                </div>
            </div>
        </div>
    );
}