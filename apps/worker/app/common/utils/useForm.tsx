import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";

// Interface defining the structure of form values
interface IValues {
  [key: string]: string;
}

// Interface defining the structure of form errors
interface IErrors {
  [key: string]: string;
}

// Interface defining the structure of form touched fields
interface ITouched {
  [key: string]: boolean;
}

// Interface defining the structure of form validation rules
interface IValidationRules {
  [key: string]: {
    required?: boolean;
    pattern?: RegExp;
    message?: string;
  };
}

// Custom hook for form handling
export const useForm = (initialValues: IValues, validationRules: IValidationRules) => {
  const { t } = useTranslation('translations');
  const [values, setValues] = useState<IValues>(initialValues);
  const [errors, setErrors] = useState<IErrors>({});
  const [touched, setTouched] = useState<ITouched>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to validate a single field
  const validateField = (name: string, value: string): string => {
    const rules = validationRules[name];
    if (!rules) return "";

    if (rules.required && !value.trim()) {
      return rules.message || `${name} is required`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return rules.message || `${name} is invalid`;
    }

    return "";
  };

  // Function to validate all fields
  const validateForm = (): boolean => {
    const newErrors: IErrors = {};
    let isValid = true;

    Object.keys(values).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Function to handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  // Function to handle input blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Function to handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>, onSubmit: (values: IValues) => Promise<void>) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (validateForm()) {
      try {
        await onSubmit(values);
      } catch (error) {
        // Error handling is now done in the component
        throw error;
      }
    } else {
      const errorMessages = Object.values(errors).filter(Boolean);
      throw new Error(errorMessages.length > 0 ? errorMessages[0] : t('Please fix the errors in the form'));
    }

    setIsSubmitting(false);
  };

  // Function to reset form
  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  };
};
