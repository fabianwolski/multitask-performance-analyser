// Configuration constants
const CONFIG = {
  SUPABASE_URL: "%%SUPABASE_URL%%",
  SUPABASE_KEY: "%%SUPABASE_KEY%%",

  KEYS: {
    SPACEBAR: " ",
    ARROW_LEFT: "ArrowLeft",
    ARROW_RIGHT: "ArrowRight",
  },

  // Application states
  STATES: {
    LOADING: "loading",
    ERROR: "error",
    INSTRUCTIONS: "instructions",
    TRIAL: "trial",
  },

  // Group configurations
  GROUPS: {
    1: {
      name: "Control Group",
      hasAudio: false,
    },
    2: {
      name: "Single Audio Group",
      hasAudio: true,
      audioCount: 1,
    },
    3: {
      name: "Dual Audio Group",
      hasAudio: true,
      audioCount: 2,
    },
  },
  SPACEBAR: " ",
  ARROW_LEFT: "ArrowLeft",

  // Application states
  STATES: {
    LOADING: "loading",
    ERROR: "error",
    INSTRUCTIONS: "instructions",
    TRIAL: "trial",
  },

  // Group configurations
  GROUPS: {
    1: { maxInstructions: 3 },
    2: { maxInstructions: 4 },
    3: { maxInstructions: 4 },
  },
};
