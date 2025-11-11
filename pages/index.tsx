// pages/index.tsx
// This is the home page of the app.
// It displays the welcome message and the button to let the user get started.
// The button is a link to the upload page.

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black px-6 py-12 text-white">
      <section className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-sky-400">
          Welcome to DJ-JPG
        </p>
        <h1 className="mt-6 text-4xl font-semibold sm:text-5xl">
          Creating playlists one pixel at a time.
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Upload your photos and create playlists with songs that match your photos mood.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#"
            className="rounded-full bg-sky-400 px-8 py-3 font-medium text-slate-950 transition hover:bg-sky-300"
          >
            Let's get started!
          </a>
        </div>
      </section>
    </main>
  );
}

