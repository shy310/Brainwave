import React, { useRef, useState } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Attachment, Translations } from '../types';

interface Props {
  onAttach: (files: Attachment[]) => void;
  translations: Translations;
}

const FileUpload: React.FC<Props> = ({ onAttach, translations }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        
        // Simple Base64 conversion
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix, keep raw base64
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(file);
        });

        newAttachments.push({
          name: file.name,
          mimeType: file.type,
          data: base64
        });
      }

      setAttachments(prev => {
        const updated = [...prev, ...newAttachments];
        onAttach(updated);
        return updated;
      });
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    onAttach(updated);
  };

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-xs">
              {att.mimeType.startsWith('image') ? <ImageIcon size={12} /> : <FileText size={12} />}
              <span className="max-w-[100px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(idx)} className="hover:text-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="p-2 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
        title={translations.upload}
      >
        <Paperclip size={20} />
      </button>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,application/pdf" 
        multiple 
      />
    </div>
  );
};

export default FileUpload;