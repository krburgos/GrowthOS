export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/growthos-logo.png" alt="GrowthOS" className="h-16 w-auto" />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
