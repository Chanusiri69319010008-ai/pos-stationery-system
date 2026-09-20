// =====================================================================
// ParticleField — พื้นหลังอนุภาคลอยพร้อมเส้นเชื่อม (หน้าเข้าสู่ระบบ)
//
// เขียนด้วย canvas ล้วน ไม่พึ่ง library ภายนอก เพราะ:
//   1. หน้านี้เป็นหน้าแรกที่ร้านเปิดทุกเช้า ยิ่งเบายิ่งดี
//   2. คุมพฤติกรรมได้เองทั้งหมด (หยุดเมื่อไม่ได้ดู / เคารพ prefers-reduced-motion)
//
// สีทั้งหมดมาจากจานสีของระบบใน tailwind.config.js เท่านั้น
//   royal #162660 (น้ำเงิน) · powder #D0E6FD (ฟ้าอ่อน) · bone #F1E4D1 (ครีมส้ม)
//
// ใช้เป็นพื้นหลังตกแต่งล้วน จึง aria-hidden และรับคลิกแทนเนื้อหาไม่ได้
// =====================================================================
import { useEffect, useRef } from "react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** ครีม 1 ใน 4 จุด ที่เหลือเป็นโทนน้ำเงิน เพื่อไม่ให้พื้นหลังฉูดฉาด */
  warm: boolean;
  /** เฟสของการหายใจ ทำให้แต่ละจุดสว่าง-หรี่ไม่พร้อมกัน */
  phase: number;
};

const COLOR_COOL = "22, 38, 96"; // royal
const COLOR_WARM = "196, 138, 74"; // bone เวอร์ชันเข้มขึ้นให้มองเห็นบนพื้นครีม
const LINK_DISTANCE = 132;
const DENSITY = 15000; // 1 จุดต่อพื้นที่เท่านี้ (px²)
const MAX_DOTS = 90;

export function ParticleField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const ctx = element.getContext("2d");
    if (!ctx) return;

    // ผูกเป็นตัวแปรที่ TypeScript รู้แน่นอนว่าไม่ใช่ null
    // เพราะฟังก์ชันด้านล่างถูก hoist ขึ้นไปก่อนการเช็ก null ข้างบน
    const canvas: HTMLCanvasElement = element;
    const context: CanvasRenderingContext2D = ctx;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;

    function seed() {
      const target = Math.min(MAX_DOTS, Math.round((width * height) / DENSITY));
      dots = Array.from({ length: target }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        // ช้ามาก ตั้งใจให้รู้สึกว่า "ลอย" ไม่ใช่ "วิ่ง"
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        radius: 1.1 + Math.random() * 1.9,
        warm: index % 4 === 0,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function resize() {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;

      // วาดตามความละเอียดจริงของจอ ไม่งั้นบนจอ retina จะเห็นขอบหยัก
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      seed();
    }

    function draw(time: number) {
      context.clearRect(0, 0, width, height);

      // เส้นเชื่อมก่อน แล้วค่อยวาดจุดทับ จุดจะได้คมกว่าเส้น
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance > LINK_DISTANCE) continue;

          // ยิ่งใกล้ยิ่งชัด แล้วคูณด้วยจังหวะหายใจรวมของทั้งคู่
          const closeness = 1 - distance / LINK_DISTANCE;
          const breath = 0.72 + 0.28 * Math.sin(time / 2600 + dots[i].phase + dots[j].phase);
          context.strokeStyle = `rgba(${COLOR_COOL}, ${(closeness * 0.16 * breath).toFixed(3)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(dots[i].x, dots[i].y);
          context.lineTo(dots[j].x, dots[j].y);
          context.stroke();
        }
      }

      for (const dot of dots) {
        const breath = 0.55 + 0.45 * Math.sin(time / 2200 + dot.phase);
        const alpha = (dot.warm ? 0.5 : 0.36) * breath;
        context.fillStyle = `rgba(${dot.warm ? COLOR_WARM : COLOR_COOL}, ${alpha.toFixed(3)})`;
        context.beginPath();
        context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        context.fill();

        if (reduceMotion) continue;

        dot.x += dot.vx;
        dot.y += dot.vy;

        // ออกนอกขอบแล้ววนกลับมาอีกฝั่ง ความหนาแน่นจะได้คงที่ตลอด
        if (dot.x < -20) dot.x = width + 20;
        if (dot.x > width + 20) dot.x = -20;
        if (dot.y < -20) dot.y = height + 20;
        if (dot.y > height + 20) dot.y = -20;
      }
    }

    function loop(time: number) {
      if (!running) return;
      draw(time);
      frame = window.requestAnimationFrame(loop);
    }

    // แท็บถูกซ่อน = หยุดวาด ไม่กินแบตของเครื่องหน้าร้านไปเปล่า ๆ
    function onVisibilityChange() {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = window.requestAnimationFrame(loop);
      }
    }

    resize();

    if (reduceMotion) {
      // ผู้ใช้ขอให้ลดการเคลื่อนไหว: วาดภาพนิ่งครั้งเดียวจบ
      draw(0);
    } else {
      frame = window.requestAnimationFrame(loop);
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`block ${className}`} />;
}
