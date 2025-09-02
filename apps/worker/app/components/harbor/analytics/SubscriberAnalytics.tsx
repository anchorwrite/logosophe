"use client";

import { useState, useEffect } from 'react';
import { Container, Heading, Text, Box, Flex, Button, Card, Badge } from '@radix-ui/themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import type { Locale } from '@/types/i18n';

interface ContentAnalyticsData {
  contentPerformance: Array<{
    MediaId: string;
    FileName: string;
    ActivityType: string;
    OperationCount: number;
    ActiveDays: number;
    FirstActivity: string;
    LastActivity: string;
    ContentLanguage: string;
  }>;
  weeklyTrends: Array<{
    MediaId: string;
    FileName: string;
    Date: string;
    DailyViews: number;
    PreviousDayViews: number;
    PercentChange: number;
  }>;
  languagePerformance: Array<{
    ContentLanguage: string;
    TotalOperations: number;
    UniqueFiles: number;
    Views: number;
    Downloads: number;
    Uploads: number;
  }>;
  roleActivity: Array<{
    UserRole: string;
    TotalOperations: number;
    UniqueFiles: number;
    ActiveDays: number;
    PreferredLanguage: string;
  }>;
  publishedContent: Array<{
    ContentStatus: string;
    TotalOperations: number;
    UniqueFiles: number;
    Views: number;
    Downloads: number;
  }>;
  engagementTrends: Array<{
    MediaId: string;
    FileName: string;
    current_views: number;
    previous_views: number;
    percent_change: number;
  }>;
  peakHours: Array<{
    Hour: number;
    ViewCount: number;
    UniqueFiles: number;
  }>;
  contentType: Array<{
    ContentType: string;
    TotalOperations: number;
    UniqueFiles: number;
    Views: number;
    Downloads: number;
  }>;
  filters: {
    days: number;
    language: string;
    userTenants: string[];
    userRoles: string[];
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface SubscriberAnalyticsProps {
  lang: Locale;
  dict: any; // Dictionary from getDictionary
}

export function SubscriberAnalytics({ lang, dict }: SubscriberAnalyticsProps) {
  const [data, setData] = useState<ContentAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analytics/subscriber/content?timeRange=${timeRange}&language=${lang}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const result = await response.json() as { data: ContentAnalyticsData };
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange, lang]);

  if (loading) {
    return (
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <Text size="4">{dict.harbor.loading}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <Text color="red" size="4">{dict.harbor.error}: {error}</Text>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <Text size="4">{dict.harbor.noData}</Text>
      </Box>
    );
  }

  // Prepare data for charts
  const peakHoursData = data.peakHours.map(hour => ({
    Hour: `${hour.Hour}:00`,
    Views: hour.ViewCount,
    Files: hour.UniqueFiles
  }));

  const contentTypeData = data.contentType.map(type => ({
    Type: type.ContentType,
    Operations: type.TotalOperations,
    Views: type.Views,
    Downloads: type.Downloads
  }));

  return (
    <Container size="3">
      <Box style={{ marginBottom: '2rem' }}>
        <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
          <Box>
            <Heading size="6" style={{ marginBottom: '0.5rem' }}>
              {dict.harbor.contentAnalytics}
            </Heading>
            <Text color="gray" size="3">
              {dict.harbor.contentAnalyticsDescription}
            </Text>
          </Box>
          <Flex gap="2">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--gray-6)' }}
            >
              <option value="1">{dict.harbor['1Day']}</option>
              <option value="7">{dict.harbor['7Days']}</option>
              <option value="30">{dict.harbor['30Days']}</option>
              <option value="90">{dict.harbor['90Days']}</option>
            </select>
          </Flex>
        </Flex>
      </Box>

      {/* Content Performance */}
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.contentPerformance}</Heading>
        <Flex gap="4" wrap="wrap">
          {data.contentPerformance.slice(0, 6).map((item) => (
            <Card key={`${item.MediaId}-${item.ActivityType}`} style={{ flex: '1', minWidth: '250px' }}>
              <Box style={{ padding: '1.5rem' }}>
                <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
                  <Heading size="3" style={{ fontSize: '0.875rem' }}>
                    {item.FileName}
                  </Heading>
                  <Badge variant="soft">{item.ActivityType}</Badge>
                </Flex>
                <Text size="6" weight="bold" style={{ marginBottom: '0.5rem' }}>
                  {item.OperationCount.toLocaleString()}
                </Text>
                <Text color="gray" size="2">
                  {item.ActiveDays} {dict.harbor.activeDays} • {item.ContentLanguage}
                </Text>
              </Box>
            </Card>
          ))}
        </Flex>
      </Box>

      {/* Engagement Trends - Week over Week */}
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.engagementTrends}</Heading>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Flex direction="column" gap="3">
              {data.engagementTrends.map((trend) => (
                <Flex key={trend.MediaId} justify="between" align="center" style={{ padding: '1rem', border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                  <Box>
                    <Text weight="medium">{trend.FileName}</Text>
                    <Text color="gray" size="2">
                      {trend.current_views} vs {trend.previous_views} previous week
                    </Text>
                  </Box>
                  <Box style={{ textAlign: 'right' }}>
                    <Text weight="bold" size="3">{trend.current_views.toLocaleString()}</Text>
                    <Text color={trend.percent_change > 0 ? 'green' : 'red'} size="2">
                      {trend.percent_change > 0 ? '+' : ''}{trend.percent_change}%
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Content Performance Chart */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.contentPerformanceChart}</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.contentPerformance.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="FileName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="OperationCount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Weekly Trends */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.weeklyTrendAnalysis}</Heading>
            <Flex direction="column" gap="3">
              {data.weeklyTrends.slice(0, 10).map((trend) => (
                <Flex key={`${trend.MediaId}-${trend.Date}`} justify="between" align="center" style={{ padding: '1rem', border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                  <Box>
                    <Text weight="medium">{trend.FileName}</Text>
                    <Text color="gray" size="2">{trend.Date}</Text>
                  </Box>
                  <Box style={{ textAlign: 'right' }}>
                    <Text weight="bold" size="3">{trend.DailyViews}</Text>
                    <Text color={trend.PercentChange > 0 ? 'green' : 'red'} size="2">
                      {trend.PercentChange > 0 ? '+' : ''}{trend.PercentChange}% {dict.harbor.change}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Peak Content Hours */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.peakContentHours}</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Hour" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="Views" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Content Type Performance */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.contentTypePerformance}</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contentTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Operations" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Language Performance */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.performanceByLanguage}</Heading>
            <Box style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.languagePerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ ContentLanguage, TotalOperations }) => `${ContentLanguage}: ${TotalOperations}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="TotalOperations"
                  >
                    {data.languagePerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Card>
      </Box>

      {/* Role Activity */}
      <Box style={{ marginBottom: '2rem' }}>
        <Card>
          <Box style={{ padding: '1.5rem' }}>
            <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.activityByRole}</Heading>
            <Flex direction="column" gap="3">
              {data.roleActivity.map((role) => (
                <Flex key={role.UserRole} justify="between" align="center" style={{ padding: '1rem', border: '1px solid var(--gray-6)', borderRadius: '4px' }}>
                  <Box>
                    <Text weight="medium" style={{ textTransform: 'capitalize' }}>{role.UserRole}</Text>
                    <Text color="gray" size="2">
                      {role.UniqueFiles} {dict.harbor.files} • {role.ActiveDays} {dict.harbor.activeDays}
                    </Text>
                  </Box>
                  <Box style={{ textAlign: 'right' }}>
                    <Text weight="bold" size="3">{role.TotalOperations.toLocaleString()}</Text>
                    <Text color="gray" size="2">{dict.harbor.operations}</Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Published Content */}
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>{dict.harbor.publishedVsUnpublished}</Heading>
        <Flex gap="4" wrap="wrap">
          {data.publishedContent.map((item) => (
            <Card key={item.ContentStatus} style={{ flex: '1', minWidth: '250px' }}>
              <Box style={{ padding: '1.5rem' }}>
                <Heading size="3" style={{ textTransform: 'capitalize', marginBottom: '1rem' }}>
                  {item.ContentStatus} {dict.harbor.content}
                </Heading>
                <Flex direction="column" gap="2">
                  <Flex justify="between">
                    <Text>{dict.harbor.totalOperations}:</Text>
                    <Text weight="bold">{item.TotalOperations.toLocaleString()}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text>{dict.harbor.uniqueFilesUC}:</Text>
                    <Text weight="bold">{item.UniqueFiles}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text>{dict.harbor.views}:</Text>
                    <Text weight="bold">{item.Views.toLocaleString()}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text>{dict.harbor.downloads}:</Text>
                    <Text weight="bold">{item.Downloads.toLocaleString()}</Text>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ))}
        </Flex>
      </Box>
    </Container>
  );
}
