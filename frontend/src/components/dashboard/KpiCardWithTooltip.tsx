import React, { useState } from 'react';

interface KpiCardWithTooltipProps {
  title: string;
  value: string | number;
  icon: string;
  tooltip: string;
  size?: 'large' | 'small';
  valueColor?: string;
}

export const KpiCardWithTooltip: React.FC<KpiCardWithTooltipProps> = ({
  title,
  value,
  icon,
  tooltip,
  size = 'large',
  valueColor = 'text-gray-900 dark:text-gray-100'
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const isLarge = size === 'large';
  const paddingClass = isLarge ? 'p-7' : 'p-4';
  const titleSizeClass = isLarge ? 'text-sm' : 'text-xs';
  const valueSizeClass = isLarge ? 'text-2xl font-bold' : 'text-lg font-semibold';
  const iconSizeClass = isLarge ? 'text-2xl' : 'text-lg';

  return (
    <div className="relative">
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 cursor-help group`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="button"
        tabIndex={0}
        aria-label={`${title}: ${value}. Presiona para ver detalles del cálculo.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowTooltip(!showTooltip);
          }
        }}
      >
        <div className={`${paddingClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className={`${titleSizeClass} text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors`}>
                {title}
              </p>
              <p className={`${valueSizeClass} ${valueColor} mt-1`}>
                {value}
              </p>
            </div>
            <div className={`${iconSizeClass} ml-2 opacity-70 group-hover:opacity-100 transition-opacity`}>
              {icon}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl border border-gray-600 dark:border-gray-500 max-w-xs animate-fade-in">
          <div className="relative">
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-semibold text-blue-300 mb-2">📊 Cálculo:</div>
              <div>{tooltip}</div>
            </div>
            {/* Flecha del tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
