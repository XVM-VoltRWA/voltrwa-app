const Home = () => {
  return (
    <div className="hero min-h-screen bg-base-100">
      <div className="hero-content text-center max-w-4xl">
        <div>
          <h1 className="text-5xl font-bold mb-6">
            Welcome to <span className="text-primary">RWA Marketplace</span>
          </h1>
          <p className="text-xl text-base-content/70 mb-8 leading-relaxed">
            The premier platform for tokenizing and trading Real World Assets on the XRPL. 
            Create, buy, and sell tokenized assets with transparency and security.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🏠</div>
                <h3 className="card-title justify-center">Tokenize Assets</h3>
                <p className="text-base-content/60">Convert your real-world assets into tradeable tokens on XRPL</p>
              </div>
            </div>
            
            <div className="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🏪</div>
                <h3 className="card-title justify-center">Trade Securely</h3>
                <p className="text-base-content/60">Buy and sell assets with built-in escrow protection</p>
              </div>
            </div>
            
            <div className="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="card-title justify-center">Track Portfolio</h3>
                <p className="text-base-content/60">Monitor your asset performance and transaction history</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;