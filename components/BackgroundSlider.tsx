"use client";
import { useState, useEffect } from 'react';
import { siteConfig } from '../siteConfig';

export default function BackgroundSlider() {
  const images = siteConfig.bgImages || [];
  const [index, setIndex] = useState(0);
  const currentImage = images[index] || '';

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const next = images[(index + 1) % images.length];
    if (!next) return;
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = next;
  }, [images, index]);

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
