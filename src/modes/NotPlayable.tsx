export function NotPlayable({ setId, message }: { setId: string; message: string }) {
  return (
    <div className="mode empty">
      <p>{message}</p>
      <a className="btn" href={`#/set/${setId}`}>
        Back to set
      </a>
    </div>
  )
}
