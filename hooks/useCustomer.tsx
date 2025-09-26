// hooks/useCustomer.tsx
import React, { createContext, useContext, ReactNode, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useLocalization } from '@/constants/localization';
// Remove the import: import { useChat } from './useChat';

interface Category {
  _id: Id<'categories'>;
  name: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  photo_url: string;
  requires_photos: boolean;
  requires_work_code: boolean;
  level: number;
  parent_id?: Id<'categories'>;
}

interface CustomerContextType {
  // Categories state
  categories: Category[];
  isLoadingCategories: boolean;
  hasErrorCategories: boolean;
  
  // User state
  userId: Id<'users'> | null;
  setUserId: (id: Id<'users'> | null) => void;
  
  // Category utilities
  getCategoryById: (categoryId: string) => Category | undefined;
  
  // Expose userId for chat functions to use
  // Remove the chat function from here
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocalization();
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  // Remove this line: const { startChatForCategory: chatStartChat } = useChat();
  
  // Type guard to ensure locale is valid
  const validLanguage = (locale === 'en' || locale === 'fr' || locale === 'ar') ? locale : 'en';
  
  // Categories data with language parameter
  const categories = useQuery(api.categories.getCategories, { 
    language: validLanguage 
  });
  
  // Category utilities
  const getCategoryById = (categoryId: string) => {
    return categories?.find(cat => cat._id === categoryId);
  };
  
  const value: CustomerContextType = {
    // Categories state
    categories: categories || [],
    isLoadingCategories: categories === undefined,
    hasErrorCategories: categories === null,
    
    // User state
    userId,
    setUserId,
    
    // Category utilities
    getCategoryById,
  };

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
}