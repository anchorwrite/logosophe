import React, { useState, useEffect } from "react";
import { useTranslation, withTranslation } from "react-i18next";
import { useForm } from "@/common/utils/useForm";
import { Box, Button, TextField, TextArea, Flex, Card, Text, Switch } from "@radix-ui/themes";
import { useToast } from "@/components/Toast";

interface HandleContactFormProps {
  handleId: number;
  handleName: string;
  handleDescription?: string;
  handleEmail?: string;
  isEnabled: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
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

const HandleContactForm: React.FC<HandleContactFormProps> = ({ 
  handleId, 
  handleName, 
  handleDescription, 
  handleEmail,
  isEnabled,
  onToggleEnabled 
}) => {
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
  
  const { values, errors, handleChange, handleSubmit, resetForm } = useForm(
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
    if (!isEnabled) {
      showToast({
        title: 'Error',
        content: t("Contact form is currently disabled for this handle."),
        type: 'error'
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/handle-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          handleId,
          handleName,
          handleEmail
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Show success message
      setSuccess(true);
      showToast({
        title: t("common.status.success"),
        content: t("messaging.messageSent"),
        type: 'success'
      });
      
      // Reset form
      resetForm();
      
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
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

  if (!isEnabled) {
    return (
      <Card style={{ padding: '1.5rem', textAlign: 'center' }}>
        <Text size="3" color="gray">
          {t("Contact form is currently disabled for this handle.")}
        </Text>
        {onToggleEnabled && (
          <Box mt="3">
            <Switch 
              checked={isEnabled} 
              onCheckedChange={onToggleEnabled}
            />
            <Text size="2" color="gray" ml="2">
              {t("Enable contact form")}
            </Text>
          </Box>
        )}
      </Card>
    );
  }

  return (
    <Card style={{ padding: '1.5rem' }}>
      <Box style={{ marginBottom: '1.5rem' }}>
        <Text size="4" weight="bold" style={{ marginBottom: '0.5rem', display: 'block' }}>
          {t("Contact {{handleName}}", { handleName })}
        </Text>
        {handleDescription && (
          <Text size="2" color="gray" style={{ marginBottom: '1rem', display: 'block' }}>
            {handleDescription}
          </Text>
        )}
        {onToggleEnabled && (
          <Flex align="center" gap="2" style={{ marginBottom: '1rem' }}>
            <Switch 
              checked={isEnabled} 
              onCheckedChange={onToggleEnabled}
            />
            <Text size="2" color="gray">
              {t("Contact form enabled")}
            </Text>
          </Flex>
        )}
      </Box>

      {success ? (
        <Box style={{ textAlign: 'center', padding: '2rem' }}>
          <Text size="4" color="green" weight="bold">
            {t("Message Sent Successfully!")}
          </Text>
          <Text size="2" color="gray" style={{ marginTop: '0.5rem', display: 'block' }}>
            {t("Thank you for your message. We'll get back to you soon.")}
          </Text>
        </Box>
      ) : (
        <form onSubmit={(e) => handleSubmit(e, onSubmit)}>
          <Flex direction="column" gap="3">
            <TextField.Root>
              <TextField.Input
                placeholder={t("Your Name")}
                name="name"
                value={values.name}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </TextField.Root>
            {errors.name && (
              <Text size="1" color="red">
                {errors.name}
              </Text>
            )}

            <TextField.Root>
              <TextField.Input
                placeholder={t("Your Email")}
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </TextField.Root>
            {errors.email && (
              <Text size="1" color="red">
                {errors.email}
              </Text>
            )}

            <TextField.Root>
              <TextField.Input
                placeholder={t("Subject")}
                name="subject"
                value={values.subject}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </TextField.Root>
            {errors.subject && (
              <Text size="1" color="red">
                {errors.subject}
              </Text>
            )}

            <TextArea
              placeholder={t("Your Message")}
              name="message"
              value={values.message}
              onChange={handleChange}
              disabled={isSubmitting}
              style={{ minHeight: '120px' }}
            />
            {errors.message && (
              <Text size="1" color="red">
                {errors.message}
              </Text>
            )}

            <Button 
              type="submit" 
              disabled={isSubmitting}
              style={{ marginTop: '1rem' }}
            >
              {isSubmitting ? t("Sending...") : t("Send Message")}
            </Button>

            {error && (
              <Text size="2" color="red" style={{ textAlign: 'center' }}>
                {error}
              </Text>
            )}
          </Flex>
        </form>
      )}
    </Card>
  );
};

export default HandleContactForm;
