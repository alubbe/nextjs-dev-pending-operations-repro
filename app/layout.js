export const metadata = {
  title: 'Next.js pendingOperations repro',
  description: 'Minimal dev-mode memory retention repro',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
