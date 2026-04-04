import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Results from "./pages/Results";
import Chat from "./pages/Chat";
import { Mic2, LayoutDashboard, MessageSquare } from "lucide-react";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
        {/* Nav */}
        <nav className="border-b border-stone-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Mic2 size={16} className="text-stone-950" />
            </div>
            <span className="font-bold text-lg tracking-tight text-stone-100">
              cymonic
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-stone-800 text-stone-100"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/50"
                }`
              }
            >
              <LayoutDashboard size={15} />
              Transcripts
            </NavLink>
            <NavLink
              to="/chat"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-stone-800 text-stone-100"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/50"
                }`
              }
            >
              <MessageSquare size={15} />
              Chat
            </NavLink>
          </div>
        </nav>

        {/* Page */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:sessionId" element={<Chat />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
