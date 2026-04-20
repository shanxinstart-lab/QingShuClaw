import React from 'react';

import { getFileTypeInfo } from '.';

interface FileTypeIconProps {
  fileName: string;
  className?: string;
}

const FileTypeIcon: React.FC<FileTypeIconProps> = ({ fileName, className }) => {
  const { icon: Icon, color } = getFileTypeInfo(fileName);
  return (
    <span style={{ color }}>
      <Icon className={className} />
    </span>
  );
};

export default FileTypeIcon;
