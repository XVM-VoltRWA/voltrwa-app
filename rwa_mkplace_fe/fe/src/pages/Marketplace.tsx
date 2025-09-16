import { useState, useEffect } from 'react';

interface Asset {
  id: string;
  name: string;
  description: string;
  price_xrp: number;
  seller_address: string;
  token_currency: string;
  listed_at?: string;
}

const Marketplace = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch marketplace assets from API
    setLoading(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        🏪 Marketplace
      </h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading assets...</div>
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500">No assets for sale at the moment.</p>
          <p className="text-sm text-gray-400 mt-2">Be the first to list an asset!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-xl font-semibold mb-2">{asset.name}</h3>
              <p className="text-gray-600 mb-4">{asset.description}</p>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Price:</span> {asset.price_xrp} XRP</p>
                <p><span className="font-medium">Token:</span> {asset.token_currency}</p>
              </div>
              <button className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition">
                Purchase
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;