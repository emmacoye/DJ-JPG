import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="flex min-h-[85vh] flex-col lg:flex-row relative">
      {/* Left Section - Yellow Background */}
      <section className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-[#FFD740] to-[#FFE8A0] px-6 pt-12 pb-8 lg:px-8 lg:pt-16 lg:pb-12">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-black/60">
            Welcome to
          </p>
          <h1 className="mt-6 text-4xl font-bold text-black sm:text-5xl lg:text-6xl tracking-tight">
            DJ JPG
          </h1>
          <p className="mt-4 text-lg text-black sm:text-xl font-medium">
          Creating playlists one pixel at a time.
          </p>
          <p className="mt-2 text-base text-black/70 leading-relaxed">
          Upload your photos and create playlists with songs that match your photos mood.
        </p>
        </div>
        {/* Cat Mascot */}
        <div className="w-48 h-48 md:w-64 md:h-64 relative mt-8 mb-6 animate-bounce-slow">
            <Image
              src="/mascot.png"
              alt="DJ JPG Mascot - Cat with Headphones"
              width={256}
              height={256}
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
      </section>

      {/* Right Section - Beige Background with Steps */}
      <section className="flex flex-1 flex-col items-center justify-center bg-[#F5F1E8] px-6 pt-12 pb-8 lg:px-8 lg:pt-16 lg:pb-12">
        <div className="flex w-full max-w-xl flex-col">
          <h2 className="text-2xl font-semibold text-black sm:text-3xl">
            Enjoy music only in three steps!
          </h2>
          
          {/* Three Steps - Diagonal Staircase Layout */}
          <div className="relative mt-10 min-h-[280px]">
            {/* Step 1 - Top Left */}
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#8B9A6B]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4L12 20M4 12L20 12"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 12L12 4M12 20L20 12"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-lg text-black">Upload a photo</span>
            </div>
            
            {/* Connecting Line 1 */}
            <div className="absolute left-7 top-14 h-12 w-px bg-[#7A7168]"></div>
            <div className="absolute left-7 top-26 h-px w-16 bg-[#7A7168]"></div>
            <div className="absolute left-23 top-26">
              <svg
                width="12"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 6L10 6M6 2L10 6L6 10"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            
            {/* Step 2 - Middle Right */}
            <div className="relative left-16 top-8 flex items-center gap-4 sm:left-20">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#8B9A6B]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"
                    fill="white"
                  />
                </svg>
              </div>
              <span className="text-lg text-black">AI Analysis</span>
            </div>
            
            {/* Connecting Line 2 */}
            <div className="absolute left-23 top-36 h-16 w-px bg-[#7A7168] sm:left-27"></div>
            <div className="absolute left-23 top-52 h-px w-16 bg-[#7A7168] sm:left-27"></div>
            <div className="absolute left-39 top-52 sm:left-43">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 6L10 6M6 2L10 6L6 10"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            
            {/* Step 3 - Bottom Right */}
            <div className="relative left-32 top-16 flex items-center gap-4 sm:left-40">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#8B9A6B]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 18V5L21 3V16M9 18C9 19.1046 8.10457 20 7 20C5.89543 20 5 19.1046 5 18C5 16.8954 5.89543 16 7 16C8.10457 16 9 16.8954 9 18ZM21 16C21 17.1046 20.1046 18 19 18C17.8954 18 17 17.1046 17 16C17 14.8954 17.8954 14 19 14C20.1046 14 21 14.8954 21 16ZM9 10L21 8"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-lg text-black">Get Playlist</span>
            </div>
          </div>
          
          {/* Login with Spotify Button */}
          <div className="">
            <Button
              asChild
              className="flex items-center justify-center gap-3 rounded-xl bg-[#504E76] px-6 py-4 text-white font-medium shadow-lg shadow-[#504E76]/20 transition-all hover:bg-[#64628A] hover:shadow-xl hover:shadow-[#504E76]/30 hover:-translate-y-0.5 active:translate-y-0 h-auto"
            >
              <Link href="/api/auth/login">
                <span className="text-lg font-medium">Login with Spotify</span>
                {/* Spotify Logo */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

