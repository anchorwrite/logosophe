import React, { useState, useEffect } from "react";
import { useTranslation, withTranslation } from "react-i18next";
import { useForm } from "@/common/utils/useForm";
import { Box, Button, TextField, TextArea, Flex, Card, Text } from "@radix-ui/themes";
import { useToast } from "@/components/Toast";

interface ContactFormProps {
  title: string;
  content: string;
  id: string;
}

interface IValues {
  [key: string]: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
  details?: string;
  data?: {
    message?: string;
    error?: string;
  };
}

const ContactForm: React.FC<ContactFormProps> = ({ title, content, id }) => {
  const { t, i18n } = useTranslation('translations');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { showToast } = useToast();
  
  useEffect(() => {
    const currentLang = window.location.pathname.split('/')[1] || 'en';
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [i18n]);
  
  const { values, errors, handleChange, handleSubmit } = useForm(
    {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
    {
      name: { required: true, message: t("common.forms.validation.invalidName") },
      email: {
        required: true,
        pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
        message: t("common.forms.validation.invalidEmail") },
      subject: { required: true, message: t("common.forms.validation.subjectRequired") },
      message: { required: true, message: t("common.forms.validation.messageRequired") },
    }
  );

  const onSubmit = async (values: any) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Show success message and redirect after a short delay
      setSuccess(true);
      showToast({
        title: t("common.status.success"),
        content: t("messaging.messageSent"),
        type: 'success'
      });
      setTimeout(() => {
        window.location.href = '/';
      }, 2000); // Redirect after 2 seconds
    } catch (error) {
      console.error('Error sending message:', error);
      showToast({
        title: t("common.status.error"),
        content: t("messaging.sendError"),
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    window.history.back();
  };

  return (
    <Box style={{ 
      position: 'relative',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 2rem',
      overflowX: 'auto',
      overflowY: 'hidden',
      boxSizing: 'border-box'
    }}>
      <Card id={id} style={{ 
        padding: '2rem',
        maxWidth: '700px',
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}>
        <Flex direction="column" gap="4">
          <Box style={{ 
            position: 'relative',
            maxWidth: '700px',
            padding: '0 2rem'
          }}>
            <Text size="6" style={{ marginBottom: '2.5rem', lineHeight: 1.4 }}>
              {title}
            </Text>
            <Box style={{ 
              borderRadius: '3rem',
              maxWidth: '600px',
              marginTop: '2.5rem',
            }}>
              <Text as="p" style={{ margin: 0 }}>
                {content}
              </Text>
            </Box>
          </Box>
          <Box>
            <form
              onSubmit={(e) => handleSubmit(e, onSubmit)}
              autoComplete="off"
              style={{
                width: '100%',
                maxWidth: '700px',
                margin: '0 auto'
              }}
            >
              <Flex direction="column" gap="3">
                <Box>
                  <TextField.Root>
                    <TextField.Input
                      placeholder={t("ContactFormContent.yourName")}
                      value={values.name || ""}
                      name="name"
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </TextField.Root>
                  {errors.name && (
                    <Text as="span" style={{ 
                      display: 'block',
                      fontWeight: 600,
                      color: 'rgb(255, 130, 92)',
                      height: '0.775rem',
                      padding: '0 0.675rem'
                    }}>
                      {errors.name}
                    </Text>
                  )}
                </Box>
                <Box>
                  <TextField.Root>
                    <TextField.Input
                      placeholder={t("ContactFormContent.yourEmail")}
                      value={values.email || ""}
                      name="email"
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </TextField.Root>
                  {errors.email && (
                    <Text as="span" style={{ 
                      display: 'block',
                      fontWeight: 600,
                      color: 'rgb(255, 130, 92)',
                      height: '0.775rem',
                      padding: '0 0.675rem'
                    }}>
                      {errors.email}
                    </Text>
                  )}
                </Box>
                <Box>
                  <TextField.Root>
                    <TextField.Input
                      placeholder={t("ContactFormContent.yourSubject")}
                      value={values.subject || ""}
                      name="subject"
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </TextField.Root>
                  {errors.subject && (
                    <Text as="span" style={{ 
                      display: 'block',
                      fontWeight: 600,
                      color: 'rgb(255, 130, 92)',
                      height: '0.775rem',
                      padding: '0 0.675rem'
                    }}>
                      {errors.subject}
                    </Text>
                  )}
                </Box>
                <Box>
                  <TextArea
                    placeholder={t("ContactFormContent.yourMessage")}
                    value={values.message || ""}
                    name="message"
                    onChange={handleChange}
                    style={{ minHeight: '120px' }}
                    disabled={isSubmitting}
                  />
                  {errors.message && (
                    <Text as="span" style={{ 
                      display: 'block',
                      fontWeight: 600,
                      color: 'rgb(255, 130, 92)',
                      height: '0.775rem',
                      padding: '0 0.675rem'
                    }}>
                      {errors.message}
                    </Text>
                  )}
                </Box>
                <Box style={{ 
                  textAlign: 'end',
                  position: 'relative'
                }}>
                  <Flex gap="3" justify="end">
                    <Button type="submit" size="3" disabled={isSubmitting}>
                      {isSubmitting ? t("ContactFormContent.sending") : t("ContactFormContent.send")}
                    </Button>
                    <Button 
                      type="button" 
                      size="3" 
                      variant="soft" 
                      color="gray" 
                      onClick={handleCancel}
                      disabled={isSubmitting}
                    >
                      {t("ContactFormContent.cancel")}
                    </Button>
                  </Flex>
                </Box>
                {error && (
                  <Text as="span" style={{ color: 'red' }}>
                    {error}
                  </Text>
                )}
                {success && (
                  <Text as="span" style={{ color: 'green' }}>
                    {t("Message sent successfully!")}
                  </Text>
                )}
              </Flex>
            </form>
          </Box>
        </Flex>
      </Card>
    </Box>
  );
};

export default withTranslation()(ContactForm);
