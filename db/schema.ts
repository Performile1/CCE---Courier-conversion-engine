import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { LeadData } from '../types';

/**
 * InvenioDatabase definierar det lokala IndexedDB-schemat.
 * Vi använder Dexie som en wrapper för att hantera objektlagringen.
 */
export class InvenioDatabase extends Dexie {
  leads!: Table<LeadData>;
  exclusions!: Table<{ id?: number; orgNumber: string; companyName: string; type: 'customer' | 'history' }>;
  tplProviders!: Table<{ id: string; name: string; address: string }>;

  constructor() {
    super('InvenioLeadsV45');
    
    // Definiera tabeller och index. 
    // Vi indexerar fält som ofta används för filtrering och sökning.
    // Cast to any to handle type recognition issues with Dexie methods in the current build context.
    (this as any).version(1).stores({
      leads: 'id, companyName, orgNumber, segment, analysisDate',
      exclusions: '++id, orgNumber, companyName, type',
      tplProviders: 'id, name, address'
    });
  }
}

// Exportera en singleton-instans av databasen
export const db = new InvenioDatabase();