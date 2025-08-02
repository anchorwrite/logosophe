import { Box } from '@radix-ui/themes'

export default function Container({ children }: { children: React.ReactNode }) {
  return (
    <Box style={{ 
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 var(--space-4)'
    }}>
      {children}
    </Box>
  )
} 