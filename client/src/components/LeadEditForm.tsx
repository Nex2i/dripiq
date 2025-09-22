import React, { useState } from 'react'
import {
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react'
import type { UpdateLeadData } from '../services/leads.service'

interface LeadEditFormProps {
  editForm: UpdateLeadData
  setEditForm: React.Dispatch<React.SetStateAction<UpdateLeadData>>
  validationErrors: Record<string, string>
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  addArrayItem: (field: keyof UpdateLeadData, value: string) => void
  removeArrayItem: (field: keyof UpdateLeadData, index: number) => void
  updateArrayItem: (field: keyof UpdateLeadData, index: number, value: string) => void
}

// Array Field Editor Component
const ArrayFieldEditor: React.FC<{
  label: string
  items: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, value: string) => void
  placeholder: string
}> = ({ label, items, onAdd, onRemove, onUpdate, placeholder }) => {
  const [newItem, setNewItem] = useState('')

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim())
      setNewItem('')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={item}
              onChange={(e) => onUpdate(index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-2 text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="p-2 text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Color Array Field Editor Component
const ColorArrayFieldEditor: React.FC<{
  label: string
  items: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, value: string) => void
  error?: string
}> = ({ label, items, onAdd, onRemove, onUpdate, error }) => {
  const [newColor, setNewColor] = useState('#000000')

  const handleAdd = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      onAdd(newColor)
      setNewColor('#000000')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="space-y-2">
        {items.map((color, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div
              className="w-8 h-8 rounded border border-gray-300"
              style={{ backgroundColor: color }}
            />
            <input
              type="text"
              value={color}
              onChange={(e) => onUpdate(index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              pattern="^#[0-9A-Fa-f]{6}$"
              placeholder="#000000"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => onUpdate(index, e.target.value)}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-2 text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center space-x-2">
          <div
            className="w-8 h-8 rounded border border-gray-300"
            style={{ backgroundColor: newColor }}
          />
          <input
            type="text"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            pattern="^#[0-9A-Fa-f]{6}$"
            placeholder="#000000"
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="p-2 text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <p className="text-red-600 text-sm mt-1">{error}</p>
        )}
      </div>
    </div>
  )
}

const LeadEditForm: React.FC<LeadEditFormProps> = ({
  editForm,
  setEditForm,
  validationErrors,
  onSave,
  onCancel,
  isSaving,
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
}) => {
  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    })
  }

  // Shared button components for reuse
  const SaveButton = () => (
    <button
      onClick={() => {
        onSave()
        // Scroll to top after save action is initiated
        setTimeout(scrollToTop, 100)
      }}
      disabled={isSaving}
      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Save className={`h-4 w-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  )

  const CancelButton = () => (
    <button
      onClick={() => {
        onCancel()
        // Scroll to top after cancel action is initiated
        setTimeout(scrollToTop, 100)
      }}
      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
    >
      <X className="h-4 w-4 mr-2" />
      Cancel
    </button>
  )

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Lead</h1>
        {/* Top Action Buttons */}
        <div className="flex items-center space-x-3">
          <CancelButton />
          <SaveButton />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={editForm.name || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] ${
                validationErrors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Lead name"
            />
            {validationErrors.name && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL *
            </label>
            <input
              type="url"
              value={editForm.url || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] ${
                validationErrors.url ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://example.com"
            />
            {validationErrors.url && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.url}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={editForm.status || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Market
            </label>
            <input
              type="text"
              value={editForm.targetMarket || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, targetMarket: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              placeholder="Target market"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary
            </label>
            <textarea
              value={editForm.summary || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, summary: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              placeholder="Lead summary"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tone
            </label>
            <input
              type="text"
              value={editForm.tone || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, tone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              placeholder="Company tone"
            />
          </div>

          {/* Array Fields */}
          <div className="lg:col-span-2">
            <ArrayFieldEditor
              label="Products"
              items={editForm.products || []}
              onAdd={(value) => addArrayItem('products', value)}
              onRemove={(index) => removeArrayItem('products', index)}
              onUpdate={(index, value) => updateArrayItem('products', index, value)}
              placeholder="Add product"
            />
          </div>

          <div className="lg:col-span-2">
            <ArrayFieldEditor
              label="Services"
              items={editForm.services || []}
              onAdd={(value) => addArrayItem('services', value)}
              onRemove={(index) => removeArrayItem('services', index)}
              onUpdate={(index, value) => updateArrayItem('services', index, value)}
              placeholder="Add service"
            />
          </div>

          <div className="lg:col-span-2">
            <ArrayFieldEditor
              label="Differentiators"
              items={editForm.differentiators || []}
              onAdd={(value) => addArrayItem('differentiators', value)}
              onRemove={(index) => removeArrayItem('differentiators', index)}
              onUpdate={(index, value) => updateArrayItem('differentiators', index, value)}
              placeholder="Add differentiator"
            />
          </div>

          <div className="lg:col-span-2">
            <ColorArrayFieldEditor
              label="Brand Colors"
              items={editForm.brandColors || []}
              onAdd={(value) => addArrayItem('brandColors', value)}
              onRemove={(index) => removeArrayItem('brandColors', index)}
              onUpdate={(index, value) => updateArrayItem('brandColors', index, value)}
              error={validationErrors.brandColors}
            />
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
          <CancelButton />
          <SaveButton />
        </div>
      </div>
    </div>
  )
}

export default LeadEditForm