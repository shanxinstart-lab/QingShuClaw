import React, { useRef } from 'react';

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  className?: string;
  overlayClassName?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  className,
  overlayClassName,
  onClick,
  children,
}) => {
  const mouseDownOnBackdropRef = useRef(false);

  if (isOpen === false) return null;

  return (
    <div
      className={overlayClassName ?? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50'}
      onMouseDown={(e) => {
        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdropRef.current) {
          mouseDownOnBackdropRef.current = false;
          onClose();
        }
      }}
    >
      <div
        className={className}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
