/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // เอกสาร integration กำหนดว่าห้ามโหลด asset จาก CDN ภายนอก
  // ทุกอย่างต้องเป็นไฟล์ในโปรเจกต์ เพื่อให้เปิดได้บนเครือข่ายปิด

  /*
    pdfjs-dist ต้องโหลดจาก node_modules ตอนรัน ไม่ใช่ถูก bundle เข้าไป
    เพราะมันหา pdf.worker.mjs กับโฟลเดอร์ standard_fonts ของตัวเองด้วย path จริง
    ถ้าปล่อยให้ bundler ย้ายที่ จะได้ "Cannot find module .next/server/chunks/pdf.worker.mjs"
  */
  serverExternalPackages: ["pdfjs-dist"],
};
export default nextConfig;
