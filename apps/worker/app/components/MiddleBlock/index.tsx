import { withTranslation } from "react-i18next";
import { Button } from "@/common/Button";
import { Flex, Box, Heading, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";

interface ButtonItem {
  title: string;
  color?: string;
}

interface MiddleBlockProps {
  title: string;
  content: string;
  button?: ButtonItem[] | string;
  id?: string;
}

const MiddleBlock = ({ title, content, button, id }: MiddleBlockProps) => {
  const router = useRouter();

  const handleButtonClick = (item: ButtonItem) => {
    if (item.title.includes("Tenant")) {
      router.push('/tenant-application');
    } else {
      const currentLang = window.location.pathname.split('/')[1] || 'en';
      router.push(`/${currentLang}/harbor`);
    }
  };

  return (
    <Box 
      id={id}
      style={{
        position: 'relative',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center'
      }}
      py={{ initial: '6', md: '8' }}
    >
      <Flex justify="center" align="center">
        <Box style={{ maxWidth: '570px' }} className="w-full md:max-w-[570px]">
          <Box>
            <Flex direction="column" gap="4" align="center">
              <Heading size="6">{title}</Heading>
              <Text size="3" align="center" style={{ padding: '2.5rem 0 0.75rem' }}>{content}</Text>
              <Flex gap="2" justify="center">
                {button &&
                  (Array.isArray(button) ? (
                    button.map((item: ButtonItem, index: number) => (
                      <Button
                        key={index}
                        color={item.color}
                        onClick={() => handleButtonClick(item)}
                      >
                        {item.title}
                      </Button>
                    ))
                  ) : (
                                          <Button onClick={() => {
                      const currentLang = window.location.pathname.split('/')[1] || 'en';
                      router.push(`/${currentLang}/harbor`);
                    }}>
                      {button}
                    </Button>
                  ))}
              </Flex>
            </Flex>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
};

export default withTranslation('translations')(MiddleBlock);
