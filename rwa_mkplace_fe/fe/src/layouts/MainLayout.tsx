import { Link, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ROUTES } from "../router/index";
import { IoIosWallet } from "react-icons/io";

const MainLayout = () => {
  const location = useLocation();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    // Check for stored wallet connection
    const stored = localStorage.getItem("rwa-wallet");
    if (stored) {
      const walletData = JSON.parse(stored);
      setWalletConnected(true);
      setWalletAddress(walletData.address);
    }
  }, []);

  const connectWallet = () => {
    // TODO: Implement wallet connection
    console.log("Connecting wallet...");
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress("");
    localStorage.removeItem("rwa-wallet");
  };

  const navItems = [
    { path: ROUTES.HOME, label: "Home" },
    { path: ROUTES.MARKETPLACE, label: "Marketplace" },
    { path: ROUTES.MY_ASSETS, label: "My Assets" },
    { path: ROUTES.CREATE_ASSET, label: "Create Asset" },
  ];

  return (
    <div className="min-h-screen bg-base-100">
      {/* Navigation */}
      <nav className="border-b border-base-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and main nav */}
            <div className="flex items-center space-x-8">
              <Link to={ROUTES.HOME} className="flex items-center space-x-2">
                <img
                  src="/LogoWithNameAndTicker.svg"
                  alt="RWA Marketplace"
                  className="h-8 w-auto"
                />
              </Link>

              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`btn btn-ghost btn-sm text-[14px]`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Wallet connection */}
            <div className="flex items-center space-x-4">
              {walletConnected ? (
                <div className="dropdown dropdown-end">
                  <label
                    tabIndex={0}
                    className="btn text-sm bg-gradient-to-r from-secondary-gradient-start to-secondary-gradient-end text-base-content"
                  >
                    <IoIosWallet className="text-xl" />
                    <span className="font-mono">
                      {walletAddress.substring(0, 6)}...
                      {walletAddress.substring(walletAddress.length - 4)}
                    </span>
                  </label>
                  <ul
                    tabIndex={0}
                    className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 mt-2"
                  >
                    <li>
                      <button onClick={disconnectWallet} className="text-error">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Disconnect
                      </button>
                    </li>
                  </ul>
                </div>
              ) : (
                <button onClick={connectWallet} className="btn btn-primary btn-sm">
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu */}
          <div className="md:hidden border-t border-base-300 py-2">
            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`btn btn-ghost btn-xs ${
                    location.pathname === item.path ? "btn-primary" : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-base-200 border-t border-base-300 mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-base-content/60">
            © 2024 RWA Marketplace. Built on XRPL.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
