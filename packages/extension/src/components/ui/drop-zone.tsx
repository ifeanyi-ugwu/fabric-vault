import { useRef, useState, type DragEvent, type ChangeEvent } from "react"

interface DropZoneProps {
  accept?: string
  fileName?: string | null
  onChange: (file: File) => void
  placeholder?: string
}

export function DropZone({
  accept,
  fileName,
  onChange,
  placeholder = "Drop file here or click to browse"
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onChange(file)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onChange(file)
  }

  return (
    <div
      className={`drop-zone ${isDragging ? "dragging" : ""} ${fileName ? "has-file" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
      <span className="drop-zone-icon" />
      <span className="drop-zone-text">
        {fileName ? fileName : placeholder}
      </span>
    </div>
  )
}
