import { withTranslation } from "react-i18next";
import { TextArea as RadixTextArea, Box } from "@radix-ui/themes";
import * as Label from "@radix-ui/react-label";
import { InputProps } from '../types';

const TextArea = ({ name, placeholder, onChange, t }: InputProps & { t: (key: string) => string }) => (
  <Box>
    <RadixTextArea
      id={name}
      name={name}
      placeholder={placeholder}
      onChange={onChange}
      style={{
        width: "100%",
        minHeight: "100px",
        padding: "0.75rem",
        borderRadius: "4px",
        border: "1px solid #CDD1D4",
        fontSize: "1rem",
        lineHeight: "1.5",
        resize: "vertical"
      }}
    />
  </Box>
);

export default withTranslation('translations')(TextArea);
