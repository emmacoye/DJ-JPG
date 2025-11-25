import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function Navbar() {
  const router = useRouter();

  return (
    <nav className="w-full border-b border-gray-200 bg-[#F5F1E8] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Home */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 relative flex items-center justify-center group-hover:scale-105 transition-transform">
                <Image
                  src="/mascot.png"
                  alt="DJ JPG Mascot"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                DJ JPG
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            {router.pathname !== '/' && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="hover:bg-gray-100"
              >
                <Link href="/">
                  <Home className="w-5 h-5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

