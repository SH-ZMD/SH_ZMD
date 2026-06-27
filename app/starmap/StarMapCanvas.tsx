"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type StarItem = {
  id: string;
  title: string;
  type: 'post' | 'chatter' | 'moment';
  date: string;
  href: string;
  preview: string;
};

type RenderStar = {
  item: StarItem;
  x: number;
  y: number;
  baseRadius: number;
  twinklePhase: number;
  color: string;
  glowIntensity: number;
};

const typeColors: Record<string, string> = {
  post: '180, 200, 255',      // 淡蓝白
  chatter: '255, 180, 220',   // 淡粉
  moment: '200, 255, 200',    // 淡绿
};

const typeLabels: Record<string, string> = {
  post: '文章',
  chatter: '杂谈',
  moment: '说说',
};

export default function StarMapCanvas({ stars }: { stars: StarItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const renderStarsRef = useRef<RenderStar[]>([]);
  const mouseRef = useRef({ x: -999, y: -999, isDown: false, dragStartX: 0, dragStartY: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const [hoveredStar, setHoveredStar] = useState<RenderStar | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dims, setDims] = useState({ w: 1200, h: 800 });
  const [isEmpty, setIsEmpty] = useState(false);

  // 初始化星点位置
  useEffect(() => {
    if (stars.length === 0) {
      setIsEmpty(true);
      return;
    }
    setIsEmpty(false);

    // 按时间排列成螺旋星轨
    const minDate = Math.min(...stars.map(s => new Date(s.date).getTime()));
    const maxDate = Math.max(...stars.map(s => new Date(s.date).getTime()));
    const dateSpan = Math.max(maxDate - minDate, 86400000); // 至少一天

    const w = dims.w;
    const h = dims.h;
    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = Math.min(w, h) * 0.42;

    const renderStars: RenderStar[] = stars.map((item, i) => {
      const t = stars.length > 1 ? i / (stars.length - 1) : 0.5;
      const dateT = (new Date(item.date).getTime() - minDate) / dateSpan;

      // 螺旋分布：角度随时间增长，半径也微微增长
      const angle = t * Math.PI * 6 + dateT * Math.PI * 2; // 3圈螺旋
      const radius = 40 + dateT * maxRadius;

      // 加一点随机偏移让星点不完美
      const jitterX = (Math.sin(i * 7.3) * 0.5) * 25;
      const jitterY = (Math.cos(i * 11.7) * 0.5) * 25;

      const baseRadius = item.type === 'post' ? 3.5 : item.type === 'chatter' ? 2.8 : 2.2;

      return {
        item,
        x: centerX + Math.cos(angle) * radius + jitterX,
        y: centerY + Math.sin(angle) * radius * 0.7 + jitterY, // 椭圆压扁
        baseRadius,
        twinklePhase: Math.random() * Math.PI * 2,
        color: typeColors[item.type] || '200,200,255',
        glowIntensity: 0,
      };
    });

    renderStarsRef.current = renderStars;
  }, [stars, dims]);

  // 监听容器尺寸
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDims({ w: Math.max(width, 320), h: Math.max(height, 400) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 绘制循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    canvas.style.width = dims.w + 'px';
    canvas.style.height = dims.h + 'px';
    ctx.scale(dpr, dpr);

    let time = 0;

    const draw = () => {
      time += 0.016;
      ctx.clearRect(0, 0, dims.w, dims.h);

      // 深色背景渐变
      const bgGrad = ctx.createRadialGradient(dims.w / 2, dims.h / 2, 0, dims.w / 2, dims.h / 2, Math.max(dims.w, dims.h) * 0.7);
      bgGrad.addColorStop(0, 'rgba(15, 15, 35, 1)');
      bgGrad.addColorStop(0.5, 'rgba(8, 8, 25, 1)');
      bgGrad.addColorStop(1, 'rgba(3, 3, 15, 1)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, dims.w, dims.h);

      // 远景星尘
      ctx.save();
      for (let i = 0; i < 80; i++) {
        const x = (Math.sin(i * 37.2 + time * 0.02) * 0.5 + 0.5) * dims.w;
        const y = (Math.cos(i * 23.7 + time * 0.015) * 0.5 + 0.5) * dims.h;
        const a = 0.08 + Math.sin(time + i) * 0.04;
        ctx.fillStyle = `rgba(180, 180, 220, ${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const renderStars = renderStarsRef.current;
      const offsetX = offsetRef.current.x;
      const offsetY = offsetRef.current.y;

      // 绘制星点之间的连线（仅相邻同类型）
      ctx.save();
      ctx.lineWidth = 0.5;
      for (let i = 1; i < renderStars.length; i++) {
        const prev = renderStars[i - 1];
        const curr = renderStars[i];
        if (prev.item.type !== curr.item.type) continue;
        const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        if (dist > 120) continue;
        const alpha = 0.06 * (1 - dist / 120);
        ctx.strokeStyle = `rgba(${curr.color}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(prev.x + offsetX, prev.y + offsetY);
        ctx.lineTo(curr.x + offsetX, curr.y + offsetY);
        ctx.stroke();
      }
      ctx.restore();

      // 检测鼠标悬停
      let hovered: RenderStar | null = null;
      const mouse = mouseRef.current;

      for (const star of renderStars) {
        const sx = star.x + offsetX;
        const sy = star.y + offsetY;
        const dx = sx - mouse.x;
        const dy = sy - mouse.y;
        const distToMouse = Math.hypot(dx, dy);

        // 闪烁
        const twinkle = 0.7 + Math.sin(time * 2 + star.twinklePhase) * 0.3;
        const isHovered = distToMouse < star.baseRadius + 12;
        if (isHovered) hovered = star;

        // glow 缓动
        const targetGlow = isHovered ? 1 : 0;
        star.glowIntensity += (targetGlow - star.glowIntensity) * 0.15;

        const radius = star.baseRadius * twinkle * (1 + star.glowIntensity * 0.8);
        const glowRadius = radius * (3 + star.glowIntensity * 5);

        // 外发光
        const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
        glowGrad.addColorStop(0, `rgba(${star.color}, ${0.4 + star.glowIntensity * 0.4})`);
        glowGrad.addColorStop(0.4, `rgba(${star.color}, ${0.1 + star.glowIntensity * 0.15})`);
        glowGrad.addColorStop(1, `rgba(${star.color}, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 星点本体
        ctx.fillStyle = `rgba(${star.color}, ${0.85 + star.glowIntensity * 0.15})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();

        // 高光十字（hover 时）
        if (star.glowIntensity > 0.3) {
          ctx.save();
          ctx.strokeStyle = `rgba(${star.color}, ${star.glowIntensity * 0.5})`;
          ctx.lineWidth = 0.8;
          const crossLen = radius * 4;
          ctx.beginPath();
          ctx.moveTo(sx - crossLen, sy);
          ctx.lineTo(sx + crossLen, sy);
          ctx.moveTo(sx, sy - crossLen);
          ctx.lineTo(sx, sy + crossLen);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 更新 hovered 状态
      if (hovered !== hoveredStar) {
        setHoveredStar(hovered);
      }
      if (hovered) {
        setTooltipPos({ x: hovered.x + offsetX, y: hovered.y + offsetY });
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dims, hoveredStar]);

  // 鼠标事件
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;

    // 拖拽平移
    if (mouseRef.current.isDown) {
      const dx = e.clientX - rect.left - mouseRef.current.dragStartX;
      const dy = e.clientY - rect.top - mouseRef.current.dragStartY;
      offsetRef.current.x = dx;
      offsetRef.current.y = dy;
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.isDown = true;
    mouseRef.current.dragStartX = e.clientX - rect.left - offsetRef.current.x;
    mouseRef.current.dragStartY = e.clientY - rect.top - offsetRef.current.y;
    mouseRef.current.clickStartX = e.clientX - rect.left;
    mouseRef.current.clickStartY = e.clientY - rect.top;
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    mouseRef.current.isDown = false;
    // 如果几乎没移动，视为点击
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const startCx = mouseRef.current.clickStartX ?? cx;
    const startCy = mouseRef.current.clickStartY ?? cy;
    if (Math.hypot(cx - startCx, cy - startCy) < 5) {
      // 点击：检查是否命中星点
      const renderStars = renderStarsRef.current;
      const offsetX = offsetRef.current.x;
      const offsetY = offsetRef.current.y;
      for (const star of renderStars) {
        const sx = star.x + offsetX;
        const sy = star.y + offsetY;
        if (Math.hypot(sx - cx, sy - cy) < star.baseRadius + 12) {
          router.push(star.item.href);
          break;
        }
      }
    }
  }, [router]);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.x = -999;
    mouseRef.current.y = -999;
    mouseRef.current.isDown = false;
    setHoveredStar(null);
  }, []);

  // 触摸支持（移动端）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return;
    const touch = e.touches[0];
    mouseRef.current.x = touch.clientX - rect.left;
    mouseRef.current.y = touch.clientY - rect.top;
    mouseRef.current.isDown = true;
    mouseRef.current.dragStartX = touch.clientX - rect.left - offsetRef.current.x;
    mouseRef.current.dragStartY = touch.clientY - rect.top - offsetRef.current.y;
    mouseRef.current.clickStartX = touch.clientX - rect.left;
    mouseRef.current.clickStartY = touch.clientY - rect.top;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return;
    const touch = e.touches[0];
    mouseRef.current.x = touch.clientX - rect.left;
    mouseRef.current.y = touch.clientY - rect.top;
    if (mouseRef.current.isDown) {
      const dx = touch.clientX - rect.left - mouseRef.current.dragStartX;
      const dy = touch.clientY - rect.top - mouseRef.current.dragStartY;
      offsetRef.current.x = dx;
      offsetRef.current.y = dy;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    mouseRef.current.isDown = false;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = mouseRef.current.x;
    const cy = mouseRef.current.y;
    const startCx = mouseRef.current.clickStartX ?? cx;
    const startCy = mouseRef.current.clickStartY ?? cy;
    if (Math.hypot(cx - startCx, cy - startCy) < 10) {
      const renderStars = renderStarsRef.current;
      const offsetX = offsetRef.current.x;
      const offsetY = offsetRef.current.y;
      for (const star of renderStars) {
        const sx = star.x + offsetX;
        const sy = star.y + offsetY;
        if (Math.hypot(sx - cx, sy - cy) < star.baseRadius + 20) {
          router.push(star.item.href);
          break;
        }
      }
    }
    mouseRef.current.x = -999;
    mouseRef.current.y = -999;
  }, [router]);

  return (
    <div className="min-h-screen relative">
      {/* 标题区 */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-20 md:pt-24 px-6 pointer-events-none">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white/90 drop-shadow-[0_0_20px_rgba(180,180,255,0.3)]">
            星图
          </h1>
          <p className="mt-2 text-sm md:text-base text-white/40 font-medium">
            所有内容化作星辰，散落在时间的银河里
          </p>
        </div>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2 pointer-events-none">
        {Object.entries(typeLabels).map(([type, label]) => (
          <div key={type} className="flex items-center gap-2 text-xs font-bold text-white/50">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: `rgba(${typeColors[type]}, 0.9)`, boxShadow: `0 0 8px rgba(${typeColors[type]}, 0.6)` }}
            />
            {label}
          </div>
        ))}
        <div className="mt-1 text-[10px] text-white/30 font-medium">
          拖拽平移 · 点击星点跳转
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-white/30 text-lg font-bold">星图正在等待第一颗星...</p>
        </div>
      ) : (
        <div ref={containerRef} className="absolute inset-0" style={{ cursor: hoveredStar ? 'pointer' : 'grab' }}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="block w-full h-full"
            style={{ cursor: hoveredStar ? 'pointer' : 'grab' }}
          />

          {/* Tooltip */}
          {hoveredStar && (
            <div
              className="absolute z-30 pointer-events-none max-w-xs"
              style={{
                left: tooltipPos.x + 16,
                top: tooltipPos.y - 20,
                opacity: 1,
              }}
            >
              <div className="rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/10 px-4 py-3 shadow-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: `rgba(${hoveredStar.color}, 1)` }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {typeLabels[hoveredStar.item.type]}
                  </span>
                </div>
                <p className="text-sm font-bold text-white/90 leading-snug break-words">
                  {hoveredStar.item.title}
                </p>
                {hoveredStar.item.preview && (
                  <p className="mt-1.5 text-xs text-white/40 leading-relaxed line-clamp-2">
                    {hoveredStar.item.preview}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-white/30 font-medium">
                  {hoveredStar.item.date}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
