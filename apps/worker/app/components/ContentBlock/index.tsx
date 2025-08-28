"use client";

import { withTranslation } from "react-i18next";
import { SvgIcon } from "@/common/SvgIcon";
import { Button } from "@/common/Button";
import { ContentBlockProps } from "./types";
import { Flex, Box, Heading, Text, Card } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/styles/animations.css";

const ContentBlock = ({
  icon,
  title,
  content,
  button,
  section,
  id,
  direction,
}: ContentBlockProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
      }
    );

    if (blockRef.current) {
      observer.observe(blockRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id) as HTMLDivElement;
    element.scrollIntoView({
      behavior: "smooth",
    });
  };

  const handleButtonClick = (item: any) => {
    if (item.title === "Browse Content") {
      router.push('/content');
    } else if (item.title === "Browse Subscriber Pages") {
      const currentLang = window.location.pathname.split('/')[1] || 'en';
      router.push(`/${currentLang}/pages`);
    } else if (item.title === "Browse Authors") {
      const currentLang = window.location.pathname.split('/')[1] || 'en';
      router.push(`/${currentLang}/pages`);
    } else if (item.title.includes("Tenant")) {
      router.push('/tenant-application');
    } else if (item.title.includes("Subscriber")) {
      const currentLang = window.location.pathname.split('/')[1] || 'en';
      router.push(`/${currentLang}/harbor`);
    } else {
      scrollTo("about");
    }
  };

  const renderButton = () => {
    if (Array.isArray(button)) {
      return button.map((item, index) => (
        <Button
          key={index}
          color={item.color}
          onClick={() => handleButtonClick(item)}
        >
          {item.title}
        </Button>
      ));
    }
    return null;
  };

  const renderSection = () => {
    if (Array.isArray(section)) {
      return section.map((item, index) => (
        <Flex key={index} gap="3" align="start" style={{ marginBottom: '1rem' }}>
          {item.icon && (
            <Box style={{ flexShrink: 0 }}>
              <SvgIcon src={item.icon} width="32px" height="32px" />
            </Box>
          )}
          <Box>
            <Heading size="4" style={{ marginBottom: '0.5rem' }}>{item.title}</Heading>
            <Text size="2">{item.content}</Text>
          </Box>
        </Flex>
      ));
    }
    return null;
  };

  const getAnimationClass = () => {
    if (!isVisible) return '';
    return direction === "left" ? "animate-slide-in-left" : "animate-slide-in-right";
  };

  return (
    <Card 
      ref={blockRef}
      style={{ 
        padding: '2rem',
        marginBottom: '2rem',
        backgroundColor: 'var(--color-panel-solid)',
        opacity: isVisible ? 1 : 0
      }}
      className={getAnimationClass()}
      id={id}
    >
      <Flex
        direction={direction === "left" ? "row" : "row-reverse"}
        align="center"
        justify="between"
        gap="6"
      >
        <Box style={{ flex: 1 }} className={isVisible ? "animate-fade-in animate-delay-100" : ""}>
          <SvgIcon src={icon} width="100%" height="100%" />
        </Box>
        <Box style={{ flex: 1 }} className={isVisible ? "animate-fade-in animate-delay-200" : ""}>
          <Flex direction="column" gap="4">
            <Heading size="6">{title}</Heading>
            <Text size="3">{content}</Text>
            <Flex gap="2" className={isVisible ? "animate-fade-in animate-delay-300" : ""}>
              {renderButton()}
            </Flex>
            {renderSection()}
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
};

export default withTranslation('translations')(ContentBlock);
