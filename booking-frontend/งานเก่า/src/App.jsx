import { NavLink, Route, Routes } from "react-router-dom";
import BookingPage from "./pages/BookingPage";
import AdminPage from "./pages/AdminPage";
import ScanPage from "./pages/ScanPage";
import TicketPage from "./pages/TicketPage";

function App() {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar บนสุด */}
      <header className="bg-indigo-700 text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold sm:text-base">
            ระบบลงทะเบียนกิจกรรมนวดรักษาอาการ
          </span>
          <nav className="flex gap-2 text-xs sm:text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 ${isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`
              }
            >
              ลงทะเบียน
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 ${isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`
              }
            >
              ระบบเจ้าหน้าที่
            </NavLink>
            <NavLink
              to="/scan"
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 ${isActive ? "bg-white/20 font-semibold" : "hover:bg-white/10"
                }`
              }
            >
              สแกน QR
            </NavLink>
          </nav>
        </div>
      </header>

      {/* เนื้อหาแต่ละหน้า */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/scan" element={<ScanPage />} />
          {/* ticket/:code สำหรับหน้าบัตรจอง */}
          <Route path="/ticket/:code" element={<TicketPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
