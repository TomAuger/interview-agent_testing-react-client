import { Modal } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import styles from './ArtifactModal.module.css';

interface ArtifactModalProps {
  opened: boolean;
  onClose: () => void;
  markdown: string;
}

export function ArtifactModal({ opened, onClose, markdown }: ArtifactModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Interview artifact"
      size={800}
      centered
      classNames={{ content: styles.content }}
    >
      <div className={styles.markdown}>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </Modal>
  );
}
