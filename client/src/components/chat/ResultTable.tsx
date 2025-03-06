import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ResultTableProps {
  data: {
    summary?: string;
    data?: {
      table_name?: string;
      companies?: any[];
      [key: string]: any;
    };
  };
}

const formatValue = (value: any, column: string): string => {
  if (!value) return '-';
  
  // Clean up the value if it's a string
  if (typeof value === 'string') {
    // Try to parse JSON strings
    try {
      const parsed = JSON.parse(value);
      value = parsed;
    } catch {
      // If it's not JSON, use the string as is
      return value;
    }
  }

  // Format based on column type
  if (column.includes('amount')) {
    // Format currency values
    return typeof value === 'string' ? value : `$${value}M`;
  } else if (column.includes('year')) {
    // Format years
    return String(value);
  } else if (Array.isArray(value)) {
    // Format arrays (like investors)
    return value.join(', ');
  } else if (typeof value === 'object' && value !== null) {
    // Format objects
    return Object.values(value).join(', ');
  }
  
  return String(value);
};

const parseCompanyData = (rawData: any[]): any[] => {
  return rawData.map(item => {
    if (typeof item === 'string') {
      try {
        // Try to parse if it's a stringified JSON
        return JSON.parse(item);
      } catch {
        return { value: item };
      }
    }
    return item;
  });
};

const ResultTable: React.FC<ResultTableProps> = ({ data }) => {
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState<boolean>(false);

  if (!data?.data?.companies || !Array.isArray(data.data.companies)) {
    return null;
  }

  const companies = data.data.companies.map(company => {
    const formatted: Record<string, string> = {};
    Object.entries(company).forEach(([key, value]) => {
      // Format the column name for display
      const displayKey = key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      formatted[displayKey] = formatValue(value, key);
    });
    return formatted;
  });

  const allColumns = companies.length > 0 
    ? Object.keys(companies[0]).filter(key => !hiddenColumns.has(key))
    : [];

  const toggleColumn = (column: string) => {
    const newHiddenColumns = new Set(hiddenColumns);
    if (hiddenColumns.has(column)) {
      newHiddenColumns.delete(column);
    } else {
      newHiddenColumns.add(column);
    }
    setHiddenColumns(newHiddenColumns);
  };

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{data.data.table_name || 'Results'}</h3>
        </div>
        
        {/* Column Management Bar */}
        <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Visible Columns:</span>
          {allColumns.map(column => (
            <div 
              key={column} 
              className="flex items-center bg-white px-2 py-1 rounded border shadow-sm"
            >
              <span className="text-sm text-gray-600">{column}</span>
              <button
                onClick={() => toggleColumn(column)}
                className="ml-2 text-gray-400 hover:text-red-500 focus:outline-none"
                title="Remove column"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          
          {/* Hidden Columns Dropdown */}
          {hiddenColumns.size > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="px-3 py-1 text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
              >
                + Add Columns ({hiddenColumns.size})
              </button>
              {showColumnMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white shadow-lg rounded-lg p-2 z-50 border">
                  <div className="text-sm font-medium mb-2 pb-2 border-b">Hidden Columns</div>
                  {Array.from(hiddenColumns).map(column => (
                    <div key={column} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                      <span className="text-sm">{column}</span>
                      <button
                        onClick={() => toggleColumn(column)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              {allColumns.map(column => (
                <th
                  key={column}
                  scope="col"
                  className="px-6 py-3"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((company, index) => (
              <tr
                key={index}
                className="bg-white border-b hover:bg-gray-50"
              >
                {allColumns.map(column => (
                  <td key={column} className="px-6 py-4 whitespace-normal break-words text-gray-700">
                    {company[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultTable;
