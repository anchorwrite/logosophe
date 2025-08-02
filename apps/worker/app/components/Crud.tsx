'use client';

import { useState, useEffect, FormEvent } from "react";
import { Button, Card, Flex, Text, TextField, Table, Popover, Box, Checkbox, Theme, Select } from "@radix-ui/themes";
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
  error?: string;
}

interface DeleteResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

type FilterState = Record<string, string[]>;

export function Crud({ config }: { config: TableConfig }) {
  const [mounted, setMounted] = useState(false);
  const [fetchedData, setFetchedData] = useState<TableRow[] | null>(null);
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
  const { showToast } = useToast();

  useEffect(() => {
    console.log('Crud mounted');
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    setMounted(true);
    return () => {
      console.log('Crud unmounting');
      document.head.removeChild(styleSheet);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  const refreshData = async () => {
    try {
      const requestBody = {
        op: 'select',
        Id: '*'
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
    return Object.entries(filters).every(([fieldName, values]) => {
      if (values.length === 0) return true;
      const rowValue = String(row[fieldName] || '');
      return values.some(value => rowValue === value);
    });
  };

  const getFilteredAndSortedData = () => {
    if (!fetchedData) return [];
    let filteredData = fetchedData.filter(isFiltered);
    if (sortField) {
      filteredData = [...filteredData].sort((a, b) => {
        const aValue = String(a[sortField] || '');
        const bValue = String(b[sortField] || '');
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      });
    }
    return filteredData;
  };

  const getPaginatedData = () => {
    const filteredData = getFilteredAndSortedData();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  };

  const handleCreateInputChange = (fieldName: string, value: string) => {
    setCreateFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleUpdateInputChange = (fieldName: string, value: string) => {
    setUpdateFormData(prev => ({ ...prev, [fieldName]: value }));
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
      const data = await response.json() as ApiResponse;
      if (data.success) {
        showToast({
          title: 'Success',
          content: 'Record created successfully',
          type: 'success'
        });
        setCreateFormData(Object.fromEntries(config.fields.map(field => [field.name, ''])));
        refreshData();
      } else {
        showToast({
          title: 'Error',
          content: data.error || 'Failed to create record',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error in insertHandleSubmit:', error);
      showToast({
        title: 'Error',
        content: 'Failed to create record',
        type: 'error'
      });
    }
  };

  const updateHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'update',
          updateId,
          ...updateFormData
        }),
      });
      const data = await response.json() as ApiResponse;
      if (data.success) {
        showToast({
          title: 'Success',
          content: 'Record updated successfully',
          type: 'success'
        });
        setUpdateFormData(Object.fromEntries(config.fields.map(field => [field.name, ''])));
        setUpdateId('');
        refreshData();
      } else {
        showToast({
          title: 'Error',
          content: data.error || 'Failed to update record',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error in updateHandleSubmit:', error);
      showToast({
        title: 'Error',
        content: 'Failed to update record',
        type: 'error'
      });
    }
  };

  const handleDeleteClick = async () => {
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          op: 'delete',
          delId
        }),
      });
      const data = await response.json() as DeleteResponse;
      if (data.success) {
        showToast({
          title: 'Success',
          content: 'Record deleted successfully',
          type: 'success'
        });
        setDelId('');
        refreshData();
      } else {
        showToast({
          title: 'Error',
          content: data.error || 'Failed to delete record',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error in handleDeleteClick:', error);
      showToast({
        title: 'Error',
        content: 'Failed to delete record',
        type: 'error'
      });
    }
  };

  return (
    <Theme>
      <div className="mx-4 max-w-full">
        <main className="flex flex-col gap-8 row-start-2 items-start">
          {/* List Records Form */}
          <Card size="2" variant="surface" className="w-full">
            <Flex direction="column" gap="4" p="4" align="center">
              <Text as="div" size="4" weight="bold">List Records</Text>
              <form onSubmit={refreshData} className="space-y-4 w-full">
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
                <Box className="w-full overflow-x-auto" style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'auto',
                  msOverflowStyle: 'auto',
                  maxHeight: 'calc(100vh - 400px)',
                  overflowY: 'auto'
                }}>
                  <Box style={{ minWidth: 'max-content', paddingBottom: '8px' }}>
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          {config.fields.map((field) => (
                            <Table.ColumnHeaderCell 
                              key={field.name}
                              onClick={() => handleSort(field.name)}
                              style={{ 
                                cursor: 'pointer', 
                                whiteSpace: 'nowrap', 
                                minWidth: '150px',
                                position: 'sticky',
                                top: 0,
                                backgroundColor: 'var(--gray-1)',
                                zIndex: 1
                              }}
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
                          <Table.ColumnHeaderCell 
                            style={{ 
                              minWidth: '100px',
                              position: 'sticky',
                              top: 0,
                              backgroundColor: 'var(--gray-1)',
                              zIndex: 1
                            }}
                          >
                            Actions
                          </Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {getPaginatedData().map((row, index) => (
                          <Table.Row key={index}>
                            {config.fields.map((field) => {
                              const value = field.type === 'date' && row[field.name] 
                                ? new Date(row[field.name]).toLocaleDateString()
                                : field.type === 'datetime' && row[field.name]
                                ? new Date(row[field.name]).toLocaleString()
                                : row[field.name];
                              return (
                                <Table.Cell 
                                  key={field.name} 
                                  style={{ 
                                    whiteSpace: 'nowrap',
                                    minWidth: '150px'
                                  }}
                                >
                                  {value}
                                </Table.Cell>
                              );
                            })}
                            <Table.Cell style={{ minWidth: '100px' }}>
                              <Flex gap="2">
                                <Button
                                  size="1"
                                  onClick={() => {
                                    setUpdateId(row.Id);
                                    setUpdateFormData(row);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="1"
                                  color="red"
                                  onClick={() => setDelId(row.Id)}
                                >
                                  Delete
                                </Button>
                              </Flex>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Box>
              )}

              {/* Pagination */}
              {fetchedData && fetchedData.length > 0 && (
                <Flex gap="2" justify="center" align="center" mt="4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Text size="2">
                    Page {currentPage} of {Math.ceil(getFilteredAndSortedData().length / itemsPerPage)}
                  </Text>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(getFilteredAndSortedData().length / itemsPerPage), prev + 1))}
                    disabled={currentPage === Math.ceil(getFilteredAndSortedData().length / itemsPerPage)}
                  >
                    Next
                  </Button>
                  <Select.Root
                    value={String(itemsPerPage)}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="10">10 per page</Select.Item>
                      <Select.Item value="25">25 per page</Select.Item>
                      <Select.Item value="50">50 per page</Select.Item>
                      <Select.Item value="100">100 per page</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
              )}
            </Flex>
          </Card>

          {/* Create Form */}
          <Card size="2" variant="surface" className="w-full">
            <Flex direction="column" gap="4" p="4">
              <Text as="div" size="4" weight="bold">Create New Record</Text>
              <form onSubmit={insertHandleSubmit}>
                <Flex direction="column" gap="2">
                  <Flex gap="2" wrap="wrap">
                    {config.fields.map(field => (
                      <TextField.Root key={field.name}>
                        <TextField.Input
                          placeholder={field.label}
                          value={createFormData[field.name]}
                          onChange={e => handleCreateInputChange(field.name, e.target.value)}
                          required={field.required}
                        />
                      </TextField.Root>
                    ))}
                  </Flex>
                  <Button type="submit">Create</Button>
                </Flex>
              </form>
            </Flex>
          </Card>

          {/* Update Form */}
          {updateId && (
            <Card size="2" variant="surface" className="w-full">
              <Flex direction="column" gap="4" p="4">
                <Text as="div" size="4" weight="bold">Update Record</Text>
                <form onSubmit={updateHandleSubmit}>
                  <Flex direction="column" gap="2">
                    <Flex gap="2" wrap="wrap">
                      {config.fields.map(field => (
                        <TextField.Root key={field.name}>
                          <TextField.Input
                            placeholder={field.label}
                            value={updateFormData[field.name]}
                            onChange={e => handleUpdateInputChange(field.name, e.target.value)}
                            required={field.required}
                          />
                        </TextField.Root>
                      ))}
                    </Flex>
                    <Flex gap="2">
                      <Button type="submit">Update</Button>
                      <Button
                        color="gray"
                        onClick={() => {
                          setUpdateId('');
                          setUpdateFormData(Object.fromEntries(config.fields.map(field => [field.name, ''])));
                        }}
                      >
                        Cancel
                      </Button>
                    </Flex>
                  </Flex>
                </form>
              </Flex>
            </Card>
          )}

          {/* Delete Confirmation */}
          {delId && (
            <Card size="2" variant="surface" className="w-full">
              <Flex direction="column" gap="4" p="4">
                <Text as="div" size="4" weight="bold">Confirm Delete</Text>
                <Text>Are you sure you want to delete this record?</Text>
                <Flex gap="2">
                  <Button color="red" onClick={handleDeleteClick}>Delete</Button>
                  <Button color="gray" onClick={() => setDelId('')}>Cancel</Button>
                </Flex>
              </Flex>
            </Card>
          )}
        </main>
      </div>
    </Theme>
  );
} 