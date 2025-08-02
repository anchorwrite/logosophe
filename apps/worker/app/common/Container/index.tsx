import { Box } from "@radix-ui/themes";
import { ContainerProps } from '../types';

const Container = ({ border, children }: ContainerProps) => (
  <Box
    style={{
      position: 'relative',
      width: '100%',
      margin: '0 auto',
      overflowX: 'auto',
      overflowY: 'hidden',
      borderTop: border ? '1px solid #CDD1D4' : 'none',
      minHeight: '100vh',
      boxSizing: 'border-box' as const,
      maxWidth: '1200px'
    }}
    px={{ initial: '3', sm: '4', md: '5', lg: '6' }}
  >
    {children}
  </Box>
);

export default Container;
