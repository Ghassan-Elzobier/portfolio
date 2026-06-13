import './globals.css'

export const metadata = {
  title: 'Ghassan Elzobier — Portfolio',
  description: 'Full-stack developer portfolio showcasing projects, experience, and skills.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
