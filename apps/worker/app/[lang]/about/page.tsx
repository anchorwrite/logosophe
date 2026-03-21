"use client";

import { useEffect, useRef, Suspense, useState } from "react";
import ContentBlock from '@/components/ContentBlock';
import { useTranslation } from 'react-i18next';
import { Box } from '@radix-ui/themes';
import Container from '@/common/Container'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface SectionItem {
  title: string;
  content: string;
  icon: string;
}

interface ContentItem {
  title: string;
  text: string;
  section?: SectionItem[];
}

function AboutPageContent() {
  const { t, i18n } = useTranslation('translations');
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (i18n.isInitialized) {
      setIsLoading(false);
    }
  }, [i18n.isInitialized]);

  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (isLoading) {
    return null;
  }

  const aboutContent = t('AboutContent', { returnObjects: true }) as ContentItem;

  return (
    <>
      <Header />
      <Container>
        <Box p="6" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div ref={contentRef}>
            <ContentBlock
              direction="left"
              title={aboutContent.title}
              content={aboutContent.text}
              section={aboutContent.section}
              icon="/img/svg/star.svg"
              id="about"
            />
          </div>
        </Box>
      </Container>
      <Footer />
    </>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AboutPageContent />
    </Suspense>
  );
}
