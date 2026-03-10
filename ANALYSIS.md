# OPENCLAW ACCOUNT & MODEL CONFIGURATION ANALYSIS

## 1. CURRENT ACCOUNT SYSTEM

### Account Structure
- **Location**: src/routing/account-id.ts, src/routing/account-lookup.ts, src/routing/resolve-route.ts
- **Default Account**: "default" (DEFAULT_ACCOUNT_ID constant)
- **Account ID Format**: 
  - Case-insensitive alphanumeric with hyphens/underscores (a-z0-9_-)
  - Max 64 characters
  - Invalid chars auto-converted to hyphens
  - Examples: "default", "prod-account", "customer_1"

### Account Configuration in Bindings
**Location**: src/config/types.agents.ts (lines 42-54)
**AgentBinding structure**:
\\\	ypescript
type AgentBinding = {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;  // ← ACCOUNT FIELD
    peer?: { kind: ChatType; id: string };
    guildId?: string;
    teamId?: string;
    roles?: string[];
  };
};
\\\

### How Accounts Work Currently
- Agents are routed to sessions based on **channel + accountId + peer**
- Accounts are primarily used in **routing/binding logic**, not configuration
- **No multi-account support** in the traditional sense:
  - One agent can handle multiple accounts (via bindings with different accountIds)
  - But each account always routes to the same agent
  - Accounts are **not separately configured** - they're just routing labels

### Account Usage Flow
1. **resolve-route.ts**: matchesAccountId() checks if binding matches the incoming accountId
2. **Session key includes accountId**: Maintains separate session state per account
3. **No account-specific configuration**: Models/auth/skills are per-agent, not per-account

---

## 2. CURRENT MODEL CONFIGURATION

### Model Structure Per Agent
**Location**: src/config/types.agents-shared.ts (lines 1-14)

\\\	ypescript
type AgentModelConfig = 
  | string                                    // "anthropic/claude-opus-4.6"
  | {
      primary?: string;                       // Main model
      fallbacks?: string[];                   // Fallback models on failure
    };
\\\

### Model Configuration Hierarchy
1. **Agent-level model** (per agent in agents.list[].model)
   - Can be: single string OR {primary, fallbacks}
   
2. **Default agent model** (agents.defaults.model)
   - Fallback if agent has no model defined
   - Also supports {primary, fallbacks} format

3. **Model Provider Configuration**
   **Location**: src/config/types.models.ts (lines 50-73)
   \\\	ypescript
   type ModelsConfig = {
     mode?: "merge" | "replace";
     providers?: Record<string, ModelProviderConfig>;
     bedrockDiscovery?: BedrockDiscoveryConfig;
   };
   
   type ModelProviderConfig = {
     baseUrl: string;
     apiKey?: SecretInput;
     auth?: "api-key" | "aws-sdk" | "oauth" | "token";
     api?: ModelApi;
     models: ModelDefinitionConfig[];
   };
   \\\

### Supported Model APIs
- openai-completions, openai-responses
- anthropic-messages
- google-generative-ai
- github-copilot
- bedrock-converse-stream
- ollama

### Current Multi-Model Support
✅ **Per-agent model with fallbacks**: Agents can have fallbacks array
✅ **Model aliases**: Provider aliases like "anthropic/claude-opus-4.6"
❌ **Per-account models**: No mechanism for account-specific model selection
❌ **Per-channel models**: No mechanism for channel-specific model selection
❌ **Model switching within session**: Session can override model (model-overrides.ts) but no auto-switching

---

## 3. MODEL SELECTION LOGIC

### Model Selection Flow
**Primary Location**: src/agents/pi-embedded-runner/run.ts (line 56: resolveModel())

**Flow**:
1. \esolveModel(provider, modelId, agentDir, cfg)\ - MAIN ENTRY
   - Queries model registry (pi-model-discovery.ts)
   - Checks inline config (cfg.models.providers)
   - Falls back to forward-compat models
   - Special handling for OpenRouter (pass-through proxy)

2. **Agent Model Resolution** (src/agents/agent-scope.ts)
   - \esolveAgentEffectiveModelPrimary()\ - Gets agent's model or defaults
   - \esolveAgentModelFallbacksOverride()\ - Gets fallback list

3. **Model Override Resolution** (src/auto-reply/reply/model-selection.ts)
   - \createModelSelectionState()\ - Creates state with model catalog
   - Checks session-stored overrides (users can override via directive)
   - Checks heartbeat.model (scheduled tasks can specify model)
   - Respects agent allowlist (agents.defaults.models whitelist)

### Model Selection Priority
1. **Session override** (user changed model with /model directive)
2. **Heartbeat override** (scheduled task specified model)
3. **Agent explicit model** (agent's model config)
4. **Default agent model** (agents.defaults.model)
5. **DEFAULT_MODEL** ("anthropic/claude-opus-4.6")

### Model Fallback Logic
**Location**: src/agents/model-fallback.ts
- When API call fails, tries next fallback
- Classifies failure reason (auth, billing, rate limit, etc.)
- Can skip profiles in cooldown

---

## 4. MODEL PROVIDER & AUTH INTEGRATION

### Auth Profile System
**Location**: src/agents/auth-profiles/ directory

**Features**:
- Multiple auth profiles per provider (e.g., multiple Anthropic API keys)
- Profile rotation on failure (cooldown system)
- OAuth support (for GitHub Copilot, Qwen, etc.)
- API key rotation tracking

**Profile Selection**:
\\\	ypescript
// src/agents/model-auth.ts
async function resolveApiKeyForProvider(params: {
  provider: string;
  cfg?: OpenClawConfig;
  profileId?: string;           // Explicit profile
  preferredProfile?: string;    // Preferred (falls back to order)
  store?: AuthProfileStore;
}): Promise<ResolvedProviderAuth>
\\\

### How Auth Works
1. **Query auth profiles for provider**
2. **Apply cooldown/failure tracking**
3. **Rotate to next profile if current failed**
4. **Source resolution**: env var → profile → config apiKey → fallback

---

## 5. KEY FILES & LOCATIONS

| Purpose | Files | Key Exports |
|---------|-------|-------------|
| **Account Routing** | src/routing/account-id.ts, resolve-route.ts | normalizeAccountId(), resolveAgentRoute() |
| **Agent Configuration** | src/agents/agent-scope.ts | resolveAgentConfig(), resolveAgentEffectiveModelPrimary() |
| **Model Resolution** | src/agents/pi-embedded-runner/model.ts | resolveModel() |
| **Model Selection** | src/agents/model-selection.ts, auto-reply/reply/model-selection.ts | resolveModelDirectiveSelection(), createModelSelectionState() |
| **Model Fallback** | src/agents/model-fallback.ts | resolveModelFallback() |
| **Auth Profiles** | src/agents/auth-profiles/, model-auth.ts | resolveApiKeyForProvider(), ensureAuthProfileStore() |
| **Config Schemas** | src/config/zod-schema.*.ts | AgentsSchema, AgentModelSchema, ModelsConfig |
| **Config Types** | src/config/types.agents.ts, types.models.ts | AgentConfig, AgentBinding, ModelsConfig |
| **Session Overrides** | src/sessions/model-overrides.ts | applyModelOverrideToSessionEntry() |

---

## 6. WHAT ALREADY EXISTS

✅ **Multi-agent support**: Multiple agents in agents.list[]
✅ **Per-agent models**: Each agent can have different model
✅ **Model fallbacks**: primary + fallbacks array per agent
✅ **Model providers**: Multiple providers (Anthropic, OpenAI, Google, etc.)
✅ **Auth profiles**: Multiple API keys per provider with rotation
✅ **Session model overrides**: Users can override model via /model directive
✅ **Model allowlisting**: agents.defaults.models{} for allowlist per agent
✅ **Heartbeat model override**: Scheduled tasks can specify model
✅ **Account routing**: Agents route differently by accountId
✅ **Agent bindings**: Per-channel, per-account, per-peer routing

❌ **Account-specific model config**: No way to set different models per account
❌ **Auto-switching models**: No logic to switch between models based on cost/performance
❌ **Multi-tenant isolation**: Accounts share agent configuration
❌ **Model per account**: Can't say "account A uses claude, account B uses gpt-4"

---

## 7. IMPLEMENTATION GAPS FOR MULTI-ACCOUNT, MULTI-MODEL

### Gap 1: No Account-Level Model Configuration
**Currently**: Models live at agent level or global default level
**Needed**: Add account-specific model override, e.g.:
\\\	ypescript
// In agents config
accounts?: {
  [accountId: string]: {
    model?: AgentModelConfig;
    allowedModels?: string[];
    authProfile?: string;
  };
};
\\\

### Gap 2: No Auto-Switching Logic
**Currently**: Fixed model selection (session override → heartbeat → agent → default)
**Needed**: Auto-switching middleware that:
- Analyzes cost vs. performance
- Switches to cheaper model for simple tasks
- Switches to powerful model for complex tasks
- Respects model allowlists

### Gap 3: Account Isolation
**Currently**: accountId only affects routing/session keys, not configuration
**Needed**: Account-specific secrets, auth profiles, model allowlists

### Gap 4: Model Capability Matching
**Currently**: Manual model selection, no auto-matching based on task requirements
**Needed**: Model capability detection (multimodal, vision, reasoning, etc.)

---

## 8. CODE LOCATIONS FOR EXTENSION

To add these features, modify/extend:

1. **types.agents-shared.ts** - Add account-level config structure
2. **zod-schema.agents.ts** - Add account schema validation
3. **agent-scope.ts** - Add resolveAccountConfig() function
4. **model-selection.ts** - Add logic to check account override before agent
5. **resolve-route.ts** - Already passes accountId, can use for model lookup
6. **pi-embedded-runner/run.ts** - Integrate account model selection
7. **auto-reply/reply/model-selection.ts** - Add account context to selection state
8. **New file**: src/agents/account-models.ts - Account model resolution logic
9. **New file**: src/agents/model-auto-switching.ts - Smart model selection

---

## SUMMARY

**Current State**:
- ✅ Multi-agent system with per-agent models
- ✅ Account-based routing for session isolation  
- ✅ Model fallbacks and provider rotation
- ❌ No account-specific model configuration
- ❌ No auto-switching between models

**To Implement**:
1. Add account-level model config to types + schemas
2. Extend agent-scope.ts with account resolution
3. Update model selection flow to check account override
4. Implement cost/performance based auto-switching
5. Add account-specific auth profile assignment

