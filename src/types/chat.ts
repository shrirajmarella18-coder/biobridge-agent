export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export const QUICK_ACTIONS = [
  {
    label: 'Generate DPR',
    prompt:
      'Generate a Device Performance Report (DPR). The document title must clearly identify the subject and must not reuse a generic title. Include scope, methodology, acceptance criteria, results summary, observations, and conclusion.',
  },
  {
    label: 'Generate URS',
    prompt:
      'Generate a User Requirements Specification (URS). Create a specific title based on the subject of the request. Cover functional, regulatory, technical, user, and system requirements.',
  },
  {
    label: 'Generate SOP',
    prompt:
      'Generate a Standard Operating Procedure (SOP). Create a specific SOP title based on the subject of the request. Include Purpose, Scope, Responsibilities, Definitions, Materials, Procedure, Safety, Documentation, and applicable requirements.',
  },
  {
    label: 'Generate IQ',
    prompt:
      'Generate an Installation Qualification (IQ) protocol. Create a specific title based on the equipment or system being qualified. Include pre-installation checks, utility verification, component verification, acceptance criteria, deviations, and approval requirements.',
  },
  {
    label: 'Generate OQ',
    prompt:
      'Generate an Operational Qualification (OQ) protocol. Create a specific title based on the equipment or system. Include operational tests, alarm tests, controls, acceptance criteria, deviations, and conclusion.',
  },
  {
    label: 'Generate PQ',
    prompt:
      'Generate a Performance Qualification (PQ) protocol. Create a specific title based on the equipment or process. Include qualification strategy, test conditions, acceptance criteria, results, deviations, and conclusion.',
  },
  {
    label: 'Generate FAT',
    prompt:
      'Generate a Factory Acceptance Test (FAT) document. Create a specific title based on the equipment or system. Include mechanical, electrical, software/control, safety, documentation, and acceptance checks.',
  },
  {
    label: 'Generate SAT',
    prompt:
      'Generate a Site Acceptance Test (SAT) document. Create a specific title based on the equipment or system. Include installation verification, operational testing, site checks, acceptance criteria, deviations, and conclusion.',
  },
  {
    label: 'Generate Validation Protocol',
    prompt:
      'Generate a Validation Protocol. Create a specific title based on the system/process being validated. Include objective, scope, responsibilities, risk assessment, test cases, acceptance criteria, deviations, traceability, and conclusion.',
  },
  {
    label: 'Generate Risk Assessment',
    prompt:
      'Generate a Risk Assessment using an appropriate methodology such as FMEA. Create a specific title based on the process/system. Include hazards, failure modes, severity, occurrence, detection, risk ranking, mitigations, and residual risk.',
  },
  {
    label: 'Ask Documents',
    prompt:
      'Answer the user request using the uploaded reference documents as the primary source. If relevant information is missing, supplement it with current authoritative internet research.',
  },
] as const;