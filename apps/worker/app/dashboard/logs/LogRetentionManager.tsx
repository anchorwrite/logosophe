'use client';

import { useState, useEffect } from 'react';
import { 
    Card, 
    Box, 
    Flex, 
    Text, 
    TextField, 
    Button, 
    Select,
    Separator,
    AlertDialog,
    Heading
} from '@radix-ui/themes';
import { 
    GearIcon, 
    DownloadIcon, 
    TrashIcon, 
    ArchiveIcon,
    ClockIcon
} from '@radix-ui/react-icons';

interface LogStats {
    totalLogs: number;
    activeLogs: number;
    archivedLogs: number;
    oldestLog: string | null;
    newestLog: null;
}

interface RetentionSettings {
    log_retention_days: string;
    log_archive_enabled: string;
    log_hard_delete_delay: string;
    log_archive_cron_schedule: string;
}

export function LogRetentionManager() {
    const [stats, setStats] = useState<LogStats | null>(null);
    const [settings, setSettings] = useState<RetentionSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsResponse, settingsResponse] = await Promise.all([
                fetch('/api/logs/stats'),
                fetch('/api/logs/settings')
            ]);

            if (statsResponse.ok) {
                const statsData = await statsResponse.json() as LogStats;
                setStats(statsData);
            }

            if (settingsResponse.ok) {
                const settingsData = await settingsResponse.json() as RetentionSettings;
                setSettings(settingsData);
            }
        } catch (err) {
            setError('Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    };

    const updateSettings = async () => {
        if (!settings) return;

        setIsUpdating(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/logs/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                setSuccess('Settings updated successfully');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                throw new Error('Failed to update settings');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
        } finally {
            setIsUpdating(false);
        }
    };

    const exportArchivedLogs = async () => {
        try {
            const response = await fetch('/api/logs/export-archived', {
                method: 'POST'
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `archived-logs-${new Date().toISOString().split('T')[0]}.csv.gz`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                throw new Error('Failed to export archived logs');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export archived logs');
        }
    };

    const hardDeleteArchivedLogs = async () => {
        try {
            const response = await fetch('/api/logs/hard-delete-archived', {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json() as { deleted: number; errors: number };
                setSuccess(`Successfully deleted ${result.deleted} archived logs`);
                setShowHardDeleteDialog(false);
                fetchData(); // Refresh stats
                setTimeout(() => setSuccess(null), 5000);
            } else {
                throw new Error('Failed to hard delete archived logs');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to hard delete archived logs');
        }
    };

    const manualArchive = async () => {
        try {
            const response = await fetch('/api/logs/archive-now', {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json() as { processed: number };
                setSuccess(`Successfully triggered archive job. Processed ${result.processed} logs.`);
                setTimeout(() => setSuccess(null), 5000);
            } else {
                throw new Error('Failed to trigger archive job');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to trigger archive job');
        }
    };

    if (isLoading) {
        return (
            <Card mb="4">
                <Box p="4">
                    <Flex justify="center" align="center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                    </Flex>
                </Box>
            </Card>
        );
    }

    if (!stats || !settings) {
        return (
            <Card mb="4">
                <Box p="4">
                    <Text color="red">Failed to load retention manager data</Text>
                </Box>
            </Card>
        );
    }

    return (
        <Box mb="6" className="space-y-4">
            {error && (
                <Card>
                    <Box p="4">
                        <Text color="red">{error}</Text>
                    </Box>
                </Card>
            )}

            {success && (
                <Card>
                    <Box p="4">
                        <Text color="green">{success}</Text>
                    </Box>
                </Card>
            )}

            {/* Log Statistics */}
            <Card>
                <Box p="4">
                    <Flex align="center" gap="2" mb="3">
                        <ArchiveIcon />
                        <Heading size="3">Log Statistics</Heading>
                    </Flex>
                    <Flex gap="6" wrap="wrap">
                        <Box>
                            <Text size="2" color="gray" weight="bold">Total Logs:</Text>
                            <Text size="4" weight="bold">{stats.totalLogs.toLocaleString()}</Text>
                        </Box>
                        <Box>
                            <Text size="2" color="gray" weight="bold">Active Logs:</Text>
                            <Text size="4" weight="bold" color="green">{stats.activeLogs.toLocaleString()}</Text>
                        </Box>
                        <Box>
                            <Text size="2" color="gray" weight="bold">Archived Logs:</Text>
                            <Text size="4" weight="bold" color="orange">{stats.archivedLogs.toLocaleString()}</Text>
                        </Box>
                        <Box>
                            <Text size="2" color="gray" weight="bold">Oldest Log:</Text>
                            <Text size="4" weight="bold">
                                {stats.oldestLog ? new Date(stats.oldestLog).toLocaleDateString() : 'N/A'}
                            </Text>
                        </Box>
                        <Box>
                            <Text size="2" color="gray" weight="bold">Newest Log:</Text>
                            <Text size="4" weight="bold">
                                {stats.newestLog ? new Date(stats.newestLog).toLocaleDateString() : 'N/A'}
                            </Text>
                        </Box>
                    </Flex>
                </Box>
            </Card>

            {/* Archive Management */}
            <Card>
                <Box p="4">
                    <Flex align="center" gap="2" mb="3">
                        <ArchiveIcon />
                        <Heading size="3">Archive Management</Heading>
                    </Flex>
                    
                    <Flex gap="3" wrap="wrap">
                        <Button 
                            variant="soft" 
                            onClick={exportArchivedLogs}
                            size="2"
                        >
                            <DownloadIcon />
                            Export Archived Logs (CSV)
                        </Button>
                        
                        <Button 
                            variant="soft" 
                            color="orange"
                            onClick={() => setShowHardDeleteDialog(true)}
                            size="2"
                            disabled={stats.archivedLogs === 0}
                        >
                            <TrashIcon />
                            Hard Delete Archived Logs
                        </Button>

                        <Button 
                            variant="soft" 
                            color="blue"
                            onClick={manualArchive}
                            size="2"
                        >
                            <ClockIcon />
                            Run Archive Now
                        </Button>
                    </Flex>
                    
                    <Text size="2" color="gray" mt="2">
                        Archived logs will be permanently deleted after {settings.log_hard_delete_delay} days.
                        Export them first if you need to preserve the data.
                    </Text>
                </Box>
            </Card>

            {/* Hard Delete Confirmation Dialog */}
            <AlertDialog.Root open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
                <AlertDialog.Content>
                    <AlertDialog.Title>Confirm Hard Deletion</AlertDialog.Title>
                    <AlertDialog.Description>
                        This action will permanently delete {stats.archivedLogs.toLocaleString()} archived logs.
                        This action cannot be undone. Make sure you have exported the data if needed.
                    </AlertDialog.Description>
                    <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                            <Button variant="soft" color="gray">Cancel</Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                            <Button variant="solid" color="red" onClick={hardDeleteArchivedLogs}>
                                Delete Permanently
                            </Button>
                        </AlertDialog.Action>
                    </Flex>
                </AlertDialog.Content>
            </AlertDialog.Root>
        </Box>
    );
}
