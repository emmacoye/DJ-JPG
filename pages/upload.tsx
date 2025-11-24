import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { Home, Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions - aggressive compression
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Use JPEG format for better compression (even if original was PNG)
          // Try progressively lower quality until we're under 800KB
          let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          let sizeKB = (compressedBase64.length - 22) * 3 / 4 / 1024; // Subtract data URL prefix
          
          let currentQuality = quality;
          let currentWidth = width;
          
          // Keep reducing quality and size until under 800KB
          while (sizeKB > 800 && currentQuality > 0.3) {
            currentQuality = Math.max(0.3, currentQuality - 0.1);
            compressedBase64 = canvas.toDataURL('image/jpeg', currentQuality);
            sizeKB = (compressedBase64.length - 22) * 3 / 4 / 1024;
          }
          
          // If still too large, reduce dimensions
          if (sizeKB > 800 && currentWidth > 400) {
            const smallerWidth = Math.max(400, currentWidth - 200);
            const smallerHeight = (height * smallerWidth) / currentWidth;
            canvas.width = smallerWidth;
            canvas.height = smallerHeight;
            ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
            compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
            sizeKB = (compressedBase64.length - 22) * 3 / 4 / 1024;
          }
          
          if (sizeKB > 850) {
            reject(new Error(`Image is too large (${sizeKB.toFixed(0)}KB) even after compression. Please try a smaller image.`));
            return;
          }
          
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Compress the image aggressively to stay under 1MB limit for API
      // Start with aggressive compression (800px max, 0.6 quality)
      let compressedImage = await compressImage(file, 800, 0.6);
      
      // Check actual size (accounting for data URL prefix)
      const sizeKB = (compressedImage.length - 22) * 3 / 4 / 1024;
      console.log(`Compressed image size: ${sizeKB.toFixed(0)}KB`);
      
      // Final size check - must be under 800KB to be safe
      if (sizeKB > 850) {
        throw new Error(`Image is too large (${sizeKB.toFixed(0)}KB) even after compression. Please try a smaller image.`);
      }
      
      // Try to store the compressed image
      try {
        sessionStorage.setItem('uploadedImage', compressedImage);
      } catch (storageError: any) {
        // If still too large for storage, compress even more
        if (storageError.name === 'QuotaExceededError') {
          compressedImage = await compressImage(file, 600, 0.4);
          sessionStorage.setItem('uploadedImage', compressedImage);
        } else {
          throw storageError;
        }
      }
      
      // Navigate to analysis page
      router.push('/analyze');
    } catch (error: any) {
      console.error('Error processing file:', error);
      if (error.name === 'QuotaExceededError') {
        alert('Image is too large even after compression. Please try a smaller image.');
      } else {
        alert(`Error processing image: ${error.message || 'Please try again.'}`);
      }
      setIsAnalyzing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing image...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <Button variant="ghost" size="icon" asChild>
          <a href="/">
            <Home size={24} />
          </a>
        </Button>
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
                <UploadIcon size={40} className="text-gray-800" />
              </div>
            </div>

            {/* Instructions */}
            <p className="text-gray-700 text-lg mb-4">
              Drop your photo here or browse (jpg, png, webp)
            </p>

            <p className="text-gray-600 mb-6">Or</p>

            {/* Upload Button */}
            <div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#504E76] hover:bg-[#64628A] text-white"
              >
                <UploadIcon size={20} />
                <span>Upload</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
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

