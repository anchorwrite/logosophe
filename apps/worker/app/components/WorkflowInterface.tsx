'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';

interface Workflow {
  id: string;
  type: string;
  status: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowMessage {
  id: string;
  workflowId: string;
  userId: string;
  message: string;
  messageType: string;
  mediaIds: string[];
  createdAt: string;
}

interface WorkflowApiResponse {
  workflows?: Workflow[];
  messages?: WorkflowMessage[];
  error?: string;
  success?: boolean;
}

export default function WorkflowInterface() {
  const { data: session } = useSession();
  const { t } = useTranslation('translations');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [messages, setMessages] = useState<WorkflowMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock tenant ID for testing - in real app this would come from user context
  const tenantId = 'test-tenant';

  useEffect(() => {
    if (session?.user) {
      fetchWorkflows();
    }
  }, [session]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflow?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json() as WorkflowApiResponse;
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflow/messages?tenantId=${tenantId}&workflowId=${workflowId}`);
      if (response.ok) {
        const data = await response.json() as WorkflowApiResponse;
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const createWorkflow = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          tenantId,
          workflowType: 'review',
          participants: [session?.user?.id || ''],
          mediaIds: [],
          message: 'New workflow created',
        }),
      });

      if (response.ok) {
        const data = await response.json() as WorkflowApiResponse;
        console.log('Workflow created:', data);
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedWorkflow || !newMessage.trim()) return;

    try {
      const response = await fetch('/api/workflow/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          workflowId: selectedWorkflow.id,
          message: newMessage,
          messageType: 'text',
          mediaIds: [],
        }),
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedWorkflow.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const selectWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    fetchMessages(workflow.id);
  };

  if (!session?.user) {
    return <div>{t('workflow.pleaseSignIn')}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('workflow.title')}</h1>
        <button
          onClick={createWorkflow}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {loading ? t('workflow.creating') : t('workflow.createWorkflow')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflows List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">{t('workflow.workflows')}</h2>
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => selectWorkflow(workflow)}
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedWorkflow?.id === workflow.id ? 'bg-blue-50 border-blue-300' : ''
                }`}
              >
                <div className="font-medium">{workflow.type}</div>
                <div className="text-sm text-gray-600">{t('workflow.status')}: {workflow.status}</div>
                <div className="text-xs text-gray-500">
                  {new Date(workflow.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
            {workflows.length === 0 && (
              <div className="text-gray-500 text-center py-8">
                {t('workflow.noWorkflows')}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">
            {selectedWorkflow ? `${selectedWorkflow.type} Workflow` : t('workflow.selectWorkflow')}
          </h2>
          
          {selectedWorkflow && (
            <>
              <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <strong>{t('workflow.status')}:</strong> {selectedWorkflow.status}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>{t('workflow.participants')}:</strong> {selectedWorkflow.participants.length}
                </div>
              </div>

              {/* Messages List */}
              <div className="border rounded-lg p-4 mb-4 h-96 overflow-y-auto">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="flex flex-col">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-sm">{message.userId}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-1 p-3 bg-white border rounded-lg">
                        {message.message}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-gray-500 text-center py-8">
                      {t('workflow.noMessages')}
                    </div>
                  )}
                </div>
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t('workflow.typeMessage')}
                  className="flex-1 border rounded-lg px-3 py-2"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {t('workflow.send')}
                </button>
              </div>
            </>
          )}

          {!selectedWorkflow && (
            <div className="text-gray-500 text-center py-8">
              {t('workflow.selectWorkflowToView')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 