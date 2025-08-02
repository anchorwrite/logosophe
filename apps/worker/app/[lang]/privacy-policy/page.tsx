"use client";

export const runtime = 'edge';

import Container from '@/common/Container'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Box, Card, Heading, Text, Flex, Button } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import Script from 'next/script'

export default function PrivacyPolicyPage() {
  const { t } = useTranslation('translations')
  const [formattedDate, setFormattedDate] = useState('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setFormattedDate(new Date().toLocaleDateString())
  }, [])

  if (!isClient) {
    return (
      <Flex direction="column">
        <Flex justify="center" align="center">
          <Text size="3">Loading...</Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <>
      <Script
        id="privacy-policy-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https:/schema.org',
            '@type': 'WebPage',
            name: 'Privacy Policy',
            description: 'Logosophe Privacy Policy',
            datePublished: formattedDate,
            dateModified: formattedDate,
            publisher: {
              '@type': 'Organization',
              name: 'Logosophe',
              url: 'https:/www.logosophe.com'
            }
          })
        }}
      />
      <Header />
      <Container>
        <Box p="6" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Flex justify="between" align="center" mb="4">
            <Heading size="6" as="h1">{t('Privacy Policy')}</Heading>
            <Flex gap="2">
              <Button 
                variant="soft" 
                onClick={() => window.print()}
                aria-label="Print privacy policy"
              >
                {t('Print')}
              </Button>
              <Button 
                variant="soft"
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    const content = document.querySelector('.policy-content')?.innerHTML;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Privacy Policy - Logosophe</title>
                          <meta name="description" content="Logosophe Privacy Policy">
                          <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 2rem; }
                            h1 { font-size: 24px; margin-bottom: 1rem; }
                            h2 { font-size: 20px; margin: 1.5rem 0 1rem; }
                            p { margin-bottom: 1rem; }
                            ul { margin-bottom: 1rem; padding-left: 2rem; }
                            li { margin-bottom: 0.5rem; }
                          </style>
                        </head>
                        <body>
                          ${content}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                    }, 250);
                  }
                }}
                aria-label="Download privacy policy"
              >
                {t('Download')}
              </Button>
              <Button 
                variant="soft"
                asChild
              >
                <a 
                  href={`mailto:?subject=${encodeURIComponent('Privacy Policy - Logosophe')}&body=${encodeURIComponent('Please find attached the Privacy Policy document.')}`}
                  aria-label="Email privacy policy"
                >
                  {t('Email')}
                </a>
              </Button>
            </Flex>
          </Flex>
          
          <article className="policy-content">
            <Text as="p" size="3" mb="4">
              {t('PrivacyPolicyContent.lastUpdated')} {formattedDate}
            </Text>

            <Text as="p" size="3" mb="4">
              {t('PrivacyPolicyContent.intro')}
            </Text>

            <section>
              <Heading size="4" mb="3" as="h2">{t('PrivacyPolicyContent.informationWeCollect')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('PrivacyPolicyContent.informationWeCollectIntro')}
              </Text>
              <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                {(t('PrivacyPolicyContent.informationWeCollectList', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('PrivacyPolicyContent.howWeUse')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('PrivacyPolicyContent.howWeUseIntro')}
              </Text>
              <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                {(t('PrivacyPolicyContent.howWeUseList', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('PrivacyPolicyContent.dataSecurity')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('PrivacyPolicyContent.dataSecurityText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('PrivacyPolicyContent.yourRights')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('PrivacyPolicyContent.yourRightsIntro')}
              </Text>
              <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                {(t('PrivacyPolicyContent.yourRightsList', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('PrivacyPolicyContent.contactUs')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('PrivacyPolicyContent.contactUsText')}
              </Text>
              <Text as="p" size="3">
                {t('PrivacyPolicyContent.contactEmail')}
              </Text>
            </section>
          </article>
        </Box>
      </Container>
      <Footer />
    </>
  )
} 