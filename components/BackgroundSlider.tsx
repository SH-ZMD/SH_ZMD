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

  return (
    <div className="absolute inset-0 z-[-10] overflow-hidden">
      <div
        key={currentImage}
        className="absolute inset-0 transition-opacity duration-700 ease-out transform-gpu"
        style={{
          backgroundImage: `url(${currentImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    </div>
  );
}
