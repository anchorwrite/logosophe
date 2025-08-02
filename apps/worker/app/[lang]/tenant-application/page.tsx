"use client";

export const runtime = 'edge';

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
          title={t("Tenant Application")}
          content={t("Please fill out this form to apply for tenant access. We'll review your application and get back to you soon.")}
          id="tenant-application"
        />
      </Container>
      <Footer />
    </>
  )
} 