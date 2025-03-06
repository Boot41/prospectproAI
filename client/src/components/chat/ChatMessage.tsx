import React, { useState } from "react";
import { Bot, User, Filter, ChevronDown } from "lucide-react";

interface StructuredData {
  summary: string;
  key_insights: string[];
  data: Record<string, any>;
}

interface ChatMessageProps {
  message: {
    content: string;
    sender: "ai" | "user";
    structuredData?: StructuredData;
  };
  onFilterApply: (query: string) => Promise<void>;
}

const DataTable: React.FC<{ data: any[], title?: string }> = ({ data, title }) => {
  const formatHeader = (header: string) => {
    return header
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!data || data.length === 0) return null;

  // Get all possible headers from all items
  const headers = Array.from(new Set(
    data.flatMap(item => Object.keys(item))
  )).sort();

  // Ensure consistent data structure
  const formattedData = data.map(item => {
    const formattedItem: Record<string, any> = {};
    headers.forEach(header => {
      const value = item[header];
      if (typeof value === 'string') {
        // Split camelCase/PascalCase into words if it's a single string
        formattedItem[header] = value.length > 1 ? value : '';
      } else if (value === undefined || value === null) {
        formattedItem[header] = '';
      } else {
        formattedItem[header] = value;
      }
    });
    return formattedItem;
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 table-fixed">
        <colgroup>
          {headers.map((_, i) => (
            <col key={i} width={`${100 / headers.length}%`} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-gray-50">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
              >
                {formatHeader(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {formattedData.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {headers.map((header) => {
                const value = row[header];
                return (
                  <td key={header} className="px-4 py-3 text-sm text-gray-900">
                    {(() => {
                      if (typeof value === 'number') {
                        return new Intl.NumberFormat('en-US', { 
                          style: header.toLowerCase().includes('revenue') ? 'currency' : 'decimal',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(value);
                      }
                      
                      if (typeof value === 'object') {
                        return JSON.stringify(value);
                      }
                      
                      if (typeof value === 'string') {
                        if (value.length === 1) return '';
                        if (header.toLowerCase().includes('year')) {
                          return new Date(value).getFullYear();
                        }
                        return value;
                      }
                      
                      return String(value);
                    })()} 
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const countryStateData: Record<string, string[]> = {
  USA: ["California", "Texas", "New York", "Florida"],
  Canada: ["Ontario", "Quebec", "British Columbia"],
  India: ["Mumbai", "Bengaluru", "Delhi", "Pune"],
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onFilterApply }) => {
  const isAi = message.sender === "ai";

  // Filter Dropdown State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [customColumn, setCustomColumn] = useState<string>("");
  const [customColumnName, setCustomColumnName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCountryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const country = event.target.value;
    setSelectedCountry(country);
    setSelectedState(""); // Reset state when country changes
  };

  return (
    <div className={`flex w-full mb-4 ${isAi ? "justify-start" : "justify-end"}`}>
      <div className={`flex max-w-[90%] ${isAi ? "flex-row" : "flex-row-reverse"}`}>
        <div
          className={`flex items-center justify-center h-10 w-10 rounded-full ${
            isAi ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-600"
          } flex-shrink-0`}
        >
          {isAi ? <Bot size={20} /> : <User size={20} />}
        </div>

        <div className={`relative mx-3 px-4 py-3 rounded-lg ${isAi ? "bg-gray-100" : "bg-indigo-100"} overflow-hidden`}>
          {isAi && (
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-1"
              >
                <Filter size={16} />
                <ChevronDown size={16} />
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white shadow-lg rounded-lg p-3 z-10">
                  <h4 className="text-sm font-semibold mb-2">Filter Options</h4>

                  {/* Country Dropdown */}
                  <label className="text-xs font-medium text-gray-600">Select Country:</label>
                  <select
                    className="w-full border rounded p-2 mt-1 text-sm"
                    value={selectedCountry}
                    onChange={handleCountryChange}
                  >
                    <option value="">-- Select Country --</option>
                    {Object.keys(countryStateData).map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>

                  {/* State Dropdown */}
                  {selectedCountry && (
                    <>
                      <label className="text-xs font-medium text-gray-600 mt-2">Select State:</label>
                      <select
                        className="w-full border rounded p-2 mt-1 text-sm"
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                      >
                        <option value="">-- Select State --</option>
                        {countryStateData[selectedCountry].map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {/* Custom Column Input */}
                  <div className="mt-4 border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Add Custom Column (Optional)</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Column Name:</label>
                        <input
                          type="text"
                          placeholder="e.g., Revenue, Team Size"
                          className="w-full border rounded p-2 mt-1 text-sm"
                          value={customColumnName}
                          onChange={(e) => setCustomColumnName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">What to show:</label>
                        <input
                          type="text"
                          placeholder="e.g., annual revenue, number of employees"
                          className="w-full border rounded p-2 mt-1 text-sm"
                          value={customColumn}
                          onChange={(e) => setCustomColumn(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Apply Filter Button */}
                  <button
                    className={`w-full mt-4 py-2 rounded text-sm ${isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                    onClick={async () => {
                      if (!selectedCountry || !selectedState) return;
                      
                      setIsLoading(true);
                      try {
                        let filterQuery = `Show me startups in ${selectedState}, ${selectedCountry}`;
                        if (customColumnName && customColumn) {
                          // Add custom column without resetting existing data
                          filterQuery += `. Also include ${customColumn} as ${customColumnName} while preserving existing data`;
                        }
                        await onFilterApply(filterQuery);
                        setIsFilterOpen(false);
                        // Only reset location filters
                        setSelectedCountry('');
                        setSelectedState('');
                        // Don't reset custom column values to allow multiple additions
                      } catch (error) {
                        console.error('Error applying filters:', error);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading || !selectedCountry || !selectedState}
                  >
                    {isLoading ? 'Applying...' : 'Apply Filters'}
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-sm mb-2">{message.content}</p>

          {message.structuredData && (
            <div className="mt-4">
              {message.structuredData.key_insights?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Key Insights:</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {message.structuredData.key_insights.map((insight, index) => (
                      <li key={index}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {message.structuredData.data && (
                <div className="space-y-6 mt-4">
                  {Object.entries(message.structuredData.data).map(([key, value]) => {
                    if (Array.isArray(value)) {
                      // Process the data to ensure proper structure
                      const processedData = value.map(item => {
                        if (typeof item === 'string') {
                          // If it's a string, create an object with appropriate fields
                          const words = item.split(/(?=[A-Z])/); // Split on capital letters
                          if (key.toLowerCase().includes('sector')) {
                            return { sector: words.join(' ') };
                          } else if (key.toLowerCase().includes('startup')) {
                            return { name: words.join(' ') };
                          } else if (key.toLowerCase().includes('initiative')) {
                            return { initiative: words.join(' ') };
                          } else {
                            return { name: words.join(' ') };
                          }
                        }
                        return item;
                      });

                      // Filter out empty or invalid data
                      const validData = processedData.filter(item => 
                        Object.values(item).some(val => 
                          val && typeof val === 'string' && val.length > 1
                        )
                      );

                      if (validData.length === 0) return null;

                      return (
                        <div key={key} className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-700">
                              {key.split('_').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1)
                              ).join(' ')}
                            </h4>
                          </div>
                          <div className="p-4">
                            <DataTable 
                              data={validData} 
                              title={key.split('_').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1)
                              ).join(' ')} 
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
