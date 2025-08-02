"use client";

import { useEffect, useRef, Suspense, useState } from "react";
import ContentBlock from '@/components/ContentBlock';
import ContactForm from "@/components/ContactForm";
import { useTranslation } from 'react-i18next';
import { Box, Theme } from '@radix-ui/themes';
import Container from '@/common/Container'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface ContentItem {
  title: string;
  text: string;
}

function ContactPageContent() {
  const { t, i18n } = useTranslation('translations');
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (i18n.isInitialized) {
      setIsLoading(false);
    }
  }, [i18n.isInitialized]);

  const getContent = (key: string): ContentItem => {
    return t(key, { returnObjects: true }) as ContentItem;
  };

  const contactContent = getContent('ContactContent');
  const contactFormContent = getContent('ContactFormContent');

  useEffect(() => {
    // Scroll to the content block when the page loads
    contentRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Header />
      <Container>
        <Box p="6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <ContentBlock
            direction="left"
            title={contactContent.title}
            content={contactContent.text}
            icon="/img/svg/vvg_reader.svg"
            id="contact"
          />
          <ContactForm
            title={contactFormContent.title}
            content={contactFormContent.text}
            id="contact"
          />
        </Box>
      </Container>
      <Footer />
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContactPageContent />
    </Suspense>
  );
}