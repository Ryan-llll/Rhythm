import React from 'react';

interface OxygenLogoProps {
  size?: number;
  className?: string;
}

export const OxygenLogo: React.FC<OxygenLogoProps> = ({ size = 24, className }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 48 48" 
      width={size} 
      height={size} 
      fill="none" 
      className={className}
    >
      {/* Orbit Rings (uses current theme gold color) */}
      <ellipse cx="24" cy="24" rx="20" ry="7" transform="rotate(30 24 24)" stroke="currentColor" strokeWidth="2.5" opacity="0.5" />
      <ellipse cx="24" cy="24" rx="20" ry="7" transform="rotate(-30 24 24)" stroke="currentColor" strokeWidth="2.5" opacity="0.5" />
      
      {/* Orbiting electron data nodes in cyan */}
      <circle cx="6" cy="14" r="3.5" fill="#00d8ff" />
      <circle cx="42" cy="34" r="3.5" fill="#00d8ff" />
      <circle cx="6" cy="34" r="3.5" fill="#00d8ff" />
      <circle cx="42" cy="14" r="3.5" fill="#00d8ff" />
      
      {/* Center nucleus */}
      <circle cx="24" cy="24" r="11" fill="var(--bg-color, #09090b)" stroke="currentColor" strokeWidth="2.5" />
      
      {/* Code terminal prompt >_ inside the core */}
      <path d="M21 20l4 4-4 4M26 28h4" stroke="#00d8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
