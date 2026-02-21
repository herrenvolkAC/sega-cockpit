import React, { useState } from 'react';

interface ExpandableGridProps {
  data: any[];
  columns: {
    key: string;
    label: string;
    render?: (value: any, row: any) => React.ReactNode;
  }[];
  detailColumns?: {
    key: string;
    label: string;
    render?: (value: any, row: any) => React.ReactNode;
  }[];
  getDetailData?: (row: any) => Promise<any[]> | any[];
  detailKey?: string;
  className?: string;
}

export default function ExpandableGrid({
  data,
  columns,
  detailColumns,
  getDetailData,
  detailKey = 'id',
  className = '',
}: ExpandableGridProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [detailData, setDetailData] = useState<Record<string | number, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string | number>>(new Set());

  const toggleRow = async (rowKey: string | number, row: any) => {
    const newExpanded = new Set(expandedRows);
    const newLoading = new Set(loadingDetails);

    if (expandedRows.has(rowKey)) {
      // Collapse row
      newExpanded.delete(rowKey);
      setExpandedRows(newExpanded);
    } else {
      // Expand row
      newExpanded.add(rowKey);
      setExpandedRows(newExpanded);
      
      // Load detail data if not already loaded
      if (!detailData[rowKey] && getDetailData) {
        newLoading.add(rowKey);
        setLoadingDetails(newLoading);
        
        try {
          const details = await getDetailData(row);
          setDetailData(prev => ({
            ...prev,
            [rowKey]: details
          }));
        } catch (error) {
          console.error('Error loading detail data:', error);
        } finally {
          setLoadingDetails(prev => {
            const updated = new Set(prev);
            updated.delete(rowKey);
            return updated;
          });
        }
      }
    }
    
    setExpandedRows(newExpanded);
  };

  const renderCell = (column: any, row: any) => {
    const value = row[column.key];
    if (column.render) {
      return column.render(value, row);
    }
    return value;
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-8">
              {/* Expand/Collapse column */}
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((row, index) => {
            const rowKey = row[detailKey] || index;
            const isExpanded = expandedRows.has(rowKey);
            const isLoading = loadingDetails.has(rowKey);
            const details = detailData[rowKey];

            return (
              <React.Fragment key={rowKey}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => toggleRow(rowKey, row)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      ) : isExpanded ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {renderCell(column, row)}
                    </td>
                  ))}
                </tr>
                
                {/* Detail row */}
                {isExpanded && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                      {details && detailColumns && (
                        <div className="ml-8">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Detalles
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  {detailColumns.map((column) => (
                                    <th
                                      key={column.key}
                                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                                    >
                                      {column.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-600">
                                {details.map((detailRow, detailIndex) => (
                                  <tr key={detailIndex} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                                    {detailColumns.map((column) => (
                                      <td key={column.key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        {column.render ? column.render(detailRow[column.key], detailRow) : detailRow[column.key]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {isLoading && (
                        <div className="ml-8 flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Cargando detalles...</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
