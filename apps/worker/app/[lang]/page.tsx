"use client";

import ContentBlock from '@/components/ContentBlock'
import MiddleBlock from '@/components/MiddleBlock'
import Container from '@/common/Container'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

interface ButtonItem {
  title: string;
  color?: string;
}

interface ContentItem {
  title: string;
  text: string;
  button?: ButtonItem[];
  section?: {
    title: string;
    content: string;
    icon: string;
  }[];
}

export default function Home({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { t, i18n } = useTranslation('translations')
  const [isLoading, setIsLoading] = useState(true)
  const [lang, setLang] = useState<string>('')

  useEffect(() => {
    const initLang = async () => {
      const { lang } = await params;
      setLang(lang);
      if (i18n.isInitialized) {
        setIsLoading(false);
      }
    };
    initLang();
  }, [params, i18n.isInitialized]);

  const getContent = (key: string): ContentItem => {
    return t(key, { returnObjects: true }) as ContentItem;
  };

  if (isLoading) {
    return null; // or a loading spinner
  }

  const readersContent = getContent('ReadersContent');
  const creatorsContent = getContent('CreatorsContent');
  const middleBlockContent = getContent('MiddleBlockContent');
  const contactContent = getContent('ContactContent');

  return (
    <>
      <Header />
      <Container>
        <ContentBlock
          direction="right"
          title={readersContent.title}
          content={readersContent.text}
          button={readersContent.button}
          icon="/img/svg/vvg_library.svg"
          id="readers"
        />
        <MiddleBlock
          title={middleBlockContent.title}
          content={middleBlockContent.text}
          button={middleBlockContent.button}
          id="join"
        />
        <ContentBlock
          direction="left"
          title={creatorsContent.title}
          content={creatorsContent.text}
          section={creatorsContent.section}
          button={creatorsContent.button}
          icon="/img/svg/vvg_table.svg"
          id="creators"
        />
        <ContentBlock
          direction="left"
          title={
            <a href={`/${lang}/contact`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {contactContent.title}
            </a>
          }
          content={contactContent.text}
          icon="/img/svg/vvg_signing.svg"
          id="contact"
        />
      </Container>
      <Footer />
    </>
  )
} 