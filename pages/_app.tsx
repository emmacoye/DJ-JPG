import type { AppProps } from "next/app";
import "../styles/globals.css";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden max-w-full">     
      <main className="flex-1 overflow-x-hidden max-w-full">
        <Component {...pageProps} />
      </main>
      <Toaster />
    </div>
  );
}

