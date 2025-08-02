"use client";

import { useState, useEffect } from "react";
import { Button } from "@radix-ui/themes";
import { useToast } from "@/components/Toast";

interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface Config {
  name: string;
  endpoint: string;
  fields: Field[];
}

interface DataTableProps {
  config: Config;
}

export function DataTable({ config }: DataTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(config.endpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      const result = await response.json();
      setData(Array.isArray(result) ? result : [result]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      showToast({
        title: 'Error',
        content: 'Failed to fetch data',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [config.endpoint]);

  const handleDelete = async () => {
    try {
      await Promise.all(selectedRows.map(id => fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          op: "delete",
          email: data.find(item => item.id === id)?.Email,
        }),
      }).then(response => {
        if (!response.ok) {
          throw new Error("Failed to delete");
        }
      })));
      showToast({
        title: 'Success',
        content: 'Selected items deleted successfully',
        type: 'success'
      });
      setSelectedRows([]);
      fetchData();
    } catch (error) {
      showToast({
        title: 'Error',
        content: 'Failed to delete items',
        type: 'error'
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="w-full overflow-x-auto">
      {selectedRows.length > 0 && (
        <div className="mb-4">
          <Button onClick={handleDelete} color="red">
            Delete Selected ({selectedRows.length})
          </Button>
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={selectedRows.length === data.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRows(data.map(row => row.id));
                  } else {
                    setSelectedRows([]);
                  }
                }}
              />
            </th>
            {config.fields.map((field) => (
              <th
                key={field.name}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {field.label}
              </th>
            ))}
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr key={item.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedRows.includes(item.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRows([...selectedRows, item.id]);
                    } else {
                      setSelectedRows(selectedRows.filter(id => id !== item.id));
                    }
                  }}
                />
              </td>
              {config.fields.map((field) => (
                <td key={field.name} className="px-6 py-4 whitespace-nowrap">
                  {item[field.name]?.toString() || ""}
                </td>
              ))}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const response = await fetch(config.endpoint, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          op: "delete",
                          email: item.Email,
                        }),
                      });
                      if (!response.ok) {
                        throw new Error("Failed to delete");
                      }
                      showToast({
                        title: 'Success',
                        content: 'Record deleted successfully',
                        type: 'success'
                      });
                      fetchData();
                    } catch (err) {
                      showToast({
                        title: 'Error',
                        content: 'Failed to delete record',
                        type: 'error'
                      });
                    }
                  }}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 