"use client";
import { useState, useEffect } from 'react';
import { siteConfig } from '../siteConfig';

export default function BackgroundSlider() {
  const images = siteConfig.bgImages || [];
  const [index, setIndex] = useState(0);
  const [canRotate, setCanRotate] = useState(false);
  const currentImage = images[index] || '';

  useEffect(() => {
    if (images.length <= 1) {
      setCanRotate(false);
      return;
    }

    const timer = window.setTimeout(() => setCanRotate(true), 3500);
    return () => window.clearTimeout(timer);
  }, [images.length]);

  useEffect(() => {
    if (!canRotate || images.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [canRotate, images.length]);

  useEffect(() => {
    if (!canRotate || images.length <= 1) return;
    const next = images[(index + 1) % images.length];
    if (!next) return;
    const preloadNext = () => {
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = next;
    };
    const requestIdle = (window as any).requestIdleCallback as
      | ((callback: () => void, options?: { timeout?: number }) => number)
      | undefined;
    const cancelIdle = (window as any).cancelIdleCallback as
      | ((id: number) => void)
      | undefined;
    const idleId = requestIdle
      ? requestIdle(preloadNext, { timeout: 2500 })
      : window.setTimeout(preloadNext, 500);
    return () => {
      if (requestIdle && cancelIdle) cancelIdle(idleId as number);
      else window.clearTimeout(idleId as number);
    };
  }, [canRotate, images, index]);

  if (!currentImage) return null;

  // 交叉淡入淡出：底层保留上一张图，新图作为上层用 CSS 动画淡入覆盖
  // （动画在挂载时自动播放，避免 transition 因重挂载直接跳到终态的问题）
  const previousImage = images[(index - 1 + images.length) % images.length] || '';

  const layerStyle = (image: string) => ({
    backgroundImage: `url(${image})`,
    backgroundSize: 'cover' as const,
    backgroundPosition: 'center' as const,
  });

  return (
    <div className="absolute inset-0 z-[-10] overflow-hidden">
      <style>{`@keyframes bgFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {previousImage && previousImage !== currentImage && (
        <div className="absolute inset-0 transform-gpu" style={layerStyle(previousImage)} />
      )}
      <div
        key={currentImage}
        className="absolute inset-0 transform-gpu"
        style={{ ...layerStyle(currentImage), animation: 'bgFadeIn 700ms ease-out both' }}
      />
    </div>
  );
}
