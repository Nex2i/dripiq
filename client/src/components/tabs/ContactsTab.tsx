import React from 'react'
import { Users, User, Crown, Mail, Phone, Building, ExternalLink } from 'lucide-react'
import CopyButton from '../CopyButton'
import type { LeadPointOfContact } from '../../services/leads.service'

interface ContactsTabProps {
  contacts: LeadPointOfContact[]
  primaryContactId?: string
}

const ContactsTab: React.FC<ContactsTabProps> = ({ contacts, primaryContactId }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Point of Contacts
          </h2>
        </div>

        {!contacts || contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg">No contacts associated with this lead.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {contact.name}
                    </h3>
                    <CopyButton text={contact.name} label="name" className="ml-2" />
                    {primaryContactId === contact.id && (
                      <div className="ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Crown className="h-3 w-3 mr-1" />
                        Primary
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                        >
                          {contact.email}
                        </a>
                      </div>
                    </div>
                    <CopyButton text={contact.email} label="email" />
                  </div>

                  {contact.phone && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Phone</p>
                          <a
                            href={`tel:${contact.phone}`}
                            className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                          >
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                      <CopyButton text={contact.phone} label="phone" />
                    </div>
                  )}

                  {contact.title && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Title</p>
                        <p className="text-base text-gray-700">{contact.title}</p>
                      </div>
                    </div>
                  )}

                  {contact.company && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Building className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Company</p>
                        <p className="text-base text-gray-700">{contact.company}</p>
                      </div>
                    </div>
                  )}

                  {contact.sourceUrl && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <ExternalLink className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Source</p>
                          <a
                            href={contact.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors underline"
                          >
                            View source page
                          </a>
                        </div>
                      </div>
                      <CopyButton text={contact.sourceUrl} label="source URL" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactsTab