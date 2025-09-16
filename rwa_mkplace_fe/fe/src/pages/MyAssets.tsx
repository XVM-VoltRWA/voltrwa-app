import { useState, useEffect } from 'react';

interface Asset {
  id: string;
  name: string;
  description: string;
  price_xrp: number;
  status: string;
  token_currency: string;
  created_at?: string;
  issuance_status?: string;
}

const MyAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // TODO: Check wallet connection and fetch user assets
    setLoading(false);
  }, []);

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Assets</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">Please connect your wallet to view your assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        📦 My Assets
      </h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading your assets...</div>
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500">You don't have any assets yet.</p>
          <button className="mt-4 bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition">
            Create Your First Asset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <h3 className="text-xl font-semibold mb-2">{asset.name}</h3>
              <p className="text-gray-600 mb-4">{asset.description}</p>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Price:</span> {asset.price_xrp} XRP</p>
                <p><span className="font-medium">Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    asset.status === 'active' ? 'bg-green-100 text-green-800' :
                    asset.status === 'for_sale' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {asset.status}
                  </span>
                </p>
                <p><span className="font-medium">Token:</span> {asset.token_currency}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 rounded text-sm hover:bg-gray-300 transition">
                  Manage
                </button>
                {asset.status === 'active' && (
                  <button className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 transition">
                    List for Sale
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAssets;