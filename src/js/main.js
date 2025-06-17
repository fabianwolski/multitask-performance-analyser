// Updated main application controller (unchanged from original)
class ExperimentApp {
  constructor() {
    this.supabaseService = new SupabaseService();
    this.instructionsManager = new InstructionsManager();
    this.trialManager = new TrialManager();
    this.currentState = CONFIG.STATES.LOADING;
    this.userData = null;

    // Make app globally accessible for UUID access
    window.experimentApp = this;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      await this.validateAndLoadUser();
      this.startInstructions();
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Validate UUID and load user data
   */
  async validateAndLoadUser() {
    // Extract UUID from URL
    const uuid = this.supabaseService.getUUIDFromURL();

    if (!uuid) {
      throw new Error("Invalid access key format");
    }

    // Fetch user session data
    const userData = await this.supabaseService.getUserSession(uuid);

    if (!userData) {
      throw new Error("Access denied - session not found");
    }

    // Validate group assignment
    if (!userData.assigned_group || !CONFIG.GROUPS[userData.assigned_group]) {
      throw new Error("Invalid group assignment");
    }

    this.userData = userData;
    console.log("User loaded:", {
      uuid: uuid,
      group: userData.assigned_group,
    });
  }

  /**
   * Start the instructions phase
   */
  startInstructions() {
    this.currentState = CONFIG.STATES.INSTRUCTIONS;

    // Setup instructions completion handler
    this.instructionsManager.onInstructionsComplete = () => {
      this.onInstructionsComplete();
    };

    // Initialize instructions for user's group
    this.instructionsManager.init(this.userData.assigned_group);
  }

  /**
   * Handle instructions completion
   */
  onInstructionsComplete() {
    console.log("Instructions completed, starting practice trial");
    this.currentState = CONFIG.STATES.TRIAL;

    // Start practice trial
    this.trialManager.init(this.userData.assigned_group, true); // true = practice
  }

  /**
   * Handle application errors
   */
  handleError(error) {
    this.currentState = CONFIG.STATES.ERROR;
    console.error("Application error:", error);

    let errorMessage = "An unexpected error occurred";

    if (error.message.includes("Invalid access key")) {
      errorMessage = "Invalid access key";
    } else if (error.message.includes("Access denied")) {
      errorMessage = "Access denied";
    } else if (error.message.includes("Invalid group")) {
      errorMessage = "Configuration error - please contact administrator";
    } else if (
      error.message.includes("network") ||
      error.message.includes("fetch")
    ) {
      errorMessage = "Network error - please check your connection";
    }

    document.getElementById("app").innerHTML = `
      <div class="app-content">
        <div class="error">
          <h1>Error</h1>
          <p>${errorMessage}</p>
        </div>
      </div>
    `;
  }

  /**
   * Get current application state
   */
  getState() {
    return {
      currentState: this.currentState,
      userData: this.userData,
      instructionStep: this.instructionsManager.getStepInfo(),
    };
  }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const app = new ExperimentApp();

  // Make app globally accessible for debugging
  window.experimentApp = app;

  // Start the application
  app.init();
});

// Global error handler
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
