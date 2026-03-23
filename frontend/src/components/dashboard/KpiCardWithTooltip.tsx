import React from 'react';
import { InfoTooltip } from "@/components/InfoTooltip";

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
  const isLarge = size === 'large';
  const paddingClass = isLarge ? 'p-7' : 'p-4';
  const titleSizeClass = isLarge ? 'text-sm' : 'text-xs';
  const valueSizeClass = isLarge ? 'text-2xl font-bold' : 'text-lg font-semibold';
  const iconSizeClass = isLarge ? 'text-2xl' : 'text-lg';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 relative">
      <div className={paddingClass}>
        <div className="absolute top-2 right-2">
          <InfoTooltip content={tooltip} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className={`${titleSizeClass} text-gray-600 dark:text-gray-400`}>
              {title}
            </p>
            <p className={`${valueSizeClass} ${valueColor} mt-1`}>
              {value}
            </p>
          </div>
          <div className={`${iconSizeClass} ml-2 opacity-70`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};
