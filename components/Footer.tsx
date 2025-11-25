import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-[#F5F1E8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 relative">
              <Image
                src="/mascot.png"
                alt="DJ JPG Mascot"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-gray-900">DJ JPG</span>
          </div>

          {/* Copyright */}
          <div className="text-xs text-gray-500">
            © {new Date().getFullYear()} DJ JPG. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

