'use client'

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

export default function Home() {
  const { t, i18n } = useTranslation('translations')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (i18n.isInitialized) {
      setIsLoading(false)
    }
  }, [i18n.isInitialized])

  const getContent = (key: string): ContentItem => {
    return t(key, { returnObjects: true }) as ContentItem;
  };

  if (isLoading) {
    return null; // or a loading spinner
  }

  const introContent = getContent('IntroContent');
  const aboutContent = getContent('AboutContent');
  const middleBlockContent = getContent('MiddleBlockContent');
  console.log('MiddleBlockContent:', middleBlockContent);
  console.log('Button data:', middleBlockContent.button);
  const missionContent = getContent('MissionContent');
  const servicesContent = getContent('ServicesContent');
  const contactContent = getContent('ContactContent');

  return (
    <>
      <Header />
      <Container>
        <ContentBlock
          direction="right"
          title={introContent.title}
          content={introContent.text}
          button={introContent.button}
          icon="/img/svg/vvg_table.svg"
          id="intro"
        />
        <ContentBlock
          direction="left"
          title={aboutContent.title}
          content={aboutContent.text}
          section={aboutContent.section}
          icon="/img/svg/vvg_library.svg"
          id="about"
        />
        <MiddleBlock
          title={middleBlockContent.title}
          content={middleBlockContent.text}
          button={middleBlockContent.button}
        />
        <ContentBlock
          direction="left"
          title={missionContent.title}
          content={missionContent.text}
          icon="/img/svg/vvg_signing.svg"
          id="mission"
        />
        <ContentBlock
          direction="right"
          title={servicesContent.title}
          content={servicesContent.text}
          icon="/img/svg/vvg_laptops.svg"
          id="services"
        />
        <ContentBlock
          direction="left"
          title={
            <a href="/contact" style={{ color: 'inherit', textDecoration: 'none' }}>
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