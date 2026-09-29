import React, { useRef } from 'react'
import clsx from 'clsx'
import Icon from '../Icon/Icon'
import styles from './Button.css'

type ButtonElementType = 'button' | 'span'

type ButtonBaseProps = {
  children?: React.ReactNode
  className?: string
  icon?: React.ComponentProps<typeof Icon>['icon']
  size?: number
  variant?: 'primary' | 'danger' | 'default' | 'yellow'
  /** The design's big full-width key: 18px (14px on a default key). */
  cta?: boolean
  as?: ButtonElementType
}

// Create separate props types for button and span
type ButtonSpecificProps = ButtonBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>
type SpanSpecificProps = ButtonBaseProps & React.HTMLAttributes<HTMLSpanElement>

// Union type for props
type ButtonProps<E extends ButtonElementType = 'button'> = E extends 'button' ? ButtonSpecificProps : SpanSpecificProps

const Button = <E extends ButtonElementType = 'button'>({
  className,
  children,
  icon,
  onClick,
  size,
  variant,
  cta,
  as,
  ...rest
}: ButtonProps<E>) => {
  const elementRef = useRef<HTMLButtonElement | HTMLSpanElement>(null)
  const ElementType = as || 'button' as E

  const buttonType = ElementType === 'button'
    ? (rest as React.ButtonHTMLAttributes<HTMLButtonElement>).type || 'button'
    : undefined

  const commonProps = {
    onClick: onClick as React.MouseEventHandler<HTMLElement>,
    className: clsx(styles.container, styles[variant], cta && styles.cta, className),
    ...rest,
  }

  if (ElementType === 'button') {
    return (
      <button
        {...commonProps as React.ButtonHTMLAttributes<HTMLButtonElement>}
        ref={elementRef as React.RefObject<HTMLButtonElement>}
        type={buttonType}
      >
        {icon && <Icon icon={icon} size={size} />}
        {children}
      </button>
    )
  }

  return (
    <span
      {...commonProps as React.HTMLAttributes<HTMLSpanElement>}
      ref={elementRef as React.RefObject<HTMLSpanElement>}
    >
      {icon && <Icon icon={icon} size={size} />}
      {children}
    </span>
  )
}

export default Button
