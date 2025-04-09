/** @type {import('tailwindcss').Config} */
export default { // Note: Vite uses ES Modules syntax (export default)
    content: [
      "./index.html", // Include the main HTML file
      "./src/**/*.{js,ts,jsx,tsx}", // Include all JS/TS/JSX/TSX files in src
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }
// Note: This is a basic Tailwind CSS configuration.  