import React from 'react';

export default function Logo({ size = 34 }) {
  return <img src="/aiproces-logo.svg" alt="AiProces" width={size} height={size} style={{ borderRadius: '8px' }} />;
}
