// Instructions management
class InstructionsManager {
  constructor() {
    this.currentStep = 0;
    this.userGroup = null;
    this.keyHandler = null;
    this.showingConfirmation = false;
    this.audioPlaying = false; // Track if any audio is currently playing

    // Define all instruction texts
    this.instructions = {
      // Common instructions for all groups
      common: [
        {
          title: "Welcome Participant",
          text: "You have been assigned group {GROUP}.",
        },
        {
          title: "Experiment Overview",
          text: "During this experiment you will see a series of numbers (between 1 and 9) appear on the screen. The numbers will appear one at a time and will be separated by a screen with a cross.",
        },
        {
          title: "Important Instructions",
          text: "You must press the spacebar every time you see a new number.<br>You should NOT press the spacebar every time you see a 3.",
        },
      ],

      // Group-specific instructions
      group2: {
        title: "Additional Instructions",
        text: "Additionally, you must press the LEFT arrow key (←) every time you hear this audio sound.",
        hasAudio: true,
        audioExamples: [
          { label: "Audio Sound", file: "/sound1.mp3", key: "←" },
        ],
      },

      group3: {
        title: "Additional Instructions",
        text: "Additionally, you must press the LEFT arrow key (←) every time you hear the first audio sound, and you must press the RIGHT arrow key (→) every time you hear the second audio sound.",
        hasAudio: true,
        audioExamples: [
          { label: "First Audio Sound", file: "/sound1.mp3", key: "←" },
          { label: "Second Audio Sound", file: "/sound2.mp3", key: "→" },
        ],
      },

      // Final instruction for all groups
      final: {
        title: "Begin Practice",
        text: "Once you are sure you understand the instructions, please press the spacebar to begin the practice trial.",
      },
    };
  }

  /**
   * Initialize instructions for a specific group
   * @param {number} group - User's assigned group
   */
  init(group) {
    this.userGroup = group;
    this.currentStep = 0;
    this.showingConfirmation = false;
    this.audioPlaying = false; // Reset audio state
    this.setupKeyboardHandlers();
    this.render();
  }

  /**
   * Setup keyboard event handlers
   */
  setupKeyboardHandlers() {
    // Remove existing handler if any
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
    }

    this.keyHandler = (event) => {
      // Don't handle keys if confirmation dialog is showing or audio is playing
      if (this.showingConfirmation || this.audioPlaying) return;

      event.preventDefault();

      if (event.key === CONFIG.KEYS.SPACEBAR) {
        this.nextStep();
      } else if (event.key === CONFIG.KEYS.ARROW_LEFT) {
        // Play first audio example (or only audio for group 2)
        this.playAudioExample(0);
      } else if (event.key === CONFIG.KEYS.ARROW_RIGHT) {
        // Play second audio example (group 3 only)
        this.playAudioExample(1);
      }
      // Note: Removed arrow key back navigation - only using visual back button
    };

    document.addEventListener("keydown", this.keyHandler);
  }

  /**
   * Move to next instruction step
   */
  nextStep() {
    const maxSteps = this.getMaxSteps();

    if (this.currentStep < maxSteps - 1) {
      this.currentStep++;
      this.render();
    } else {
      // Show confirmation before starting trial
      this.showConfirmation();
    }
  }

  /**
   * Move to previous instruction step
   */
  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.render();
    }
  }

  /**
   * Get maximum number of steps for current group
   * @returns {number} Maximum steps
   */
  getMaxSteps() {
    let steps = this.instructions.common.length; // Common instructions

    // Add group-specific instruction if applicable
    if (this.userGroup === 2 || this.userGroup === 3) {
      steps += 1;
    }

    steps += 1; // Final instruction
    return steps;
  }

  /**
   * Get current instruction content
   * @returns {Object} Instruction object with title and text
   */
  getCurrentInstruction() {
    const commonSteps = this.instructions.common.length;

    if (this.currentStep < commonSteps) {
      // Common instructions
      const instruction = { ...this.instructions.common[this.currentStep] };
      instruction.text = instruction.text.replace("{GROUP}", this.userGroup);
      return instruction;
    } else if (
      this.currentStep === commonSteps &&
      (this.userGroup === 2 || this.userGroup === 3)
    ) {
      // Group-specific instruction
      return this.instructions[`group${this.userGroup}`];
    } else {
      // Final instruction
      return this.instructions.final;
    }
  }

  /**
   * Show confirmation dialog
   */
  showConfirmation() {
    this.showingConfirmation = true;

    const overlay = document.createElement("div");
    overlay.className = "confirmation-overlay";
    overlay.innerHTML = `
            <div class="confirmation-dialog">
                <h3>Ready to Begin?</h3>
                <p>Are you sure you understand all the instructions and are ready to start the practice trial?</p>
                <div class="confirmation-buttons">
                    <button class="btn btn-secondary" onclick="this.closest('.confirmation-overlay').remove(); window.instructionsManager.showingConfirmation = false;">Review Instructions</button>
                    <button class="btn btn-primary" onclick="this.closest('.confirmation-overlay').remove(); window.instructionsManager.confirmStart();">Start Practice Trial</button>
                </div>
            </div>
        `;

    document.body.appendChild(overlay);

    // Make instance globally accessible for the onclick handlers
    window.instructionsManager = this;
  }

  /**
   * Confirm start of trial
   */
  confirmStart() {
    this.showingConfirmation = false;
    this.cleanup();
    this.onInstructionsComplete();
  }

  /**
   * Create audio example HTML
   * @param {Array} audioExamples - Array of audio example objects
   * @returns {string} HTML for audio examples
   */
  createAudioExamplesHTML(audioExamples) {
    if (!audioExamples || audioExamples.length === 0) {
      return "";
    }

    const examplesHTML = audioExamples
      .map(
        (example, index) => `
            <div class="audio-example">
                <h4>${example.label}</h4>
                <div class="audio-controls">
                    <button class="play-button" onclick="window.instructionsManager.playAudioExample(${index})">
                        Play Sound
                    </button>
                    <span style="font-size: 0.85rem; color: #64748b; font-weight: 500;">
                        Press '${example.key}' when you hear this sound
                    </span>
                </div>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px;">
                    Click button or press '${example.key}' to play
                </div>
            </div>
        `
      )
      .join("");

    return `
            <div class="audio-examples">
                <h3 style="margin-bottom: 16px; color: #374151; font-size: 1rem; font-weight: 600;">Audio Examples:</h3>
                ${examplesHTML}
            </div>
        `;
  }

  /**
   * Play audio example using HTML5 Audio API
   * @param {number} index - Index of audio example to play
   */
  playAudioExample(index) {
    // Don't play if audio is already playing
    if (this.audioPlaying) return;

    const instruction = this.getCurrentInstruction();
    if (!instruction.audioExamples || !instruction.audioExamples[index]) return;

    const example = instruction.audioExamples[index];
    console.log(`Playing audio: ${example.file}`);

    // Set audio playing state
    this.audioPlaying = true;

    // Disable all play buttons and show states
    const buttons = document.querySelectorAll(".play-button");
    buttons.forEach((button, i) => {
      if (i === index) {
        button.innerHTML = "Playing...";
      } else {
        button.innerHTML = "Wait...";
      }
      button.disabled = true;
    });

    // Create and play audio
    const audio = new Audio(example.file);

    // Handle successful audio playback
    audio.addEventListener("ended", () => {
      this.resetAudioButtons();
    });

    // Handle audio errors
    audio.addEventListener("error", (e) => {
      console.error("Audio playback error:", e);
      this.resetAudioButtons();

      // Show error in button
      if (buttons[index]) {
        buttons[index].innerHTML = "Error - Try Again";
        setTimeout(() => {
          buttons[index].innerHTML = "Play Sound";
        }, 2000);
      }
    });

    // Handle successful load and play
    audio.addEventListener("canplaythrough", () => {
      audio.play().catch((e) => {
        console.error("Audio play failed:", e);
        this.resetAudioButtons();

        if (buttons[index]) {
          buttons[index].innerHTML = "Click to Play";
          setTimeout(() => {
            buttons[index].innerHTML = "Play Sound";
          }, 2000);
        }
      });
    });

    // Set a fallback timeout in case audio events don't fire
    setTimeout(() => {
      if (this.audioPlaying) {
        this.resetAudioButtons();
      }
    }, 5000); // 5 second timeout

    // Load the audio file
    audio.load();
  }

  /**
   * Reset all audio buttons to normal state
   */
  resetAudioButtons() {
    const buttons = document.querySelectorAll(".play-button");
    buttons.forEach((button) => {
      button.innerHTML = "Play Sound";
      button.disabled = false;
    });

    // Reset audio playing state
    this.audioPlaying = false;
  }

  /**
   * Render current instruction
   */
  render() {
    const instruction = this.getCurrentInstruction();
    const canGoBack = this.currentStep > 0;

    // Create audio examples if needed
    const audioHTML = instruction.hasAudio
      ? this.createAudioExamplesHTML(instruction.audioExamples)
      : "";

    const backButton = canGoBack
      ? `<button class="back-button" onclick="window.instructionsManager.previousStep()">
                <span>←</span> Back
            </button>`
      : `<button class="back-button" disabled>
                <span>←</span> Back
            </button>`;

    document.getElementById("app").innerHTML = `
            <div class="app-header">
                ${backButton}
            </div>
            <div class="app-content">
                <div class="group-info">Group ${this.userGroup}</div>
                <h1>${instruction.title}</h1>
                <div class="instruction-text">${instruction.text}</div>
                ${audioHTML}
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Press SPACEBAR to continue</div>
            </div>
        `;

    // Make instance globally accessible for onclick handlers
    window.instructionsManager = this;
  }

  /**
   * Cleanup event handlers
   */
  cleanup() {
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    // Clean up global reference
    if (window.instructionsManager === this) {
      delete window.instructionsManager;
    }
  }

  /**
   * Callback when instructions are complete
   * Override this method to handle trial start
   */
  onInstructionsComplete() {
    // This will be called when instructions are finished
    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <h1>Practice Trial</h1>
                <div class="group-info">Group ${this.userGroup}</div>
                <div class="instruction-text">
                    Commence practice trial with feedback enabled (disabled for the actual experiment)
                </div>
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Ready to begin!</div>
            </div>
        `;

    console.log("Instructions completed for group", this.userGroup);
  }

  /**
   * Get current step info for debugging
   * @returns {Object} Current step information
   */
  getStepInfo() {
    return {
      currentStep: this.currentStep,
      maxSteps: this.getMaxSteps(),
      userGroup: this.userGroup,
      isLastStep: this.currentStep === this.getMaxSteps() - 1,
      showingConfirmation: this.showingConfirmation,
    };
  }
}
