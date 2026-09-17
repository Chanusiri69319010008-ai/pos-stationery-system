/** @type {import('tailwindcss').Config} */
// ธีมตาม AUNCHAN-SPEC.md §8 — ห้ามเพิ่มสีตกแต่งนอกเหนือจากนี้
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        royal: { DEFAULT: "#162660", 700: "#0d1740" },
        powder: "#D0E6FD",
        bone: "#F1E4D1",
        paper: "#FCFAF6",
        ink: "#2A2E39",
        success: "#1F6B4A",
        warning: "#8A4B12",
        danger: "#8C2F2F",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', "system-ui", "sans-serif"],
        display: ['"Barlow Condensed"', '"IBM Plex Sans Thai"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        // §8 มุมโค้งน้อย: ใช้ได้แค่ rounded-none กับ rounded (4px)
        DEFAULT: "4px",
      },
      minHeight: {
        touch: "44px", // §8 ปุ่มบนมือถือสูงไม่น้อยกว่า 44px
      },
      minWidth: {
        touch: "44px",
      },
      spacing: {
        dock: "56px",
        "dock-sm": "48px",
      },
    },
  },
  plugins: [],
};
