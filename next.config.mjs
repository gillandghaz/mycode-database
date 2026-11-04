/** @type {import('next').NextConfig} */

// Domains the browser talks to besides our own server: the Firebase SDK
// (Auth + Firestore) and Google sign-in. Add more here if you add services.
const connectDomains = [
  "https://firestore.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.googleapis.com",
];

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`, // Next.js needs unsafe-inline unless a nonce setup is used
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https://lh3.googleusercontent.com`,
  `connect-src 'self' ${connectDomains.join(" ")}`,
  `frame-src https://*.firebaseapp.com https://accounts.google.com`, // Google sign-in popup helper
  `font-src 'self' data:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'self'`,
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Report-Only: violations are logged in the console but nothing is
          // blocked yet. Switch the key to "Content-Security-Policy" once
          // you've confirmed login (incl. Google popup) works without warnings.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
