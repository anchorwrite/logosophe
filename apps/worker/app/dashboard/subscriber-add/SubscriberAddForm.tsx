'use client';

import { useState, useEffect } from 'react';
import { Button, TextField, Text, Checkbox } from "@radix-ui/themes";
import { useToast } from "@/components/Toast";
import { ChevronDown } from "lucide-react";
import { useRouter } from 'next/navigation';

interface SubscriberFormData {
  Email: string;
  Name: string;
  Provider: string;
  Active: boolean;
  Banned: boolean;
  Post: boolean;
  Moderate: boolean;
  Track: boolean;
  TenantIds: string[];
}

interface Tenant {
  Id: string;
  Name: string;
  Description?: string;
}

interface TenantsResponse {
  tenants: Tenant[];
}

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  subscriber?: {
    Email: string;
    Name: string;
    Provider: string;
    Joined: string;
    LastSignin: string;
    Active: boolean;
    Banned: boolean;
    Post: boolean;
    Moderate: boolean;
    Track: boolean;
  };
}

// Helper function to format date as yyyy-MM-dd
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchTenants(): Promise<Tenant[]> {
  const response = await fetch('/api/tenant');
  if (!response.ok) {
    throw new Error('Failed to fetch tenants');
  }
  const data = await response.json() as TenantsResponse;
  return data.tenants || [];
}

async function addSubscriber(data: SubscriberFormData) {
  const now = new Date();
  const response = await fetch('/api/subscriber-add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      op: 'add',
      Id: data.Email,
      Name: data.Name,
      Provider: data.Provider,
      Active: data.Active,
      Banned: data.Banned,
      Post: data.Post,
      Moderate: data.Moderate,
      Track: data.Track,
      Joined: formatDateForInput(now),
      CreatedAt: formatDateForInput(now),
      TenantIds: data.TenantIds
    }),
  });

  const responseData = await response.json() as ApiResponse;

  if (!response.ok) {
    throw new Error(responseData.error || 'Failed to add subscriber');
  }

  return responseData;
}

export function SubscriberAddForm() {
  const { showToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [formData, setFormData] = useState<SubscriberFormData>({
    Email: '',
    Name: '',
    Provider: 'email',
    Active: true,
    Banned: false,
    Post: false,
    Moderate: false,
    Track: false,
    TenantIds: []
  });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  useEffect(() => {
    fetchTenants().then(setTenants).catch(error => {
      console.error('Error fetching tenants:', error);
      showToast({
        title: 'Error',
        content: 'Failed to load tenants',
        type: 'error'
      });
    });
  }, [showToast]);

  useEffect(() => {
    // Add click handler to show/hide overlay
    const handleClick = (e: MouseEvent) => {
      const select = document.getElementById('tenant-select');
      const overlay = document.getElementById('tenant-select-overlay');
      const trigger = e.target as HTMLElement;
      
      if (select && !select.contains(trigger) && !trigger.closest('[data-trigger]')) {
        select.classList.add('hidden');
        if (overlay) {
          overlay.classList.add('hidden');
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Update the click handler for the trigger
  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const select = document.getElementById('tenant-select');
    const overlay = document.getElementById('tenant-select-overlay');
    if (select) {
      select.classList.toggle('hidden');
      if (overlay) {
        overlay.classList.toggle('hidden');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await addSubscriber(formData);
      showToast({
        title: 'Success',
        content: 'Subscriber added successfully',
        type: 'success'
      });
      router.push('/dashboard/subscribers');
    } catch (error) {
      console.error('Error adding subscriber:', error);
      showToast({
        title: 'Error',
        content: 'Failed to add subscriber',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantSelect = (tenantId: string) => {
    const newSelectedTenants = selectedTenants.includes(tenantId)
      ? selectedTenants.filter(id => id !== tenantId)
      : [...selectedTenants, tenantId];
    
    setSelectedTenants(newSelectedTenants);
    setFormData(prev => ({ ...prev, TenantIds: newSelectedTenants }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Text as="label" size="2" weight="bold">Email</Text>
        <TextField.Root>
          <TextField.Input
            type="email"
            value={formData.Email}
            onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
            required
            placeholder="Enter email address"
          />
        </TextField.Root>
      </div>

      <div className="space-y-2">
        <Text as="label" size="2" weight="bold">Name</Text>
        <TextField.Root>
          <TextField.Input
            type="text"
            value={formData.Name}
            onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
            required
            placeholder="Enter full name"
          />
        </TextField.Root>
      </div>

      <div className="space-y-2">
        <Text as="label" size="2" weight="bold">Provider</Text>
        <select
          value={formData.Provider}
          onChange={(e) => setFormData({ ...formData, Provider: e.target.value })}
          className="w-full p-2 border rounded-md"
          required
        >
          <option value="credentials">Credentials</option>
          <option value="resend">Resend</option>
          <option value="google">Google</option>
          <option value="apple">Apple</option>
          <option value="test-credentials">Test</option>
        </select>
      </div>

      <div className="space-y-2">
        <Text as="label" size="2" weight="bold">Tenants</Text>
        <div className="relative">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-gray-50"
          >
            <Text size="2" color="gray">
              {selectedTenants.length > 0
                ? `${selectedTenants.length} tenant${selectedTenants.length === 1 ? '' : 's'} selected`
                : 'Select tenants'}
            </Text>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </div>
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
                <div className="max-h-60 overflow-auto">
                  {tenants.map((tenant) => (
                    <div
                      key={tenant.Id}
                      className="flex items-center px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleTenantSelect(tenant.Id)}
                    >
                      <Checkbox
                        checked={selectedTenants.includes(tenant.Id)}
                        onCheckedChange={() => {}}
                      />
                      <Text size="2" className="ml-2">{tenant.Name}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="active"
            checked={formData.Active}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, Active: checked })}
          />
          <Text as="label" size="2">Active</Text>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="banned"
            checked={formData.Banned}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, Banned: checked })}
          />
          <Text as="label" size="2">Banned</Text>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="post"
            checked={formData.Post}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, Post: checked })}
          />
          <Text as="label" size="2">Can Post</Text>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="moderate"
            checked={formData.Moderate}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, Moderate: checked })}
          />
          <Text as="label" size="2">Can Moderate</Text>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="track"
            checked={formData.Track}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, Track: checked })}
          />
          <Text as="label" size="2">Can Track</Text>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Adding...' : 'Add Subscriber'}
      </Button>
    </form>
  );
} 