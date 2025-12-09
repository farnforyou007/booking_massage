export default function ScanPage() {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">
                สแกน QR - ยืนยันการลงทะเบียน
            </h2>

            {/* กล้องสแกน QR */}
            <div className="rounded-2xl bg-white p-4 shadow">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    กล้องสแกน QR
                </h3>
                <div
                    id="reader"
                    className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400"
                >
                    (พื้นที่แสดงกล้องสแกน QR)
                </div>
                <div className="mt-3 flex gap-2">
                    <button className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        เริ่มสแกน
                    </button>
                    <button className="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">
                        หยุดกล้องชั่วคราว
                    </button>
                </div>
                <div className="mt-2 text-xs text-gray-500" id="cameraMsg">
                    {/* ข้อความกล้อง / error ต่าง ๆ */}
                </div>
            </div>

            {/* ค้นหาจากรหัสลงทะเบียน */}
            <div className="rounded-2xl bg-white p-4 shadow">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    ค้นหาจากรหัสลงทะเบียน (กรณีสแกนไม่ได้)
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                        type="text"
                        placeholder="วางโค้ดจาก QR หรือพิมพ์รหัสลงทะเบียน"
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        ค้นหา
                    </button>
                </div>
            </div>
        </div>
    );
}
