export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export const QUICK_ACTIONS = [
  { label: 'Generate DPR', prompt: 'Generate a Device Performance Report (DPR) for a new analytical instrument qualification, including scope, methodology, acceptance criteria, and results summary.' },
  { label: 'Generate URS', prompt: 'Generate a User Requirements Specification (URS) for a laboratory information management system (LIMS), covering functional, regulatory, and technical requirements.' },
  { label: 'Generate SOP', prompt: 'Generate a Standard Operating Procedure (SOP) for equipment calibration and preventive maintenance in a GMP pharmaceutical manufacturing facility.' },
  { label: 'Generate IQ', prompt: 'Generate an Installation Qualification (IQ) protocol for a new bioreactor system, including pre-installation checks, utility verification, and component verification.' },
  { label: 'Generate OQ', prompt: 'Generate an Operational Qualification (OQ) protocol for a cleanroom HVAC system, including alarm tests, airflow verification, and control logic testing.' },
  { label: 'Generate PQ', prompt: 'Generate a Performance Qualification (PQ) protocol for a tablet press, including batch consistency testing, weight variation, and hardness testing acceptance criteria.' },
  { label: 'Generate FAT', prompt: 'Generate a Factory Acceptance Test (FAT) plan for a filling line, covering mechanical, electrical, and control system verification at the vendor site.' },
  { label: 'Generate SAT', prompt: 'Generate a Site Acceptance Test (SAT) protocol for a lyophilizer installation, covering installation verification, operational testing, and performance confirmation.' },
  { label: 'Generate Validation Protocol', prompt: 'Generate a validation protocol for a computerized system used in pharmaceutical batch release, including risk assessment, test cases, and traceability matrix.' },
  { label: 'Generate Risk Assessment', prompt: 'Generate a risk assessment for a new aseptic processing line using FMEA methodology, covering failure modes, severity, detection, and recommended mitigations.' },
  { label: 'Ask Documents', prompt: 'Based on my uploaded documents, summarize the key regulatory and quality requirements relevant to my current project.' },
] as const;
