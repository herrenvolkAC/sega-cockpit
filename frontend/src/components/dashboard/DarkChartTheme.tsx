import React from 'react';

// CSS styles for dark theme charts - optimized to remove light overlays
export const darkChartStyles = `
  /* Custom bar chart styles - Dark theme optimized */
  .recharts-bar-rectangle {
    transition: all 0.15s ease-in-out !important;
  }
  
  .recharts-bar-rectangle:hover {
    filter: brightness(1.08) !important;
    stroke: rgba(255, 255, 255, 0.2) !important;
    stroke-width: 1px !important;
  }
  
  .recharts-bar-rectangle.recharts-active-bar {
    filter: brightness(1.12) !important;
    stroke: rgba(255, 255, 255, 0.3) !important;
    stroke-width: 1.5px !important;
  }
  
  /* Remove ALL background overlays and active states */
  .recharts-active-bar-background,
  .recharts-bar-background-rectangle,
  .recharts-brush-area,
  .recharts-active-shape {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
  }
  
  /* Remove any selection/click backgrounds */
  .recharts-bar-chart .recharts-active-shape-wrapper,
  .recharts-bar-chart .recharts-active-shape {
    display: none !important;
  }
  
  /* Dark mode tooltip adjustments */
  .recharts-tooltip-wrapper {
    border: 1px solid #374151 !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
  }
  
  /* Custom line chart styles */
  .recharts-line-curve {
    transition: stroke-width 0.15s ease-in-out !important;
  }
  
  .recharts-dot:hover {
    r: 6 !important;
    filter: brightness(1.1) !important;
  }
`;

// Props for dark-themed Bar component
export interface DarkBarProps {
  dataKey: string;
  fill?: string;
  name?: string;
  radius?: [number, number, number, number];
}

// Props for dark-themed Tooltip component
export interface DarkTooltipProps {
  contentRenderer: (active: boolean, payload: any[], label: any) => React.ReactNode;
  cursor?: boolean;
}

// Configuration object for dark theme charts
export const darkChartConfig = {
  // Common props to disable light overlays
  barCommonProps: {
    isAnimationActive: false,
    activeBar: false,
    background: false,
    fillOpacity: 1,
    stroke: "transparent",
    strokeWidth: 0,
  },
  
  // Common tooltip props
  tooltipCommonProps: {
    cursor: false,
    isAnimationActive: false,
  },
  
  // Common grid props
  gridCommonProps: {
    strokeDasharray: "3 3",
    stroke: "#f0f0f0",
    opacity: 0.25,
  },
  
  // Common axis props
  axisCommonProps: {
    tick: { fontSize: 11 },
  },
};

// Hook to inject dark chart styles
export const useDarkChartStyles = () => {
  React.useEffect(() => {
    // Check if styles are already injected
    if (document.getElementById('dark-chart-styles')) {
      return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'dark-chart-styles';
    styleElement.textContent = darkChartStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      // Cleanup styles when component unmounts
      const existingStyle = document.getElementById('dark-chart-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);
};

// Component to provide dark chart theme
export const DarkChartThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useDarkChartStyles();
  return <>{children}</>;
};
