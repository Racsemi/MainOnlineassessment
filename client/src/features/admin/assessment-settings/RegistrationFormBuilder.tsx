import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'radio' | 'select' | 'file';
  required: boolean;
  options?: string[]; // for radio or select
}

interface RegistrationFormBuilderProps {
  fields: FormField[];
  setFields: (fields: FormField[]) => void;
}

const RegistrationFormBuilder: React.FC<RegistrationFormBuilderProps> = ({ fields, setFields }) => {
  const addField = () => {
    const newField: FormField = {
      id: Math.random().toString(36).substr(2, 9),
      name: `field_${fields.length}`,
      label: 'New Field',
      type: 'text',
      required: false
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, key: keyof FormField, value: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const updateOptions = (id: string, optionsStr: string) => {
    const options = optionsStr.split(',').map(s => s.trim()).filter(s => s);
    setFields(fields.map(f => f.id === id ? { ...f, options } : f));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div>
          <h3 className="text-lg font-bold text-dark">Candidate Registration Form</h3>
          <p className="text-sm text-gray-500">Configure what data candidates must provide before starting.</p>
        </div>
        <button 
          onClick={addField}
          className="bg-white border border-gray-300 text-dark hover:bg-gray-50 px-4 py-2 rounded-lg font-medium text-sm flex items-center shadow-sm"
        >
          <Plus size={16} className="mr-1" /> Add Custom Field
        </button>
      </div>

      <div className="space-y-4">
        {/* Default hardcoded fields that we can't easily remove without breaking the candidate model */}
        <div className="p-4 border border-blue-200 bg-blue-50/30 rounded-xl flex items-center justify-between opacity-80 pointer-events-none">
          <div className="flex items-center space-x-4">
            <span className="font-bold text-gray-700 w-32">Full Name</span>
            <span className="text-sm px-2 py-1 bg-gray-100 rounded border border-gray-200">text</span>
          </div>
          <span className="text-sm font-bold text-gray-400 bg-white px-2 py-1 rounded">Required Core Field</span>
        </div>
        
        <div className="p-4 border border-blue-200 bg-blue-50/30 rounded-xl flex items-center justify-between opacity-80 pointer-events-none">
          <div className="flex items-center space-x-4">
            <span className="font-bold text-gray-700 w-32">Email Address</span>
            <span className="text-sm px-2 py-1 bg-gray-100 rounded border border-gray-200">email</span>
          </div>
          <span className="text-sm font-bold text-gray-400 bg-white px-2 py-1 rounded">Required Core Field</span>
        </div>

        {/* Dynamic Fields */}
        {fields.map((field) => (
          <div key={field.id} className="p-5 border border-gray-200 bg-white rounded-xl shadow-sm flex items-start gap-4">
            <div className="mt-2 text-gray-400 cursor-grab">
              <GripVertical size={20} />
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Field Label</label>
                  <input 
                    type="text" 
                    value={field.label}
                    onChange={e => updateField(field.id, 'label', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                    placeholder="e.g. College Name"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Internal Name</label>
                  <input 
                    type="text" 
                    value={field.name}
                    onChange={e => updateField(field.id, 'name', e.target.value.replace(/\s+/g, '_').toLowerCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/20 text-gray-600 font-mono text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Type</label>
                  <select 
                    value={field.type}
                    onChange={e => updateField(field.id, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 bg-white"
                  >
                    <option value="text">Text Input</option>
                    <option value="number">Number</option>
                    <option value="radio">Radio Buttons</option>
                    <option value="select">Dropdown</option>
                    <option value="file">File Upload (Resume/Doc)</option>
                  </select>
                </div>
              </div>

              {(field.type === 'radio' || field.type === 'select') && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Options (comma separated)</label>
                  <input 
                    type="text" 
                    value={field.options?.join(', ') || ''}
                    onChange={e => updateOptions(field.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                    placeholder="e.g. Male, Female, Prefer not to say"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input 
                    type="checkbox" 
                    checked={field.required}
                    onChange={e => updateField(field.id, 'required', e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Required Field</span>
                </label>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => removeField(field.id)}
              className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors mt-6"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegistrationFormBuilder;
