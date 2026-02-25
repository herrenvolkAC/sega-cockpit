import React from 'react';

interface ChartReferenceLabelProps {
  value: number;
  label: string;
  unit?: string;
  lineColor?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const ChartReferenceLabel: React.FC<ChartReferenceLabelProps> = ({
  value,
  label,
  unit = '',
  lineColor = '#6b7280',
  lineStyle = 'dashed',
  position = 'top-right'
}) => {
  const positionClasses = {
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6'
  };

  const getLineStyle = () => {
    switch (lineStyle) {
      case 'solid':
        return 'border-t-2 border-solid';
      case 'dotted':
        return 'border-t-2 border-dotted';
      case 'dashed':
      default:
        return 'border-t-2 border-dashed';
    }
  };

  return (
    <div className={`absolute ${positionClasses[position]} bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm z-10`}>
      <div className="flex items-center gap-2">
        <div 
          className={`w-8 h-0 ${getLineStyle()}`}
          style={{ borderColor: lineColor }}
        ></div>
        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-400">{label}: </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {value.toFixed(1)}{unit && ` ${unit}`}
          </span>
        </div>
      </div>
    </div>
  );
};
