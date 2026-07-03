import type { FC } from 'react';

interface FabProps {
  label: string;
  onClick: () => void;
  background?: string;
}

const Fab: FC<FabProps> = ({ label, onClick, background = '#2563eb' }) => {
  return (
    <button type="button" className="fab" aria-label={label} onClick={onClick} style={{ background }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
};

export default Fab;
