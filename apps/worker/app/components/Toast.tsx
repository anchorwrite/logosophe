'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Box, Flex, Text, Button } from '@radix-ui/themes';
import { Cross2Icon, CheckIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  title?: string;
  content?: string;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProps {
  type: ToastType;
  title: string;
  content: string;
  onClose: () => void;
  duration: number;
}

function Toast({ type, title, content, onClose, duration }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckIcon width="16" height="16" />;
      case 'error':
        return <ExclamationTriangleIcon width="16" height="16" />;
      case 'warning':
        return <ExclamationTriangleIcon width="16" height="16" />;
      case 'info':
        return <InfoCircledIcon width="16" height="16" />;
      default:
        return null;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      case 'warning':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Box
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        minWidth: '300px',
        maxWidth: '400px',
        backgroundColor: 'var(--color-panel-solid)',
        border: `1px solid var(--${getColor()}-6)`,
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)',
        padding: 'var(--space-3)',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <Flex justify="between" align="start" gap="3">
        <Flex gap="2" style={{ flex: 1 }}>
          <Box style={{ color: `var(--${getColor()}-9)`, marginTop: '2px' }}>
            {getIcon()}
          </Box>
          <Flex direction="column" gap="1" style={{ flex: 1 }}>
            <Text size="2" weight="medium" color={getColor()}>
              {title}
            </Text>
            {content && (
              <Text size="2" color="gray">
                {content}
              </Text>
            )}
          </Flex>
        </Flex>
        <Button
          variant="ghost"
          size="1"
          onClick={onClose}
          style={{ padding: '4px', minWidth: 'auto' }}
        >
          <Cross2Icon width="12" height="12" />
        </Button>
      </Flex>
    </Box>
  );
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastTitle, setToastTitle] = useState<string>('');
  const [toastContent, setToastContent] = useState('');
  const [toastDuration, setToastDuration] = useState(5000);

  const showToast = useCallback((options: ToastOptions) => {
    // Set all state values first
    setToastType(options.type || 'success');
    setToastTitle(options.title || options.type || 'success');
    setToastContent(options.content || '');
    setToastDuration(options.duration || 5000);
    
    // Then show the toast
    setToastOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setToastOpen(false);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastOpen && (
        <Toast
          type={toastType}
          title={toastTitle}
          content={toastContent}
          onClose={handleClose}
          duration={toastDuration}
        />
      )}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}; 