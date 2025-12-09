import { Routes, Route, Link, useLocation } from "react-router-dom";
import { FiCalendar, FiClipboard, FiCamera, FiTool, FiMenu, FiActivity } from "react-icons/fi";
import BookingPage from "./pages/BookingPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import TicketPage from "./pages/TicketPage.jsx";
import { useState } from "react";

export default function App() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: "/", label: "จองคิว", icon: <FiCalendar /> },
    { path: "/ticket", label: "ตรวจสอบสิทธิ์", icon: <FiClipboard /> },
    // { path: "/scan", label: "สแกน (จนท.)", icon: <FiCamera /> },
    { path: "/admin", label: "เจ้าหน้าที่", icon: <FiTool /> },
  ];

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-gray-800 flex flex-col">
      {/* Import Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600&display=swap');
        .font-sans { font-family: 'Prompt', sans-serif; }
      `}</style>

      {/* Navbar */}
      <nav className="bg-white border-b border-emerald-100 shadow-sm sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => window.location.href = '/'}>
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-md">
                  <FiActivity />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-emerald-900 leading-tight">คลินิกการแพทย์แผนไทย</span>
                  <span className="text-[10px] text-emerald-600 font-medium tracking-wider">THAI TRADITIONAL MEDICINE</span>
                </div>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex md:items-center md:space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${isActive(item.path)
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-500 hover:text-emerald-600 hover:bg-gray-50"
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-gray-100 focus:outline-none"
              >
                <FiMenu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-lg">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium ${isActive(item.path)
                      ? "bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-emerald-600"
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content: ใช้ w-full และ flex-grow เพื่อให้ยืดเต็ม */}
      <main className="w-full flex-grow">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/ticket" element={<TicketPage />} />
          {/* <Route path="/scan" element={<ScanPage />} /> */}
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}