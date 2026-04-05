import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { LayoutDashboard, MessageSquare, LogOut, CheckSquare } from "lucide-react";
import Home from "./pages/Home";
import Results from "./pages/Results";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Nav() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <nav className="border-b border-stone-800 px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="Meeting Intelligence Hub" width="40" height="40" />
        <span className="font-bold text-lg tracking-tight text-stone-100">Meeting Intelligence Hub</span>
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
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-stone-800 text-stone-100"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/50"
            }`
          }
        >
          <CheckSquare size={15} />
          Dashboard
        </NavLink>
        <div className="w-px h-5 bg-stone-700 mx-2" />
        <span className="text-xs text-stone-500 mr-2">{user.email}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={14} />
        </button>
        
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Nav />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/results/:id" element={<Results />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/chat/:sessionId" element={<Chat />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                  </Routes>
                </main>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;