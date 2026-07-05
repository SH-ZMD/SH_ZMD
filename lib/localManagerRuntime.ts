"use client";

import { useEffect, useState } from 'react';

export function isLocalManagerRuntime() {
  if (typeof window === 'undefined') return false;
  const { hostname, protocol } = window.location;
  return (
    protocol === 'file:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

export function useLocalManagerRuntime() {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    setCanManage(isLocalManagerRuntime());
  }, []);

  return canManage;
}
