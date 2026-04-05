
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './Header';
import InputForm from './InputForm';
import LeadCard from './LeadCard'; 
import { ResultsTable } from './ResultsTable'; 
import { ExclusionManager } from './ExclusionManager';
import { InclusionManager } from './InclusionManager';
import { CacheManager } from './CacheManager';
import { BackupManager } from './BackupManager';
import { DailyBriefing } from './DailyBriefing';
import { ManualAddModal } from './ManualAddModal';
import { MailTemplateManager } from './MailTemplateManager';
import { IntegrationManager } from './IntegrationManager';
import { NewsSourceManager } from './NewsSourceManager';
import { SNISettingsManager } from './SNISettingsManager';
import { ThreePLManager } from './ThreePLManager';
import { CarrierSettingsManager } from './CarrierSettingsManager'; // Ny
import { ProcessingStatusBanner } from './ProcessingStatusBanner';
import { RateLimitOverlay } from './RateLimitOverlay';
import { QuotaTimer } from './QuotaTimer';
import { OnboardingTour } from './OnboardingTour';
import { generateLeads, generateDeepDiveSequential } from '../services/openrouterService'; 
import { buildBatchAnalysisPolicyFromSourcePolicyConfig, buildDeepDiveAnalysisPolicyFromSourcePolicyConfig } from '../services/analysisPolicy';
import { Language } from '../services/i18n';
import { 
  SearchFormData, 
  LeadData, 
  NewsSourceMapping, 
  SNIPercentage, 
  ThreePLProvider, 
  RemovalReason,
  Segment,
  CarrierSettings
} from '../types';
import { db } from '../db/schema';
export { App } from '../App';
export { App as default } from '../App';
export const App: React.FC = () => {
