// Quality floors shared by the agent loop (which enforces them) and the prompt (which tells the model up front).
// The playbook asks for 10 to 25 sources for a company, person or place, and fewer for a single word or event.
// These are lower bounds on sources actually FETCHED and cited, deliberately below the playbook's targets.

export const SOURCE_MINIMUMS = { company: 8, brand: 8, organisation: 8, organization: 8, person: 8, place: 8, product: 8, event: 6, history: 6, idea: 6, word: 4, etymology: 4 };
export const DEFAULT_MIN_SOURCES = 6;
// How many times a too-thin draft is bounced back for more research before it is accepted with a warning instead
// (a subject with little to read must not loop forever).
export const MAX_THIN_RETRIES = 2;

export const minSourcesFor = (kind) => SOURCE_MINIMUMS[String(kind || "").toLowerCase()] ?? DEFAULT_MIN_SOURCES;
