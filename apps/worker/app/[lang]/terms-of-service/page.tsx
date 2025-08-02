"use client";

export const runtime = 'edge';

import Container from '@/common/Container'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Box, Card, Heading, Text, Flex, Button } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import Script from 'next/script'

export default function TermsOfServicePage() {
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
        id="terms-of-service-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https:/schema.org',
            '@type': 'WebPage',
            name: 'Terms of Service',
            description: 'Logosophe Terms of Service',
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
            <Heading size="6" as="h1">{t('Terms of Service')}</Heading>
            <Flex gap="2">
              <Button 
                variant="soft" 
                onClick={() => window.print()}
                aria-label="Print terms of service"
              >
                {t('Print')}
              </Button>
              <Button 
                variant="soft"
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    const content = document.querySelector('.terms-content')?.innerHTML;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Terms of Service - Logosophe</title>
                          <meta name="description" content="Logosophe Terms of Service">
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
                aria-label="Download terms of service"
              >
                {t('Download')}
              </Button>
              <Button 
                variant="soft"
                asChild
              >
                <a 
                  href={`mailto:?subject=${encodeURIComponent('Terms of Service - Logosophe')}&body=${encodeURIComponent('Please find attached the Terms of Service document.')}`}
                  aria-label="Email terms of service"
                >
                  {t('Email')}
                </a>
              </Button>
            </Flex>
          </Flex>
          
          <article className="terms-content">
            <Text as="p" size="3" mb="4">
              {t('TermsOfServiceContent.lastUpdated')} {formattedDate}
            </Text>

            <Text as="p" size="3" mb="4">
              {t('TermsOfServiceContent.intro')}
            </Text>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.acceptance')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.acceptanceText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.useOfService')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.useOfServiceText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.userAccounts')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.userAccountsText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.contentOwnership')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.contentOwnershipText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.prohibitedActivities')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.prohibitedActivitiesIntro')}
              </Text>
              <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                {(t('TermsOfServiceContent.prohibitedActivitiesList', { returnObjects: true }) as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.termination')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.terminationText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.changesToTerms')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.changesToTermsText')}
              </Text>
            </section>

            <section>
              <Heading size="4" mb="3" as="h2">{t('TermsOfServiceContent.contactInformation')}</Heading>
              <Text as="p" size="3" mb="4">
                {t('TermsOfServiceContent.contactInformationText')}
              </Text>
              <Text as="p" size="3">
                {t('TermsOfServiceContent.contactEmail')}
              </Text>
            </section>
          </article>
        </Box>
      </Container>
      <Footer />
    </>
  )
} 