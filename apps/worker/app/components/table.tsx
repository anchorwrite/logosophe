'use client';

import { useState, useEffect, FormEvent } from "react";
import { Button, Card, Flex, Text, TextField, Table, Popover, Box, Checkbox, Theme } from "@radix-ui/themes";
import { useToast } from "./Toast";
import type { TableConfig, Field, TableRow } from '@/types/table';
import './table.css';

const styles = `
  .scrollbar-visible::-webkit-scrollbar {
    display: block;
    height: 8px;
  }
  .scrollbar-visible::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  .scrollbar-visible::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  .scrollbar-visible::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

interface ApiResponse {
  success?: boolean;
  results?: TableRow[];
  message?: string;
}

interface DeleteResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

type FilterState = Record<string, string[]>;

export function DataTable({ config, defaultTenantId }: { config: TableConfig; defaultTenantId?: string }) {
  const [mounted, setMounted] = useState(false);
  const [fetchedData, setFetchedData] = useState<TableRow[] | null>(null);
  const [fetchedPlaceholders, setPlaceholders] = useState<TableRow[] | null>(null);
  const [createFormData, setCreateFormData] = useState<Record<string, string>>(
    Object.fromEntries(config.fields.map(field => [field.name, '']))
  );
  const [updateFormData, setUpdateFormData] = useState<Record<string, string>>(
    Object.fromEntries(config.fields.map(field => [field.name, '']))
  );
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [Id, setId] = useState('');
  const [delId, setDelId] = useState('');
  const [updateId, setUpdateId] = useState('');
  const [updatePermissionId, setUpdatePermissionId] = useState('');
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    console.log('DataTable mounted');
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    setMounted(true);

    // Set initial tenant ID
    const url = new URL(window.location.href);
    const tenantId = url.searchParams.get('tenantId') || defaultTenantId || 'default';
    console.log('Initial tenantId:', tenantId);
    setCurrentTenantId(tenantId);

    // Watch for URL changes
    const handleUrlChange = () => {
      const newUrl = new URL(window.location.href);
      const newTenantId = newUrl.searchParams.get('tenantId') || defaultTenantId || 'default';
      console.log('URL changed, new tenantId:', newTenantId);
      if (newTenantId !== currentTenantId) {
        setCurrentTenantId(newTenantId);
      }
    };

    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', handleUrlChange);

    // Create a MutationObserver to watch for URL changes
    const observer = new MutationObserver(handleUrlChange);
    observer.observe(document, { subtree: true, childList: true });

    return () => {
      console.log('DataTable unmounting');
      document.head.removeChild(styleSheet);
      window.removeEventListener('popstate', handleUrlChange);
      observer.disconnect();
    };
  }, [defaultTenantId]);

  // Add effect to handle tenant changes
  useEffect(() => {
    if (currentTenantId) {
      console.log('Tenant changed to:', currentTenantId);
      // Only clear data if we're not in the middle of a data fetch
      if (!fetchedData) {
        setFetchedData(null);
      }
    }
  }, [currentTenantId]);

  // Add effect to monitor fetchedData changes
  useEffect(() => {
    if (fetchedData) {
      console.log('fetchedData changed:', fetchedData);
      console.log('Current filtered data:', getFilteredAndSortedData());
      console.log('Current paginated data:', getPaginatedData());
      // Check if we can access the fields
      console.log('Sample row field access:', fetchedData[0] ? {
        Email: fetchedData[0].Email,
        Name: fetchedData[0].Name,
        TenantName: fetchedData[0].TenantName,
        AssignedAt: fetchedData[0].AssignedAt
      } : 'No data');
    }
  }, [fetchedData]);

  if (!mounted) {
    return null; // or a loading spinner
  }

  const refreshData = async () => {
    try {
      const requestBody = {
        op: 'select',
        Id: '*',
        ...(currentTenantId ? { tenantId: currentTenantId } : {})
      };
      console.log('Sending refresh request:', requestBody);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json() as ApiResponse;
      console.log('Received refresh response:', data);

      if (data && data.success && Array.isArray(data.results)) {
        console.log('Setting fetched data from refresh:', data.results);
        setFetchedData(data.results);
        setFilters({});
        setSortField(null);
        setSortDirection('asc');
        setCurrentPage(1);
        // Force a re-render
        setTimeout(() => {
          console.log('Current fetchedData after refresh:', fetchedData);
        }, 0);
      } else {
        console.log('No results found or invalid response in refresh');
        showToast({
          title: 'Warning',
          content: 'Failed to refresh data',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('Error in refreshData:', error);
      showToast({
        title: 'Error',
        content: 'Failed to refresh data',
        type: 'error'
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getUniqueValues = (field: Field): string[] => {
    if (!fetchedData) return [];
    return Array.from(new Set(fetchedData.map(row => String(row[field.name] || ''))));
  };

  const handleFilterChange = (fieldName: string, value: string) => {
    setFilters(prev => {
      const currentValues = prev[fieldName] || [];
      if (currentValues.some(v => v === value)) {
        return {
          ...prev,
          [fieldName]: currentValues.filter(v => v !== value)
        };
      } else {
        return {
          ...prev,
          [fieldName]: [...currentValues, value]
        };
      }
    });
  };

  const isFiltered = (row: TableRow): boolean => {
    console.log('isFiltered - checking row:', row);
    console.log('isFiltered - current filters:', filters);
    const result = Object.entries(filters).every(([fieldName, values]) => {
      if (values.length === 0) return true;
      const rowValue = String(row[fieldName] || '');
      const matches = values.some(value => rowValue === value);
      console.log(`isFiltered - field ${fieldName}: rowValue=${rowValue}, values=${values}, matches=${matches}`);
      return matches;
    });
    console.log('isFiltered - result:', result);
    return result;
  };

  const getFilteredAndSortedData = () => {
    if (!fetchedData) return [];
    console.log('getFilteredAndSortedData - fetchedData:', fetchedData);
    console.log('getFilteredAndSortedData - config fields:', config.fields);
    let filteredData = fetchedData.filter(isFiltered);
    console.log('getFilteredAndSortedData - after filtering:', filteredData);
    if (sortField) {
      filteredData = [...filteredData].sort((a, b) => {
        const aValue = String(a[sortField] || '');
        const bValue = String(b[sortField] || '');
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      });
      console.log('getFilteredAndSortedData - after sorting:', filteredData);
    }
    return filteredData;
  };

  const getPaginatedData = () => {
    const filteredData = getFilteredAndSortedData();
    console.log('getPaginatedData - filteredData:', filteredData);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
    console.log('getPaginatedData - paginatedData:', paginatedData);
    return paginatedData;
  };

  const totalPages = Math.ceil((getFilteredAndSortedData().length || 0) / itemsPerPage);
  console.log('Total pages:', totalPages, 'Current page:', currentPage, 'Items per page:', itemsPerPage);

  const handleCreateInputChange = (fieldName: string, value: string) => {
    setCreateFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleUpdateInputChange = (fieldName: string, value: string) => {
    setUpdateFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const selectHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    
    // Remove Email field if it's '*'
    if (input.Email === '*') {
      delete input.Email;
    }
    
    try {
      const requestBody = { 
        op: 'select',
        ...input,
        ...(currentTenantId ? { tenantId: currentTenantId } : {})
      };
      console.log('Sending select request:', requestBody);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json() as ApiResponse;
      console.log('Received response:', data);

      if (data && data.success && Array.isArray(data.results)) {
        console.log('Setting fetched data:', data.results);
        setFetchedData(data.results);
        // Reset filters and sorting
        setFilters({});
        setSortField(null);
        setSortDirection('asc');
        setCurrentPage(1);
      } else {
        console.log('No results found or invalid response');
        showToast({
          title: 'Warning',
          content: 'Record not found',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('Error in selectHandleSubmit:', error);
      showToast({
        title: 'Error',
        content: 'An error occurred',
        type: 'error'
      });
    }
  };

  const insertHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'insert',
          ...createFormData
        }),
      });
      const message = await response.json();
      showToast({
        title: 'Success',
        content: message as string,
        type: 'success'
      });
      // Reset create form
      setCreateFormData(Object.fromEntries(config.fields.map(field => [field.name, ''])));
    } catch (error) {
      showToast({
        title: 'Error',
        content: 'An error occurred',
        type: 'error'
      });
      console.error(error);
    }
  };

  const populateHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = {
      op: 'populate',
      updateId: updateId,
      ...(config.compositeKey && updatePermissionId ? { PermissionId: updatePermissionId } : {}),
      ...Object.fromEntries(formData)
    };
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const data: ApiResponse = await response.json();
      if (data.results && data.results.length > 0) {
        setPlaceholders(data.results);
        const newFormData: Record<string, string> = {};
        config.fields.forEach(field => {
          newFormData[field.name] = String(data.results![0][field.name] || '');
        });
        setUpdateFormData(newFormData);
      } else {
        showToast({
          title: 'Warning',
          content: 'Record not found',
          type: 'warning'
        });
      }
    } catch (error) {
      showToast({
        title: 'Error',
        content: 'An error occurred',
        type: 'error'
      });
      console.error(error);
    }
  };

  const updateHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = {
      op: 'update',
      updateId: updateId,
      ...Object.fromEntries(formData)
    };
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const data: { message?: string; error?: string } = await response.json();
      if (response.ok) {
        showToast({
          title: 'Success',
          content: data.message || 'Record updated successfully',
          type: 'success'
        });
        setUpdateFormData(Object.fromEntries(config.fields.map(field => [field.name, ''])));
        setPlaceholders(null);
        setUpdateId('');
      } else {
        showToast({
          title: 'Error',
          content: data.error || 'Failed to update record',
          type: 'error'
        });
      }
    } catch (error) {
      showToast({
        title: 'Error',
        content: 'An error occurred while updating the record',
        type: 'error'
      });
      console.error(error);
    }
  };

  const deleteHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const data = await response.json() as DeleteResponse | string;
      
      if (typeof data === 'string') {
        if (data.includes('not found')) {
          showToast({
            title: 'Warning',
            content: 'Record not found',
            type: 'warning'
          });
        } else {
          showToast({
            title: 'Success',
            content: data,
            type: 'success'
          });
          setDelId('');
        }
      } else if (data.error) {
        showToast({
          title: 'Warning',
          content: 'Record not found',
          type: 'warning'
        });
      } else if (data.message) {
        showToast({
          title: 'Success',
          content: data.message,
          type: 'success'
        });
        setDelId('');
      } else {
        showToast({
          title: 'Success',
          content: 'Record deleted successfully',
          type: 'success'
        });
        setDelId('');
      }
    } catch (error) {
      showToast({
        title: 'Error',
        content: 'An error occurred',
        type: 'error'
      });
      console.error(error);
    }
  };

  const handlePrint = () => {
    if (!fetchedData) return;

    // Get the filtered and sorted data
    const dataToPrint = getFilteredAndSortedData();

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Create the print content
    const content = `
      <html>
        <head>
          <title>${config.name} - Print View</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            @media print {
              body { margin: 0; padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${config.name}</h1>
          <p>Printed on: ${new Date().toLocaleString()}</p>
          ${Object.entries(filters).some(([_, value]) => value) ? 
            `<p>Filters: ${Object.entries(filters)
              .filter(([_, value]) => value)
              .map(([field, value]) => `${field}: ${value}`)
              .join(', ')}</p>` : ''}
          ${sortField ? 
            `<p>Sorted by: ${sortField} (${sortDirection})</p>` : ''}
          <div class="no-print">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()">Close</button>
          </div>
          <table>
            <thead>
              <tr>
                ${config.fields.map(field => `<th>${field.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${dataToPrint.map(row => `
                <tr>
                  ${config.fields.map((field) => (
                    <td key={field.name} style={{ whiteSpace: 'nowrap' }}>
                      {field.type === 'date' && row[field.name] 
                        ? new Date(row[field.name]).toLocaleDateString()
                        : field.type === 'datetime' && row[field.name]
                        ? new Date(row[field.name]).toLocaleString()
                        : row[field.name]}
                    </td>
                  ))}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleCSVExport = () => {
    if (!fetchedData) return;

    // Get the filtered and sorted data
    const dataToExport = getFilteredAndSortedData();

    // Create CSV content
    const headers = config.fields.map(field => field.label).join(',');
    const rows = dataToExport.map(row => 
      config.fields.map(field => {
        const value = row[field.name];
        // Wrap in quotes and escape any existing quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${config.name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Theme>
      <div className="mx-4 max-w-full">
        <main className="flex flex-col gap-8 row-start-2 items-start">
          {/* List Records Form */}
          <Card size="2" variant="surface" className="w-full">
            <Flex direction="column" gap="4" p="4" align="center">
              <Text as="div" size="4" weight="bold">List Records</Text>
              <form onSubmit={selectHandleSubmit} className="space-y-4 w-full">
                <Flex gap="2" justify="center">
                  <TextField.Root>
                    <TextField.Slot>
                      <input
                        type={config.fields[0].type}
                        name={config.fields[0].name}
                        placeholder={`Enter ${config.fields[0].label.toLowerCase()} (* for all)`}
                        value={Id}
                        onChange={(e) => setId(e.target.value)}
                        required
                      />
                    </TextField.Slot>
                  </TextField.Root>
                  <input type="hidden" name="op" value="select" />
                  <Button type="submit" variant="outline">List</Button>
                  {fetchedData && fetchedData.length > 0 && (
                    <>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={refreshData}
                      >
                        Refresh
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handlePrint}
                      >
                        Print
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCSVExport}
                      >
                        Export CSV
                      </Button>
                    </>
                  )}
                </Flex>
                {fetchedData && (
                  <Text as="div" size="2" align="center" color="gray">
                    {fetchedData.length} record{fetchedData.length !== 1 ? 's' : ''} found
                  </Text>
                )}
              </form>

              {/* Results Table */}
              {fetchedData && fetchedData.length > 0 && (
                <div className="w-full overflow-x-scroll scrollbar-visible" style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'auto',
                  msOverflowStyle: 'auto'
                }}>
                  <div style={{ minWidth: 'max-content', paddingBottom: '8px' }}>
                    {(() => {
                      console.log('Rendering table with data:', getPaginatedData());
                      return null;
                    })()}
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          {config.fields.map((field) => (
                            <Table.ColumnHeaderCell 
                              key={field.name}
                              onClick={() => handleSort(field.name)}
                              style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '150px' }}
                            >
                              <Flex gap="2" align="center">
                                {field.label}
                                {sortField === field.name && (
                                  <Text size="1">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </Text>
                                )}
                              </Flex>
                            </Table.ColumnHeaderCell>
                          ))}
                        </Table.Row>
                        <Table.Row>
                          {config.fields.map((field) => (
                            <Table.Cell key={field.name} style={{ whiteSpace: 'nowrap' }}>
                              <Popover.Root open={openFilter === field.name} onOpenChange={(open) => setOpenFilter(open ? field.name : null)}>
                                <Popover.Trigger>
                                  <Button variant="soft" style={{ minWidth: '150px' }}>
                                    Filter {field.label}...
                                  </Button>
                                </Popover.Trigger>
                                <Popover.Content style={{ width: '300px' }}>
                                  <Box style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
                                    <Flex align="center" gap="2" style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                                      <input
                                        type="text"
                                        placeholder={`Enter ${field.label} pattern (use * for wildcard)`}
                                        className="flex-1 px-2 py-1 text-sm border rounded"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const input = e.target as HTMLInputElement;
                                            const value = input.value.trim();
                                            if (value) {
                                              handleFilterChange(field.name, value);
                                              input.value = '';
                                            }
                                          }
                                        }}
                                      />
                                    </Flex>
                                    {getUniqueValues(field).map((value) => (
                                      <Flex key={value} align="center" gap="2">
                                        <Checkbox
                                          checked={((filters[field.name] as string[]) || []).includes(value)}
                                          onCheckedChange={() => handleFilterChange(field.name, value)}
                                        />
                                        <Text size="2">{value}</Text>
                                      </Flex>
                                    ))}
                                  </Box>
                                </Popover.Content>
                              </Popover.Root>
                            </Table.Cell>
                          ))}
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {(() => {
                          const data = getPaginatedData();
                          return null;
                        })()}
                        {getPaginatedData().map((row, index) => {
                          return (
                            <Table.Row key={index}>
                              {config.fields.map((field) => {
                                try {
                                  const value = field.type === 'date' && row[field.name] 
                                    ? new Date(row[field.name]).toLocaleDateString()
                                    : field.type === 'datetime' && row[field.name]
                                    ? new Date(row[field.name]).toLocaleString()
                                    : row[field.name];
                                  return (
                                    <Table.Cell key={field.name} style={{ whiteSpace: 'nowrap' }}>
                                      {value}
                                    </Table.Cell>
                                  );
                                } catch (error) {
                                  console.error(`Error rendering cell ${field.name}:`, error);
                                  return (
                                    <Table.Cell key={field.name} style={{ whiteSpace: 'nowrap' }}>
                                      Error
                                    </Table.Cell>
                                  );
                                }
                              })}
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Root>

                    {/* Pagination Controls */}
                    <Flex justify="start" align="center" mt="4" gap="4">
                      <Flex gap="2" align="center">
                        <Text size="2">Rows per page:</Text>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => setItemsPerPage(Number(e.target.value))}
                          className="border rounded px-2 py-1"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                      </Flex>
                      <Flex gap="2" align="center">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Text size="2">
                          Page {currentPage} of {totalPages}
                        </Text>
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </Flex>
                    </Flex>
                  </div>
                </div>
              )}
            </Flex>
          </Card>

          {/* Create Record Form */}
          <Card size="2" variant="surface" className="w-full">
            <Flex direction="column" gap="4" p="4" align="center">
              <Text as="div" size="4" weight="bold">Create Record</Text>
              <form onSubmit={insertHandleSubmit} className="space-y-4 w-full">
                <div className="w-full overflow-x-auto">
                  <Table.Root>
                    <Table.Body>
                      {config.fields.map((field) => (
                        <Table.Row key={field.name}>
                          <Table.Cell>
                            <Text as="div" size="2" weight="medium">
                              {field.label}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <TextField.Root>
                              <TextField.Slot>
                                <input
                                  type={field.type}
                                  name={field.name}
                                  placeholder={`Enter ${field.label.toLowerCase()}`}
                                  value={createFormData[field.name]}
                                  onChange={(e) =>
                                    handleCreateInputChange(field.name, e.target.value)
                                  }
                                  required={field.required}
                                  readOnly={field.readOnly}
                                  className="w-full"
                                />
                              </TextField.Slot>
                            </TextField.Root>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </div>
                <Flex justify="center" mt="4">
                  <Button type="submit" variant="outline">Create</Button>
                </Flex>
              </form>
            </Flex>
          </Card>

          {/* Update Record Form */}
          <Card size="2" variant="surface" className="w-full">
            <Flex direction="column" gap="4" p="4" align="center">
              <Text as="div" size="4" weight="bold">Update Record</Text>
              <div className="space-y-4 w-full">
                <form onSubmit={populateHandleSubmit} className="space-y-4">
                  <Flex gap="2" justify="center">
                    <TextField.Root>
                      <TextField.Slot>
                        <input
                          type="text"
                          name="updateId"
                          placeholder={`Enter ${config.fields[0].label} to update`}
                          value={updateId}
                          onChange={(e) => setUpdateId(e.target.value)}
                          required
                          className="w-full"
                        />
                      </TextField.Slot>
                    </TextField.Root>
                    {config.compositeKey && (
                      <TextField.Root>
                        <TextField.Slot>
                          <input
                            type="text"
                            name="updatePermissionId"
                            placeholder={`Enter ${config.fields[1].label} to update`}
                            value={updatePermissionId}
                            onChange={(e) => setUpdatePermissionId(e.target.value)}
                            required
                            className="w-full"
                          />
                        </TextField.Slot>
                      </TextField.Root>
                    )}
                    <Button type="submit" variant="outline">Search</Button>
                  </Flex>
                </form>

                {fetchedPlaceholders && (
                  <form onSubmit={updateHandleSubmit} className="space-y-4">
                    <div className="w-full overflow-x-auto">
                      <Table.Root>
                        <Table.Body>
                          {config.fields.map((field) => (
                            <Table.Row key={field.name}>
                              <Table.Cell>
                                <Text as="div" size="2" weight="medium">
                                  {field.label}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <TextField.Root>
                                  <TextField.Slot>
                                    <input
                                      type={field.type}
                                      name={field.name}
                                      placeholder={`Enter ${field.label.toLowerCase()}`}
                                      value={updateFormData[field.name]}
                                      onChange={(e) => handleUpdateInputChange(field.name, e.target.value)}
                                      required={field.required}
                                      readOnly={field.readOnly}
                                      className="w-full"
                                    />
                                  </TextField.Slot>
                                </TextField.Root>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </div>
                    <Flex justify="center" mt="4">
                      <Button type="submit" variant="outline">Update</Button>
                    </Flex>
                  </form>
                )}
              </div>
            </Flex>
          </Card>

          {/* Delete Record Form */}
          <Card size="2" variant="surface" className="w-full">
            <Flex direction="column" gap="4" p="4" align="center">
              <Text as="div" size="4" weight="bold">Delete Record</Text>
              <form onSubmit={deleteHandleSubmit} className="space-y-4 w-full">
                <Flex gap="2" justify="center">
                  <TextField.Root>
                    <TextField.Slot>
                      <input
                        type={config.fields[0].type}
                        name={config.fields[0].name}
                        placeholder={`Enter ${config.fields[0].label.toLowerCase()} to delete`}
                        value={delId}
                        onChange={(e) => setDelId(e.target.value)}
                        required
                        className="w-full"
                      />
                    </TextField.Slot>
                  </TextField.Root>
                  <input type="hidden" name="delId" value={delId} />
                  <input type="hidden" name="op" value="delete" />
                  <Button type="submit" variant="outline">Delete</Button>
                </Flex>
              </form>
            </Flex>
          </Card>
        </main>
      </div>
    </Theme>
  );
}