'use client';

import { useState } from 'react';
import { Button, Table, Flex, Text, Popover, Box, Checkbox } from '@radix-ui/themes';
import { useToast } from "@/components/Toast";
import { SubscriberUpdateForm } from './SubscriberUpdateForm';

interface Subscriber {
  Email: string;
  Name: string;
  Provider: string;
  Joined: string;
  LastSignin: string;
  Active: boolean;
  Left?: string;
  Banned: boolean;
  Post: boolean;
  Moderate: boolean;
  Track: boolean;
}

interface SubscriberUpdateListProps {
  subscribers: Subscriber[];
}

export function SubscriberUpdateList({ subscribers }: SubscriberUpdateListProps) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [wildcardFilters, setWildcardFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
    } catch {
      return 'N/A';
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

  const getUniqueValues = (field: string): string[] => {
    return Array.from(new Set(subscribers.map(row => String(row[field as keyof Subscriber] || ''))));
  };

  const handleFilterChange = (fieldName: string, value: string) => {
    if (value.includes('*')) {
      setWildcardFilters(prev => ({
        ...prev,
        [fieldName]: value
      }));
    } else {
      setFilters(prev => {
        const currentValues = prev[fieldName] || [];
        if (currentValues.includes(value)) {
          return {
            ...prev,
            [fieldName]: currentValues.filter(v => v !== value)
          };
        }
        return {
          ...prev,
          [fieldName]: [...currentValues, value]
        };
      });
    }
  };

  const isFiltered = (row: Subscriber): boolean => {
    // Check exact matches
    const exactMatch = Object.entries(filters).every(([fieldName, values]) => {
      if (values.length === 0) return true;
      const rowValue = String(row[fieldName as keyof Subscriber] || '').toLowerCase();
      return values.some(value => rowValue === value.toLowerCase());
    });

    // Check wildcard patterns
    const wildcardMatch = Object.entries(wildcardFilters).every(([fieldName, pattern]) => {
      if (!pattern) return true;
      const rowValue = String(row[fieldName as keyof Subscriber] || '').toLowerCase();
      // Convert wildcard pattern to regex, handling special characters
      const regexPattern = pattern
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
        .replace(/\\\*/g, '.*'); // Replace escaped * with .*
      try {
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(rowValue);
      } catch (e) {
        console.error('Invalid regex pattern:', regexPattern);
        return false;
      }
    });

    return exactMatch && wildcardMatch;
  };

  const getFilteredAndSortedData = () => {
    let filteredData = subscribers.filter(subscriber => 
      subscriber.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscriber.Name.toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(isFiltered);

    if (sortField) {
      filteredData = [...filteredData].sort((a, b) => {
        const aValue = String(a[sortField as keyof Subscriber] || '');
        const bValue = String(b[sortField as keyof Subscriber] || '');
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

  const totalPages = Math.ceil(getFilteredAndSortedData().length / itemsPerPage);

  const handleUpdate = (subscriber: Subscriber) => {
    setSelectedSubscriber(subscriber);
    setShowUpdateForm(true);
  };

  const handleUpdateComplete = () => {
    setShowUpdateForm(false);
    setSelectedSubscriber(null);
    window.location.reload();
  };

  if (showUpdateForm && selectedSubscriber) {
    return (
      <div className="space-y-4">
        <Button
          variant="soft"
          onClick={() => setShowUpdateForm(false)}
        >
          Back to List
        </Button>
        <SubscriberUpdateForm
          subscriber={selectedSubscriber}
          onUpdateComplete={handleUpdateComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <input
          type="text"
          placeholder="Search subscribers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 p-2 border rounded-md"
        />
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell 
              onClick={() => handleSort('Email')}
              style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '250px' }}
            >
              <Flex gap="2" align="center">
                Email
                {sortField === 'Email' && (
                  <Text size="1">{sortDirection === 'asc' ? '↑' : '↓'}</Text>
                )}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell 
              onClick={() => handleSort('Name')}
              style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '200px' }}
            >
              <Flex gap="2" align="center">
                Name
                {sortField === 'Name' && (
                  <Text size="1">{sortDirection === 'asc' ? '↑' : '↓'}</Text>
                )}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell 
              onClick={() => handleSort('Provider')}
              style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '150px' }}
            >
              <Flex gap="2" align="center">
                Provider
                {sortField === 'Provider' && (
                  <Text size="1">{sortDirection === 'asc' ? '↑' : '↓'}</Text>
                )}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell 
              onClick={() => handleSort('Joined')}
              style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '150px' }}
            >
              <Flex gap="2" align="center">
                Joined
                {sortField === 'Joined' && (
                  <Text size="1">{sortDirection === 'asc' ? '↑' : '↓'}</Text>
                )}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell 
              onClick={() => handleSort('LastSignin')}
              style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '150px' }}
            >
              <Flex gap="2" align="center">
                Last Sign In
                {sortField === 'LastSignin' && (
                  <Text size="1">{sortDirection === 'asc' ? '↑' : '↓'}</Text>
                )}
              </Flex>
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Actions</Table.ColumnHeaderCell>
          </Table.Row>
          <Table.Row>
            {['Email', 'Name', 'Provider', 'Joined', 'LastSignin'].map((field) => (
              <Table.Cell key={field}>
                <Popover.Root open={openFilter === field} onOpenChange={(open) => setOpenFilter(open ? field : null)}>
                  <Popover.Trigger>
                    <Button variant="soft" style={{ minWidth: '150px' }}>
                      Filter {field}...
                    </Button>
                  </Popover.Trigger>
                  <Popover.Content style={{ width: '300px' }}>
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
                      <Flex align="center" gap="2" style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                        <input
                          type="text"
                          placeholder={`Enter ${field} pattern (use * for wildcard)`}
                          className="flex-1 px-2 py-1 text-sm border rounded"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              const value = input.value.trim();
                              if (value) {
                                handleFilterChange(field, value);
                                input.value = '';
                              }
                            }
                          }}
                        />
                      </Flex>
                      {wildcardFilters[field] && (
                        <Flex align="center" gap="2" style={{ padding: '0.5rem', backgroundColor: '#f3f4f6' }}>
                          <Text size="2">Wildcard pattern: {wildcardFilters[field]}</Text>
                          <Button
                            variant="soft"
                            onClick={() => setWildcardFilters(prev => ({ ...prev, [field]: '' }))}
                          >
                            Clear
                          </Button>
                        </Flex>
                      )}
                      {getUniqueValues(field).map((value) => (
                        <Flex key={value} align="center" gap="2">
                          <Checkbox
                            checked={((filters[field] as string[]) || []).includes(value)}
                            onCheckedChange={() => handleFilterChange(field, value)}
                          />
                          <Text size="2">{value}</Text>
                        </Flex>
                      ))}
                    </Box>
                  </Popover.Content>
                </Popover.Root>
              </Table.Cell>
            ))}
            <Table.Cell />
            <Table.Cell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {getPaginatedData().map((subscriber) => (
            <Table.Row key={subscriber.Email}>
              <Table.Cell style={{ whiteSpace: 'nowrap' }}>{subscriber.Email}</Table.Cell>
              <Table.Cell style={{ whiteSpace: 'nowrap' }}>{subscriber.Name}</Table.Cell>
              <Table.Cell style={{ whiteSpace: 'nowrap' }}>{subscriber.Provider}</Table.Cell>
              <Table.Cell style={{ whiteSpace: 'nowrap' }}>
                {formatDate(subscriber.Joined)}
              </Table.Cell>
              <Table.Cell style={{ whiteSpace: 'nowrap' }}>
                {formatDate(subscriber.LastSignin)}
              </Table.Cell>
              <Table.Cell>
                <Flex gap="2" align="center">
                  {subscriber.Active && <Text color="green">Active</Text>}
                  {subscriber.Banned && <Text color="red">Banned</Text>}
                  {!subscriber.Active && !subscriber.Banned && (
                    <Flex gap="2" align="center">
                      <Text color="gray">Inactive</Text>
                      {subscriber.Left && (
                        <Text size="1" color="gray">
                          (Left: {formatDate(subscriber.Left)})
                        </Text>
                      )}
                    </Flex>
                  )}
                </Flex>
              </Table.Cell>
              <Table.Cell align="right" style={{ whiteSpace: 'nowrap' }}>
                <Button
                  variant="soft"
                  onClick={() => handleUpdate(subscriber)}
                >
                  Update
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

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
            variant="soft"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Text size="2">
            Page {currentPage} of {totalPages}
          </Text>
          <Button
            variant="soft"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </Flex>
      </Flex>
    </div>
  );
} 