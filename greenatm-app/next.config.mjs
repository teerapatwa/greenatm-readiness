/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // เอกสาร integration กำหนดว่าห้ามโหลด asset จาก CDN ภายนอก
  // ทุกอย่างต้องเป็นไฟล์ในโปรเจกต์ เพื่อให้เปิดได้บนเครือข่ายปิด
};
export default nextConfig;
