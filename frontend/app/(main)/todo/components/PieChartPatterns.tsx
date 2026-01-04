export default function PieChartPatterns() {
  // Define colors once for all patterns
  const bgLight = "var(--background-lighter)";
  const bg = "var(--primary-color-light)";
  const bgOpacity = "0.5";

  return (
    <defs>
      {/* Pattern 1: Checkerboard */}
      <pattern
        id="pattern-1"
        width="4"
        height="4"
        patternUnits="userSpaceOnUse"
      >
        <rect width="4" height="4" fill={bgLight} />
        <path fill={bg} fillOpacity={bgOpacity} d="M1 3h1v1H1V3zm2-2h1v1H3V1z" />
      </pattern>

      {/* Pattern 2: Graph Paper */}
      <pattern
        id="pattern-2"
        width="100"
        height="100"
        patternUnits="userSpaceOnUse"
      >
        <rect width="100" height="100" fill={bgLight} />
        <g fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity}>
            <path opacity=".5" d="M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z" />
            <path d="M6 5V0H5v5H0v1h5v94h1V6h94V5H6z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 3: Charlie Brown */}
      <pattern
        id="pattern-3"
        width="20"
        height="12"
        patternUnits="userSpaceOnUse"
      >
        <rect width="20" height="12" fill={bgLight} />
        <g fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity}>
            <path d="M9.8 12L0 2.2V.8l10 10 10-10v1.4L10.2 12h-.4zm-4 0L0 6.2V4.8L7.2 12H5.8zm8.4 0L20 6.2V4.8L12.8 12h1.4zM9.8 0l.2.2.2-.2h-.4zm-4 0L10 4.2 14.2 0h-1.4L10 2.8 7.2 0H5.8z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 4: Hexagons */}
      <pattern
        id="pattern-4"
        width="28"
        height="49"
        patternUnits="userSpaceOnUse"
      >
        <rect width="28" height="49" fill={bgLight} />
        <g fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity} fillRule="nonzero">
            <path d="M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 5: Zig Zag */}
      <pattern
        id="pattern-5"
        width="50"
        height="40"
        patternUnits="userSpaceOnUse"
      >
        <rect width="50" height="40" fill={bgLight} />
        <g fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity}>
            <path d="M40 10L36.67 0h-2.11l3.33 10H20l-2.28 6.84L12.11 0H10l6.67 20H10l-2.28 6.84L2.11 10 5.44 0h-2.1L0 10l6.67 20-3.34 10h2.11l2.28-6.84L10 40h20l2.28-6.84L34.56 40h2.1l-3.33-10H40l2.28-6.84L47.89 40H50l-6.67-20L50 0h-2.1l-5.62 16.84L40 10zm1.23 10l-2.28-6.84L34 28h4.56l2.67-8zm-10.67 8l-2-6h-9.12l2 6h9.12zm-12.84-4.84L12.77 38h15.79l2.67-8H20l-2.28-6.84zM18.77 20H30l2.28 6.84L37.23 12H21.44l-2.67 8zm-7.33 2H16l-4.95 14.84L8.77 30l2.67-8z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 6: Autumn */}
      <pattern
        id="pattern-6"
        width="16"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <rect width="16" height="32" fill={bgLight} />
        <g fill={bg} fillOpacity={bgOpacity}>
          <path fillRule="evenodd" d="M0 24h4v2H0v-2zm0 4h6v2H0v-2zm0-8h2v2H0v-2zM0 0h4v2H0V0zm0 4h2v2H0V4zm16 20h-6v2h6v-2zm0 4H8v2h8v-2zm0-8h-4v2h4v-2zm0-20h-6v2h6V0zm0 4h-4v2h4V4zm-2 12h2v2h-2v-2zm0-8h2v2h-2V8zM2 8h10v2H2V8zm0 8h10v2H2v-2zm-2-4h14v2H0v-2zm4-8h6v2H4V4zm0 16h6v2H4v-2zM6 0h2v2H6V0zm0 24h2v2H6v-2z" />
        </g>
      </pattern>

      {/* Pattern 7: Squares */}
      <pattern
        id="pattern-7"
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
      >
        <rect width="8" height="8" fill={bgLight} />
        <g fill={bg} fillOpacity={bgOpacity}>
          <path fillRule="evenodd" d="M0 0h4v4H0V0zm4 4h4v4H4V4z" />
        </g>
      </pattern>

      {/* Pattern 8: Dominos */}
      <pattern
        id="pattern-8"
        width="12"
        height="24"
        patternUnits="userSpaceOnUse"
      >
        <rect width="12" height="24" fill={bgLight} />
        <g fill="none" fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity}>
            <path d="M2 0h2v12H2V0zm1 20c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM9 8c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-1 4h2v12H8V12z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 9: Plus */}
      <pattern
        id="pattern-9"
        width="60"
        height="60"
        patternUnits="userSpaceOnUse"
      >
        <rect width="60" height="60" fill={bgLight} />
        <g fill="none" fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity}>
            <path d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 10: Wiggle */}
      <pattern
        id="pattern-10"
        width="52"
        height="26"
        patternUnits="userSpaceOnUse"
      >
        <rect width="52" height="26" fill={bgLight} />
        <g fill="none" fillRule="evenodd">
          <g fill={bg} fillOpacity={bgOpacity}>
            <path d="M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z" />
          </g>
        </g>
      </pattern>

      {/* Pattern 11: Bubbles */}
      <pattern
        id="pattern-11"
        width="32"
        height="26"
        patternUnits="userSpaceOnUse"
      >
        <rect width="32" height="26" fill={bgLight} />
        <path d="M14 0v3.994C14 7.864 10.858 11 7 11c-3.866 0-7-3.138-7-7.006V0h2v4.005C2 6.765 4.24 9 7 9c2.756 0 5-2.236 5-4.995V0h2zm0 26v-5.994C14 16.138 10.866 13 7 13c-3.858 0-7 3.137-7 7.006V26h2v-6.005C2 17.235 4.244 15 7 15c2.76 0 5 2.236 5 4.995V26h2zm2-18.994C16 3.136 19.142 0 23 0c3.866 0 7 3.138 7 7.006v9.988C30 20.864 26.858 24 23 24c-3.866 0-7-3.138-7-7.006V7.006zm2-.01C18 4.235 20.244 2 23 2c2.76 0 5 2.236 5 4.995v10.01C28 19.765 25.756 22 23 22c-2.76 0-5-2.236-5-4.995V6.995z" fill={bg} fillOpacity={bgOpacity} fillRule="evenodd" />
      </pattern>

      {/* Pattern 12: Triangles */}
      <pattern
        id="pattern-12"
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
      >
        <rect width="40" height="40" fill={bgLight} />
        <g fill={bg} fillOpacity={bgOpacity} fillRule="evenodd">
          <path d="M0 40L40 0H20L0 20M40 40V20L20 40" />
        </g>
      </pattern>

      {/* Pattern 13: Arrows */}
      <pattern
        id="pattern-13"
        width="16"
        height="20"
        patternUnits="userSpaceOnUse"
      >
        <rect width="16" height="20" fill={bgLight} />
        <g fill={bg} fillOpacity={bgOpacity} fillRule="evenodd">
          <path d="M8 0v20L0 10M16 0v10L8 0M16 10v10H8" />
        </g>
      </pattern>

      {/* Pattern 14: Diagonal Lines */}
      <pattern
        id="pattern-14"
        width="60"
        height="60"
        patternUnits="userSpaceOnUse"
      >
        <rect width="60" height="60" fill={bgLight} />
        <path d="M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zm20.97 0l9.315 9.314-1.414 1.414L34.828 0h2.83zM22.344 0L13.03 9.314l1.414 1.414L25.172 0h-2.83zM32 0l12.142 12.142-1.414 1.414L30 .828 17.272 13.556l-1.414-1.414L28 0h4zM.284 0l28 28-1.414 1.414L0 2.544V0h.284zM0 5.373l25.456 25.455-1.414 1.415L0 8.2V5.374zm0 5.656l22.627 22.627-1.414 1.414L0 13.86v-2.83zm0 5.656l19.8 19.8-1.415 1.413L0 19.514v-2.83zm0 5.657l16.97 16.97-1.414 1.415L0 25.172v-2.83zM0 28l14.142 14.142-1.414 1.414L0 30.828V28zm0 5.657L11.314 44.97 9.9 46.386l-9.9-9.9v-2.828zm0 5.657L8.485 47.8 7.07 49.212 0 42.143v-2.83zm0 5.657l5.657 5.657-1.414 1.415L0 47.8v-2.83zm0 5.657l2.828 2.83-1.414 1.413L0 53.456v-2.83zM54.627 60L30 35.373 5.373 60H8.2L30 38.2 51.8 60h2.827zm-5.656 0L30 41.03 11.03 60h2.828L30 43.858 46.142 60h2.83zm-5.656 0L30 46.686 16.686 60h2.83L30 49.515 40.485 60h2.83zm-5.657 0L30 52.343 22.343 60h2.83L30 55.172 34.828 60h2.83zM32 60l-2-2-2 2h4zM59.716 0l-28 28 1.414 1.414L60 2.544V0h-.284zM60 5.373L34.544 30.828l1.414 1.415L60 8.2V5.374zm0 5.656L37.373 33.656l1.414 1.414L60 13.86v-2.83zm0 5.656l-19.8 19.8 1.415 1.413L60 19.514v-2.83zm0 5.657l-16.97 16.97 1.414 1.415L60 25.172v-2.83zM60 28L45.858 42.142l1.414 1.414L60 30.828V28zm0 5.657L48.686 44.97l1.415 1.415 9.9-9.9v-2.828zm0 5.657L51.515 47.8l1.414 1.413 7.07-7.07v-2.83zm0 5.657l-5.657 5.657 1.414 1.415L60 47.8v-2.83zm0 5.657l-2.828 2.83 1.414 1.413L60 53.456v-2.83zM39.9 16.385l1.414-1.414L30 3.658 18.686 14.97l1.415 1.415 9.9-9.9 9.9 9.9zm-2.83 2.828l1.415-1.414L30 9.313 21.515 17.8l1.414 1.413 7.07-7.07 7.07 7.07zm-2.827 2.83l1.414-1.416L30 14.97l-5.657 5.657 1.414 1.415L30 17.8l4.243 4.242zm-2.83 2.827l1.415-1.414L30 20.626l-2.828 2.83 1.414 1.414L30 23.456l1.414 1.414zM56.87 59.414L58.284 58 30 29.716 1.716 58l1.414 1.414L30 32.544l26.87 26.87z" fill={bg} fillOpacity={bgOpacity} fillRule="evenodd" />
      </pattern>

      {/* Pattern 15: Horizontal Stripes */}
      <pattern
        id="pattern-15"
        width="40"
        height="1"
        patternUnits="userSpaceOnUse"
      >
        <rect width="40" height="1" fill={bgLight} />
        <path d="M0 0h20v1H0z" fill={bg} fillOpacity={bgOpacity} fillRule="evenodd" />
      </pattern>
    </defs>
  );
}

