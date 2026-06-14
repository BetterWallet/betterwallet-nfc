export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        {/* BetterWallet branding */}
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="black" strokeWidth="2"/>
              <circle cx="17" cy="12" r="2" fill="black"/>
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight">BetterWallet</span>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight leading-tight max-w-xl mb-6">
          Tap to pay.<br />
          <span className="text-[#EAFF03]">No address needed.</span>
        </h1>

        <p className="text-zinc-400 text-lg max-w-md mb-10 leading-relaxed">
          Hold your phone to any NFC tag and deposit stablecoins in one tap.
          Passkey-secured. Self-custodied. Instant.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4">
            <span className="text-2xl">📡</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">NFC Tap</p>
              <p className="text-xs text-zinc-500">Read merchant tag</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4">
            <span className="text-2xl">🔑</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Passkey Auth</p>
              <p className="text-xs text-zinc-500">Confirm with biometrics</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4">
            <span className="text-2xl">✅</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Deposit Done</p>
              <p className="text-xs text-zinc-500">USDC on Base</p>
            </div>
          </div>
        </div>

        {/* Powered by Blink badge */}
        <a
          href="https://blink.cash"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors rounded-full px-5 py-2.5"
        >
          <span className="text-xs text-zinc-400 font-medium tracking-wide uppercase">Powered by</span>
          <BlinkLogo className="h-5 w-auto" />
          <span className="text-sm font-bold text-white">Blink</span>
        </a>
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Built at ETH NYC &middot; NFC × Passkeys × Base
      </footer>
    </div>
  );
}

function BlinkLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 314 225"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Blink logo"
    >
      <g clipPath="url(#blink-clip)">
        <path
          d="M209.277 103.167C224.612 103.459 231.109 123.063 213.405 129.14C200.217 129.916 198.176 121.495 199.8 110.14C203.37 106.221 204.526 105.314 209.277 103.167Z"
          fill="currentColor"
        />
        <path
          d="M106.835 103.35C113.557 102.158 119.924 106.914 121.076 113.985C122.223 121.056 117.72 127.775 111.003 128.998C106.83 129.759 102.576 128.221 99.7342 124.914C96.7025 121.392 95.7351 116.41 97.2161 111.917C98.697 107.429 102.382 104.143 106.835 103.35Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M177.53 4.93136C206.689 -5.82929 237.585 5.36665 249.906 27.6901C256.189 39.0649 256.353 51.9726 250.361 63.4958C247.282 69.4648 243.627 73.654 238.539 77.9548C237.606 78.7441 238.3 80.3468 239.512 80.1872C259.432 77.5631 278.165 78.7875 293.79 90.8484C293.84 90.8863 293.893 90.9219 293.948 90.9519C317.494 103.918 319.152 133.907 303.288 151.756C295.484 160.652 284.089 167.218 270.973 170.394C270.405 170.532 270.016 171.06 270.052 171.643C270.924 185.769 267.472 197.968 255.065 208.996C245.488 217.585 238.13 223.168 223.664 224.058C216.691 224.435 211.268 223.788 198.872 218.155C187.446 212.963 173.178 191.971 169.011 176.97C168.701 175.855 166.994 175.622 166.406 176.619C158.156 190.587 136.46 211.875 120.759 218.155C108.221 223.122 98.2431 226.572 84.9818 223.076C70.5273 219.283 58.6242 211.118 51.9047 200.387C48.2375 194.549 43.8823 182.601 46.3832 176.281C46.4525 176.106 46.4884 175.92 46.4633 175.733C46.3567 174.941 45.9866 173.473 45.2123 173.276C13.8463 165.284 -5.71415 143.286 2.83635 116.405C6.73947 104.425 16.5711 94.1387 30.143 87.8337C44.0152 81.3176 58.4932 79.8164 73.7152 81.9831C74.9844 82.1638 75.7718 80.3249 74.7826 79.5095C66.3257 72.5382 60.6492 64.0641 58.8852 54.2907C56.5045 41.9379 60.5361 29.3243 70.0776 19.2712C79.21 9.71277 92.8617 3.44026 107.923 1.88155C127.218 -0.102329 142.57 8.05406 156.854 16.6784C157.085 16.8181 157.358 16.8743 157.625 16.8376L159.054 16.6413C159.45 16.5871 159.785 16.335 159.99 15.9919C162.695 11.4471 171.993 6.97447 177.53 4.93136Z"
          fill="#EAFF03"
        />
        <path
          d="M145.153 64.6765C157.542 64.6766 167.585 85.2914 167.585 110.72C167.585 136.15 157.542 156.764 145.153 156.764C132.94 156.764 123.007 136.728 122.729 111.795C130.554 109.769 140.266 109.569 147.999 111.869C148.856 112.124 149.713 111.41 149.507 110.541C146.452 97.6905 132.814 95.7687 123.79 96.6443C126.688 78.1 135.157 64.6765 145.153 64.6765Z"
          fill="currentColor"
        />
        <path
          d="M206.593 64.6765C218.981 64.6766 229.024 85.2914 229.024 110.72C229.024 136.15 218.981 156.764 206.593 156.764C194.379 156.764 184.446 136.728 184.168 111.795C191.994 109.769 201.706 109.569 209.438 111.869C210.295 112.124 211.153 111.41 210.946 110.541C207.892 97.6905 194.254 95.7687 185.229 96.6443C188.127 78.1 196.596 64.6765 206.593 64.6765Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="blink-clip">
          <rect width="314" height="225" rx="65.0558" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
