"use client";

type InfoTooltipProps = {
  text: string;
};

export default function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="group relative inline-block">
      <div className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded-lg p-3 w-72 -top-2 left-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {text}
        <div className="absolute -right-2 top-3 w-0 h-0 border-l-8 border-l-gray-900 border-y-4 border-y-transparent"></div>
      </div>
    </div>
  );
}
