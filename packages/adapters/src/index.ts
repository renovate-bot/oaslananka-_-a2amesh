// Deprecated — use individual @a2amesh/runtime-adapter-* packages instead.
// This barrel re-exports the new standalone packages for backward compatibility.
export { BaseAdapter } from '@a2amesh/internal-adapter-base';
export { OpenAIAdapter } from '@a2amesh/internal-adapter-openai';
export { AnthropicAdapter } from '@a2amesh/internal-adapter-anthropic';
export { LangChainAdapter } from '@a2amesh/internal-adapter-langchain';
export { GoogleADKAdapter } from '@a2amesh/internal-adapter-google-adk';
export { LlamaIndexAdapter } from '@a2amesh/internal-adapter-llamaindex';
export { CrewAIAdapter } from '@a2amesh/internal-adapter-crewai';
export {
  createTextArtifact,
  extractRequiredText,
  extractText,
} from '@a2amesh/internal-adapter-base';
export type { AdapterCompatibility } from '@a2amesh/internal-adapter-base';
