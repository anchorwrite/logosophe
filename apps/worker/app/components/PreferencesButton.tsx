'use client';

import React, { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { Settings } from 'lucide-react';
import { PreferencesModal } from './PreferencesModal';

export function PreferencesButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="ghost" 
        onClick={() => setIsOpen(true)}
        style={{ padding: '0.5rem' }}
      >
        <Settings size={16} />
      </Button>
      
      <PreferencesModal 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </>
  );
} 