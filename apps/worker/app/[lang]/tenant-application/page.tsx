"use client";

import Container from '@/common/Container'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import TenantApplicationForm from '@/components/TenantApplicationForm'
import { useTranslation } from 'react-i18next'

export default function TenantApplicationPage() {
  const { t } = useTranslation('translations')

  return (
    <>
      <Header />
      <Container>
        <TenantApplicationForm
          title={t("TenantApplicationContent.title")}
          content={t("TenantApplicationContent.content")}
          id="tenant-application"
        />
      </Container>
      <Footer />
    </>
  )
} 