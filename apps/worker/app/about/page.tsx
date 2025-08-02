"use client";

import Container from "@/common/Container";
import ContentBlock from "@/components/ContentBlock";
import { useTranslation } from 'react-i18next'

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

export default function AboutPage() {
  const { t } = useTranslation('translations')

  const getContent = (key: string): ContentItem => {
    return t(key, { returnObjects: true }) as ContentItem;
  };

  const aboutContent = getContent('AboutContent');

  return (
    <Container>
      <ContentBlock
        direction="left"
        title={aboutContent.title}
        content={aboutContent.text}
        section={aboutContent.section}
        icon="/img/svg/star.svg"
        id="about"
      />
    </Container>
  );
} 