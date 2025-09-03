import { useEffect } from "react";
import logo from "./assets/Logo.svg";

function App() {
  useEffect(() => {
    // Set viewport height for mobile browsers
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener("resize", setViewportHeight);

    // Initialize Telegram WebApp theme if available
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
    }

    return () => window.removeEventListener("resize", setViewportHeight);
  }, []);

  return (
    <div
      className="min-h-screen bg-black flex items-center justify-center overflow-hidden"
      style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <div className="flex flex-col items-center justify-center text-center p-8 animate-fadeIn">
        <img
          src={logo}
          alt="XVM Logo"
          className="w-[120px] h-[120px] mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse"
        />
        <h1 className="text-5xl font-bold mb-2 tracking-[0.05em] bg-gradient-to-br from-white to-gray-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
          $XVM
        </h1>
        <p className="text-xl text-gray-400 tracking-[0.02em] font-light">
          Building the Future of RWA
        </p>
      </div>
    </div>
  );
}

export default App;
