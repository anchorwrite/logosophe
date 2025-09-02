"use client";

import React from "react";
import { SvgIcon } from "@/common/SvgIcon";
import { useTranslation } from "react-i18next";
import { useRouter, usePathname } from "next/navigation";
import { Box, Container, Flex, Text, Grid, Card, Select } from "@radix-ui/themes";
import { locales } from '@/translation';
import { useTheme } from "@/lib/theme-context";
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/lib/languages';

const Footer: React.FC = () => {
  const { t, i18n } = useTranslation('translations');
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage } = useTheme();

  const handleChange = (newLanguage: string) => {
    // Update the persisted language preference
    setLanguage(newLanguage as SupportedLanguageCode);
    
    // Get the current path without the language prefix
    const pathWithoutLang = pathname.split('/').slice(2).join('/');
    // Construct the new path with the selected language
    const newPath = `/${newLanguage}/${pathWithoutLang}`;
    // Change the language in i18n
    i18n.changeLanguage(newLanguage);
    // Navigate to the new path
    router.push(newPath);
  };

  // Use persisted language if available, otherwise fall back to pathname
  const currentLang = language || pathname.split('/')[1] || 'en';

  return (
    <Box style={{ 
      borderTop: '1px solid var(--gray-5)',
      backgroundColor: 'var(--color-panel-solid)',
      padding: 'var(--space-6) 0'
    }}>
      <Container size="3" style={{ 
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 var(--space-4)'
      }}>
        <Flex direction="column" gap="6">
          <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="6">
            {/* Navigation Section */}
            <Card variant="ghost">
              <Flex direction="column" gap="3">
                <Text size="3" weight="bold">
                  {i18n.isInitialized ? t("Navigation menu") : "Navigation menu"}
                </Text>
                <Flex direction="column" gap="2">
                  <a href={`/${currentLang}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Text size="2">
                      {i18n.isInitialized ? t("Home") : "Home"}
                    </Text>
                  </a>
                  <a href={`/${currentLang}#about`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Text size="2">
                      {i18n.isInitialized ? t("About") : "About"}
                    </Text>
                  </a>
                  <a href={`/${currentLang}/contact`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Text size="2">
                      {i18n.isInitialized ? t("Contact") : "Contact"}
                    </Text>
                  </a>
                </Flex>
              </Flex>
            </Card>

            {/* Social Media Section */}
            <Card variant="ghost">
              <Flex direction="column" gap="3">
                <Text size="3" weight="bold">
                  {i18n.isInitialized ? t("Connect") : "Connect"}
                </Text>
                <Flex gap="3">
                  <a href="https:/github.com/plowden" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                    <SvgIcon src="/img/svg/github.svg" width="25px" height="25px" />
                  </a>
                  <a href="https:/x.com/PhilipLowden104" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                    <SvgIcon src="/img/svg/x.svg" width="25px" height="25px" />
                  </a>
                  <a href="https:/www.linkedin.com/in/philip-lowden-672b8b1b/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                    <SvgIcon src="/img/svg/linkedin.svg" width="25px" height="25px" />
                  </a>
                </Flex>
              </Flex>
            </Card>

            {/* Language Section */}
            <Card variant="ghost">
              <Flex direction="column" gap="3">
                <Text size="3" weight="bold">
                  {i18n.isInitialized ? t("Language") : "Language"}
                </Text>
                <Select.Root value={currentLang} onValueChange={handleChange}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    {Object.values(SUPPORTED_LANGUAGES).map(lang => (
                      <Select.Item key={lang.code} value={lang.code}>
                        <Flex align="center" gap="2">
                          <SvgIcon src={lang.flag} width="20px" height="20px" />
                          <Text>{lang.nativeName}</Text>
                        </Flex>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
            </Card>
          </Grid>

          {/* Legal Section */}
          <Box style={{ 
            borderTop: '1px solid var(--gray-5)',
            paddingTop: 'var(--space-4)'
          }}>
            <Flex 
              direction={{ initial: "column", sm: "row" }} 
              justify="between" 
              align="center" 
              gap="4"
            >
              <Flex gap="4" wrap="wrap" justify="center">
                <a href={`/${currentLang}/privacy-policy`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Text size="2">
                    {i18n.isInitialized ? t("Privacy Policy") : "Privacy Policy"}
                  </Text>
                </a>
                <a href={`/${currentLang}/terms-of-service`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Text size="2">
                    {i18n.isInitialized ? t("Terms of Service") : "Terms of Service"}
                  </Text>
                </a>
              </Flex>
              <Text size="2" color="gray">
                © {new Date().getFullYear()} Logosophe. {i18n.isInitialized ? t("All rights reserved") : "All rights reserved"}
              </Text>
            </Flex>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;
