'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { SystemLog } from '@/lib/system-logs';
import { 
    Table, 
    Box, 
    Flex, 
    Text, 
    TextField, 
    Checkbox, 
    Button, 
    Popover,
    Select,
    Card,
    ScrollArea,
    Separator
} from '@radix-ui/themes';
import { 
    ChevronUpIcon, 
    ChevronDownIcon, 
    MagnifyingGlassIcon, 
    CheckIcon,
    CalendarIcon,
    ClockIcon,
    MixerHorizontalIcon
} from '@radix-ui/react-icons';

const ITEMS_PER_PAGE = 20;

// Custom CSS for visible scrollbars
const scrollbarStyles = `
  .top-scrollbar::-webkit-scrollbar {
    height: 8px;
    background-color: var(--gray-3);
  }
  
  .top-scrollbar::-webkit-scrollbar-track {
    background-color: var(--gray-3);
    border-radius: 4px;
  }
  
  .top-scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--gray-6);
    border-radius: 4px;
  }
  
  .top-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: var(--gray-7);
  }
  
  .top-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--gray-6) var(--gray-3);
  }
`;

interface LogsResponse {
    logs: SystemLog[];
    totalCount: number;
}

type SortField = 'timestamp' | 'logType' | 'userEmail' | 'tenantId' | 'activityType' | 'accessType' | 'targetId' | 'targetName' | 'ipAddress' | 'provider';
type SortOrder = 'asc' | 'desc';

export function LogsTable() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('timestamp');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
    const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
    const [showArchived, setShowArchived] = useState(false);
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
        logType: [],
        provider: [],
        userEmail: [],
        tenantId: [],
        activityType: [],
        accessType: [],
        targetName: [],
        ipAddress: []
    });

    // Refs for synchronized scrolling
    const topScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    // Calculate offset based on current page and page size
    const offset = (page - 1) * pageSize;

    // Extract unique values for filters from logs
    const filterOptions = useMemo(() => {
        const options = {
            logType: new Set<string>(),
            provider: new Set<string>(),
            userEmail: new Set<string>(),
            tenantId: new Set<string>(),
            activityType: new Set<string>(),
            accessType: new Set<string>(),
            targetName: new Set<string>(),
            ipAddress: new Set<string>()
        };

        logs.forEach(log => {
            if (log.logType) options.logType.add(log.logType);
            if (log.provider) options.provider.add(log.provider);
            if (log.userEmail) options.userEmail.add(log.userEmail);
            if (log.tenantId) options.tenantId.add(log.tenantId);
            if (log.activityType) options.activityType.add(log.activityType);
            if (log.accessType) options.accessType.add(log.accessType);
            if (log.targetName) options.targetName.add(log.targetName);
            if (log.ipAddress) options.ipAddress.add(log.ipAddress);
        });

        return {
            logType: Array.from(options.logType).sort(),
            provider: Array.from(options.provider).sort(),
            userEmail: Array.from(options.userEmail).sort(),
            tenantId: Array.from(options.tenantId).sort(),
            activityType: Array.from(options.activityType).sort(),
            accessType: Array.from(options.accessType).sort(),
            targetName: Array.from(options.targetName).sort(),
            ipAddress: Array.from(options.ipAddress).sort()
        };
    }, [logs]);

    useEffect(() => {
        async function fetchLogs() {
            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams(searchParams);
                
                // Always add pagination parameters
                params.set('limit', pageSize.toString());
                params.set('offset', offset.toString());
                
                params.set('sortField', sortField);
                params.set('sortOrder', sortOrder);
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);

                // Add column filters
                Object.entries(columnFilters).forEach(([key, values]) => {
                    if (values.length > 0) {
                        // Remove any existing values for this parameter
                        params.delete(key);
                        // Add each value as a separate parameter
                        values.forEach(value => {
                            params.append(key, value);
                        });
                    }
                });

                // Add archived status
                if (showArchived) {
                    params.set('showArchived', 'true');
                }

                const response = await fetch(`/api/logs?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch logs');
                }

                const data = await response.json() as LogsResponse;
                setLogs(data.logs);
                setTotalCount(data.totalCount);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        }

        fetchLogs();
    }, [searchParams, page, pageSize, sortField, sortOrder, offset, startDate, endDate, columnFilters, showArchived]);

    const handleSort = (field: SortField) => {
        if (field === sortField) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleMultiSelectFilter = (field: string, value: string) => {
        setColumnFilters(prev => {
            const currentValues = prev[field] || [];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            
            return {
                ...prev,
                [field]: newValues
            };
        });
        
        // Reset to first page when filtering
        setPage(1);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (field !== sortField) return null;
        return sortOrder === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />;
    };

    const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
        <Flex align="center" gap="1" className="cursor-pointer" onClick={() => handleSort(field)}>
            <Text>{label}</Text>
            <SortIcon field={field} />
        </Flex>
    );

    const MultiSelectFilter = ({ 
        field, 
        label, 
        options 
    }: { 
        field: string; 
        label: string; 
        options: string[] 
    }) => {
        const [open, setOpen] = useState(false);
        
        const handleButtonClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
        };

        const handleCheckboxChange = (option: string) => {
            handleMultiSelectFilter(field, option);
        };
        
        return (
            <Box style={{ position: 'relative', zIndex: 1000 }}>
                <Popover.Root open={open} onOpenChange={setOpen}>
                    <Popover.Trigger>
                        <Button 
                            variant="soft" 
                            size="1" 
                            onClick={handleButtonClick}
                            style={{ pointerEvents: 'auto' }}
                        >
                            <Flex gap="2" align="center">
                                <MixerHorizontalIcon />
                                <Text size="2">
                                    {columnFilters[field]?.length ? `${columnFilters[field].length} selected` : 'Filter'}
                                </Text>
                            </Flex>
                        </Button>
                    </Popover.Trigger>
                    <Popover.Content 
                        side="bottom" 
                        align="start" 
                        style={{ 
                            zIndex: 1001,
                            pointerEvents: 'auto'
                        }}
                    >
                        <Card>
                            <ScrollArea style={{ maxHeight: '300px' }}>
                                <Box p="2" className="space-y-2">
                                    {options.map(option => (
                                        <Flex key={option} align="center" gap="2">
                                            <Checkbox
                                                checked={columnFilters[field]?.includes(option)}
                                                onCheckedChange={() => handleCheckboxChange(option)}
                                            />
                                            <Text size="2">{option}</Text>
                                        </Flex>
                                    ))}
                                </Box>
                            </ScrollArea>
                        </Card>
                    </Popover.Content>
                </Popover.Root>
            </Box>
        );
    };

    // Synchronized scrolling handlers
    const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (bottomScrollRef.current) {
            bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleBottomScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (topScrollRef.current) {
            topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    if (error) {
        return (
            <Card>
                <Text color="red" align="center">Error: {error}</Text>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Flex justify="center" align="center" p="6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </Flex>
        );
    }

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <Box className="space-y-4">
            <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
            
            <Card>
                <Box p="4">
                    <Flex gap="4" align="center">
                        <Box>
                            <Text size="2" weight="bold" mb="2">Start Date</Text>
                            <TextField.Root size="2" style={{ width: '300px' }}>
                                <TextField.Slot>
                                    <CalendarIcon />
                                </TextField.Slot>
                                <TextField.Input
                                    type="datetime-local"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{ fontSize: '16px', padding: '8px' }}
                                />
                            </TextField.Root>
                        </Box>
                        <Box>
                            <Text size="2" weight="bold" mb="2">End Date</Text>
                            <TextField.Root size="2" style={{ width: '300px' }}>
                                <TextField.Slot>
                                    <CalendarIcon />
                                </TextField.Slot>
                                <TextField.Input
                                    type="datetime-local"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{ fontSize: '16px', padding: '8px' }}
                                    min={startDate}
                                />
                            </TextField.Root>
                        </Box>
                        <Button 
                            variant="soft" 
                            color="gray" 
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                            }}
                            style={{ marginTop: '24px' }}
                        >
                            Clear Dates
                        </Button>
                    </Flex>
                </Box>
            </Card>

            <Card>
                <Flex justify="between" align="center" p="4">
                    <Flex gap="2" align="center">
                        <Text size="2">
                            Showing {logs.length} of {totalCount} logs
                        </Text>
                        <Select.Root 
                            value={pageSize === totalCount ? 'all' : pageSize.toString()} 
                            onValueChange={(value) => {
                                const newPageSize = value === 'all' ? totalCount : parseInt(value);
                                setPageSize(newPageSize);
                                setPage(1);
                            }}
                        >
                            <Select.Trigger />
                            <Select.Content>
                                <Select.Item value="10">10 per page</Select.Item>
                                <Select.Item value="20">20 per page</Select.Item>
                                <Select.Item value="50">50 per page</Select.Item>
                                <Select.Item value="100">100 per page</Select.Item>
                                <Select.Item value="all">Show all</Select.Item>
                            </Select.Content>
                        </Select.Root>
                        
                        <Button
                            variant={showArchived ? "solid" : "soft"}
                            color={showArchived ? "orange" : "gray"}
                            onClick={() => {
                                setShowArchived(!showArchived);
                                setPage(1); // Reset to first page when switching
                            }}
                            size="2"
                        >
                            {showArchived ? 'Archived Logs' : 'Active Logs'}
                        </Button>
                    </Flex>
                    <Flex gap="2">
                        <Button
                            variant="soft"
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Previous
                        </Button>
                        <Text size="2" align="center" style={{ minWidth: '100px' }}>
                            Page {page} of {totalPages}
                        </Text>
                        <Button
                            variant="soft"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        >
                            Next
                        </Button>
                    </Flex>
                </Flex>
            </Card>

            <Card>
                {/* Top horizontal scroll bar */}
                <ScrollArea 
                    ref={topScrollRef}
                    onScroll={handleTopScroll}
                    style={{
                        height: '12px',
                        backgroundColor: 'var(--gray-3)',
                        borderBottom: '1px solid var(--gray-6)'
                    }}
                >
                    <div style={{ 
                        minWidth: 'max-content',
                        height: '1px'
                    }}>
                        <Table.Root style={{ visibility: 'hidden' }}>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ minWidth: '150px' }}>
                                        <div style={{ height: '1px' }} />
                                    </Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                        </Table.Root>
                    </div>
                </ScrollArea>

                {/* Main table with synchronized scroll */}
                <ScrollArea ref={bottomScrollRef} onScroll={handleBottomScroll}>
                    <Table.Root>
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="timestamp" label="Timestamp" />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="logType" label="Type" />
                                        <MultiSelectFilter
                                            field="logType"
                                            label="Filter Types"
                                            options={filterOptions.logType}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="provider" label="Provider" />
                                        <MultiSelectFilter
                                            field="provider"
                                            label="Filter Providers"
                                            options={filterOptions.provider}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="userEmail" label="User" />
                                        <MultiSelectFilter
                                            field="userEmail"
                                            label="Filter Users"
                                            options={filterOptions.userEmail}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="tenantId" label="Tenant" />
                                        <MultiSelectFilter
                                            field="tenantId"
                                            label="Filter Tenants"
                                            options={filterOptions.tenantId}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="activityType" label="Activity" />
                                        <MultiSelectFilter
                                            field="activityType"
                                            label="Filter Activities"
                                            options={filterOptions.activityType}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="accessType" label="Access" />
                                        <MultiSelectFilter
                                            field="accessType"
                                            label="Filter Access Types"
                                            options={filterOptions.accessType}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="targetName" label="Target" />
                                        <MultiSelectFilter
                                            field="targetName"
                                            label="Filter Targets"
                                            options={filterOptions.targetName}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Flex direction="column" gap="2">
                                        <SortableHeader field="ipAddress" label="IP" />
                                        <MultiSelectFilter
                                            field="ipAddress"
                                            label="Filter IPs"
                                            options={filterOptions.ipAddress}
                                        />
                                    </Flex>
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                    <Text size="2" weight="bold">Metadata</Text>
                                </Table.ColumnHeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {logs.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={10}>
                                        <Text align="center">No logs found</Text>
                                    </Table.Cell>
                                </Table.Row>
                            ) : (
                                logs.map((log) => (
                                    <Table.Row key={log.id}>
                                        <Table.Cell>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </Table.Cell>
                                        <Table.Cell>
                                                                                        <Text className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                log.logType === 'activity' ? 'bg-blue-100 text-blue-800' :
                                                log.logType === 'auth' ? 'bg-green-100 text-green-800' :
                                                log.logType === 'media_access' ? 'bg-purple-100 text-purple-800' :
                                                log.logType === 'avatar_access' ? 'bg-indigo-100 text-indigo-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {log.logType}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>{log.provider}</Table.Cell>
                                        <Table.Cell>{log.userEmail}</Table.Cell>
                                        <Table.Cell>{log.tenantId}</Table.Cell>
                                        <Table.Cell>{log.activityType}</Table.Cell>
                                        <Table.Cell>{log.accessType}</Table.Cell>
                                        <Table.Cell>{log.targetName}</Table.Cell>
                                        <Table.Cell>{log.ipAddress}</Table.Cell>
                                        <Table.Cell>
                                            {log.metadata ? (
                                                <details>
                                                    <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--gray-11)' }}>
                                                        View Metadata
                                                    </summary>
                                                    <pre style={{ 
                                                        fontSize: '11px', 
                                                        backgroundColor: 'var(--gray-3)', 
                                                        padding: '8px', 
                                                        borderRadius: '4px',
                                                        marginTop: '4px',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word',
                                                        maxWidth: '300px',
                                                        overflow: 'auto'
                                                    }}>
                                                        {JSON.stringify(log.metadata, null, 2)}
                                                    </pre>
                                                </details>
                                            ) : (
                                                <Text size="1" color="gray">No metadata</Text>
                                            )}
                                        </Table.Cell>
                                    </Table.Row>
                                ))
                            )}
                        </Table.Body>
                    </Table.Root>
                </ScrollArea>
            </Card>
        </Box>
    );
} 