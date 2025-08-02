'use client';

import React, { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link'
import type { NextPage } from 'next';
import { auth } from "@/auth";
import { SessionProvider, useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
interface CustomerRow {
  Id: string;
  CompanyName: string;
  ContactName: string;
  ContactTitle: string;
  Address: string;
  City: string;
  Region: string;
  PostalCode: string;
  Country: string;
  Phone: string;
  Pronouns?: string;
}
import { Button, Table, Flex, Text, Popover, Box, Checkbox } from '@radix-ui/themes';
import { useToast } from '@/components/Toast';

const Home: NextPage = () => {
  const [fetchedData, setFetchedData] = useState<CustomerRow[] | null>(null);
  const [fetchedPlaceholders, setPlaceholders] = useState<CustomerRow[] | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [Id, setId] = useState('');
  const [newId, setNewId] = useState('');
  const [CompanyName, setCompanyName] = useState('');
  const [ContactName, setContactName] = useState('');
  const [ContactTitle, setContactTitle] = useState('');
  const [Address, setAddress] = useState('');
  const [City, setCity] = useState('');
  const [Region, setRegion] = useState('');
  const [PostalCode, setPostalCode] = useState('');
  const [Country, setCountry] = useState('');
  const [Phone, setPhone] = useState('');
  const [Pronouns, setPronouns] = useState('');
  const [delId, setDelId] = useState('');
  const [updateId, setUpdateId] = useState('');
  const [op, setOp] = useState('');
  const [key, setKey] = useState("");
  const [sortField, setSortField] = useState<keyof CustomerRow | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Partial<Record<keyof CustomerRow, string>>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { showToast } = useToast();

  const handleSort = (field: keyof CustomerRow) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilter = (field: keyof CustomerRow, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const getFilteredAndSortedData = () => {
    if (!fetchedData) return [];
    
    let filtered = fetchedData.filter(customer => {
      return Object.entries(filters).every(([field, filterValue]) => {
        if (!filterValue) return true;
        const value = String(customer[field as keyof CustomerRow]).toLowerCase();
        return value.includes(filterValue.toLowerCase());
      });
    });

    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = String(a[sortField]);
        const bValue = String(b[sortField]);
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });
    }

    // Get current page items
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filtered.slice(indexOfFirstItem, indexOfLastItem);
  };

  const getTotalPages = () => {
    if (!fetchedData) return 0;
    const filteredData = fetchedData.filter(customer => {
      return Object.entries(filters).every(([field, filterValue]) => {
        if (!filterValue) return true;
        const value = String(customer[field as keyof CustomerRow]).toLowerCase();
        return value.includes(filterValue.toLowerCase());
      });
    });
    return Math.ceil(filteredData.length / itemsPerPage);
  };

  const idHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const data: D1Result = await response.json();
      if (data?.results.length > 0) {
        setFetchedData(data.results as Array<CustomerRow>);
      } else {
        showToast({
          title: 'Error',
          content: 'Customer not found',
          type: 'error'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const populateHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const data: D1Result = await response.json();
      if (data?.results.length > 0) {
        setPlaceholders(data.results as Array<CustomerRow>);
      } else {
        showToast({
          title: 'Error',
          content: 'Customer not found',
          type: 'error'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const insertHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const message = await response.json();
      showToast({
        title: 'Success',
        content: message as string,
        type: 'success'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const updateHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const message = await response.json();
      showToast({
        title: 'Success',
        content: message as string,
        type: 'success'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const updateHandleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPlaceholders(prev => {
      const updated = prev?.map(customer => customer.Id === updateId ? { ...customer, [name]: value || '' } : customer) || null;
      return updated;
    });
  };

  const deleteHandleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = Object.fromEntries(formData);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const message = await response.json();
      showToast({
        title: 'Success',
        content: message as string,
        type: 'success'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/signin');
    },
  });

  const handleDelete = async () => {
    try {
      await Promise.all(
        selectedCustomers.map(email =>
          fetch('/api/customers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              op: 'delete',
              email,
            }),
          })
        )
      );
      showToast({
        title: 'Success',
        content: 'Selected customers deleted successfully',
        type: 'success'
      });
      setSelectedCustomers([]);
      // Refresh the list
      const response = await fetch('/api/customers');
      const data = await response.json();
      setFetchedData(data as CustomerRow[]);
    } catch (error) {
      showToast({
        title: 'Error',
        content: 'Failed to delete customers',
        type: 'error'
      });
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return (
    <div className="ml-4">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <form onSubmit={idHandleSubmit}>
          <input className = "outline-1"
            type='Id'
            name='Id'
            placeholder='Enter id (* for every id)'
            value={Id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <input type="hidden" name="op" value="select" />
          <Button type="submit" variant="outline">
            List
          </Button>
        </form>

        {fetchedData && (
          <>
            <table className="table-auto mx-auto">
              {fetchedData?.length > 0 && (
                <thead>
                  <tr>
                    {['Id', 'CompanyName', 'ContactName', 'ContactTitle', 'Address', 'City', 'Region', 'PostalCode', 'Country', 'Phone', 'Pronouns'].map((field) => (
                      <th key={field} className="px-4 py-2">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {field}
                            <button
                              onClick={() => handleSort(field as keyof CustomerRow)}
                              className="text-xs"
                            >
                              {sortField === field ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                            </button>
                          </div>
                          <input
                            type="text"
                            className="mt-1 px-1 py-0.5 text-sm w-full border rounded"
                            placeholder="Filter..."
                            onChange={(e) => handleFilter(field as keyof CustomerRow, e.target.value)}
                            value={filters[field as keyof CustomerRow] || ''}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {getFilteredAndSortedData().map((customer) => (
                  <tr key={customer.Id}>
                    <td className="border px-4 py-2">{customer.Id}</td>
                    <td className="border px-4 py-2">{customer.CompanyName}</td>
                    <td className="border px-4 py-2">{customer.ContactName}</td>
                    <td className="border px-4 py-2">{customer.ContactTitle}</td>
                    <td className="border px-4 py-2">{customer.Address}</td>
                    <td className="border px-4 py-2">{customer.City}</td>
                    <td className="border px-4 py-2">{customer.Region}</td>
                    <td className="border px-4 py-2">{customer.PostalCode}</td>
                    <td className="border px-4 py-2">{customer.Country}</td>
                    <td className="border px-4 py-2">{customer.Phone}</td>
                    <td className="border px-4 py-2">{customer.Pronouns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <span className="mx-2">
                Page {currentPage} of {getTotalPages()}
              </span>
              
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                disabled={currentPage === getTotalPages()}
              >
                Next
              </Button>
              
              <select 
                className="border rounded px-2 py-1 ml-4"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </>
        )}

        <form onSubmit={insertHandleSubmit}>
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th className="px-4 py-2">Field</th>
                <th className="px-4 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-4 py-2">ID</td>
                <td className="border px-4 py-2">
                  <input className = "outline-1"
                    type="text"
                    name="newId"
                    placeholder="Enter new id"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Company Name</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="CompanyName"
                    className="w-full"
                    placeholder="Enter company name"
                    value={CompanyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Contact Name</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="ContactName"
                    className="w-full"
                    placeholder="Enter contact name"
                    value={ContactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Contact Title</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="ContactTitle"
                    className="w-full"
                    placeholder="Enter contact title"
                    value={ContactTitle}
                    onChange={(e) => setContactTitle(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Address</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="Address"
                    className="w-full"
                    placeholder="Enter address"
                    value={Address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">City</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="City"
                    className="w-full"
                    placeholder="Enter city"
                    value={City}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Region</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="Region"
                    className="w-full"
                    placeholder="Enter region"
                    value={Region}
                    onChange={(e) => setRegion(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Postal Code</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="PostalCode"
                    className="w-full"
                    placeholder="Enter postal code"
                    value={PostalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Country</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="Country"
                    className="w-full"
                    placeholder="Enter country"
                    value={Country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Phone</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="Phone"
                    className="w-full"
                    placeholder="Enter phone"
                    value={Phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border px-4 py-2">Pronouns</td>
                <td className="border px-4 py-2">
                  <input
                    type="text"
                    name="Pronouns"
                    className="w-full"
                    placeholder="Enter pronouns"
                    value={Pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    required
                  />
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border px-4 py-2 text-center">
                  <input type="hidden" name="op" value="insert" />
                  <Button type="submit" variant="outline"  className="outline-1">
                    Create
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </form>

        <form onSubmit={populateHandleSubmit}>
          <input className = "outline-1"
            type='updateId'
            name='updateId'
            placeholder='Enter id to update'
            value={updateId}
            onChange={(e) => setUpdateId(e.target.value)}
            required
          />
          <input type="hidden" name="op" value="populate" />
          <Button type="submit" variant="outline">
            Find
          </Button>
        </form>

        {fetchedPlaceholders && fetchedPlaceholders?.length > 0 && (
          <form onSubmit={updateHandleSubmit}>
            <table className="table-auto w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2">Field</th>
                  <th className="px-4 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-4 py-2">Company Name</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="CompanyName"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.CompanyName || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Contact Name</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="ContactName"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.ContactName || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Contact Title</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="ContactTitle"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.ContactTitle || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Address</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="Address"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.Address || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">City</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="City"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.City || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Region</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="Region"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.Region || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Postal Code</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="PostalCode"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.PostalCode || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Country</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="Country"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.Country || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Phone</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="Phone"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.Phone || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border px-4 py-2">Pronouns</td>
                  <td className="border px-4 py-2">
                    <input
                      type="text"
                      name="Pronouns"
                      className="w-full"
                      value={fetchedPlaceholders[0]?.Pronouns || ''}
                      onChange={updateHandleChange}
                    />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border px-4 py-2 text-center">
                    <input type="hidden" name="updateId" value={updateId} />
                    <input type="hidden" name="op" value="update" />
                    <Button type="submit" variant="outline" className="w-1/4">
                      Update
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </form>
        )}

        <form onSubmit={deleteHandleSubmit}>
          <input className = "outline-1"
            type='delId'
            name='delId'
            placeholder='Enter ID to delete'
            value={delId}
            onChange={(e) => setDelId(e.target.value)}
            required
          />
          <input type="hidden" name="op" value="delete" />
          <Button type="submit" variant="outline">
            Delete
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Home;