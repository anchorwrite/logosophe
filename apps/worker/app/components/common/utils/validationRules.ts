export const validate = (values: { [key: string]: string }) => {
  const errors: { [key: string]: string } = {};

  if (!values.name) {
    errors.name = "Name is required";
  }

  if (!values.email) {
    errors.email = "Email is required";
  } else if (!/\S+@\S+\.\S+/.test(values.email)) {
    errors.email = "Email is invalid";
  }

  if (!values.subject) {
    errors.subject = "Subject is required";
  }

  if (!values.message) {
    errors.message = "Message is required";
  }

  return errors;
}; 