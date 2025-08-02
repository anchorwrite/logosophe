import { Button as RadixButton } from "@radix-ui/themes";
import { ButtonProps } from '../types';

export const Button = ({ color, children, onClick }: ButtonProps) => (
  <RadixButton 
    variant="solid" 
    color={color === "#fff" ? "gray" : "blue"}
    onClick={onClick}
    style={{
      backgroundColor: color,
      color: color === "#fff" ? "#2E186A" : "#fff",
      fontSize: "1rem",
      fontWeight: 700,
      width: "100%",
      maxWidth: "240px",
      transition: "all 0.3s ease-in-out",
      boxShadow: "0 16px 30px rgb(23 31 114 / 20%)",
      cursor: "pointer",
      border: "1px solid #edf3f5",
      borderRadius: "4px",
      padding: "13px 0",
      marginTop: "0.625rem"
    }}
    className="hover:bg-[rgb(255,130,92)] hover:text-white hover:border-[rgb(255,130,92)]"
  >
    {children}
  </RadixButton>
);
