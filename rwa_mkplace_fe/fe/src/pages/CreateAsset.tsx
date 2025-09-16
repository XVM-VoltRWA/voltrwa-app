import { useState, useRef } from "react";
import { createNFT } from "../services/nftService";
import type { NFTMetadata, CreateNFTResponse } from "../services/nftService";

interface Property {
  id: string;
  key: string;
  value: string;
}

const CreateAsset = () => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    external_link: "",
    valuation: "",
    image_url: "",
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [nftResult, setNftResult] = useState<CreateNFTResponse | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build metadata object
    const metadata: NFTMetadata = {
      external_link: formData.external_link,
      description: formData.description,
      category: formData.category,
      properties: properties.reduce((acc, prop) => {
        if (prop.key && prop.value) {
          acc[prop.key] = prop.value;
        }
        return acc;
      }, {} as Record<string, string>),
      valuation: formData.valuation ? parseFloat(formData.valuation) : undefined,
    };

    // Call create-nft function via service
    try {
      const result = await createNFT({
        name: formData.name,
        image_url: "https://image_url.com",
        owner_address: "rLnsyM1eBn9UMuEH3HMD1RBVoFH7ZrCEC3", // TODO: Get from wallet
        metadata,
      });

      console.log("NFT Creation Result:", result);

      if (result.success) {
        setNftResult(result);
        setShowSuccess(true);
      } else {
        alert("Error creating NFT: " + result.error);
      }
    } catch (error) {
      console.error("Error creating NFT:", error);
      alert("Error creating NFT: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addProperty = () => {
    setProperties([...properties, { id: Date.now().toString(), key: "", value: "" }]);
  };

  const updateProperty = (id: string, field: "key" | "value", value: string) => {
    setProperties(properties.map((prop) => (prop.id === id ? { ...prop, [field]: value } : prop)));
  };

  const removeProperty = (id: string) => {
    setProperties(properties.filter((prop) => prop.id !== id));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // TODO: Upload file to storage service
    // For now, create a local URL for preview
    const url = URL.createObjectURL(file);
    setFormData((prev) => ({ ...prev, image_url: url }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content mb-2">Create New Asset</h1>
        <p className="text-base-content/70">
          This information will be displayed publicly on the asset's detail page.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Preview */}
        <div className="order-2 lg:order-1">
          <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
          <div className="card bg-base-200 shadow-xl">
            <figure className="px-6 pt-6">
              {formData.image_url ? (
                <img
                  src={formData.image_url}
                  alt={formData.name || "Asset preview"}
                  className="rounded-xl w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-base-300 rounded-xl flex items-center justify-center">
                  <span className="text-base-content/50">No image uploaded</span>
                </div>
              )}
            </figure>
            <div className="card-body">
              <h3 className="card-title text-lg">
                {formData.name || "Asset Name"}
                {formData.category && (
                  <div className="badge badge-secondary">{formData.category}</div>
                )}
              </h3>
              <div className="text-sm text-base-content/70 mb-4">Price</div>
              <div className="text-2xl font-bold text-primary mb-4">
                {formData.valuation ? `${formData.valuation} USDC` : "0 USDC"}
              </div>
              <button className="btn btn-primary">Buy Now</button>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="order-1 lg:order-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  Image <span className="text-error">*</span>
                </span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/10"
                    : "border-base-300 hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <p className="text-sm text-base-content/70 mb-2">Upload a file or drag and drop</p>
                <p className="text-xs text-base-content/50">PNG, JPG, GIF up to 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileInput}
                />
              </div>
            </div>

            {/* Name */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  Name <span className="text-error">*</span>
                </span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                autoComplete="off"
                className="input input-bordered w-full"
                placeholder="[1 of 10] SEIKO COLLECTOR'S WATCH"
              />
            </div>

            {/* External Link */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">External Link</span>
              </label>
              <input
                type="url"
                name="external_link"
                value={formData.external_link}
                onChange={handleChange}
                autoComplete="off"
                className="input input-bordered w-full"
                placeholder="https://volt-marketplace.com/asset/..."
              />
            </div>

            {/* Description */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  Description <span className="text-error">*</span>
                </span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="textarea textarea-bordered w-full"
                placeholder="1 of 10, limited edition SEIKO brand watch. Original documents and authentic papers."
              />
            </div>

            {/* Category */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Category</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="">Select category</option>
                <option value="Collectibles">Collectibles</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Art">Art</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Luxury Goods">Luxury Goods</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Properties */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Properties</span>
              </label>
              <p className="text-xs text-base-content/50 mb-4">
                Textual traits that show up as rectangles.
              </p>

              {properties.map((property) => (
                <div key={property.id} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Property name"
                    value={property.key}
                    onChange={(e) => updateProperty(property.id, "key", e.target.value)}
                    className="input input-bordered flex-1"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={property.value}
                    onChange={(e) => updateProperty(property.id, "value", e.target.value)}
                    className="input input-bordered flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeProperty(property.id)}
                    className="btn btn-square btn-outline btn-error"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button type="button" onClick={addProperty} className="btn btn-outline btn-sm">
                + Add Property
              </button>
            </div>

            {/* Token Details */}
            <div className="divider">Token Details</div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  Min. Asset Valuation <span className="text-error">*</span>
                </span>
              </label>
              <div className="join">
                <input
                  type="number"
                  name="valuation"
                  value={formData.valuation}
                  onChange={handleChange}
                  required
                  step="0.01"
                  min="0"
                  className="input input-bordered join-item flex-1 min-w-24"
                  placeholder="15000"
                />
                <select className="select select-bordered join-item">
                  <option>USDC</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-6">
              <button type="button" className="btn btn-outline flex-1">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary flex-1">
                Create
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && nftResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-success-content"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-base-content mb-2">
                NFT Created Successfully! 🎉
              </h2>
              <p className="text-base-content/70 text-sm">{nftResult.message}</p>
            </div>

            {/* QR Code Section */}
            {nftResult.acceptance?.qr_code && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">
                  Scan with XUMM Wallet to Receive Your NFT
                </h3>
                <div className="bg-white p-4 rounded-xl mx-auto inline-block">
                  <img
                    src={nftResult.acceptance.qr_code}
                    alt="XUMM QR Code"
                    className="w-48 h-48 mx-auto blur-md"
                  />
                </div>
                <p className="text-xs text-base-content/50 mt-2">
                  {nftResult.acceptance.instruction}
                </p>
              </div>
            )}

            {/* Manual Instructions */}
            {nftResult.manual_acceptance && (
              <div className="mb-6 text-left">
                <h3 className="text-lg font-semibold mb-2">Manual Instructions</h3>
                <p className="text-sm text-base-content/70 mb-2">
                  {nftResult.manual_acceptance.instruction}
                </p>
                <div className="bg-base-200 p-3 rounded-lg">
                  <p className="text-xs font-mono break-all">
                    Offer Index: {nftResult.manual_acceptance.offer_index}
                  </p>
                </div>
              </div>
            )}

            {/* Deep Link for Desktop */}
            {nftResult.acceptance?.deep_link && (
              <div className="mb-6">
                <p className="text-sm text-base-content/70 mb-3">
                  On desktop? Click the button below:
                </p>
                <a
                  href={nftResult.acceptance.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Open in XUMM App
                </a>
              </div>
            )}

            {/* Transaction Links */}
            <div className="mb-6 text-left">
              <h4 className="font-semibold mb-2">Transaction Details</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-base-content/70">NFT Token ID:</span>
                  <p className="font-mono text-xs break-all bg-base-200 p-2 rounded mt-1 blur-sm">
                    {nftResult.nft_token_id}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={nftResult.mint_explorer_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-xs flex-1"
                  >
                    View Mint
                  </a>
                  {nftResult.transfer_offer_link && (
                    <a
                      href={nftResult.transfer_offer_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-xs flex-1"
                    >
                      View Transfer
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setNftResult(null);
                  // Reset form
                  setFormData({
                    name: "",
                    description: "",
                    category: "",
                    external_link: "",
                    valuation: "",
                    image_url: "",
                  });
                  setProperties([]);
                }}
                className="btn btn-outline flex-1"
              >
                Create Another
              </button>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setNftResult(null);
                }}
                className="btn btn-primary flex-1"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAsset;
