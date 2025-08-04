"use client";

import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { SvgIcon } from "@/common/SvgIcon";
import { useTranslation, withTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flex, Box, Button, Text, Container } from "@radix-ui/themes";
import * as Dialog from "@radix-ui/react-dialog";
import { PreferencesButton } from '@/components/PreferencesButton';
import { useSession } from "next-auth/react";

const Header: React.FC = () => {
  const { t, i18n } = useTranslation('translations');
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (i18n.isInitialized) {
      setIsLoading(false);
    }
  }, [i18n.isInitialized]);

  const handleNavigation = (id: string) => {
    const currentLang = window.location.pathname.split('/')[1] || 'en';
    if (currentPath === '/') {
      // If we're on the main page, use scroll behavior
      scrollTo(id);
    } else {
      // If we're on another page, navigate to main page with hash
      router.push(`/${currentLang}/#${id}`);
    }
    setIsOpen(false);
  };

  const menuItems = [
    {
      key: "readers",
      label: t("For Readers"),
      onClick: () => handleNavigation("readers"),
    },
    {
      key: "creators",
      label: t("For Creators"),
      onClick: () => handleNavigation("creators"),
    },
    {
      key: "join",
      label: t("Join Us"),
      onClick: () => handleNavigation("join"),
    },
    {
      key: "dashboard",
      label: session?.user ? "Harbor" : t("Sign In"),
      onClick: () => {
        if (session?.user) {
          router.push("/harbor");
        } else {
          router.push("/dashboard");
        }
      },
    },
    {
      key: "contact",
      label: t("Contact"),
      onClick: () => {
        const currentLang = window.location.pathname.split('/')[1] || 'en';
        router.push(`/${currentLang}/contact`);
      },
    },
  ];

  const scrollTo = (id: string) => {
    const element = document.getElementById(id) as HTMLDivElement;
    if (element) {
      const headerOffset = 100; // Adjust this value based on your header height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      
      // Set focus to the element
      element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
    }
    setIsOpen(false);
  };

  if (isLoading) {
    return null; // or a loading spinner
  }

  return (
    <Box style={{ 
      borderBottom: '1px solid var(--gray-5)',
      backgroundColor: 'var(--color-panel-solid)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <Container size="3" style={{ 
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--space-4)'
      }}>
        <Flex justify="between" align="center" style={{ width: '100%' }}>
          <Box>
            <Button 
              variant="ghost" 
              onClick={() => router.push('/')} 
              style={{ padding: 0 }}
            >
              <SvgIcon src="/img/svg/logo.svg" width="101px" height="64px" />
            </Button>
          </Box>
          
          {/* Desktop Navigation */}
          <Box style={{ display: isMobile ? 'none' : 'block' }}>
            <Flex gap="4" align="center">
              {menuItems.map((item) => (
                <Button
                  key={item.key}
                  variant="ghost"
                  onClick={item.onClick}
                  style={{ fontSize: '18px', fontWeight: 500 }}
                >
                  {item.label}
                </Button>
              ))}
              <PreferencesButton />
            </Flex>
          </Box>

          {/* Mobile Navigation */}
          <Box style={{ display: isMobile ? 'block' : 'none' }}>
            <Button variant="ghost" onClick={() => setIsOpen(true)}>
              <Menu size={24} />
            </Button>
            <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
              <Dialog.Portal>
                <Dialog.Overlay 
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 1000
                  }}
                />
                <Dialog.Content 
                  style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '150px',
                    backgroundColor: 'white',
                    padding: 'var(--space-4)',
                    boxShadow: 'var(--shadow-1)',
                    zIndex: 1001,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Flex direction="column" gap="4">
                    <Flex justify="between" align="center">
                      <Dialog.Title style={{ 
                        fontSize: 'var(--font-size-4)',
                        fontWeight: 'var(--font-weight-6)',
                        color: 'var(--gray-12)'
                      }}>
                        {t("Menu")}
                      </Dialog.Title>
                      <Button variant="ghost" onClick={() => setIsOpen(false)}>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http:/www.w3.org/2000/svg">
                          <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                        </svg>
                      </Button>
                    </Flex>
                    <Dialog.Description style={{ display: 'none' }}>
                      {t("Navigation menu")}
                    </Dialog.Description>
                    <Flex direction="column" gap="2">
                      {menuItems.map((item) => (
                        <Button
                          key={item.key}
                          variant="ghost"
                          onClick={item.onClick}
                          style={{ 
                            width: '100%',
                            justifyContent: 'flex-start',
                            padding: 'var(--space-2)',
                            fontSize: 'var(--font-size-3)',
                            fontWeight: 'var(--font-weight-5)',
                            color: 'var(--gray-12)'
                          }}
                        >
                          {item.label}
                        </Button>
                      ))}
                      <PreferencesButton />
                    </Flex>
                  </Flex>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
};

export default withTranslation('translations')(Header);
