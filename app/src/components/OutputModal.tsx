interface Props {
  title: string;
  text: string;
  onClose: () => void;
}

export function OutputModal({ title, text, onClose }: Props) {
  return (
    <div className="modal show" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="top">
          <b>{title}</b>
          <div className="tools">
            <button onClick={() => navigator.clipboard?.writeText(text)}>コピー</button>
            <button onClick={onClose}>閉じる</button>
          </div>
        </div>
        <pre>{text}</pre>
      </div>
    </div>
  );
}
