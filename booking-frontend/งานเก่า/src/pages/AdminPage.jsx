export default function AdminPage() {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">
                ระบบเจ้าหน้าที่
            </h2>

            {/* กล่องล็อกอิน */}
            <div className="rounded-2xl bg-white p-4 shadow">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    เข้าสู่ระบบเจ้าหน้าที่
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                            รหัสผ่าน
                        </label>
                        <input
                            type="password"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>
                    <button className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700">
                        เข้าสู่ระบบ
                    </button>
                </div>
            </div>

            {/* ส่วนหลัก หลังจากล็อกอิน - ตอนนี้เป็นโครงหน้าจอเปล่า */}
            <div className="space-y-4">
                {/* ค้นหาการลงทะเบียนตามวันที่ */}
                <div className="rounded-2xl bg-white p-4 shadow">
                    <h3 className="mb-2 text-sm font-semibold text-gray-800">
                        ค้นหาการลงทะเบียนตามวันที่
                    </h3>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-700">
                                วันที่
                            </label>
                            <input
                                type="date"
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                        <button className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                            ค้นหา
                        </button>
                    </div>
                </div>

                {/* การจัดการช่วงเวลา & จำนวนคิวต่อวัน */}
                <div className="rounded-2xl bg-white p-4 shadow">
                    <h3 className="mb-1 text-sm font-semibold text-gray-800">
                        จัดการช่วงเวลา & จำนวนคิวต่อวัน
                    </h3>
                    <p className="mb-2 text-xs text-gray-500">
                        สำหรับวันที่: -
                    </p>
                    <div className="text-xs text-gray-500">
                        (ส่วนนี้ไว้แสดงตารางช่วงเวลา, จำนวนคิว, ปุ่มแก้ไข เป็นต้น)
                    </div>
                </div>

                {/* รายการลงทะเบียน */}
                <div className="rounded-2xl bg-white p-4 shadow">
                    <h3 className="mb-1 text-sm font-semibold text-gray-800">
                        รายการลงทะเบียน
                    </h3>
                    <p className="mb-2 text-xs text-gray-500">
                        สำหรับวันที่: -
                    </p>
                    <div className="text-xs text-gray-500">
                        (ส่วนนี้ไว้แสดงตารางรายการลงทะเบียนตามวันที่)
                    </div>
                </div>
            </div>
        </div>
    );
}
