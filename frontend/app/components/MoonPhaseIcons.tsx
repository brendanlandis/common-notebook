/**
 * Moon phase icons using the correct SVG paths from Weather Icons
 * Source: https://github.com/erikflowers/weather-icons
 */

interface MoonIconProps {
  size?: number;
  className?: string;
}

export function MoonNew({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0-1.53,0.3-3,0.89-4.39s1.4-2.59,2.4-3.6s2.2-1.81,3.6-2.4s2.85-0.89,4.37-0.89c1.53,0,3,0.3,4.39,0.89 s2.59,1.4,3.6,2.4s1.81,2.2,2.4,3.6s0.89,2.85,0.89,4.39c0,1.52-0.3,2.98-0.89,4.37s-1.4,2.59-2.4,3.6s-2.2,1.81-3.6,2.4 s-2.85,0.89-4.39,0.89c-1.52,0-2.98-0.3-4.37-0.89s-2.59-1.4-3.6-2.4s-1.81-2.2-2.4-3.6S3.74,15.97,3.74,14.44z M4.94,14.44 c0,1.36,0.27,2.66,0.8,3.9s1.25,2.32,2.15,3.22s1.97,1.61,3.22,2.15s2.55,0.8,3.9,0.8c1.37,0,2.67-0.27,3.91-0.8 s2.31-1.25,3.22-2.15s1.62-1.97,2.15-3.22s0.8-2.55,0.8-3.9c0-1.82-0.45-3.5-1.35-5.05s-2.13-2.77-3.68-3.68s-3.23-1.35-5.05-1.35 c-1.36,0-2.66,0.27-3.9,0.8S8.79,6.41,7.89,7.32s-1.61,1.98-2.15,3.22S4.94,13.08,4.94,14.44z"/>
    </svg>
  );
}

export function MoonWaxingCrescent1({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M15.01,25.71c2.04,0,3.92-0.5,5.65-1.51s3.09-2.37,4.09-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.09-4.09 s-3.61-1.51-5.65-1.51c1.32,0.52,2.48,1.2,3.47,2.06s1.78,1.79,2.35,2.82s0.99,2.07,1.27,3.13s0.41,2.14,0.41,3.24 c0,0.64-0.02,1.26-0.07,1.84c-0.05,0.58-0.15,1.2-0.29,1.87s-0.33,1.28-0.56,1.86s-0.54,1.15-0.92,1.74s-0.83,1.11-1.35,1.58 s-1.14,0.92-1.87,1.33S15.9,25.42,15.01,25.71z"/>
    </svg>
  );
}

export function MoonWaxingCrescent2({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M15.01,25.71c2.04,0,3.92-0.5,5.65-1.51s3.09-2.37,4.09-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.09-4.09 s-3.61-1.51-5.65-1.51c1.1,0.59,2.07,1.32,2.89,2.19s1.47,1.82,1.95,2.83s0.83,2.03,1.05,3.07s0.34,2.09,0.34,3.16 c0,0.91-0.04,1.76-0.13,2.54s-0.27,1.63-0.53,2.53s-0.62,1.71-1.06,2.43s-1.04,1.42-1.82,2.09S16.03,25.26,15.01,25.71z"/>
    </svg>
  );
}

export function MoonWaxingCrescent3({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M15.01,25.71c2.04,0,3.92-0.5,5.65-1.51s3.09-2.37,4.09-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.09-4.09 s-3.61-1.51-5.65-1.51c1.71,1.26,2.97,2.9,3.78,4.91S20,12.24,20,14.44c0,0.9-0.03,1.73-0.1,2.5s-0.21,1.59-0.43,2.47 s-0.51,1.68-0.86,2.4s-0.83,1.42-1.45,2.12S15.83,25.21,15.01,25.71z"/>
    </svg>
  );
}

export function MoonWaxingCrescent4({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M15.01,25.71c2.04,0,3.92-0.5,5.65-1.51s3.09-2.37,4.09-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.09-4.09 s-3.61-1.51-5.65-1.51c1.29,1.39,2.24,3.07,2.84,5.05s0.91,4.05,0.91,6.2c0,0.88-0.03,1.69-0.08,2.44s-0.16,1.55-0.32,2.41 s-0.38,1.65-0.64,2.37s-0.63,1.43-1.09,2.15S15.62,25.15,15.01,25.71z"/>
    </svg>
  );
}

export function MoonWaxingCrescent5({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M14.99,25.71c2.04,0,3.93-0.5,5.65-1.51s3.1-2.37,4.1-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.1-4.09 s-3.61-1.51-5.65-1.51c1.67,2.9,2.5,6.65,2.5,11.25c0,2.33-0.17,4.43-0.52,6.3S15.97,24.26,14.99,25.71z"/>
    </svg>
  );
}

export function MoonWaxingCrescent6({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M14.99,25.71c2.04,0,3.93-0.5,5.65-1.51s3.1-2.37,4.1-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.1-4.09 s-3.61-1.51-5.65-1.51c1.67,2.9,2.5,6.65,2.5,11.25c0,2.33-0.17,4.43-0.52,6.3S15.97,24.26,14.99,25.71z"/>
    </svg>
  );
}

export function MoonFirstQuarter({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M15.01,25.71c2.04,0,3.92-0.5,5.65-1.51s3.09-2.37,4.09-4.1s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.09-4.09 s-3.61-1.51-5.65-1.51V25.71z"/>
    </svg>
  );
}

export function MoonWaxingGibbous1({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M13.93,14.44c-0.02,4.53,0.33,8.29,1.04,11.27c2.04,0.01,3.93-0.49,5.65-1.49s3.1-2.36,4.11-4.08s1.52-3.61,1.53-5.65 c0.01-2.04-0.49-3.93-1.49-5.65c-1-1.73-2.36-3.1-4.08-4.11s-3.6-1.52-5.64-1.53C14.32,6.91,13.94,10.66,13.93,14.44z"/>
    </svg>
  );
}

export function MoonWaxingGibbous2({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M12.85,14.44c0,4.77,0.71,8.52,2.14,11.26c2.04,0,3.93-0.5,5.65-1.51s3.1-2.37,4.1-4.1s1.51-3.61,1.51-5.65 s-0.5-3.92-1.51-5.65s-2.37-3.09-4.1-4.09s-3.61-1.51-5.65-1.51C13.57,6.61,12.85,10.36,12.85,14.44z"/>
    </svg>
  );
}

export function MoonWaxingGibbous3({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M11.8,14.43c0,2.39,0.24,4.52,0.71,6.39s1.31,3.5,2.51,4.89c1.52,0,2.98-0.3,4.37-0.89s2.59-1.4,3.6-2.4s1.81-2.2,2.4-3.6 s0.89-2.85,0.89-4.39s-0.3-2.99-0.89-4.38s-1.4-2.58-2.4-3.59s-2.2-1.81-3.6-2.4s-2.85-0.89-4.37-0.89 c-1.02,1.46-1.81,3.16-2.37,5.13S11.8,12.3,11.8,14.43z"/>
    </svg>
  );
}

export function MoonWaxingGibbous4({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M10.73,14.43c0,1.19,0.07,2.29,0.2,3.3s0.35,2,0.67,2.99s0.76,1.9,1.33,2.75s1.27,1.59,2.09,2.25c1.53,0,2.99-0.3,4.38-0.89 s2.58-1.4,3.59-2.4s1.81-2.2,2.4-3.6s0.89-2.85,0.89-4.39c0-2.04-0.5-3.93-1.51-5.65s-2.37-3.1-4.1-4.1s-3.61-1.51-5.65-1.51 c-1.35,1.3-2.4,2.94-3.16,4.93S10.73,12.19,10.73,14.43z"/>
    </svg>
  );
}

export function MoonWaxingGibbous5({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M9.65,14.43c0,1.24,0.08,2.38,0.25,3.41s0.44,2.05,0.83,3.04s0.95,1.89,1.67,2.71s1.6,1.52,2.62,2.12 c1.52,0,2.98-0.3,4.37-0.89s2.59-1.4,3.6-2.4s1.81-2.2,2.4-3.6s0.89-2.85,0.89-4.39s-0.3-2.99-0.89-4.38s-1.4-2.58-2.4-3.59 s-2.2-1.81-3.6-2.4s-2.85-0.89-4.37-0.89c-1.67,1.14-2.98,2.72-3.94,4.74S9.65,12.09,9.65,14.43z"/>
    </svg>
  );
}

export function MoonWaxingGibbous6({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M8.58,14.43c0,1.03,0.06,1.97,0.18,2.83s0.32,1.73,0.62,2.59s0.69,1.65,1.16,2.34s1.1,1.35,1.85,1.96s1.63,1.12,2.63,1.55 c1.53,0,2.99-0.3,4.38-0.89s2.58-1.4,3.59-2.4s1.81-2.2,2.4-3.6s0.89-2.85,0.89-4.39c0-2.04-0.5-3.93-1.51-5.65s-2.37-3.1-4.1-4.1 s-3.61-1.51-5.65-1.51c-1.99,1-3.56,2.51-4.72,4.55S8.58,11.99,8.58,14.43z"/>
    </svg>
  );
}

export function MoonFull({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.1,4.1s3.61,1.51,5.65,1.51s3.92-0.5,5.65-1.51s3.09-2.37,4.09-4.1 s1.51-3.61,1.51-5.65s-0.5-3.92-1.51-5.65s-2.37-3.09-4.09-4.09s-3.61-1.51-5.65-1.51S11.08,3.7,9.35,4.7s-3.1,2.37-4.1,4.09 S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningGibbous1({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.49c0,1.22,0.19,2.4,0.56,3.54s0.91,2.17,1.6,3.09s1.5,1.72,2.42,2.42s1.95,1.23,3.09,1.6s2.32,0.56,3.54,0.56 c5.03-1.4,7.54-5.14,7.54-11.22c0-1.18-0.14-2.3-0.42-3.37s-0.65-2.01-1.13-2.83s-1.04-1.57-1.68-2.24s-1.34-1.24-2.06-1.68 s-1.47-0.81-2.26-1.07c-1.52,0-2.98,0.3-4.37,0.89S8.02,5.57,7.02,6.57s-1.8,2.19-2.39,3.57S3.74,12.97,3.74,14.49z"/>
    </svg>
  );
}

export function MoonWaningGibbous2({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.49c0,1.22,0.19,2.4,0.56,3.54s0.91,2.17,1.6,3.09s1.5,1.72,2.42,2.42s1.95,1.23,3.09,1.6s2.32,0.56,3.54,0.56 c4.33-1.73,6.49-5.47,6.49-11.22c0-1.39-0.18-2.7-0.54-3.93s-0.85-2.31-1.47-3.23s-1.31-1.71-2.06-2.39s-1.56-1.23-2.42-1.66 c-2.03,0-3.91,0.5-5.63,1.5S6.25,7.14,5.24,8.86S3.74,12.46,3.74,14.49z"/>
    </svg>
  );
}

export function MoonWaningGibbous3({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.49c0,1.22,0.19,2.4,0.56,3.54s0.91,2.17,1.6,3.09s1.5,1.72,2.42,2.42s1.95,1.23,3.09,1.6s2.32,0.56,3.54,0.56 c3.61-2.07,5.42-5.81,5.42-11.22c0-1.31-0.15-2.56-0.45-3.74s-0.71-2.24-1.23-3.17s-1.1-1.75-1.72-2.46s-1.3-1.33-2.02-1.86 c-1.52,0-2.98,0.3-4.37,0.89s-2.58,1.39-3.58,2.4s-1.8,2.2-2.39,3.59S3.74,12.96,3.74,14.49z"/>
    </svg>
  );
}

export function MoonWaningGibbous4({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.47c0,1.52,0.3,2.98,0.89,4.37s1.39,2.58,2.4,3.59s2.2,1.8,3.59,2.4s2.84,0.89,4.37,0.89 c2.89-2.39,4.34-6.14,4.34-11.24c0-2.34-0.41-4.47-1.22-6.36s-1.85-3.52-3.11-4.87c-2.03,0-3.91,0.5-5.64,1.51S6.25,7.12,5.24,8.84 S3.74,12.44,3.74,14.47z"/>
    </svg>
  );
}

export function MoonWaningGibbous5({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.47c0,2.03,0.5,3.91,1.51,5.63s2.37,3.09,4.09,4.09s3.6,1.51,5.63,1.51c2.17-2.75,3.25-6.5,3.25-11.24 c0-3.96-1.08-7.71-3.25-11.24c-2.03,0-3.91,0.5-5.63,1.5S6.26,7.1,5.25,8.83S3.74,12.44,3.74,14.47z"/>
    </svg>
  );
}

export function MoonWaningGibbous6({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.46c0,2.04,0.5,3.92,1.51,5.65s2.37,3.09,4.09,4.09s3.61,1.51,5.65,1.51c1.44-3.08,2.15-6.83,2.15-11.25 c0-3.46-0.72-7.2-2.15-11.24c-1.52,0-2.98,0.3-4.37,0.89S8.03,5.5,7.03,6.5s-1.8,2.2-2.4,3.59S3.74,12.93,3.74,14.46z"/>
    </svg>
  );
}

export function MoonThirdQuarter({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.09,4.1s3.61,1.51,5.65,1.51V3.19c-2.04,0-3.92,0.5-5.65,1.51 S6.26,7.07,5.25,8.8S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningCrescent1({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.09,4.1s3.61,1.51,5.65,1.51c-1-3.14-1.49-6.9-1.49-11.26 c0-3.43,0.5-7.18,1.49-11.25c-2.04,0-3.92,0.5-5.65,1.51S6.26,7.07,5.25,8.8S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningCrescent2({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.1,4.1s3.61,1.51,5.65,1.51c-2.01-2.74-3.02-6.5-3.02-11.26 c0-3.98,1.01-7.73,3.02-11.25c-2.04,0-3.93,0.5-5.65,1.51s-3.1,2.37-4.1,4.09S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningCrescent3({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.09,4.1s3.61,1.51,5.65,1.51c-2.99-2.33-4.48-6.09-4.48-11.26 c0-2.32,0.42-4.46,1.25-6.4s1.91-3.56,3.23-4.85c-2.04,0-3.92,0.5-5.65,1.51S6.26,7.07,5.25,8.8S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningCrescent4({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.1,4.1s3.61,1.51,5.65,1.51c-2.07-1.01-3.59-2.45-4.56-4.33 S9,17.19,9,14.44c0-2.53,0.56-4.78,1.69-6.75s2.57-3.47,4.31-4.5c-2.04,0-3.93,0.5-5.65,1.51s-3.1,2.37-4.1,4.09 S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningCrescent5({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.09,4.1s3.61,1.51,5.65,1.51c-2.59-0.79-4.48-2.13-5.69-4.02 s-1.81-4.3-1.81-7.24c0-1.39,0.2-2.7,0.6-3.95c0.4-1.25,0.94-2.34,1.63-3.27s1.48-1.75,2.37-2.44s1.86-1.22,2.89-1.59 c-2.04,0-3.92,0.5-5.65,1.51S6.26,7.07,5.25,8.8S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}

export function MoonWaningCrescent6({ size = 30, className }: MoonIconProps) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} className={className} fill="currentColor" stroke="currentColor" strokeWidth="0">
      <path d="M3.74,14.44c0,2.04,0.5,3.93,1.51,5.65s2.37,3.1,4.09,4.1s3.61,1.51,5.65,1.51c-1.46-0.56-2.72-1.18-3.79-1.88 s-1.93-1.39-2.57-2.1s-1.15-1.49-1.53-2.34s-0.64-1.66-0.77-2.42s-0.2-1.6-0.2-2.52c0-0.65,0.03-1.26,0.08-1.81s0.16-1.14,0.32-1.77 s0.38-1.21,0.64-1.75s0.63-1.09,1.08-1.66s0.98-1.1,1.59-1.57s1.34-0.95,2.21-1.42s1.85-0.89,2.93-1.27c-2.04,0-3.92,0.5-5.65,1.51 S6.26,7.07,5.25,8.8S3.74,12.4,3.74,14.44z"/>
    </svg>
  );
}
