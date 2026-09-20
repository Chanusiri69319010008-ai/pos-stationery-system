// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';

export function LoginPage() {
  const [email, setEmail] = useState('owner@aunchan.local');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const canvasRef = useRef(null);

  // Particle Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      size: Math.random() * 2 + 1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (!email || !password) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วน');
      setLoading(false);
      return;
    }

    setTimeout(() => {
      const userSession = {
        email: email,
        token: 'auth_token_' + Date.now(),
        role: email.includes('owner') ? 'owner' : 'staff',
        loggedInAt: new Date().toISOString()
      };
      
      // บันทึก Session ลง LocalStorage เพื่อยึดสถานะการเข้าสู่ระบบ
      localStorage.setItem('pos_user_session', JSON.stringify(userSession));
      localStorage.setItem('isAuthenticated', 'true');
      
      setLoading(false);
      
      // บังคับเปลี่ยนหน้าไปยัง Dashboard/หน้าหลักโดยตรง ไม่ติด Loop Guard ใน SPA Router
      window.location.href = '/';
    }, 400);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 99999 }}>
      {/* Dynamic Background Canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />

      {/* Login Card */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', margin: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffffff', margin: '0 0 8px 0' }}>Aunchan</h1>
          <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0 }}>ระบบขายหน้าร้านและจัดการสต็อก</p>
        </div>

        {errorMsg && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#fca5a5', fontSize: '14px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              placeholder="owner@aunchan.local"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px 16px', backgroundColor: '#4f46e5', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '8px' }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}
