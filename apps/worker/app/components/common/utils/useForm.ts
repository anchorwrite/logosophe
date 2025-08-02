import { useState } from "react";

interface FormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export const useForm = (validate: (values: FormValues) => FormErrors) => {
  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues({
      ...values,
      [name]: value,
    });
    setErrors(validate({ ...values, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setIsSubmitting(true);
      try {
        const referrer = document.referrer; // Get the referring page's URL

        const response = await fetch("/api/contact", { // Updated route
          method: "POST",
          body: JSON.stringify({
            ...values,
            referrer, // Include the referrer in the request
          }),
          headers: { "Content-Type": "application/json" },
        });

        if (response.redirected) {
          window.location.href = response.url; // Follow the redirect
        } else {
          // Clear form on success
          setValues({
            name: "",
            email: "",
            subject: "",
            message: "",
          });
          alert("Message sent successfully!");
        }
      } catch (error) {
        console.error("Error sending message:", error);
        if (error instanceof Error) {
          alert(`Failed to send message: ${error.message}`);
        } else {
          alert("Failed to send message. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    isSubmitting,
  };
};