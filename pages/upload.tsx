import { useState } from 'react';

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file drop here
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      console.log('Files dropped:', files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log('File selected:', e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] border-2 border-blue-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <a href="/" className="text-gray-700 hover:text-gray-900">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-6 py-8 relative">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Step 1: Choose your photo</h1>
        {/* Upload Box */}
        <div className="w-full max-w-2xl">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed border-gray-600 rounded-xl bg-[#F5F1E8] p-12 text-center transition-colors ${
              isDragging ? 'border-[#504E76] bg-[#F0EDE4]' : ''
            }`}
          >
            {/* Upload Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 border-2 border-gray-700 rounded-lg flex items-center justify-center bg-white">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="#333"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5 12L12 5L19 12"
                    stroke="#333"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-gray-700 text-lg mb-4">
              Drop your photo here or browse (jpg, png, webp)
            </p>

            <p className="text-gray-600 mb-6">Or</p>

            {/* Upload Button */}
            <label className="inline-flex items-center gap-2 bg-[#504E76] hover:bg-[#64628A] text-white px-6 py-3 rounded-lg cursor-pointer transition-colors">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 16V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V16M16 8L12 4M12 4L8 8M12 4V16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-medium">Upload</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Step Indicator Dots */}
        <div className="flex gap-3 mt-12">
          <div className="w-3 h-3 rounded-full bg-gray-700"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
        </div>
      </div>
    </div>
  );
}

