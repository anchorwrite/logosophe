import React from 'react'
import { Button as RadixButton } from '@radix-ui/themes'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost'
  size?: '1' | '2' | '3' | '4'
  color?: 'gray' | 'blue' | 'green' | 'red' | 'purple' | 'orange'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'solid',
  size = '3',
  color = 'blue',
  ...props
}) => {
  return (
    <RadixButton variant={variant} size={size} color={color} {...props}>
      {children}
    </RadixButton>
  )
} 